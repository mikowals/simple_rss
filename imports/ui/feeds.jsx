
import { Meteor } from 'meteor/meteor';
import { withTracker } from 'meteor/react-meteor-data';
import React, { useState, useEffect, memo } from 'react';
import PropTypes from 'prop-types';
import { Feeds, Articles } from '/imports/api/simple_rss';
import { TimeAgoContainer } from './timeAgo';
import { initialArticleLimit } from '/imports/api/simple_rss';

// Spread the feed object (...) to avoid rerendering
const renderFeed = (feed) => <Feed {...feed} key={feed._id} />;

const FeedsPage = (props) => (
  <div className="container">
    <AddFeed />
    <span className="pad-top-5 col-xs-6 col-md-6"><h4><strong>Feed Title</strong></h4></span>
    <span className="col-xs-2 col-md-2 text-right"><h4><strong>Count</strong></h4></span>
    <span className="col-xs-4 text-right"><h4><strong>Last update</strong></h4></span>
    <div>{props.feeds.map(renderFeed)}</div>
  </div>
);

FeedsPage.propTypes = {
  feeds: PropTypes.arrayOf(PropTypes.object)
};

export const FeedsPageContainer = withTracker(() => {
  const list = Feeds.find({}, {sort: {title: 1}})
  return {
    feeds: list.fetch().map((feed) => {
      feed.last_date = new Date(feed.last_date).getTime();
      return feed;
    })
  }
})(FeedsPage);

FeedsPageContainer.displayName = "FeedsPageContainer";

class Feed extends React.PureComponent {
  render() {
    const {_id, url, title, last_date} = this.props;
    return <React.Fragment>
             <h5 className="col-xs-7 col-md-7 pull-left">
               <Remove _id={_id}/>
               <a  href={url}> {title || ""}</a>
             </h5>
             <h5 className="count col-xs-1 col-md-1 text-right">
               <FeedCountContainer feedId={_id}/>
             </h5>
             <h5 className="lastDate time col-xs-2 col-md-4 text-right pull-right">
               <TimeAgoContainer date={last_date}/>
             </h5>
           </React.Fragment>;
  }
};

Feed.propTypes = {
  title: PropTypes.string,
  url: PropTypes.string.isRequired,
  last_date: PropTypes.number,
  _id: PropTypes.string.isRequired
};

const FeedCount = memo((props) => {
  return <span>{props.count}</span>;
});

FeedCount.propTypes = {count: PropTypes.number};

const FeedCountContainer = withTracker((props) => {
  const count = Articles.find({feed_id: props.feedId},{fields:{_id:1}}).count()
  return { count };
})(FeedCount);

FeedCountContainer.displayName = "FeedCountContainer";

const Remove = memo((props) => {
  const handleClick = (e) => Meteor.call('removeFeed', props._id);
  return <a onClick={handleClick}>
           <i className="glyphicon glyphicon-remove-circle"></i>
         </a>;
});

class AddFeed extends React.PureComponent {
  constructor(props) {
    super(props);
    this.state = {newURL: new String("")};
    this.handleSubmit = this.handleSubmit.bind(this);
    this.handleInput = this.handleInput.bind(this);
  }
  handleSubmit(e) {
    //Stop submit from navigating away from feeds page
    e.preventDefault();
    e.stopPropagation();
    if (! this.state.newURL) {
      alert("URL can not be empty");
      return;
    }
    Meteor.call('addFeed', {url: this.state.newURL} , (err, res) => {
      if (err) alert(err);
      else this.setState({newURL: ""});
    });

  }

  handleInput(e) {
    this.setState({newURL: e.target.value});
  }

  render() {
    return <React.Fragment>
           <form className="form-inline pull-right col-sm-12" onSubmit={this.handleSubmit}>
             <span className="mt-1 col-xs-0 col-sm-0"/>
             <span className="input-group input-group-sm col-xs-12 col-sm-12 pull-right">
               <input onChange={this.handleInput} type="url" value={this.state.newURL} className="input-sm col-xs-12" placeholder="http://new URL/rss.xml" id="feedUrl" />
               <a id="addFeed" onClick={this.handleSubmit} onTouchStart={this.handleSubmit} type="submit" className="input-group-addon btn btn-primary btn-sm pull-right">Subscribe</a>
             </span>
           </form>
           <hr className="col-sm-12"/>
          </React.Fragment>;
  }
};
