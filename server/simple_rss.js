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

Articles._ensureIndex( { feed_id: 1, date: -1} );

Accounts.config({sendVerificationEmail: true});

Facts.setUserIdFilter(function ( userId ) {
  var user = Meteor.users.findOne(userId);
  return user && user.admin;
});

FastRender.onAllRoutes( function( ) {
  var self = this,
      feed_ids,
      visibleFields = {_id: 1, title: 1, source: 1, date: 1, summary: 1, link: 1, clicks: 1, readCount: 1};

  if ( self.userId )
    feed_ids = Meteor.users.findOne( self.userId, {fields: {feedList: 1}} ).feedList;
  else
    feed_ids = Feeds.find( {subscribers: null}, {fields: {_id: 1}}).map ( function( feed ) { return feed._id;});

  self.subscribe( 'feeds' );
  self.subscribe( "articles", feed_ids, 20);
});

//prepare userdata and feedlist for all clients ASAP
Meteor.publish( 'feeds', function(){
  var self = this;
  var feedFields = {_id: 1, title: 1, url: 1, last_date:1};
  var cursors = [];
  if ( self.userId ){
    cursors.push( Meteor.users.find( self.userId, {fields: {admin: 1}} ) );
  }
  cursors.push( Feeds.find( { subscribers: self.userId }, { fields: feedFields }) );
  return cursors;
});

Meteor.publish( 'articles', function( feed_ids, limit ){
  var self = this;
  check( feed_ids, [String] );
  check( limit, Number );
  var startDate = keepLimitDate();
  var visibleFields = {_id: 1, title: 1, source: 1, date: 1, summary: 1, link: 1, feed_id: 1};
  return Articles.find( {feed_id: {$in: feed_ids}, date: {$gt: startDate}}, {fields: visibleFields, limit: limit, sort: {date: -1, _id: 1}});
});

Meteor.startup( function(){

  Meteor.call('findArticles', {} );

  Meteor.call('removeOldArticles');

  if ( !intervalProcesses[ "removeOldArticles"] ){
    var pro = Meteor.setInterval(function (){
      Meteor.call('removeOldArticles'); },
      DAY);
    intervalProcesses["removeOldArticles"] = pro;
  }

  if ( !intervalProcesses[ "findArticles"] ){
    var pro = Meteor.setInterval( function(){
      Meteor.call('findArticles', { hub: null});
      },
      updateInterval);
    intervalProcesses[ "findArticles"] = pro;
  }

  var options = {
    callbackPath: "hubbub",  //leave slash off since this will be argument to eteor.AbsoluteUrl()
    secret: Random.id()
  };

//if no ROOT_URL was set assume we are on my server
  if ( Meteor.absoluteUrl() === "http://localhost:3000/"){
    options.callbackUrl = "http://localhost:3000/" + options.callbackPath;
  }

  feedSubscriber = new FeedSubscriber ( options );

  feedSubscriber.on(
    'liveFeed',
    Meteor.bindEnvironment( FeedParser.readAndInsertArticles, function( error ) { console.log( error ); } )
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

  var boundCallback = Meteor.bindEnvironment( function (error, topic){
    if ( error ) {
      console.error( error );
    } else {
      console.log( feed.url + " : " + topic );
    }
  }, function ( e) { throw e;});

  var handle = Feeds.find({hub: {$ne: null}},{fields: {_id: 1, hub:1, url:1}}).observeChanges({

    added: function ( id, fields ){
	    feedSubscriber.subscribe ( fields.url, fields.hub , id, boundCallback );
    },

    removed: function( id ){
      feedSubscriber.unsubscribe( id );
    },

    changed: function ( id, fields ){
	    feedSubscriber.unsubscribe( id );
      var feed = Feeds.findOne( id );
	    feedSubscriber.subscribe ( feed.url, feed.hub , id, boundCallback);
    }
  });
});

Meteor.methods({

  findArticles: function( criteria ) {
    check ( criteria,  Object );
    console.time("findArticles");
    criteria = criteria || {};
    var article_count = 0;
    var rssResults = FeedParser.syncFP( Feeds.find( criteria ).fetch() );

    rssResults.forEach( function( rssResult ){
      if ( rssResult.statusCode === 200 ) {
        Feeds.update(rssResult._id, {$set: _( rssResult ).pick( 'lastModified', 'etag', 'lastDate' ) } );
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
      feedSubscriber.subscribe( feed.url, feed.hub , feed._id, onErr );
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
