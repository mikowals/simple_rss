import { ApolloServer, gql } from 'apollo-server-express';
import { WebApp } from 'meteor/webapp';
import { Feeds } from '/imports/api/simple_rss';
//import { WebApp } from 'meteor/webapp'
//import { makeExecutableSchema } from 'graphql-tools';

const typeDefs = gql`
  type Feed {
    _id: String
    title: String
    url: String
    last_date: Float
  }

  type Query {
    feeds: [Feed]!
  }
`;

const resolvers = {
  Query: {
    feeds() {
      return Feeds.find({}, {sort: {title: 1}, fields: {_id: 1, title: 1, url: 1, last_date: 1}}).fetch();
    }
  }
};

const server = new ApolloServer({typeDefs, resolvers});

server.applyMiddleware({
  app: WebApp.connectHandlers,
  path: '/graphql'
})

BrowserPolicy.content.allowOriginForAll("https://fonts.googleapis.com");
BrowserPolicy.content.allowOriginForAll("http://cdn.jsdelivr.net");
BrowserPolicy.content.allowOriginForAll("http://fonts.gstatic.com");
// We are doing this work-around because Playground sets headers and WebApp also sets headers
// Resulting into a conflict and a server side exception of "Headers already sent"
WebApp.connectHandlers.use('/graphql', (req, res) => {
  if (req.method === 'GET') {
    res.end()
  }
})
