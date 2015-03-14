_ = lodash;

Feeds = new Meteor.Collection ( "feeds" );
Articles = new Meteor.Collection ( "articles" );

var handleError = function( error ){
  if ( error ) console.log( error );
};

if ( Meteor.isServer ){
  Meteor.startup( function () {
    var options = {
      callbackUrl: Meteor.absoluteUrl("hubbub"),
      secret: Random.id()
    };

    feedSubscriber = new FeedSubscriber ( options );

    feedSubscriber.on( 'feedStream',
      Meteor.bindEnvironment( function( stream, topic ) {
        var feed = feedSubscriber.subscriptions[ topic ];
        FeedParser.readAndInsertArticles( stream, feed );
      }, function( error ) { console.log( error ) })
    );

    Feeds.find({hub: {$ne: null}}, {fields:{_id:1, hub:1, url:1}}).forEach( function (feed) {
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

    var feed = Feeds.findOne( feedId, {fields:{_id:1, subscribers:1, url:1, hub:1}});

    if (!feed )
      return false;

    if ( Meteor.isServer ) {

      Meteor.users.update( {_id: userId, feedList: feedId}, {$pull: {feedList: feedId }});

      if ( feed.subscribers && feed.subscribers.length > 1 ) {
        Feeds.update( feedId, {$pull: {subscribers: userId }});
        return true;
      }
      if ( feed.subscribers && feed.subscribers[0] !== userId ){
        console.error( 'user: ', userId, " feedSub: ", feed.subscribers[0]);
        return false;
      }
    }

    //always run on client but only run on server if this is the last subscriber unsubscribing
    Articles.remove( { feed_id: feedId } );
    if (Meteor.isServer && feed.hub)
      feedSubscriber.unsubscribe( feed.url, feed.hub );
    Feeds.remove( feedId );
    return true;
  },

  addFeed: function( doc ){
    var self = this;
    self.unblock();
    check ( doc, { url: String});
    var originalUrl = doc.url;
    var userId = self.userId || 'nullUser';
    doc._id = Feeds._makeNewID();
    if ( self.isSimulation ) {
      Feeds.insert( doc, handleError );
      return
    }

    // server only code starts here
    var existing = Feeds.findOne( {url: doc.url} , {fields: { _id:1 }} );

    if ( existing ) {
      Feeds.update( existing._id, {$addToSet:{ subscribers: userId }}, _.noop );
      return Meteor.users.upsert( {_id: userId}, {$addToSet:{ feedList: existing._id }}, _.noop );
    }
    var rssResult = FeedParser.syncFP( doc );
    if ( rssResult.error || rssResult.statusCode !== 200 ){
      console.log(JSON.stringify (rssResult) + " has no data to insert");
      throw new Meteor.Error( 500, "bad url for new feed", "The server at " + doc.url + " responded with statusCode " + rssResult.statusCode + " and content " + rssResult.content);
    }

    if ( rssResult.url !== originalUrl ) {
      console.log( "added url: " +  originalUrl + ", canonical url: " + rssResult.url );
      var existing = Feeds.findOne( { url: rssResult.url });
      if ( existing ) {
        Articles.remove( {feed_id: doc._id }, _.noop );
        Feeds.update( existing._id, {$addToSet: { subscribers: userId }}, _.noop );
        return Meteor.users.upsert( {_id: userId}, {$addToSet:{ feedList: existing._id }}, _.noop );
      }
    }

    console.log( "insertedFeed: ", rssResult.title );

    Feeds.insert( {
      _id: rssResult._id,
      url: rssResult.url,
      hub: rssResult.hub || null,
      title: rssResult.title,
      last_date: rssResult.date,
      lastModified: rssResult.lastModified,
      etag: rssResult.etag,
      subscribers: [ userId ]
    }, function (err, res){
      if ( res && rssResult.hub )
        feedSubscriber.subscribe ( rssResult.url, rssResult.hub, res );
    });
    return Meteor.users.upsert( {_id: userId}, {$addToSet:{ feedList: rssResult._id }}, _.noop );
  }
});

if (Meteor.isServer ){
  Meteor.methods({
    stopAndRestartPubSub: function(){
      feedSubscriber.stopAllSubscriptions();

      var onErr = function(err, res){ if( err ) console.error( err );};
      var onFeed = function( feed ){
        feedSubscriber.subscriptions[ feed.url ] = feed;
        feedSubscriber.subscribe( feed.url, feed.hub, onErr );
      };

      Feeds.find({hub: {$ne: null}},{fields: {_id: 1, hub:1, url:1}}).forEach( onFeed );
    }
  });
}

eachRecursive = function (obj, resultArr) {
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
