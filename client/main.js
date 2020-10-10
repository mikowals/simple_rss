import { onPageLoad } from 'meteor/server-render';
import { Meteor } from 'meteor/meteor';
import { Session } from 'meteor/session';
import { unstable_createRoot } from 'react-dom';
import { initialArticleLimit } from '/imports/api/simple_rss';
import { AppContainer } from '/imports/ui/app';
import React from 'react';
import '/imports/api/client/methods.js';

onPageLoad( sink => {
  Meteor.subscribe('articles', function(){
    const rootElement = document.getElementById("app");
    unstable_createRoot(rootElement, {
      hydrate: true
    }).render(<AppContainer location="articles"/>);
  });
});

Meteor.startup(() => {
  Meteor.subscribe('feeds');
  Session.set('page', 'articles');
  Session.set('articleLimit', initialArticleLimit);
});
