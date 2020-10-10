import { onPageLoad } from 'meteor/server-render';
import { Meteor } from 'meteor/meteor';
import { Session } from 'meteor/session';
import { unstable_createRoot } from 'react-dom';
import { initialArticleLimit, AppContainer } from '/imports/ui/simple_rss';
import React from 'react';

onPageLoad( sink => {
  Meteor.subscribe('articles', function(){
    const rootElement = document.getElementById("app");
    console.log(<AppContainer location="articles"/>);
    unstable_createRoot(rootElement, {
      hydrate: true
    }).render(<AppContainer location="articles"/>);
    //hydrate(<AppContainer />,
    //  document.getElementById("app")
    //);
  });
  //(await import("/lib/simple_rss.jsx")).default;
});

Meteor.startup(() => {
  Meteor.subscribe('feeds');
  Session.set('page', 'articles');
  Session.set('articleLimit', initialArticleLimit);
});
