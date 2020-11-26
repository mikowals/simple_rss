import React from 'react';
import { unstable_createRoot } from 'react-dom';
import { BrowserRouter, Route, Switch, Link } from 'react-router-dom';
import { createBrowserHistory } from 'history';
import { Meteor } from 'meteor/meteor';
import { ApolloClient, InMemoryCache, createHttpLink, ApolloProvider } from '@apollo/client';
import { BatchHttpLink } from "@apollo/client/link/batch-http";
import { FeedsPageWithContainer } from '/imports/ui/feeds';
import { ArticlesPageWithStream } from '/imports/ui/articles';
import { onPageLoad } from "meteor/server-render";

export const client = new ApolloClient({
  cache: new InMemoryCache().restore(window.__APOLLO_STATE__),
  link: new BatchHttpLink({
    uri: '/graphql',
    credentials: 'same-origin',
    batchInterval: 10}),
  connectToDevTools: true
});

export const renderRoutes = () => (
    <BrowserRouter>
      <ApolloProvider client={client}>
        <Switch>
          <Route exact path="/feeds" component={FeedsPageWithContainer} />
          <Route exact path="/articles" component={ArticlesPageWithStream} />
          <Route component={ArticlesPageWithStream} />
        </Switch>
      </ApolloProvider>
      <Link to="/feeds" >Feeds</Link>
      <Link to="/articles" >Articles</Link>
    </BrowserRouter>
);


Meteor.startup(() => {
  unstable_createRoot(
    document.getElementById('app'),
    {hydrate: true}
  ).render(renderRoutes())
});
