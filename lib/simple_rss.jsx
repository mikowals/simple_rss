
import { Meteor } from 'meteor/meteor';
import { withTracker } from 'meteor/react-meteor-data';
import { Session } from 'meteor/session';
import React, { useState, useEffect, memo } from 'react';
import { unstable_createRoot } from 'react-dom';
import PropTypes from 'prop-types';
import { onPageLoad } from 'meteor/server-render';
import { ServerStyleSheet } from "styled-components";
import { renderToNodeStream } from 'react-dom/server';
import formatDistanceToNow  from 'date-fns/formatDistanceToNow';

const DAY = 1000 * 60 * 60 * 24;
const initialArticleLimit = 40;

const App = (props) => {
    return props.location === "articles" ?
        <ArticlesPageContainer /> :
        <FeedsPageContainer />;
};

const AppContainer = withTracker(() => {
    return {
        location: Session.get('page')
    }
})(App);

// Spread the feed object (...) to avoid rerendering
const renderFeed = (feed) => <Feed {...feed} key={feed._id} />;

const FeedsPage = (props) => {
  return <div className="container">
           <AddFeed />
           <span className="pad-top-5 col-xs-6 col-md-6"><h4><strong>Feed Title</strong></h4></span>
           <span className="col-xs-2 col-md-2 text-right"><h4><strong>Count</strong></h4></span>
           <span className="col-xs-4 text-right"><h4><strong>Last update</strong></h4></span>
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

class AddFeed extends React.Component {
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

// Spread the article object (...) to avoid new object causing rerender.
const renderArticle = (article) => {
  return <ArticleWithTimeAgo {...article} key={article._id} />;
};

const articlesEqual = (prev, next) => {
  if (prev.articles.length !== next.articles.length) return false;
  for (let ii = 0; ii < prev.articles.length; ii++) {
    const prevValues = Object.values(prev.articles[ii]);
    const nextValues = Object.values(next.articles[ii]);
    for (let jj = 0; jj < prevValues.length; jj++){
      if (prevValues[jj] !== nextValues[jj]) {
        console.log("Articles not equal ", ii, prevValues, nextValues);
        return false;
      }
    }
  }
  return true;
};

const ArticlesPage = memo((props) => {
  return <div id="stream">{props.articles.map(renderArticle)}</div>
}, articlesEqual);

ArticlesPage.propTypes = {
  articles: PropTypes.array
};

ArticlesPage.displayName = "ArticlesPage";

const ArticlesPageContainer = withTracker(() => {
    let limit = Session.get('articleLimit')
    var list = Articles.find({}, {limit: limit, sort: {date: -1, _id: 1}});
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

ArticlesPageContainer.displayName = "ArticlesPageContainer";

const Article = (props) => {
    var {_id, title, source, summary, link, timeText} = props;
    // TimeAgo occurs twice.  Once in SourceHeader and once in the footer.
    return  <div id={_id} className="section">
              <SourceHeader source={source} timeText={timeText} />
              <div className="article">
                <TitleAndSummary link={link} title={title} summary={summary} />
                <div className="footer visible-xs">
                  <time><TimeAgo timeText={timeText} /></time>
                </div>
              </div>
            </div>;
};

Article.propTypes = {
  _id: PropTypes.string.isRequired,
  timeText: PropTypes.string.isRequired,
  title: PropTypes.string,
  source: PropTypes.string.isRequired,
  summary: PropTypes.string,
  link: PropTypes.string.isRequired,
};

const SourceHeader = (props) => {
    const {source, timeText} = props;
    return <div className="header row-fluid" name="source">
             <h2>{source}</h2>
             <span className="spacer"/>
             <time><TimeAgo timeText={timeText} /></time>
           </div>;
};

const TitleAndSummary = React.memo((props) => {
    const {link, title, summary} = props;
    return <React.Fragment>
           <div className="header">
             <h3>
               <a href={link}>{title}</a>
            </h3>
          </div>
          <div className="description"
               dangerouslySetInnerHTML={{__html: UniHTML.purify(summary)}}/>
          </React.Fragment>;
});

TitleAndSummary.displayName = "TitleAndSummary";
const TimeAgo = React.memo((props) => <span>{props.timeText}</span>);

TimeAgo.propTypes = {
  timeText: PropTypes.string.isRequired
}

TimeAgo.displayName = "TimeAgo";

function getDisplayName(WrappedComponent) {
  return WrappedComponent.displayName || WrappedComponent.name || 'Component';
}

// Transform date property into time ago text that updates automatically.
// Only past times in minues require frequent text changes.
const withTimeText = (WrappedComponent) => {
  const getTimeText = (date) => {
    return (date && formatDistanceToNow(date) + " ago") || "";
  };
  // Set time update frequency to be longer when time text will only change hourly.
  // Sync time updates with system clock so times render together for user.
  const msUntilUpdate = (timeText) => {
    const timeToUpdate = (timeText.includes("hour") ? 15 : 1) * 60 * 1000;
    const msSinceClockMinute = (Date.now() % (60 * 1000));
    return timeToUpdate - msSinceClockMinute;
  };

  // Memo because given the same props a rerender should produce the same
  // output as is currently displayed.
  const NewComponent = memo((props) => {
    const {date, ...passThroughProps} = props;
    const [timeText, setTimeText] = useState(getTimeText(props.date));
    useEffect(() => {
      let innerTimeout = null;
      // Each run sets a new timeout length based on current text.
      let intervalFn = () => {
        newTimeText = getTimeText(props.date);
        setTimeText(newTimeText);
        innerTimeout = setTimeout(intervalFn, msUntilUpdate(newTimeText));
      }
      const timeout = setTimeout(intervalFn, msUntilUpdate(timeText));
      return () => {
        timeout && clearTimeout(timeout);
        innerTimeout && clearTimeout(innerTimeout);
      };
    }, [props.date]);

    return <WrappedComponent {...passThroughProps} timeText={timeText} />;
  });

  NewComponent.displayName = "withTimeText(" + getDisplayName(WrappedComponent) + ")";
  return NewComponent;
}

const ArticleWithTimeAgo = withTimeText(Article);
//ArticleWithTimeAgo.displayName = "ArticleWithTimeAgo";

const TimeAgoContainer = withTimeText(TimeAgo);
TimeAgoContainer.propTypes = {
  date: PropTypes.number.isRequired
};

/*

const TimeAgoContainer = withTracker ((props) => {
  //Session.get triggers the autorun on the client
  if (Meteor.isClient) { Session.get('now') }
  return {
    timeText: props.date && formatDistanceToNow(props.date) + " ago" || ""
  };
})(TimeAgo);

TimeAgoContainer.displayName = "TimeAgoContainer";
*/
if (Meteor.isClient) {
  onPageLoad( sink => {
    Meteor.subscribe('articles', function(){
      const rootElement = document.getElementById("app");
      unstable_createRoot(rootElement, {
        hydrate: true
      }).render(<AppContainer location="articles"/>);
      //hydrate(<AppContainer />,
      //  document.getElementById("app")
      //);
    });
    //(await import("/lib/simple_rss.jsx")).default;
  });
  Meteor.startup(() => {
    Meteor.subscribe('feeds');
    Session.set('page', 'articles');
    Session.set('articleLimit', initialArticleLimit);
  });
} else {
  onPageLoad(sink => {
    const sheet = new ServerStyleSheet();
    //need to rewrite this for real userID using cookies;
    const userId = "nullUser";
    const feedList = Meteor.users.findOne(
      {_id: userId},
      {fields: {feedList: 1}}
    ).feedList;
    const articlesCursor = Articles.find(
      {feed_id: {$in: feedList}},
      {limit: initialArticleLimit, sort: {date: -1, _id: 1}}
    );
    const articles = articlesCursor.map((article) => {
      article.date = new Date(article.date).getTime();
      article.title = article.title || "Link";
      return article;
    });
    const appJSX = sheet.collectStyles(<ArticlesPage articles={articles} />);
    const htmlStream = sheet.interleaveWithNodeStream(
      renderToNodeStream(appJSX)
    );
    sink.renderIntoElementById("app", htmlStream);
  });
}
