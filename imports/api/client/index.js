import React from 'react';
import { unstable_createRoot } from 'react-dom';
import { BrowserRouter, Route, Switch, Link } from 'react-router-dom';
import { createBrowserHistory } from 'history';
import { Meteor } from 'meteor/meteor';
import { ApolloClient, InMemoryCache, createHttpLink, ApolloProvider } from '@apollo/client';
import { BatchHttpLink } from "apollo-link-batch-http";
import { FeedsPageWithContainer } from '/imports/ui/feeds';
import { ArticlesPageWithStream } from '/imports/ui/articles';
import { onPageLoad } from "meteor/server-render";

export const client = new ApolloClient({
  cache: new InMemoryCache().restore(window.__APOLLO_STATE__),
  link: new BatchHttpLink({uri: 'http://localhost:3000/graphql', batchInterval: 20}),
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
        <Link to="/articles" >Articles</Link>
        <Link to="/feeds" >Feeds</Link>
      </ApolloProvider>
    </BrowserRouter>
);


Meteor.startup(
  unstable_createRoot(
    document.getElementById('app'),
    {hydrate: true}
  ).render(renderRoutes())
)
