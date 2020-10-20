import { gql } from '@apollo/client';

export const ARTICLES_QUERY = gql`
  query($userId: String) {
    articles(userId: $userId) {
      _id
      source
      date
      title
      link
      summary
      feed_id
    }
  }
`;

export const FEEDS_QUERY = gql`
  query feeds($userId: String!) {
    feeds(userId: $userId) {
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
  query feedIds($userId: String!) {
    feedIds(userId: $userId)
  }
`
