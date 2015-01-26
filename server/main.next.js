var Future = Npm.require( 'fibers/future');
var DAY = 1000 * 60 * 60 * 24;
var daysStoreArticles = 3.0;
var updateInterval = 1000 * 60 * 15;
var intervalProcesses = {};
var articlePubLimit = 150;
var maxArticlesFromSource = 25;
var feedSubscriber;
var keepLimitDate = function(){
  return new Date( new Date().getTime() - ( DAY * daysStoreArticles ));
};

Feeds._ensureIndex( { url: 1 }, {unique: true} );
Articles._ensureIndex( { link: 1 }, {unique: true, dropDups: true });
Articles._ensureIndex( { feed_id: 1, date: -1} );

Accounts.config({sendVerificationEmail: true});

Facts.setUserIdFilter(function ( userId ) {
  var user = Meteor.users.findOne(userId);
  return user && user.admin;
});

//prepare userdata and feedlist for all clients ASAP
Meteor.publish( null, function() {
  var self = this;
  var userId = self.userId || 'nullUser';
  var feedOptions = {fields: {_id: 1, title: 1, url: 1, last_date:1}};
  var articleFields = {_id: 1, title: 1, source: 1, date: 1, summary: 1, link: 1, feed_id: 1};
  var articleOptions = {fields: articleFields, limit: 70, sort: {date: -1, _id: 1}};
  var feedPublisher, articlePublisher, userObserver, nullUserObserver, nullUserCursor;

  feedPublisher = new stoppablePublisher( self );
  articlePublisher = new stoppablePublisher( self );

  function startFeedsAndArticles( id, doc){
    if ( ! doc || ! doc.feedList || doc.feedList.length === 0 )
      return;

    var feedCursor = Feeds.find( {_id:{ $in: doc.feedList}}, feedOptions);
    feedPublisher.start( feedCursor );
    var articleCursor = Articles.find( {feed_id: {$in: doc.feedList}, date: {$gt: keepLimitDate()}}, articleOptions);
    articlePublisher.start( articleCursor );
  }

  userObserver = Meteor.users.find( userId, {fields: {feedList: 1}} ).observeChanges({
    added: startFeedsAndArticles,
    changed: startFeedsAndArticles
  });


  self.onStop( () => {
    userObserver.stop();
    feedPublisher.stop();

    articlePublisher.stop();

  });

  return Meteor.users.find( userId, {fields: {admin: 1}});
});

Meteor.startup( () => {

  Meteor.call('findArticles', {} );
  Meteor.call('removeOldArticles');


  intervalProcesses["removeOldArticles"] = Meteor.setInterval(
    () => Meteor.call('removeOldArticles'),
    DAY
  );


  intervalProcesses[ "findArticles"] = Meteor.setInterval(
    () => Meteor.call('findArticles', { hub: null} ),
    updateInterval
  );


  var options = {
    callbackUrl: Meteor.absoluteUrl("hubbub"),
    secret: Random.id()
  };

  feedSubscriber = new FeedSubscriber ( options );

  feedSubscriber.on( 'feedStream',
    Meteor.bindEnvironment( function( stream, topic ) {
      var feed = feedSubscriber.subscriptions[ topic ];
      FeedParser.readAndInsertArticles( stream, feed )
    }, ( error ) => console.log( error ) )
  );

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

  var handle = Feeds.find({hub: {$ne: null}},{fields: {_id: 1, hub:1, url:1}}).observeChanges({

    added: function ( id, fields ){
      fields._id = id;
      feedSubscriber.subscriptions[ fields.url ] = fields;
      feedSubscriber.subscribe ( fields.url, fields.hub );
    },

    removed: function( id ){
      var fields = _.findWhere( feedSubscriber.subscriptions , {_id: id});
      fields.unsub = new Future();
      feedSubscriber.unsubscribe( fields.url, fields.hub );
    },

    changed: function ( id, fields ){
      var oldSub = _.findWhere( feedSubscriber.subscriptions , {_id: id});
      fields = _.default( fields , oldSub );
      oldSub.unsub = new Future();
	    feedSubscriber.unsubscribe( oldSub.url, oldSub.hub );
      oldSub.unsub.wait();
      feedSubscriber.subscriptions[ fields.url ] = fields;
	    feedSubscriber.subscribe ( fields.url, fields.hub );
    }
  });
});

Meteor.methods({

  findArticles: function( criteria ) {
    check ( criteria,  Object );
    console.time("findArticles");
    criteria = criteria || {};
    var article_count = 0;
    var feeds = Feeds.find( criteria );
    if ( feeds.count() < 1) return;
    var rssResults = FeedParser.syncFP( feeds.fetch() );

    rssResults.forEach( function( rssResult ){
      if ( rssResult.statusCode === 200 ) {
        var modifier = _.pick( rssResult, 'lastModified', 'etag', 'lastDate' );
        Feeds.update(rssResult._id, {$set: modifier } , function(){return;});
      }
      else if ( rssResult.error ) console.log (rssResult.url + " returned " + rssResult.error);
      else if ( typeof rssResult.statusCode === "number" && rssResult.statusCode !== 304 ){
        console.log( rssResult.url + " responded with " + rssResult.statusCode );
      }
    });

    console.timeEnd("findArticles");

  },

  stopAndRestartPubSub: function(){
    feedSubscriber.stopAllSubscriptions();

    var onErr = function(err, res){ if( err ) console.error( err );};
    var onFeed = function( feed ){
      feedSubscriber.subscriptions[ feed.url ] = feed;
      feedSubscriber.subscribe( feed.url, feed.hub, onErr );
    };

    Feeds.find({hub: {$ne: null}},{fields: {_id: 1, hub:1, url:1}}).forEach( onFeed );
  },

  removeOldArticles: function(){
    console.log("removeOldArticles method called on server");
    var error = Articles.remove({date:  {$lt: keepLimitDate()}, clicks: 0 }, function(error){ return error;});
    return error || 'success';
  },

  addSubscriberToFeeds: function(){
    var self = this;
    Feeds.find({}).forEach( function ( feed ){
      console.log("adding subscriber " + self.userId);
      Feeds.update( feed._id,{ $addToSet: { subscribers: self.userId }});
    });
  },

  createNullSubscriber: function(){
    var feedList = Feeds.find( {subscribers: null}, {fields: {_id:1}}).map( feed => feed._id );
    Meteor.users.upsert( 'nullUser', { _id: 'nullUser', feedList }, error => {
      if ( error ) console.log( error );
    });
  },

  addFeed_idToArticles: function(){
    Articles.find({}).forEach( function (article){
      var feed_id = Feeds.findOne({title: article.source})._id;
      Articles.update(article._id,{$set: {feed_id: feed_id}});
    });

  },

  cleanUrls: function(){
    Feeds.find({}).forEach( function(feed){
      var result = FeedParser.syncFP( feed );
      if (result && result.url && feed.url !== result.url ){
	      console.log("changing url " + feed.url + " to " + result.url);
	      Feeds.update(feed._id, {$set: {url: result.url }});
      }
    });
  },

  markRead: function( link ){
    var self = this;
    check( link, String );
    var article = Articles.findOne({link: link});
    if ( article ){
      Articles.update( article._id,{$addToSet: {readBy: this.userId }, $inc: {clicks: 1, readCount: 1}}, function( error, result){
	//make update async since client might be waiting to navigate
      });
    }
    console.log( "marked as read: " + link);
  },

  XML2JSparse: function ( file ) {
    check( file, String);
    return XML2JS.parse( file );
  },

  createFeedListByUser: function(){
    Meteor.users.find( {}, {_id:1} ).forEach( function ( user ){
      var feedList = Feeds.find( {subscribers: user._id}, {_id: 1} ).map( function( feed ) { return feed._id });
      Meteor.users.update( user._id, {$set: {feedList: feedList}, $pull:{feedList: null}});
    //  Meteor.users.update( user._id, { $pull:{feedList: null}});
    });
  },

  checkAdmin: function(){
    var user = Meteor.users.findOne( {_id: this.userId} );
    return user && user.admin;
  }


});
