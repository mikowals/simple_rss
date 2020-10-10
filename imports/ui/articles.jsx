import { Meteor } from 'meteor/meteor';
import { withTracker } from 'meteor/react-meteor-data';
import React, { useState, useEffect, memo } from 'react';
import PropTypes from 'prop-types';
import { Articles } from '/imports/api/simple_rss';
import { withTimeText, TimeAgo } from './timeAgo';
import { initialArticleLimit } from '/imports/api/simple_rss';

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

export const ArticlesPage = memo((props) => {
  return <div id="stream">{props.articles.map(renderArticle)}</div>
}, articlesEqual);

ArticlesPage.propTypes = {
  articles: PropTypes.array
};

ArticlesPage.displayName = "ArticlesPage";

export const ArticlesPageContainer = withTracker(() => {
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

const ArticleWithTimeAgo = withTimeText(Article);

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

//ArticleWithTimeAgo.displayName = "ArticleWithTimeAgo";
