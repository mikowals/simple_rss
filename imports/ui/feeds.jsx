
import { Meteor } from 'meteor/meteor';
import { withTracker, useTracker } from 'meteor/react-meteor-data';
import React, { useState, useEffect, memo } from 'react';
import PropTypes from 'prop-types';
import { Feeds, Articles } from '/imports/api/simple_rss';
import { TimeAgoContainer } from './timeAgo';
import { initialArticleLimit } from '/imports/api/simple_rss';

// Spread the feed object (...) to avoid rerendering
const renderFeed = (feed) => <Feed {...feed} key={feed._id} />;

export const FeedsPage1 = () => {
  const feeds = useTracker(() => {
    const list = Feeds.find({}, {sort: {title: 1}})
    return list.map((feed) => {
        feed.last_date = new Date(feed.last_date).getTime();
        return feed;
    });
  }, []); // '[]' here allows memoization.
  return (
    <div className="container">
      <AddFeed />
      <span className="pad-top-5 col-xs-6 col-md-6"><h4><strong>Feed Title</strong></h4></span>
      <span className="col-xs-2 col-md-2 text-right"><h4><strong>Count</strong></h4></span>
      <span className="col-xs-4 text-right"><h4><strong>Last update</strong></h4></span>
      <div>{feeds.map(renderFeed)}</div>
    </div>
  );
};

export const FeedsPage = ({feeds}) => {
  return (
    <div className="container">
      <AddFeed />
      <span className="pad-top-5 col-xs-6 col-md-6"><h4><strong>Feed Title</strong></h4></span>
      <span className="col-xs-2 col-md-2 text-right"><h4><strong>Count</strong></h4></span>
      <span className="col-xs-4 text-right"><h4><strong>Last update</strong></h4></span>
      <div>{feeds.map(renderFeed)}</div>
    </div>
  );
};


const Feed = memo(({_id, url, title, last_date}) => {
    return <React.Fragment>
             <h5 className="col-xs-7 col-md-7 pull-left">
               <Remove _id={_id}/>
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
  const count = useTracker(() => {
    const articles = Articles.find({feed_id: feedId},{fields:{_id:1}});
    return articles.count();
  }, [feedId]);

  return <span>{count}</span>;
};

FeedCount.propTypes = {feedId: PropTypes.string.isRequired};

const Remove = memo(({_id}) => {
  const handleClick = (e) => Meteor.call('removeFeed', _id);
  return <a onClick={handleClick}>
           <i className="glyphicon glyphicon-remove-circle"></i>
         </a>;
});

Remove.displayName = "Remove";

const AddFeed = memo((props) => {
  let [newURL, setNewURL] = useState("");
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
    Meteor.call('addFeed', {url: url} , (err, res) => {
      if (err) {
        setNewURL(url);
        alert(err);
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
