var DAY = 1000 * 60 * 60 * 24;
var daysStoreArticles = 3.0;
var updateInterval = 1000 * 60 * 15;
var intervalProcesses = {};
var articlePubLimit = 150;
var maxArticlesFromSource = 25;
var keepLimitDate = function(){
  return new Date( new Date().getTime() - ( DAY * daysStoreArticles ));
};

Accounts.config({sendVerificationEmail: true});

Facts.setUserIdFilter(function ( userId ) {
  var user = Meteor.users.findOne(userId);
  return user && user.admin;
});

FastRender.onAllRoutes( function( ) {
  
  var self = this;
  console.log( "fastrender userId: " + self.userId );
  var feed_ids = Feeds.find({ subscribers: self.userId },  {fields: {_id: 1}}).map( function( doc ) {return doc._id;});
  var visibleFields = {_id: 1, title: 1, source: 1, date: 1, summary: 1, link: 1, clicks: 1, readCount: 1};
  //self.find( Feeds, {subscribers: self.userId}, {fields: {_id: 1, title: 1, url:1, last_date:1}}); 
  self.find( Articles,{ feed_id: {$in: feed_ids}, date: {$gt: keepLimitDate()} }, { sort: {date: -1}, limit: 20, fields: visibleFields } );
  //self.completeSubscriptions(['feedsWithArticles']);
});


Meteor.publish( "feedsWithArticles", function(){
  var self = this;
  var subscriptions = [];
  var initialising = true;
  var init = true;
  var articleHandle;
  var startDate = keepLimitDate();
  var visibleFields = {_id: 1, title: 1, source: 1, date: 1, summary: 1, link: 1, clicks: 1, readCount: 1, feed_id: 1};

  var startArticleObserver = function( ){
    var pubCount = 0;
    var countId;
    init = true;
    var handle = Articles.find({feed_id: {$in: subscriptions}, date: {$gt: startDate}}, {sort: { feed_id: 1, date: -1}, fields: visibleFields}).observeChanges({
      //_suppress_initial: true,
      added: function( id, doc){
         if ( countId !== doc.feed_id){
           countId = doc.feed_id;
           pubCount =0;
         }
         if ( ! init || ( initialising && pubCount < maxArticlesFromSource))
           self.added( "articles", id, doc );
         pubCount++;
         //console.log( "initialising: " + initialising + " : " + doc.title+ " : " + doc.feed_id + " : " + pubCount);
      },
      removed: function( id ) {
        if ( _.keys( self._documents.articles).indexOf( id ) > 0)
          self.removed( "articles", id );
      },
      changed: function( id, doc){
        if ( _.keys( self._documents.articles).indexOf( id ) > 0)
          self.changed( "articles", id, doc );
      }
    });
    init = false;
    return handle; 
  };

  var feedHandle = Feeds.find( {subscribers: self.userId}, {fields: {_id: 1, title: 1, url:1, last_date:1}}).observeChanges({
    added: function( id, doc){
      if ( articleHandle )
        articleHandle.stop();

      self.added( "feeds", id, doc);
      subscriptions.push( id );
      if (! initialising){
        Articles.find({feed_id: id, date: {$gt: startDate}}, {sort: {date: -1}, limit: maxArticlesFromSource, fields: visibleFields}).forEach( function( article) {
          self.added( "articles", article._id, article );
        });
      
        articleHandle = startArticleObserver( );
      }
    },
    removed: function( id ){
      if ( articleHandle )
        articleHandle.stop();
      Articles.find({feed_id: id, _id: {$in: _.keys( self._documents.articles) }}, {fields: {_id: 1}}).forEach( function (article){
        self.removed( "articles", article._id);
      });
      self.removed( "feeds", id);      
      subscriptions.splice( subscriptions.indexOf( id ), 1);
      if ( ! initialising )
        articleHandle = startArticleObserver( );
    },
    changed: function( id, doc){
      self.changed( "feeds", id, doc);  
    }
  });
 
  if ( initialising ){
    articleHandle = startArticleObserver( );
    self.ready();
  }
  
  initialising = false;

  self.onStop( function(){
    feedHandle.stop();
    articleHandle.stop();
  });
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
  //unsafe eval in FastRender.
  BrowserPolicy.content.allowEval();
  
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

  var feedSubscriber = new FeedSubscriber ( options );
  feedSubscriber.on( 'liveFeed', Meteor.bindEnvironment( readAndInsertArticles, function( error ) { console.log( error ); } ));

  process.on('exit', Meteor.bindEnvironment ( function (){
    feedSubscriber.stopAllSubscriptions();
    Meteor.setTimeout ( function() { 
      console.log( "paused to allow subscriptions to end");
    }, 8000 );
  }, function ( e ) { throw e; }));

  _.each(['SIGINT', 'SIGHUP', 'SIGTERM'], function (sig) {
    process.once(sig, Meteor.bindEnvironment (function () {
       console.log ( "process received : " + sig);
      feedSubscriber.stopAllSubscriptions();
      Meteor.setTimeout ( function() { 
        process.kill( process.pid, sig);
      }  , 8000 );
    }, function ( e ) { throw e; }));
  });


  var handle = Feeds.find({},{fields: {_id: 1, hub:1, url:1}}).observeChanges({

    added: function ( id, fields ){
      if ( fields.hub ){

	feedSubscriber.subscribe ( fields.url, fields.hub , id, Meteor.bindEnvironment( function (error, topic){
	  if ( error ) { 
	    console.error( error );
	  } else {
	    console.log( fields.url + " : " + topic );
	  }
	}, function ( e) { throw e;}) ); 
      } 
    },

    removed: function( id ){
      feedSubscriber.unsubscribe( id );
    },

    changed: function ( id, fields ){
      if ( fields.hub ) {
	feedSubscriber.unsubscribe( id );
        var feed = Feeds.findOne( id );
	feedSubscriber.subscribe ( feed.url, feed.hub , id, Meteor.bindEnvironment( function (error, topic){
	  if ( error ) {
	    console.error( error );
	  } else {
	    console.log( feed.url + " : " + topic );
	  }
	}, function ( e) { throw e;}) );

      }
    }
  });
});

Meteor.methods({

  findArticles: function( criteria ) {
    check ( criteria,  Object ); 
    console.time("findArticles");
    criteria = criteria || {};		
    //console.log("looking for new articles");
    var article_count = 0;         

    //var rssResults = multipleSyncFP ( Feeds.find( criteria ).fetch() );
    var rssResults = multipleSyncFP( Feeds.find( criteria ).fetch() );

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
//console.log("finished find articles " + (new Date() - start ) / 1000 + " seconds"); 
  },

  findHubs : function(){
    Feeds.find({}, {fields: {_id:1, url: 1}}).forEach( function( feed ) {
      var result = syncFP( feed );
      if ( result.hub ){
	Feeds.update( {_id: feed._id}, { $set: { hub: result.hub}}, function ( error ){
	  if ( error )  console.error ( error.reason);
	  else console.log( result.title + " updated with hub " + result.hub);
	});
      }
    });
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
      var result = syncFP( feed );
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

  checkAdmin: function(){
    var user = Meteor.users.findOne( {_id: this.userId} );
    return user && user.admin;
  }

});
