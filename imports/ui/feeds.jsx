import React, { useState, useEffect, memo } from 'react';
import { Link } from 'react-router-dom';
import PropTypes from 'prop-types';
import { Feeds } from '/imports/api/simple_rss';
import { TimeAgoContainer } from './timeAgo';
import { initialArticleLimit } from '/imports/api/simple_rss';
import { useQuery, useMutation, gql, useLazyQuery } from '@apollo/client';
import { USER_QUERY, FEEDS_QUERY } from '/imports/api/query';
import { ADD_FEED, REMOVE_FEED } from '/imports/api/mutation';
import orderBy from 'lodash.orderby';

export const FeedsPageWithContainer = () => (
  <div id="feed-container">
    <FeedsPage />
  </div>
);

// Spread the feed object (...) to avoid rerendering
const renderFeed = (feed) => <Feed {...feed} key={feed._id} />;

export const FeedsPage = () => {
  const self = this;
  const {loading, error, data} = useQuery(
    FEEDS_QUERY,{
      variables: {userId: "nullUser"},
      fetchPolicy: "cache-and-network"
    }
  );

  if (error) { console.log(error) }
  let feedDiv = <div />;
  if (data) {
    const sortedFeeds = orderBy(data.feeds, [feed => feed.title.toLowerCase()]);
    feedDiv = <div>{sortedFeeds.map(renderFeed)}</div>;
  }
  return (
    <>
      <AddFeed />
      <span className="pad-top-5 col-xs-6 col-md-6"><h4><strong>Feed Title</strong></h4></span>
      <span className="col-xs-2 col-md-2 text-right"><h4><strong>Count</strong></h4></span>
      <span className="col-xs-4 text-right"><h4><strong>Last update</strong></h4></span>
      {feedDiv}
    </>
  );
};

const Feed = memo(({_id, url, title, last_date, count}) => {
  const self = this;
  return <React.Fragment>
           <h5 className="col-xs-7 col-md-7 pull-left">
             <Remove _id={_id} />
             <a  href={url}> {title || ""}</a>
           </h5>
           <h5 className="count col-xs-1 col-md-1 text-right">
             <FeedCount count={count}/>
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
  _id: PropTypes.string.isRequired,
  count: PropTypes.number.isRequired
};

Feed.displayName = 'Feed';

const FeedCount = ({count}) => {

  return <span>{count}</span>;
};

FeedCount.propTypes = {count: PropTypes.number};

const Remove = memo(({_id}) => {
  const [onDeleteHandler] = useMutation(REMOVE_FEED, {
    update(cache, { data: { removeFeed } }) {
      let articlesToRemove = [];
      cache.modify({
        id: "ROOT_QUERY",
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
        id: "ROOT_QUERY",
        fields: {
          feeds(existingRefs, { readField }) {
            let newRef = cache.writeFragment({
              data: addFeed,
              fragment: gql`
                fragment NewFeed on Feed {
                  _id
                  title
                  url
                  last_date
                  count
                }
              `
            });
            if (existingRefs.some(
              ref => readField('url', ref) === addFeed.url
            )) {
              return existingRefs;
            }

            return [...existingRefs, newRef];
          },
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
    const _id = Feeds._makeNewID();
    setNewURL("");
    addHandler({variables: {_id, url},
      optimisticResponse: {
        __typename: "Mutation",
        addFeed: {
          _id: _id,
          title: "adding...",
          url: url,
          last_date: Date.now(),
          count: 0,
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
