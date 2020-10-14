import React from 'react';
import { Session } from 'meteor/session';
import { withTracker, useTracker } from 'meteor/react-meteor-data';
import { ArticlesPage } from '/imports/ui/articles';
import { FeedsPage } from '/imports/ui/feeds';

export const App = (props) => {
  const location = useTracker(() => {
    return Session.get('page')
  }, []);
  return location === "articles" ?
    <ArticlesPage /> :
    <FeedsPage />;
};
