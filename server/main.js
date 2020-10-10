import { Feeds, Articles, initialArticleLimit, keepLimitDate } from '/imports/api/simple_rss';
import { ArticlesPage } from '/imports/ui/articles';
import React from 'react';
import { FeedParser } from '/imports/api/server/feedparser';
import { onPageLoad } from 'meteor/server-render';
import { renderToNodeStream, renderToString } from 'react-dom/server';
import { StoppablePublisher } from '/imports/api/server/stoppablePublisher';
import '/imports/api/server/methods.js';
import '/imports/api/server/startup.js';

var articlePubLimit = 150;
var maxArticlesFromSource = 25;

BrowserPolicy.content.allowConnectOrigin("*.mak-play.com");

BrowserPolicy.content.allowEval();

Feeds._ensureIndex( { url: 1 }, {unique: true} );
Articles._ensureIndex( { link: 1 }, {unique: true, dropDups: true });
Articles._ensureIndex( { feed_id: 1, date: -1} );

//Accounts.config({sendVerificationEmail: true});
Meteor.users.deny({
  update: () => true
});

Meteor.publish( 'feeds', function() {
  var feedOptions = {fields: {_id: 1, title: 1, url: 1, last_date:1}};
  return Feeds.find( {subscribers: this.userId || 'nullUser'}, feedOptions );
});

Meteor.publish( 'articles', function() {
  var self = this;
  var userId = self.userId || 'nullUser';
  //var feedOptions = {fields: {_id: 1, title: 1, url: 1, last_date:1}};
  var articleFields = {_id: 1, title: 1, source: 1, date: 1, summary: 1, link: 1, feed_id: 1};
  var articleOptions = {fields: articleFields, limit: 200, sort: {date: -1, _id: 1}};
  var articlePublisher, userObserver;
  articlePublisher = new StoppablePublisher( self );
  function observeArticles( id, doc){
    var articleCursor = Articles.find(
      {feed_id: {$in: doc.feedList}, date: {$gt: keepLimitDate()}},
      articleOptions
    );
    articlePublisher.start( articleCursor );
  }

  //Observing the Users collection to watch changes in the feedLists.
  //removes don't matter because the user will always exist or log out.
  userObserver = Meteor.users.find( userId, {fields: {feedList: 1}} ).observeChanges({
    added: observeArticles,
    // for bulk adds the observer would restart constantly
    // XXX could manage this with pause publish
    changed:  _.debounce(Meteor.bindEnvironment(observeArticles), 300, {trailing: true})
  });

  self.onStop( () => {
    userObserver.stop();
    articlePublisher.stop();
  });

  return self.ready();
});

onPageLoad(sink => {
  //need to rewrite this for real userID using cookies;
  const userId = "nullUser";
  const feedList = Meteor.users.findOne(
    {_id: userId},
    {fields: {feedList: 1}}
  ).feedList;
  const articlesCursor = Articles.find(
    {feed_id: {$in: feedList}},
    {limit: initialArticleLimit, sort: {date: -1, _id: 1}}
  );
  const articles = articlesCursor.map((article) => {
    article.date = new Date(article.date).getTime();
    article.title = article.title || "Link";
    return article;
  });
  //console.log(renderToString(<ArticlesPage articles={articles} />));
  const htmlStream = renderToNodeStream(<ArticlesPage articles={articles} />);
  sink.renderIntoElementById("app", htmlStream);
});
