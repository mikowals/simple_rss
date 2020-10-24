import { gql } from '@apollo/client';

export const REMOVE_FEED = gql`
  mutation removeFeed($id: String) {
    removeFeed(id: $id) {
      _id
    }
  }
`;

export const ADD_FEED = gql`
mutation addFeed($url: String) {
  addFeed(url: $url) {
    _id
    title
    last_date
    url
    count
  }
}
`
