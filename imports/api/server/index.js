import { ApolloServer, Express } from 'apollo-server-express';
import { WebApp } from 'meteor/webapp';
import { Feeds, Articles } from '/imports/api/simple_rss';
import React from 'react';
import { renderToStaticMarkup, renderToNodeStream, renderToString } from 'react-dom/server';
import { ApolloClient, InMemoryCache, ApolloProvider, createHttpLink} from '@apollo/client';
import { renderToStringWithData } from "@apollo/client/react/ssr";
import fetch from 'isomorphic-fetch';
import { ApolloApp } from '/imports/ui/app';
import { FeedsPage } from '/imports/ui/feeds';
import { ArticlesPage } from '/imports/ui/articles'
import { ServerStyleSheet } from "styled-components";
import { Meteor } from 'meteor/meteor';
import { onPageLoad } from 'meteor/server-render';
import { resolvers } from '/imports/api/server/resolvers';
import { typeDefs } from '/imports/api/server/typeDefs';

const server = new ApolloServer({typeDefs, resolvers});

BrowserPolicy.content.allowConnectOrigin("*.mak-play.com");
BrowserPolicy.content.allowEval();

Feeds._ensureIndex( { url: 1 }, {unique: true} );
Articles._ensureIndex( { link: 1 }, {unique: true, dropDups: true });
Articles._ensureIndex( { feed_id: 1, date: -1} );

//Accounts.config({sendVerificationEmail: true});
Meteor.users.deny({
  update: () => true
});

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
});

// Wrap ArticlesPage here so that we can inject it into div id='stream'.
const SSRPage = ({client, location}) => (
  <ApolloProvider client={client}>
    {location === "/feeds" ? <FeedsPage /> : <ArticlesPage />}
  </ApolloProvider>
);

function AppWithCache({ content, state, location }) {
  return (
    <>
    {<div id={location === "/feeds" ? "feed-container" : "stream"}
      dangerouslySetInnerHTML={{ __html: content }} />}
    <script dangerouslySetInnerHTML={{
      __html: `window.__APOLLO_STATE__=${JSON.stringify(state).replace(/</g, '\\u003c')};`,
    }} />
    </>
  );
}

onPageLoad(async sink => {
  const client = new ApolloClient({
    ssrMode: true,
    link: createHttpLink({
      uri: 'http://localhost:3000/graphql',
      credentials: 'same-origin',
      fetch
    }),
    cache: new InMemoryCache(),
  });

  const sheet = new ServerStyleSheet();
  const location = sink.request.url.pathname;
  const content = await renderToStringWithData(SSRPage({client, location}));

  const initialState = client.extract();
  const appJSX = <AppWithCache content={content} state={initialState} location={location} />;

  const htmlStream = renderToNodeStream(appJSX);
  sink.renderIntoElementById("app", htmlStream);

});
