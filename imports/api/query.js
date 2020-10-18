import { gql } from '@apollo/client';

export const ARTICLES_QUERY = gql`
  query($id: String) {
    articlesBySubscriber(id: $id) {
      _id
      source
      date
      title
      link
      summary
    }
  }
`;

export const FEED_QUERY = gql`
  query feedsBySubscriber($id: String) {
    feedsBySubscriber(id: $id) {
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
