_ = lodash;

Feeds = new Mongo.Collection ( "feeds" );
Articles = new Mongo.Collection ( "articles" );

var handleError = function( error ){
  if ( error ) console.log( error );
};

if ( Meteor.isServer ){
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
}

Meteor.methods({
  removeFeed: function (feedId) {
    var self = this;
    var userId = self.userId || 'nullUser';
    check(feedId, String);

    if (! self.isSimulation){
      var feed = Feeds.findOne( {_id: feedId, subscribers: userId}, {fields:{_id: 1, subscribers: 1, url: 1, hub: 1}});

      if (! feed )
        throw new Meteor.Error('feed-not-found', 'bad _id for feed removal');

      Meteor.users.update( userId, {$pull: {feedList: feedId}});

      if ( feed.subscribers.length > 1 ) {
        return Feeds.update( {_id: feedId, subscribers: userId}, {$pull: {subscribers: userId }});
      } else if (feed.hub) {
        feedSubscriber.unsubscribe(feed.url, feed.hub);
      }
    }

    // always run on client but only on server if this is last subscriber removing
    Articles.remove({feed_id: feedId});
    Feeds.remove(feedId);
  },

  addFeed: function( doc ){
    var self = this;
    self.unblock();
    check ( doc, { url: String});
    var originalUrl = doc.url;
    var userId = self.userId || 'nullUser';

    // create id so we can insert articles before feed itself is inserted.
    doc._id = Feeds._makeNewID();
    if ( self.isSimulation ) {
      Feeds.insert( doc, handleError );
      return;
    }

    // server only code starts here
    // check existence with findOne since we need the feedId anyway to update user
    var existing = Feeds.findOne( {url: doc.url} , {fields: { _id:1 }} );
    if ( existing ) {

      Feeds.update( {url: doc.url}, {$addToSet:{ subscribers: userId }}, _.noop );
      Meteor.users.upsert( {_id: userId}, {$addToSet:{ feedList: existing._id }}, _.noop );
      return true;
    }
    var rssResult = FeedParser.syncFP( doc );
    console.log(rssResult);
    if ( rssResult.error || rssResult.statusCode !== 200 ){
      console.log(JSON.stringify (rssResult) + " has no data to insert");
      var err = new Meteor.Error( 500, "bad url for new feed", "The server at " + doc.url + " responded with statusCode " + rssResult.statusCode + " and content " + rssResult.content);
      console.log(err);
      throw err;
    }

    // the url sets a different feed url so check if we have that one
    if ( rssResult.url !== originalUrl ) {
      console.log( "added url: " +  originalUrl + ", canonical url: " + rssResult.url );
      var existing = Feeds.findOne( { url: rssResult.url });
      if ( existing ) {
        Articles.remove( {feed_id: doc._id }, _.noop );
        Feeds.update( existing._id, {$addToSet: { subscribers: userId }}, _.noop );
        Meteor.users.upsert( {_id: userId}, {$addToSet:{ feedList: existing._id }}, _.noop );
        return true;
      }
    }

    // all checks pass so insert the new feed.
    console.log( "insertedFeed: ", rssResult.title );

    Feeds.insert({
      _id: rssResult._id,
      url: rssResult.url,
      hub: rssResult.hub || null,
      title: rssResult.title,
      last_date: rssResult.date,
      lastModified: rssResult.lastModified,
      etag: rssResult.etag,
      subscribers: [ userId ]
    }, _.noop);

    if (rssResult.hub)
      feedSubscriber.subscribe(rssResult.url, rssResult.hub, rssResult._id);

    Meteor.users.upsert( {_id: userId}, {$addToSet:{ feedList: rssResult._id }}, _.noop );
    return true;
  }
});

const eachRecursive = function (obj, resultArr) {
  for (var k in obj) {

    if (typeof obj[k] === "object"){
      eachRecursive(obj[k], resultArr);
    }
    else{
      if (k === 'xmlUrl'){
        resultArr.push( obj['xmlUrl'] );
      }
    }
  }
};
