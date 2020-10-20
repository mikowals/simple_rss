
import { Random } from 'meteor/random';
import React, { useState, useEffect, memo } from 'react';
import { Link } from 'react-router-dom';
import PropTypes from 'prop-types';
import { Feeds, Articles } from '/imports/api/simple_rss';
import { TimeAgoContainer } from './timeAgo';
import { initialArticleLimit } from '/imports/api/simple_rss';
import { useQuery, useMutation, gql } from '@apollo/client';
import { FEED_IDS, FEEDS_QUERY, FEED_COUNT } from '/imports/api/query';
import { ADD_FEED, REMOVE_FEED } from '/imports/api/mutation';
import { Meteor } from 'meteor/meteor';

const MaybeLink = () => {
  if (Meteor.isServer) return null;
  return <Link to="/articles">Articles</Link>;
}
export const FeedsPageWithContainer = () => (
  <div id="feed-container">
    <FeedsPage />
  </div>
);

// Spread the feed object (...) to avoid rerendering
const renderFeed = (feed) => <Feed {...feed} key={feed._id} />;

export const FeedsPage = () => {
  const self = this;
  const {loading, error,  data} = useQuery(
    FEEDS_QUERY,{
      variables: {id: "nullUser"},
      fetchPolicy: "cache-and-network",
      nextFetchPolicy: "cache-first"
    }
  );
  if (error) { console.log(error) }
  let feedDiv = <div />;
  if (data) {
    feedDiv = <div>{data.feeds.map(renderFeed)}</div>;
  }
  return (
      <>
      <AddFeed />
      <span className="pad-top-5 col-xs-6 col-md-6"><h4><strong>Feed Title</strong></h4></span>
      <span className="col-xs-2 col-md-2 text-right"><h4><strong>Count</strong></h4></span>
      <span className="col-xs-4 text-right"><h4><strong>Last update</strong></h4></span>
      {feedDiv}
      {MaybeLink}
      </>
  );
};

const Feed = memo(({_id, url, title, last_date}) => {
  const self = this;
  return <React.Fragment>
           <h5 className="col-xs-7 col-md-7 pull-left">
             <Remove _id={_id} />
             <a  href={url}> {title || ""}</a>
           </h5>
           <h5 className="count col-xs-1 col-md-1 text-right">
             <FeedCount feedId={_id}/>
           </h5>
           <h5 className="lastDate time col-xs-2 col-md-4 text-right pull-right">
             <TimeAgoContainer date={last_date} />
           </h5>
         </React.Fragment>;
});

Feed.propTypes = {
  title: PropTypes.string,
  url: PropTypes.string.isRequired,
  last_date: PropTypes.number,
  _id: PropTypes.string.isRequired
};

Feed.displayName = 'Feed';

const FeedCount = ({feedId}) => {
  const {loading, error, data} = useQuery(FEED_COUNT, {
    variables: {id: feedId},
    pollInterval: 2 * 60 * 1000,
    fetchPolicy: "cache-and-network"
  });
  let count = 0;
  if (data) {
    count = data.articlesCountByFeed;
  } else if (error) {
    console.log(error);
  }

  return <span>{count}</span>;
};

FeedCount.propTypes = {feedId: PropTypes.string.isRequired};

const Remove = memo(({_id}) => {
  const [onDeleteHandler] = useMutation(REMOVE_FEED, {
    update(cache, { data: { removeFeed } }) {
      let articlesToRemove = [];
      cache.modify({
        fields: {
          feeds(existingFeedRefs, { readField }) {
            return existingFeedRefs.filter(
              feedRef => removeFeed._id !== readField('_id', feedRef)
            );
          },
          articles(existingArticleRefs, { readField }) {
            articlesToRemove = existingArticleRefs.filter(
              ref => readField("feed_id", ref) === removeFeed._id
            );
            return existingArticleRefs.filter(
              ref => readField("feed_id", ref) !== removeFeed._id
            );
          }
        },
      });
      cache.evict({ id: cache.identify(removeFeed) });
      articlesToRemove.forEach(ref => cache.evict({id: cache.identify(ref)}));
      cache.gc();
    }
  });
  const handleClick = (e) => {
    onDeleteHandler({
      variables: {id: _id},
      optimisticResponse: {
        __typename: "Mutation",
        removeFeed: {
          __typname: "Feed",
          _id: _id
        }
      }
    })
  };
  return <a onClick={handleClick}>
           <i className="glyphicon glyphicon-remove-circle"></i>
         </a>;
});

Remove.displayName = "Remove";

const AddFeed = memo(() => {
  let [newURL, setNewURL] = useState("");
  let [addHandler] = useMutation( ADD_FEED, {
    update(cache, { data: { addFeed } }) {
      cache.modify({
        fields: {
          feeds(existingRefs, { readField }) {
            let newRef = cache.writeFragment({
              id: cache.identify(addFeed),
              data: addFeed,
              fragment: gql`
                fragment NewFeed on Feed {
                  _id
                  title
                  url
                  last_date
                }
              `
            });
            if (existingRefs.some(
              ref => readField('url', ref) === addFeed.url
            )) {
              return existingRefs;
            }
            let ii = 0;
            while (
              ii < existingRefs.length &&
                readField('title', existingRefs[ii]).toLowerCase() < addFeed.title.toLowerCase()
            ) {
              ii++
            }
            return [...existingRefs.slice(0, ii), newRef, ...existingRefs.slice(ii)];
          },
          articles(articleRefs, { INVALIDATE }) {
            return INVALIDATE;
          }
        }
      });
    }
  });
  const handleSubmit = (e) => {
    //Stop submit from navigating away from feeds page.
    e.preventDefault();
    e.stopPropagation();
    if (! newURL) {
      alert("URL can not be empty");
      return;
    }

    // Getting the new feed info can be slow.
    // Switch URL to blank so users see action before calling server.
    // Replace with erroring URL so user can check for typos.
    const url = newURL
    setNewURL("");
    addHandler({variables: {url: url},
      optimisticResponse: {
        __typename: "Mutation",
        addFeed: {
          _id: Random.id(12),
          title: "adding...",
          url: url,
          last_date: Date.now(),
          __typename: "Feed"
        }
      }
    });
  };

  const handleInput = (e) => setNewURL(e.target.value);

  return <React.Fragment>
         <form className="form-inline pull-right col-sm-12" onSubmit={handleSubmit}>
           <span className="mt-1 col-xs-0 col-sm-0"/>
           <span className="input-group input-group-sm col-xs-12 col-sm-12 pull-right">
             <input onChange={handleInput} type="url" value={newURL} className="input-sm col-xs-12" placeholder="http://new URL/rss.xml" id="feedUrl" />
             <a id="addFeed" onClick={handleSubmit} onTouchStart={handleSubmit} type="submit" className="input-group-addon btn btn-primary btn-sm pull-right">Subscribe</a>
           </span>
         </form>
         <hr className="col-sm-12"/>
        </React.Fragment>;
});

AddFeed.diplayName = "AddFeed";
