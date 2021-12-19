import React, { useEffect, memo } from 'react';
import PropTypes from 'prop-types';
import { useTimeAgoText, TimeAgo } from './timeAgo';
import { ErrorBoundary } from './errorBoundary';
import { useQuery } from '@apollo/client';
import { ARTICLES_QUERY } from '../api/query';
import sanitizeHtml from 'sanitize-html';

//This stream div is important for CSS.
// SSR needs a div to unsafely render text into so this needs to wrap ArticlesPage.
export const ArticlesPageWithStream = () => (
  <ErrorBoundary>
    <div id="stream"><ArticlesPage /></div>
  </ErrorBoundary>
);

// Spread the article object (...) to avoid new object causing rerender.
const renderArticle = (article) => <Article {...article} key={article._id} />
export const ArticlesPage = () => {
  const {loading, error, data, stopPolling} = useQuery(
    ARTICLES_QUERY, {
    variables: {userId: "nullUser"},
    fetchPolicy: "cache-and-network",
    pollInterval: 10 * 60 * 1000
  });
  // Schedule stopPolling to be called on component unmount.
  useEffect(() => {
    return stopPolling;
  }, [])

  if (error) {
    console.log(error);
  }
  if (! data) {
    return null;
  }
  return data.articles.map(renderArticle);
};

ArticlesPage.displayName = "ArticlesPage";

export const Article = memo(({_id, title, source, summary, link, date}) => {
    // TimeAgo occurs twice.  Once in SourceHeader and once in the footer.
    // Keep time state here in common parent.
    const timeText = useTimeAgoText(date);
    return  <li id={_id} className="section">
              <SourceHeader source={source} timeText={timeText} />
              <div className="article">
                <TitleAndSummary link={link} title={title} summary={summary} />
                <div className="footer visible-xs">
                  <time><TimeAgo timeText={timeText} /></time>
                </div>
              </div>
            </li>;
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
               <a href={link}>{title || "Link"}</a>
            </h3>
          </div>
          <div className="description"
               dangerouslySetInnerHTML={{__html: sanitizeHtml(summary)}}/>
          </React.Fragment>;
});

TitleAndSummary.displayName = "TitleAndSummary";

//ArticleWithTimeAgo.displayName = "ArticleWithTimeAgo";
