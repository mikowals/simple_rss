import React from 'react';
import { unstable_createRoot } from 'react-dom';
import { Meteor } from 'meteor/meteor';
import { ApolloClient, InMemoryCache, createHttpLink } from '@apollo/client';
import { ApolloApp } from '/imports/ui/app';
import { onPageLoad } from "meteor/server-render";

export const client = new ApolloClient({
  cache: new InMemoryCache().restore(window.__APOLLO_STATE__),
  link: createHttpLink({uri: 'http://localhost:3000/graphql'}),
  connectToDevTools: true
});

Meteor.startup(
  unstable_createRoot(
    document.getElementById('app'),
    {hydrate: true}
  ).render(<ApolloApp client={client} location={window.location.pathname} />)
)

onPageLoad(sink => {

});
