import React from 'react';
import { ArticlesPageWithStream } from '/imports/ui/articles';
import { FeedsPageWithContainer } from '/imports/ui/feeds';
import { ApolloProvider, useQuery } from '@apollo/client';

export const App = ({location}) => {
  return location === "/feeds" ?
    <FeedsPageWithContainer /> :
    <ArticlesPageWithStream />;
};

export const ApolloApp = ({client, location}) => {
  return <ApolloProvider client={client}>
           <App location={location} />
         </ApolloProvider>;
};
