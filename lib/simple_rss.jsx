import { Meteor } from 'meteor/meteor'
import React from 'react';
import { render } from 'react-dom'
import { withTracker } from 'meteor/react-meteor-data';
import PropTypes from 'prop-types'

function renderArticle(article) {
  return <Article article={article} key={article._id}/>
};

function ArticlesPage(props) {
  
  return  <div id="stream">
            {props.loading ? <h1>loading...</h1> : props.articles.map(renderArticle) }
          </div>;
};

ArticlesPage.propTypes = {
  loading: PropTypes.bool,
  listExists: PropTypes.bool,
  articles: PropTypes.array
};

const ArticlesPageContainer = withTracker(() => {
  const articlesHandle = Meteor.subscribe('Articles');
  const loading = !articlesHandle.ready();
  const list = Articles.find();
  const listExists = !loading && !!list;
  return {
    loading,
    listExists,
    articles: listExists ? list.fetch() : [],
  };
})(ArticlesPage);

/*const ArticlesPageContainer = withTracker(({}) => {
  const articlesHandle = Meteor.subscribe("articles");
  const loading = !articlesHandle.ready();
  const list = Articles.find({});
  const listExists = !loading && !!list;

  return {
    loading,
    listExists,
    articles: listExists ? list.fetch() : []
  };
})(ArticlesPage);*/

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
                <TimeAgo 
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
                    <TimeAgo 
                      className="timeago" 
                      date={date}/>
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
  componentWillMount() {
    var now;
    if (Meteor.isServer){
      now = new Date();
      return this.setState({timeText: timeAgoText(now, this.props.date)});
    } else {
      this.computation = Tracker.autorun( (c) => {
        now = Session.get('now');
        this.setState({timeText: timeAgoText(now, this.props.date)});
      });
    }
  };
  shouldComponentUpdate(nextProps,nextState){
    return this.state.timeText !== nextState.timeText;
  };
  componentWillUnmount() {
    this.computation && this.computation.stop();
  };
  render() {
    return <span>{this.state.timeText}</span>;
  };
};

var timeAgoText = function( now, aDate) {
  now = new Date(now);
  aDate = new Date(aDate);
  var days = ( now -  aDate ) / DAY

  var timeText = null;
  if (Math.floor(days )  >= 2) timeText = Math.floor(days ) + " days ago";
  else if (Math.floor(days )  >= 1) timeText = Math.floor(days ) + " day ago";
  else if (Math.floor(days  * 24)  >= 2 ) timeText = Math.floor(days * 24) + " hours ago";
  else if (Math.floor(days * 24)  >= 1 ) timeText = Math.floor(days  * 24) + " hour ago";
  else if (Math.floor(days  * 24 * 60) >= 2) timeText = Math.floor(days * 24 * 60) + " minutes ago";
  else {
    timeText = "about a minute ago";
  }
  return timeText;
}

if (Meteor.isClient) {
  Meteor.startup(() => {
    render(<ArticlesPageContainer/>, document.body);
  });
}

