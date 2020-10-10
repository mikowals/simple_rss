import { Meteor } from 'meteor/meteor';
import { FeedParser } from '/imports/api/server/feedparser';
import { Feeds, Articles } from '/imports/api/simple_rss';
//Maybe this can move to server/main.js.
//It is here so methods below have FeedSubscriber.
const feedSubscriber = new FeedSubscriber({
  callbackUrl: Meteor.absoluteUrl("hubbub"),
  secret: Random.id()
});
 
Meteor.startup( function () {
  feedSubscriber.on(
    'feedStream',
    FeedParser.readAndInsertArticles.bind(FeedParser)
  );

  Feeds.find(
    {hub: {$ne: null}},
    {fields:{_id:1, hub:1, url:1}}
  ).forEach( function (feed) {
    feedSubscriber.subscribe( feed.url, feed.hub, feed._id );
  });
  process.on('exit', Meteor.bindEnvironment ( function (){
    feedSubscriber.stopAllSubscriptions();
    console.log( "paused to allow subscriptions to end");

  }, function ( e ) { throw e; }));

  _.each(['SIGINT', 'SIGHUP', 'SIGTERM'], function (sig) {
    process.once(sig, Meteor.bindEnvironment (function () {
      console.log ( "process received : " + sig);
      feedSubscriber.stopAllSubscriptions();
      process.kill( process.pid, sig);
    }, function ( e ) { throw e; }));
  });
});
