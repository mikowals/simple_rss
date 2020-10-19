import { gql } from '@apollo/client';

export const ARTICLES_QUERY = gql`
  query($id: String) {
    articles(id: $id) {
      _id
      source
      date
      title
      link
      summary
    }
  }
`;

export const MORE_ARTICLES_QUERY = gql`
  query moreArticles($id: String, $date: Float) {
    moreArticles(id: $id, date: $date) {
      date
      articles {
        _id
        source
        date
        title
        link
        summary
      }
    }
  }
`

export const FEEDS_QUERY = gql`
  query feeds($id: String) {
    feeds(id: $id) {
        _id
        title
        url
        last_date
    }
  }
`;

export const FEED_COUNT = gql`
  query articlesCountByFeed($id: String) {
    articlesCountByFeed(id: $id)
  }
`;

export const FEED_IDS = gql`
  query feedIds($id: String) {
    feedIds(id: $id)
  }
`
