import React from 'react';
import { Session } from 'meteor/session';
import { withTracker } from 'meteor/react-meteor-data';
import { ArticlesPageContainer } from '/imports/ui/articles';
import { FeedsPageContainer } from '/imports/ui/feeds';

const App = (props) => {
    return props.location === "articles" ?
        <ArticlesPageContainer /> :
        <FeedsPageContainer />;
};

export const AppContainer = withTracker(() => {
    return {
        location: Session.get('page')
    }
})(App);
