import React from 'react';
import { hydrateRoot } from 'react-dom';
import { BrowserRouter, Route, Routes, Link } from 'react-router-dom';
import { Meteor } from 'meteor/meteor';
import { ApolloClient, InMemoryCache, ApolloProvider } from '@apollo/client';
import { BatchHttpLink } from "@apollo/client/link/batch-http";
import { FeedsPageWithContainer } from '/imports/ui/feeds';
import { ArticlesPageWithStream } from '/imports/ui/articles';

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
        <Routes>
          <Route exact path="/feeds" element={<FeedsPageWithContainer />} />
          <Route exact path="/articles" element={<ArticlesPageWithStream />} />
          <Route element={<ArticlesPageWithStream />} />
        </Routes>
      </ApolloProvider>
      <Link to="/feeds" >Feeds</Link>
      <Link to="/articles" >Articles</Link>
    </BrowserRouter>
);


Meteor.startup(() => {
  hydrateRoot(
    document.getElementById('app'),
    renderRoutes()
  )
});
