import { Meteor } from 'meteor/meteor';
import { Session } from 'meteor/session';
import React from 'react';
import { hydrate } from 'react-dom';
import { renderToNodeStream } from 'react-dom/server'
import { withTracker } from 'meteor/react-meteor-data';
import PropTypes from 'prop-types';
import { onPageLoad } from 'meteor/server-render';
import { ServerStyleSheet } from "styled-components";

const DAY = 1000 * 60 * 60 * 24;

class App extends React.PureComponent {
  render(){
    return this.props.location === "articles" ?
        <ArticlesPageContainer /> :
        <FeedsPageContainer />;
  };
};

const AppContainer = withTracker(() => {
    return {
        location: Session.get('page')
    }
})(App);

const FeedsPage = (props) => {
  function renderChildren(feeds){
    return feeds.map((feed) => <Feed className="feed row" feed={feed} key={feed._id}/>);
  };

  return <div className="container">
    <div>
      <span className="col-xs-7 col-md-7"><h4><strong>Feed Title</strong></h4></span>
      <span className="col-xs-2 col-md-2 text-right"><h4><strong>Count</strong></h4></span>
      <span className="col-xs-3 text-right"><h4><strong>Last update</strong></h4></span>
    </div>
    <div>{renderChildren(props.feeds)}</div>
    </div>;
};

FeedsPage.propTypes = {
  feeds: PropTypes.arrayOf(PropTypes.object)
};

const FeedsPageContainer = withTracker(() => {
  const list = Feeds.find({}, {sort: {title: 1}})
  return {
    feeds: list.fetch()
  }
})(FeedsPage);

const Feed = (props) => {
  const {title, url, last_date, _id} = props.feed;
  return<div>
      <h5 className="col-xs-8 col-md-8 pull-left">
        <Remove _id={_id} /> {title || url}
      </h5>
      <h5 className="count col-xs-1 col-md-1 text-right">
        <FeedCountContainer feedId={_id}/>
      </h5>
      <h5 className="lastDate time col-xs-2 col-md-3 text-right pull-right">
        <TimeAgoContainer date={last_date}/></h5>
      </div>;
};

Feed.propTypes = {
  title: PropTypes.string,
  url: PropTypes.string,
  last_date: PropTypes.string,
  _id: PropTypes.string
};

const FeedCount = (props) => {
  return <span>{props.count}</span>;
};

FeedCount.propTypes = {count: PropTypes.number};

const FeedCountContainer = withTracker((props) => {
  const count = Articles.find({feed_id: props.feedId},{fields:{_id:1}}).count()
  return { count };
})(FeedCount);

const Remove = (props) => {
  function handleClick(e){
    Meteor.call('removeFeed', props._id);
  };

  return <a onClick={handleClick}>
           <i className="glyphicon glyphicon-remove-circle"></i>
         </a>;
};

const ArticlesPage = (props) => {
  function renderArticle(article) {
    return <Article article={article} key={article._id}/>
  };

  return  <div id="stream">
            { props.articles.map(renderArticle) }
          </div>;
};

ArticlesPage.propTypes = {
  articles: PropTypes.array
};

const ArticlesPageContainer = withTracker(() => {
  const list = Articles.find({}, {limit: 20, sort: {date: -1}});
  console.log("articles updated!")
  return {
    articles: list.fetch()
  };
})(ArticlesPage);


class Article extends React.PureComponent {
  render() {
    var {_id, title, source, summary, date, link} = this.props.article;
    title = title || "Link";
    function renderMarkup() { return {__html: UniHTML.purify(summary)}; };
    return  <ArticleSectionView _id={_id}>
              <ArticleSourceView source={source}>
                <TimeAgoContainer
                  className="hidden-xs time pull-right"
                  date={date}/>
              </ArticleSourceView>
              <div className="article">
                <div className="header">
                  <h3>
                    <a href={link}>{title}</a>
                  </h3>
                </div>
                <div
                  className="description"
                  dangerouslySetInnerHTML={renderMarkup()}/>
                <ArticleFooterView>
                    <TimeAgoContainer date={date}/>
                </ArticleFooterView>
              </div>
            </ArticleSectionView>;
  }
};

Article.propTypes = {
  article: PropTypes.object.isRequired
};

class ArticleSectionView extends React.PureComponent {
  render() {
    return <div id={this.props._id} className="section">
             {this.props.children}
           </div>;
  }
};

class ArticleSourceView extends React.PureComponent {
  render() {
    return <div className="header row-fluid" name="source">
              <h2>{this.props.source}</h2>
              <span className="spacer"/>
              <time>
                {this.props.children}
              </time>
            </div>;
  }
};

const ArticleFooterView = (props) => {
    return <div className="footer visible-xs">
              <time>
                {props.children}
              </time>
            </div>;
};

const TimeAgo = (props) => {
  return <span>{props.timeText}</span>;
};

TimeAgo.propTypes = {
  timeText: PropTypes.string.isRequired
}

const TimeAgoContainer = withTracker ((props) => {
  const now = Meteor.isServer ? new Date() : Session.get("now");
  return {
    timeText: timeAgoText(now, props.date)
  };
})(TimeAgo);

var timeAgoText = function(now, aDate) {
  now = new Date(now);
  aDate = new Date(aDate);
  var timeAgoMS = ( now -  aDate )
  const days = Math.floor(timeAgoMS / DAY)
  if (days >= 2) return days + " days ago";
  if (days  >= 1) return days + " day ago";
  const hours = Math.floor(timeAgoMS / (1000 * 60 * 60))
  if (hours  >= 2 ) return hours + " hours ago";
  if (hours  >= 1 ) return hours + " hour ago";
  const minutes = Math.floor(timeAgoMS / (1000 * 60))
  if ( minutes >= 2) return minutes + " minutes ago";
  return "about a minute ago";
}

if (Meteor.isClient) {
  onPageLoad(async sink => {
    Meteor.subscribe('articles', function(){
      hydrate(<AppContainer />,
        document.getElementById("app")
      );
      console.log("hydrated!");
    });
    (await import("/lib/simple_rss.jsx")).default;
    console.log('onPageLoad finished!')
  });
  Meteor.startup(() => {
    Meteor.subscribe('feeds');
    Session.set('now',new Date());
    Session.set('page', 'articles');
    Meteor.setInterval( function() {
      Session.set('now',new Date());
    }, 1000 * 60);
  });
} else {
  onPageLoad(sink => {
    const start = new Date()
    const sheet = new ServerStyleSheet();
    const list = Articles.find({}, {limit: 20, sort: {date: -1}});
    const appJSX = sheet.collectStyles(
      <ArticlesPage articles={list.fetch()} />
    );
    const htmlStream = sheet.interleaveWithNodeStream(
      renderToNodeStream(appJSX)
    );
    sink.renderIntoElementById("app", htmlStream);
  });
}
