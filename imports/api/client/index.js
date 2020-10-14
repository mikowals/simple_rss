import React from 'react';
import { unstable_createRoot } from 'react-dom';
import { Meteor } from 'meteor/meteor';
import { ApolloClient, InMemoryCache, ApolloProvider, createHttpLink, gql, useQuery } from '@apollo/client';
import { FeedsPage } from '/imports/ui/feeds';

const cache = new InMemoryCache();
const link = createHttpLink({
  uri: 'http://localhost:3000/graphql',
});

const client = new ApolloClient({
  // Provide required constructor fields
  cache: cache,
  link: link,
  connectToDevTools: false
});

const feeds = gql`
  {
    feeds {
      _id
      title
      url
      last_date
    }
  }
`;

function Feeds() {
  const { loading, error, data } = useQuery(feeds);
  //console.log(data.feeds);
  if (loading) return <p>Loading...</p>;
  if (error) return <p>Error! ${error.message}</p>;
  return <FeedsPage feeds={data.feeds} />;
};

const ApolloApp = () => {
  return <ApolloProvider client={client}>
           <Feeds />
         </ApolloProvider>;
};

Meteor.startup(
  () => unstable_createRoot(document.getElementById('app'), {hydrate: false}).render(<ApolloApp />)
)
