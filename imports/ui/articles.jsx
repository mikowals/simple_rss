import { Meteor } from 'meteor/meteor';
import { withTracker, useTracker } from 'meteor/react-meteor-data';
import React, { useState, useEffect, memo, useRef } from 'react';
import PropTypes from 'prop-types';
import { Articles } from '/imports/api/simple_rss';
import { withTimeText, useTimeAgoText, TimeAgo } from './timeAgo';
import { initialArticleLimit } from '/imports/api/simple_rss';

// Spread the article object (...) to avoid new object causing rerender.
const renderArticle = (article) => {
  // Convert date so simple equality checks work and avoid rerender.
  article.date = new Date(article.date).getTime();
  // Some articles don't have titles and display nicer with placeholder.
  article.title = article.title || "Link";
  return <Article {...article} key={article._id} />;
};

export const ArticlesPage = ({articlesFromServer}) => {
  const articles = useTracker(() => {
    // Separate paths. Bug on server when query not on meteor fiber.
    if (Meteor.isServer) {
      return articlesFromServer;
    } else {
      const limit = initialArticleLimit//Session.get('articleLimit');
      // Empty queries are frowned on.  Commented code needs user info.
      //const user = Meteor.users.findOne({_id: Meteor.userId || "nullUser"});
      const criteria = {}; // {feed_id: {$in: user.feedList}}
      return Articles.find(criteria, {limit: limit, sort: {date: -1, _id: 1}}).fetch();
    }
  }, []); // '[]' here allows memoization without dependencies.

  return <div id="stream">{articles.map(renderArticle)}</div>;
};

const articlesEqual = (prev, next) => {
  if (prev.length !== next.length) return false;
  for (let ii = 0; ii < prev.length; ii++) {
    const prevValues = Object.values(prev[ii]);
    const nextValues = Object.values(next[ii]);
    for (let jj = 0; jj < prevValues.length; jj++){
      if (prevValues[jj] !== nextValues[jj]) {
        console.log("Articles not equal ", ii, prevValues, nextValues);
        return false;
      }
    }
  }
  return true;
};

ArticlesPage.displayName = "ArticlesPage";

const Article = memo(({_id, title, source, summary, link, date}) => {
    // TimeAgo occurs twice.  Once in SourceHeader and once in the footer.
    // Keep time state here in common parent.
    const timeText = useTimeAgoText(date);
    return  <div id={_id} className="section">
              <SourceHeader source={source} timeText={timeText} />
              <div className="article">
                <TitleAndSummary link={link} title={title} summary={summary} />
                <div className="footer visible-xs">
                  <time><TimeAgo timeText={timeText} /></time>
                </div>
              </div>
            </div>;
});

Article.propTypes = {
  _id: PropTypes.string.isRequired,
  date: PropTypes.number.isRequired,
  title: PropTypes.string,
  source: PropTypes.string.isRequired,
  summary: PropTypes.string,
  link: PropTypes.string.isRequired,
};

Article.displayName = "Article";

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
