import { Meteor } from 'meteor/meteor';
import React from 'react';
import { render } from 'react-dom';
import { withTracker } from 'meteor/react-meteor-data';
import { Tracker } from 'meteor/tracker';
import PropTypes from 'prop-types';

const DAY = 1000 * 60 * 60 * 24;

function ArticlesPage(props) {
  function renderArticle(article) {
    return <Article article={article} key={article._id}/>
  };

  return  <div id="stream">
            { props.loading ? <h1>loading...</h1> : props.articles.map(renderArticle) }
          </div>;
};

ArticlesPage.propTypes = {
  loading: PropTypes.bool,
  listExists: PropTypes.bool,
  articles: PropTypes.array
};

const ArticlesPageContainer = withTracker(() => {
  const articlesHandle = Meteor.subscribe('articles');
  const loading = !articlesHandle.ready();
  const list = Articles.find();
  const listExists = !loading && !!list;
  return {
    loading,
    listExists,
    articles: listExists ? list.fetch() : [],
  };
})(ArticlesPage);

class Article extends React.Component {
  shouldComponentUpdate(nextProps) {
    return nextProps.article !== this.props.article;
  };

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
  };
};

Article.propTypes = {
  article: PropTypes.object.isRequired
};

class ArticleSectionView extends React.Component {
  render(){
    return <div 
              id={this.props._id} 
              className="section">
                {this.props.children}
            </div>;
  }
};

class ArticleSourceView extends React.Component {
  render(){
    return <div className="header row-fluid">
              <h2>{this.props.source}</h2>
              <span className="spacer"/>
              <time>
                {this.props.children}
              </time>
            </div>;
  }
};

class ArticleFooterView extends React.Component {
  render(){
    return <div className="footer visible-xs">
              <time>
                {this.props.children}
              </time>
            </div>;
  }
};

class TimeAgo extends React.Component {
  render() {
    return <span>{this.props.timeText}</span>;
  };
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
  Meteor.startup(() => {
    Session.set('now',new Date());
    Meteor.setInterval( function() {
      Session.set('now',new Date());
    }, 1000 * 60);
    render(<ArticlesPageContainer/>, document.body);
  });
}

