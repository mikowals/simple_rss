import { gql } from '@apollo/client';

export const REMOVE_FEED = gql`
  mutation removeFeed($id: String) {
    removeFeed(id: $id) {
      _id
    }
  }
`;

export const ADD_FEED = gql`
mutation addFeed($_id: String, $url: String!) {
  addFeed(_id: $_id, url: $url) {
    _id
    title
    date
    url
    count
  }
}
`
