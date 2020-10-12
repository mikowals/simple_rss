import { Meteor } from 'meteor/meteor';
import { Session } from 'meteor/session';
import { initialArticleLimit } from '/imports/api/simple_rss';
import '/imports/api/client/methods.js';

Meteor.startup(() => {
  Meteor.subscribe('feeds');
  Session.set('page', 'articles');
  Session.set('articleLimit', initialArticleLimit);
});
