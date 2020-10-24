import React, { useState, useEffect, memo, useRef } from 'react';
import { Link } from 'react-router-dom';
import PropTypes from 'prop-types';
import { Articles } from '/imports/api/simple_rss';
import { withTimeText, useTimeAgoText, TimeAgo } from './timeAgo';
import { initialArticleLimit } from '/imports/api/simple_rss';
import { useQuery, useLazyQuery} from '@apollo/client';
import { ARTICLES_QUERY } from '/imports/api/query';
import orderBy from 'lodash.orderby';

//This stream div is important for CSS.
// SSR needs a div to unsafely render text into so this needs to wrap ArticlesPage.
export const ArticlesPageWithStream = () => (
  <div id="stream"><ArticlesPage /></div>
);

const renderArticle = (article) => {
  // Convert date so simple equality checks work and avoid rerender.
  article.date = new Date(article.date).getTime();
  // Some articles don't have titles and display nicer with placeholder.
  article.title = article.title || "Link";

  // Spread the article object (...) to avoid new object causing rerender.
  return <Article {...article} key={article._id} />;
};

export const ArticlesPage = () => {

  const [runUseQuery, {loading, error, data, stopPolling}] = useLazyQuery(
    ARTICLES_QUERY, {
    variables: {userId: "nullUser"},
    fetchPolicy: "cache-and-network",
    nextFetchPolicy: "cache-first",
    pollInterval: 2 * 60 * 1000
  });

  // Schedule stopPolling to be called on component unmount.
  useEffect(() => {
    runUseQuery();
    return stopPolling;
  }, [runUseQuery])

  if (error) {
    console.log(error);
  }
  if (! data) {
    return <div />;
  }
  return data.articles.map(renderArticle);
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
