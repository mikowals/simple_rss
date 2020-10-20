import { gql } from '@apollo/client';

export const typeDefs = gql`
  type Article {
    _id: String
    source: String
    date: Float
    title: String
    link: String
    summary: String
    feed_id: String
  }

  type Feed {
    _id: String
    title: String
    url: String
    last_date: Float
  }

  type Query {
    feeds(userId: String!): [Feed]!
    feedIds(userId: String!): [String]
    articles(userId: String!): [Article]!
    articlesCountByFeed(id: String): Int
  }

  type Mutation {
    removeFeed(id: String): Feed
    addFeed(url: String): Feed
  }
`;
