var pubsub = Npm.require('pubsubhubbub').PubSubHubbub;
var nodepie = Npm.require('nodepie');
var Future = Npm.require('fibers/future');
var request = Npm.require( 'request');

nodepie.Item.prototype.getGuid = function(){
	return this._parseContents( this.element.guid );
};

var listening = false;

var options = {
  port: 8084,
  callbackServer: "http://pubsub.mak-play.com",
  token: Random.id()
};

console.log("pubsub token: " + options.token); 

var feedSubscriber = new pubsub( options );

feedSubscriber.on( 'subscribe', function ( data ){
           console.log ("pubsub - subscribe: " + JSON.stringify ( data ) );
           return
});

feedSubscriber.on( 'error', function (err){
           console.log ("pubsub - error: " + err );
           return
});

feedSubscriber.on( 'feed', function (feed){
  console.log( "pubsub -feed: " + feed.getTitle());
  return _publishArticlesToStorage ( feed, tmpStorage);
});

feedSubscriber.on("listen", function(){
	listening = true;
	return
});

var subscribe =  function ( topic, hub ){
 feedSubscriber.subscribe(topic, hub, function(err, subscription){
                           if(err){
//                           console.log("Subscribing failed");
                           console.log("pubsub subscription " + topic + " got error " + err);
                           return;
                           }

                           if(subscription === topic){
                           //console.log("Subscribed "+topic+" to "+hub);
                           }else{
                           console.log("pubsub - Invalid response: " + subscription + " !== " + topic );
                           return;
                           }
                           });
}

getHubs = function ( feeds ){
  
	var updatedFeeds = [];
	var futures = _.map (feeds, function ( feed ) {
                var future = new Future();
                var r = request ( feed.url, {timeout: 10000}, function( error, response, body){
                                 if (error) console.log( "getHubs error for feed: " + feed.title + " : " + error);
                                 if (response && response.statusCode === 200){
                                 
                                 var feedObj = _npParse( body );
                                 
                                 console.log( "getHubs nodepie : " +  feedObj.getTitle() + " : " + feedObj.getHub());
                                 var updatedFeed = feed;
                                 updatedFeed.hub = feedObj.getHub() || null;
                                 future.ret ( updatedFeed );
                                 }
                                 else future.ret ( null );
                                 });
		return future;
	});
  
  futures.wait();
  
	return _.invoke( futures, 'get');
};

subscribeToPubSub = function( feeds ) {
	while ( feeds.length > 0 ){
		var ii = feeds.length -1;
		if ( listening ) {
			subscribe ( feeds[ ii ].url, feeds[ ii ].hub ) 
			feeds.splice( ii, 1);
		}
	}	
};

var _npParse = function( feedXml ){
  
  var npFeed = new nodepie ( feedXml );
  npFeed.init();
  
  return npFeed;
};

var _articleFromNP = function ( feed, itemNum ){
  
  var item = feed.getItem( itemNum || 0 );
  ;
  var npArticle = {
  title: item.getTitle(),
  link: item.getPermalink(),
  summary: cleanSummary( item.getContents() ),
  date: item.getDate(),
  source: feed.getTitle(),
  guid: item.getGuid() || item.getPermalink(),
  sourceUrl : feed.getSelf(),
  feed_id: feed.feed_id || null  
  }
  
  return npArticle;
};

var _publishArticlesToStorage = function ( feed , storage ){
	var ii = 0;
	var ii = 0;
        while ( ii < feed.getItemQuantity() ) {
		var doc = _articleFromNP( feed, ii );
		if (doc.date > keepLimitDate ){
			storage.insert( doc, function( error, result){
			if (error) console.log ( "pubsub error inserting to tmpStorage: " + error );
                    //		if (result) console.log ( "tmpStorage insert: " + ( doc.title || doc.source ));
			});
		}
		ii++;
	}
  //	console.log("done handling pubsub feed event.  Feed: " + doc.title);
	return ii;

};

getArticlesNP = function( feeds ){

	var futures = _.map( feeds, function( feed ) {
		return getFeedNP ( feed ); 
	});
return futures;
};

getFeedNP = function( feed ){
	var future = new Future();
	var options = {url: feed.url, headers: {}, timeout: 10000 };
	options.headers['If-None-Match'] = feed.etag;
	options.headers['If-Modified-Since'] = feed.lastModified;
	//options.headers['Accept-Encoding'] = "gzip, deflate";
        var interval = Meteor.setInterval( 
		function(){
		console.log ( "waiting for feed: " + feed.title) }, 10000);
	request (options, function (error, response, body){
		var returnObj = error || response;			
		if (error) console.log ( feed.url + "got request error: " + error );
		else if ( response && response.statusCode === 200 && body) {
			feed.statusCode = 200;
			feed.etag = response.headers[ 'etag' ] ;
			feed.lastModified = response.headers[ 'last-modified' ] ;
			//console.log ( body );
			var npFeed = _npParse( body );
			feed.url = npFeed.getPermalink();
			feed.title = npFeed.getTitle();
			feed.lastDate = npFeed.getDate();

			npFeed.feed_id = feed._id;
			_publishArticlesToStorage( npFeed, tmpStorage );
			returnObj = feed;
		}
		else if (response && response.statusCode !== 304){
			console.log( feed.url + " received statusCode: " + response.statusCode);

		  }
		Meteor.clearInterval( interval );
		future.ret ( returnObj );	  
	});

	return future;
};



