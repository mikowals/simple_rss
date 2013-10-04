var DAY = 1000 * 60 * 60 * 24;
var daysStoreArticles = 2;
keepLimitDate = new Date( new Date() - daysStoreArticles * DAY );
var updateInterval = 1000 * 60 * 15;
var intervalProcesses = {};
var articlePubLimit = 150;

Accounts.config({sendVerificationEmail: true});

Feeds = new Meteor.Collection("feeds");
Articles = new Meteor.Collection("articles");
//Articles.ensureIndex( {"date": 1} ); //not working with SmartCollections
 

Meteor.publish("feeds", function () {
  var self = this;
  return Feeds.find({subscribers: self.userId }, {_id: 1, title: 1, url:1, last_date:1});
});

Meteor.publish( "articles", function(){
               var self= this;
               var subscriptions = [];
               
               
               var observer = Feeds.find({ subscribers: self.userId }, {_id: 1}).observeChanges({
                                                                                added: function (id){
                                                                                  subscriptions.push(id);                                       
                                                                                },
                                        
                                                                                removed: function (id){
                                                                                  var ax;
                                                                                  while (( ax = subscriptions.indexOf(id)) !== -1) {
                                                                                  subscriptions.splice(ax, 1);
                                                                                }
                                        
                                                                                }

                                        });

               self.onStop( function() {
                           observer.stop();
			   });
               
              //self.ready();

	var visibleFields = {_id: 1, title: 1, source: 1, date: 1, summary: 1, link: 1};
	return Articles.find({ feed_id: {$in: subscriptions} }, { sort: {date: -1}, limit: articlePubLimit, fields: visibleFields } );
               
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
    return doc.subscribers[0] === userId;
  },

  update: function (doc, fields, modifier) {
    return false;
  },

  remove: function(userId, doc){
    if(doc.subscribers.length > 1){
      Feeds.update(doc._id, {$pull: {subscribers: userId}} );
      return false;
    }
    else{
      return doc.subscribers[0] === userId;
    }
  }
    
  //fetch: ['owner']
});

Feeds.deny({
  insert: function(userId, doc){
	doc.url = doc.url;    
	var existingFeed = Feeds.findOne({url: doc.url});
    if( existingFeed ){
      console.log(doc.url + " exists in db");
      Feeds.update(existingFeed._id, { $addToSet: { subscribers: userId }});
      return true;
    }

    var rssResult = syncFP( doc );
    if ( rssResult.error || rssResult.statusCode !== 200 ){
	console.log(JSON.stringify (rssResult) + " has no data to insert"); 
	return true;

    }
    else if (rssResult.url && doc.url !== rssResult.url ) {
      doc.url = rssResult.url;
      existingFeed = Feeds.findOne( {url: doc.url} );
    }

    if( existingFeed ){
      console.log(doc.url + " exists in db at different url");
      Feeds.update(existingFeed._id, {$addToSet: {subscribers: userId}});
      return true;
    }
           
    else{
      console.log(doc.url + " not in db - adding");
      doc.hub = rssResult.hub || null;
      doc.title = rssResult.title;  
      doc.last_date = rssResult.date;
      doc.subscribers = [];
      doc.subscribers.push(userId);
      doc.lastModified = null;
      return false;
    }

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

  var feedSubscriber = new FeedSubscriber ( options );
  

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
      Articles.remove({ feed_id: id });
      console.log("removed all articles from source: " + id );
    }
  });

});

var eachRecursive = function (obj, resultArr) {
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
}


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

removeOldArticles: function(){
		     console.log("removeOldArticles method called on server");

		     var error = Articles.remove({date:  {$lt: keepLimitDate} }, function(error){ return error;});
		     commonDuplicates = Articles.find({}, { link: 1}).fetch();
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

importOPML: function(upload){
	      check (upload, String);
	      var self = this;
	      var opml = XML2JS.parse(upload);
	      var xmlToAdd = [];
	      eachRecursive(opml, xmlToAdd); 
	      var fpResults = [];

	      xmlToAdd.forEach( function(url){
		  try{
		  var feed = { url: url };
		  if (url !== null && url !== undefined){
		  fpResults.push( syncFP( feed ) );
		  }
		  }
		  catch(e){
		  console.log( e + " parsing url " + url);
		  }
		  });
	      console.log( "finished with feedparser");
	      if ( fpResults ){
		fpResults.forEach( function (rssResult){

		    var doc = {url: rssResult.url, title: rssResult.title, last_date: rssResult.date, subscribers: [] };
		    doc.subscribers.push(self.userId);

		    });
	      }

	    },

lowerCaseUrls: function(){


		       Feeds.find({}).forEach( function (feed){
				       Feeds.update(feed._id, {$set:{url: feed.url.toLowerCase()}});
				       });

		       Articles.find({}).forEach( function ( article) {
				Articles.remove( {_id: {$ne: article._id},link: article.link});
				article.guid = article.guid || article.link;
			       Articles.update( article._id, {$set: { link: article.link.toLowerCase(), guid: article.guid.toLowerCase()}});
			});

	       }


});
