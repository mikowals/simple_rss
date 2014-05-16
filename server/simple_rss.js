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

  if ( self.userId ){
    feed_ids = Meteor.users.findOne( self.userId, {fields: {feedList: 1}} ).feedList;
  } else{
    feed_ids = Feeds.find( {subscribers: null}, {fields: {_id: 1}}).map ( function( feed ) { return feed._id;});
  }

  self.find( Articles,{ feed_id: {$in: feed_ids}, date: {$gt: keepLimitDate()} }, { sort: {date: -1}, limit: 20, fields: visibleFields } );
  self.completeSubscriptions(['feedsWithArticles']);
});

Meteor.publish( "feedsWithArticles", function( articleLimit ){
  var self = this;
  articleLimit = articleLimit || articlePubLimit;
  check( articleLimit, Number );
  var feedList = [];
  var initialising = true;
  var articleHandle, userHandle, nullUserHandle;
  var startDate = keepLimitDate();
  var visibleFields = {_id: 1, title: 1, source: 1, date: 1, summary: 1, link: 1};
  var feedFields = {_id: 1, title: 1, url: 1, last_date:1};

  function startArticleObserver() {
    //when limit is working again, uncomment code and simplify publish so article observer publishes all articles it finds and removes any articles it doesn't find.
    // no longer need feed_id in visible fields, no more counting, feedobserver manages feeds and article observer manages articles.
    articleHandle && articleHandle.stop();
    var publishedArticles = _.clone( self._documents.articles || {} );
    var init = true;
    var criteria = {date: {$gt: startDate}};
    var feedList = _.keys( self._documents.feeds || null );
    if ( feedList )
      _.extend( criteria, {feed_id: {$in: feedList }});
    var options = {limit: articleLimit, sort: { date: -1}, fields: visibleFields};
    var handle = Articles.find( criteria, options ).observeChanges({
      added: function( id, doc){
        if ( ! init || ! publishedArticles[ id ] )
          self.added( "articles", id, doc );
        else delete publishedArticles[ id ];
      },
      removed: function( id ) {
        if ( self._documents.articles[ id ])
          self.removed( "articles", id );
      },
      changed: function( id, doc){
        if ( self._documents.articles[ id ] )
          self.changed( "articles", id, doc );
      }
    });

    _.keys( publishedArticles ).forEach( function ( id ){
      self.removed( "articles", id );
    });
    init = false;
    return handle;
  };

  function feedsForNullUser(){
    return Feeds.find({subscribers: null}, {fields: feedFields }).observeChanges({
      added: function( id, feed ){
        self.added( 'feeds', id, feed);
        if ( ! initialising ) articleHandle = startArticleObserver();
      },
      removed: function( id ){
        self.removed( 'feeds', id);
        articleHandle = startArticleObserver();
      },
      changed: function( id, fields){
        self.changed( 'feeds', id, fields);
      }
    });
  }

  self.onStop( function(){
    nullUserHandle && nullUserHandle.stop();
    userHandle &&  userHandle.stop();
    articleHandle && articleHandle.stop();
  });


  userHandle = Meteor.users.find( self.userId, {feedList: 1} ).observeChanges({
      added: function( id, doc ){
        //user has changed so remove all feeds
        if( self._documents.feeds){
          nullUserHandle && nullUserHandle.stop();
          _.keys( self._documents.feeds ).forEach( function( id ){
            self.removed( 'feeds', id);
          });
        }

        Feeds.find( {_id: {$in: doc.feedList}}, {fields: feedFields}).forEach( function ( feed ){
          self.added( 'feeds', feed._id, feed );
        });
        if ( ! initialising ) articleHandle = startArticleObserver();
      },
      changed: function( id, doc ){
        _.difference( doc.feedList, _.keys( self._documents.feeds ) ).forEach( function( newId ){
          var feed = Feeds.findOne( newId, {fields: feedFields} );
          feed && self.added( 'feeds', newId, feed );
          console.log( 'publishing: ', newId);
        });
        _.difference( _.keys( self._documents.feeds ), doc.feedList ).forEach( function( removeId ){
          self.removed( 'feeds', removeId );
        });
        articleHandle = startArticleObserver();
      },
      removed: function( id ){
        _.keys( self._documents.feeds ).forEach( function( id ){
          self.removed( 'feeds', id);
        });
        nullUserHandle = feedsForNullUser();
        articleHandle = startArticleObserver();
      }
    });
    if ( ! self._documents.feeds )
      nullUserHandle = feedsForNullUser();

    articleHandle = startArticleObserver();
  initialising = false;

  return [
    Meteor.users.find( {_id: self.userId}, {fields: {admin: 1}})
  ];
});

Articles.allow({
  insert: function ( doc ) {
    return false //(userId && doc.owner === userId);
  },
  update: function (userId, doc, fieldNames, modifier ) {
    return false;
  },

  remove: function ( doc ) {
 // can only remove your own documents
  return false //doc.owner === userId;
 }
 //fetch: ['owner']
});

Feeds.allow({
  insert: function (userId, doc) {
    return false;
  },

  update: function (doc, fields, modifier) {
    return false;
  },

  remove: function(userId, doc){
    return false; //doc.subscribers.length === 1 && doc.subscribers[0] === userId;
  }

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
  feedSubscriber.on( 'liveFeed', Meteor.bindEnvironment( FeedParser.readAndInsertArticles, function( error ) { console.log( error ); } ));

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

    rssResults.forEach(function(rssResult){
      if ( rssResult.statusCode === 200 ) {
        Feeds.update(rssResult._id, {$set: {lastModified: rssResult.lastModified, etag: rssResult.etag, lastDate: rssResult.date } } );
      }
      else if ( rssResult.error ) console.log (rssResult.url + " returned " + rssResult.error);
      else if (typeof rssResult.statusCode === "number" && rssResult.statusCode !== 304 ){
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
