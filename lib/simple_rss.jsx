import { Meteor } from 'meteor/meteor';
import { Session } from 'meteor/session';
import React from 'react';
import { hydrate } from 'react-dom';
import { renderToNodeStream } from 'react-dom/server'
import { withTracker } from 'meteor/react-meteor-data';
import PropTypes from 'prop-types';
import { onPageLoad } from 'meteor/server-render';
import { ServerStyleSheet } from "styled-components";
import formatDistanceToNow from 'date-fns/formatDistanceToNow'

const DAY = 1000 * 60 * 60 * 24;
const initialArticleLimit = 200;

class App extends React.Component {
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

const renderFeed = (feed) => <Feed feed={feed} key={feed._id} />;
const FeedsPage = (props) => {
  return <div className="container">
    <AddFeed />
    <div>
      <span className="pad-top-5 col-xs-6 col-md-6"><h4><strong>Feed Title</strong></h4></span>
      <span className="col-xs-2 col-md-2 text-right"><h4><strong>Count</strong></h4></span>
      <span className="col-xs-4 text-right"><h4><strong>Last update</strong></h4></span>
    </div>
    <div>{props.feeds.map(renderFeed)}</div>
    </div>;
};

FeedsPage.propTypes = {
  feeds: PropTypes.arrayOf(PropTypes.object)
};

const FeedsPageContainer = withTracker(() => {
  const list = Feeds.find({}, {sort: {title: 1}})
  return {
    feeds: list.fetch().map((feed) => {
      feed.last_date = new Date(feed.last_date).getTime();
      return feed;
    })
  }
})(FeedsPage);

class Feed extends React.Component {
  render() {
    const {title, url, last_date, _id} = this.props.feed;
    return<div>
        <h5 className="col-xs-7 col-md-7 pull-left">
          <Remove _id={_id}/><a  href={url}> {title || url}</a>
        </h5>
        <h5 className="count col-xs-1 col-md-1 text-right">
          <FeedCountContainer feedId={_id}/>
        </h5>
        <h5 className="lastDate time col-xs-2 col-md-4 text-right pull-right">
          <TimeAgoContainer date={last_date}/></h5>
        </div>;
  }
};

Feed.propTypes = {
  title: PropTypes.string,
  url: PropTypes.string,
  last_date: PropTypes.string,
  _id: PropTypes.string
};

const FeedCount = React.memo((props) => {
  return <span>{props.count}</span>;
});

FeedCount.propTypes = {count: PropTypes.number};

const FeedCountContainer = withTracker((props) => {
  const count = Articles.find({feed_id: props.feedId},{fields:{_id:1}}).count()
  return { count };
})(FeedCount);


const Remove = React.memo((props) => {
  const handleClick = (e) => Meteor.call('removeFeed', props._id);

  return <a onClick={handleClick}>
           <i className="glyphicon glyphicon-remove-circle"></i>
         </a>;
});

class AddFeed extends React.Component {
  constructor(props) {
    super(props);
    this.state = {newURL: new String("")};
    this.handleSubmit = this.handleSubmit.bind(this);
    this.handleInput = this.handleInput.bind(this);
  }
  handleSubmit(e) {
    if (! this.state.newURL) {
      alert("URL can not be empty");
      return;
    }
    Meteor.call('addFeed', {url: this.state.newURL} , (err, res) => {
      if (err) alert(err);
      else this.setState({newURL: ""});
    });
    //Stop submit from navigating away from feeds page
    e.preventDefault();
  }

  handleInput(e) {
    this.setState({newURL: e.target.value});
  }

  render() {
    return <React.Fragment>
           <form className="form-inline pull-right col-sm-12" onSubmit={this.addFeed}>
             <span className="mt-1 col-xs-0 col-sm-0"/>
             <span className="input-group input-group-sm col-xs-12 col-sm-12 pull-right">
               <input onChange={this.handleInput} type="url" value={this.state.newURL} className="input-sm col-xs-12" placeholder="http://new URL/rss.xml" id="feedUrl" />
               <a id="addFeed" onClick={this.handleSubmit} onTouchStart={this.addFeed} type="submit" className="input-group-addon btn btn-primary btn-sm pull-right">Subscribe</a>
             </span>
           </form>
           <hr className="col-sm-12"/>
          </React.Fragment>;
  }
};

const renderArticle = (article) => <Article article={article} key={article._id} />;
const ArticlesPage =  (props) => {
  return <React.Fragment>
           <div id="stream">{props.articles.map(renderArticle)}</div>
        </React.Fragment>;
};

ArticlesPage.propTypes = {
  articles: PropTypes.array
};

const ArticlesPageContainer = withTracker(() => {
    let limit = Session.get('articleLimit')
    var list = Articles.find({}, {limit: limit, sort: {date: -1, title: 1}});
    return {
      articles: list.map((article) => {
        // Convert date so simple equality checks work and avoid rerender.
        article.date = new Date(article.date).getTime();
        // Some articles don't have titles and display nicer with placeholder.
        article.title = article.title || "Link";
        return article;
      })
    };
})(ArticlesPage);

const renderMarkup = (summary) => {
  return {__html: UniHTML.purify(summary)};
};

class Article extends React.PureComponent {
  // This could use more components but only the time ago really changes.
  render() {
    var {_id, title, source, summary, date, link} = this.props.article;
    return  <div id={_id} className="section">
              <div className="header row-fluid" name="source">
                <h2>{source}</h2>
                <span className="spacer"/>
                <time><TimeAgoContainer date={date} /></time>
              </div>
              <div className="article">
                <div className="header">
                  <h3>
                    <a href={link}>{title}</a>
                  </h3>
                </div>
                <div
                  className="description"
                  dangerouslySetInnerHTML={renderMarkup(summary)}/>
                  <div className="footer visible-xs">
                    <time><TimeAgoContainer date={date} /></time>
                  </div>
              </div>
            </div>;
  }
};

Article.propTypes = {
  article: PropTypes.object.isRequired
};

class ArticleSourceView extends React.PureComponent {
  render() {
    return <div className="header row-fluid" name="source">
              <h2>{this.props.source}</h2>
              <span className="spacer"/>
              {this.props.children}
            </div>;
  }
};

const TimeAgo = React.memo((props) => <span>{props.timeText}</span>);

TimeAgo.propTypes = {
  timeText: PropTypes.string.isRequired
}

const TimeAgoContainer = withTracker ((props) => {
  //Session.get triggers the autorun on the client
  if (Meteor.isClient) { Session.get('now') }
  return {
    timeText: props.date && formatDistanceToNow(props.date) + " ago" || ""
  };
})(TimeAgo);

if (Meteor.isClient) {
  onPageLoad(async sink => {
    Meteor.subscribe('articles', function(){
      hydrate(<AppContainer />,
        document.getElementById("app")
      );
    });
    (await import("/lib/simple_rss.jsx")).default;
  });
  Meteor.startup(() => {
    Meteor.subscribe('feeds');
    Session.set('now',Date.now());
    Session.set('page', 'articles');
    Session.set('articleLimit', initialArticleLimit);
    Meteor.setInterval( function() {
      Session.set('now',new Date());
    }, 1000 * 60);
  });
} else {
  onPageLoad(sink => {
    const start = new Date()
    const sheet = new ServerStyleSheet();
    //need to rewrite this for userID;
    const userId = "nullUser";
    const feedList = Meteor.users.findOne(
      {_id: userId},
      {fields: {feedList: 1}}
    ).feedList;
    const rawList = Articles.find(
      {feed_id: {$in: feedList}},
      {limit: initialArticleLimit, sort: {date: -1, title: 1}}
    );
    const list = rawList.map((article) => {
      article.date = new Date(article.date).getTime();
      article.title = article.title || "Link";
      return article;
    });
    const appJSX = sheet.collectStyles(
      <ArticlesPage articles={list} />
    );
    const htmlStream = sheet.interleaveWithNodeStream(
      renderToNodeStream(appJSX)
    );
    sink.renderIntoElementById("app", htmlStream);
  });
}
