var pubsub = Npm.require('pubsubhubbub').PubSubHubbub;
var nodepie = Npm.require('nodepie');
var Future = Npm.require('fibers/future');
var request = Npm.require( 'request');

var subscriptions = [];

nodepie.NS.feedburner = 'http://rssnamespace.org/feedburner/ext/1.0';
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
           subscriptions.push( data.topic );
console.log ("pubsub - subscribe: " + JSON.stringify ( data ) );
           return;
});

feedSubscriber.on("unsubscribe", function(data){
	var removeId = subscriptions.indexOf( data.topic );
	subscriptions.splice( removeId, 1 );
	console.log("Unsubscribe");
	console.log(data);
});

feedSubscriber.on( 'error', function (err){
           console.log ("pubsub - error: " + err );
           return;
});

feedSubscriber.on( 'feed', function (feed){
    var article = new Article().fromNodePieFeed( feed );
    if ( subscriptions.indexOf( article.sourceUrl ) !== -1 ) article.tmpStorage.insert( article );  
    console.log( "pubsub -feed: " + article.title + " : " + article.source );
    return;  
    });

feedSubscriber.on("listen", function(){
    listening = true;
    return;
    });

var subscribe =  function ( topic, hub ){
  if ( subscriptions.indexOf (topic) === -1 ){
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

  Future.wait( futures );

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

unsubscribePubSub = function ( feeds ){
  feeds.forEach( function ( feed ) {
	feedSubscriber.unsubscribe ( feed.url, feed.hub, function ( error, data ){
	if (error) console.log( "pubsub unsubscibe go error " + error );
	 });
  });
};

var _npParse = function( feedXml ){
  
  var npFeed = new nodepie ( feedXml );
  npFeed.init();
  
  return npFeed;
};

getArticlesNP = function ( feeds ){

	var futures = _.map( feeds, function( feed ){
		return getFeedNP( feed );
	});

	Future.wait( futures );
console.log(" all futures returned by NodePie ");
	return _.invoke( futures, 'get' );
};

getFeedNP = function( feed ){
	var future = new Future();
	var options = {url: feed.url, headers: {}, timeout: 10000 };
	options.headers['If-None-Match'] = feed.etag;
	options.headers['If-Modified-Since'] = feed.lastModified;
	//options.headers['Accept-Encoding'] = "gzip, deflate";
	var r = request (options, function (error, response, body){
		var returnObj = error || response;			
		if (error){ 
			console.log ( feed.url + "got request error: " + error );
		}
		else if ( response && response.statusCode === 200 && body) {
			feed.statusCode = 200;
			feed.etag = response.headers[ 'etag' ] ;
			feed.lastModified = response.headers[ 'last-modified' ] ;
			//console.log ( body );
			var npFeed = _npParse( body );
			feed.url = npFeed.getSelf() || feed.url;
			feed.url = feed.url.toLowerCase();
			feed.title = npFeed.getTitle();
			feed.lastDate = npFeed.getDate();

			npFeed.feed_id = feed._id;
			for ( var ii = 0; ii < npFeed.getItemQuantity(); ii++){
				var doc = new Article().fromNodePieFeed( npFeed, ii );
				tmpStorage.insert( doc, function( error , result){
					if ( error ) console.log( 'getFeedNP error: ' + error);
				} );
			}
			returnObj = feed;
		}
		else if (response && response.statusCode !== 304){
			console.log( feed.url + " received statusCode: " + response.statusCode);

		  }
		future.ret ( returnObj );	  
	});
	return future;
};



