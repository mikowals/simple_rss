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
  return _publishArticleToStorage ( feed.getItem(), tmpStorage);
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
  
  var npFeed = nodepie ( feexXml );
  npFeed.init();
  
  return npFeed;
}

var _articlFromNP = function ( feedItem ){
  
  var item = feedItem;
  var npArticle = {
  title: item.getTitle(),
  link: item.getPermalink(),
  summary: cleanSummary( item.getContents() ),
  date: item.getDate(),
  source: feed.getTitle(),
  guid: item.getGuid(),
  sourceUrl : feed.getSelf()
    
  }
  
  return npArticle;
}

var _publishArticleToStorage = function ( feed , storage ){
	
	var doc = _articleFromNP( feed );
  
  console.log ("pubsub - feed: " + doc.source + " : " + doc.title + " : " + doc.sourceUrl );
	storage.insert( doc, function( error, result){
                    if (error) console.log ( "pubsub error inserting to tmpStorage: " + error );
                    //		if (result) console.log ( "tmpStorage insert: " + ( doc.title || doc.source ));
                    });
  //	console.log("done handling pubsub feed event.  Feed: " + doc.title);
	return true;

}
