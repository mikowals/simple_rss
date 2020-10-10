import { Meteor } from 'meteor/meteor';
import { FeedParser } from '/imports/api/server/feedparser';
import { Feeds, Articles, DAY, daysStoreArticles } from '/imports/api/simple_rss';

var updateInterval = 1000 * 60 * 15;

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

  // Delayed to avoid client requests at startup getting mismatched rssResult
  // as new articles flood in.
  Meteor.setTimeout(() => {
    Meteor.call('findArticles' );
    Meteor.call('removeOldArticles');
  }, 5000);

  Meteor.setInterval(
    () => Meteor.call('removeOldArticles'),
    DAY
  );

  var interval = Meteor.setInterval(
    () => Meteor.call('findArticles', { hub: null} ),
    updateInterval
  );

  _.each(['SIGINT', 'SIGHUP', 'SIGTERM'], function (sig) {
      process.once(sig, Meteor.bindEnvironment (function () {
        Meteor.clearInterval( interval );
      }, function ( e ) { throw e; }));
    });
});
