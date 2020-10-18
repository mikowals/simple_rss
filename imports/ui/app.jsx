import React from 'react';
import { Session } from 'meteor/session';
import { withTracker, useTracker } from 'meteor/react-meteor-data';
import { ArticlesPageWithStream } from '/imports/ui/articles';
import { FeedsPage } from '/imports/ui/feeds';
import { ApolloProvider } from '@apollo/client';

export const App = ({location}) => {
  return location === "articles" ?
    <ArticlesPageWithStream /> :
    <FeedsPage />;
};

export const ApolloApp = ({client}) => {
  return <ApolloProvider client={client}>
           <App location="articles" />
         </ApolloProvider>;
};
