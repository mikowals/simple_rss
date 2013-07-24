var pubsub = Npm.require('pubsubhubbub').PubSubHubbub;
var nodepie = Npm.require('nodepie');
var Future = Npm.require('fibers/future');
var request = Npm.require( 'request');
var subscriptions = {};

pubsub.prototype.serverPOSTHandler = function(req, res){
var self = this;
var feedResult = {};
var fp = req.pipe( new feedParser());
  fp.on('error', function(err ){
        console.log(" got feedparser error: " + err);
        res.error = err;
        })
      .on ( 'meta', function ( meta ){
        //console.log( "feedparser emmitted meta for url: " + url );
        if (meta !== null ){
          feedResult.meta  = meta;
        }
      })
      .on('readable', function(){
          var stream = this, item, doc;
          while ( item = stream.read() ) {

           feedResult.article = item ;
          }
          self.emit( 'feed', feedResult);
      })
      .on( 'end', function() {
      //    console.log( feedResult.meta ); 
          });

    req.on("end", (function(){
        res.writeHead(204, {'Content-Type': 'text/plain; charset=utf-8'});
        res.end();
    }).bind(this));

}

var listening = false;

var options = {
  port: 8084,
  callbackServer: "http://pubsub.mak-play.com",
  token: Random.id()
};

console.log("pubsub token: " + options.token); 

var feedSubscriber = new pubsub( options );

feedSubscriber.on( 'subscribe', function ( data ){
	console.log ("pubsub - subscribe: " + data.topic );
        return;
});

feedSubscriber.on("unsubscribe", function(data){
	console.log("Unsubscribe");
	console.log(data);
});

feedSubscriber.on( 'error', function (err){
           console.log ("pubsub - error: " + err );
           return;
});

feedSubscriber.on( 'feed', function (feed){
	var article = new Article().fromFeedParserItem( feed.article );
	article.source = feed.meta.title;
        if ( subscriptions[ article.source ]){
	//	console.log( "pubsub - feed: " + JSON.stringify ( feed.meta ) );
		article.feed_id = subscriptions[ article.source ];
		tmpStorage.insert( article );  
	}
	console.log( "pubsub -feed: " + article.title + " : " + article.source + " : " + article.feed_id);
    return;  
});

feedSubscriber.on("listen", function(){
    listening = true;
    return;
    });

var subscribe =  function ( feed ){
  if ( ! subscriptions[ feed.title ] ){
    feedSubscriber.subscribe(feed.url, feed.hub, function(err, subscription){
	if(err){
	//                           console.log("Subscribing failed");
	console.log("pubsub subscription " + feed.url + " got error " + err);
	return;
	}

	if(subscription === feed.url){
		subscriptions[ feed.title ] =  feed._id;
                subscriptions[ feed._id ] = { title: feed.title, url: feed.url, hub: feed.hub };
	}else{
	console.log("pubsub - Invalid response: " + subscription + " !== " + feed.url );
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
	console.log( JSON.stringify ( feed ) );
	var feedObj = _npParse( body );
	console.log( "getHubs nodepie : " +  feedObj.getTitle() + " : " + feedObj.getHub());
	var updatedFeed = feed;
	updatedFeed.hub = feedObj.getHub() || null;
	future.ret ( updatedFeed );
	}
	else future.ret ( null );
	});
      return future.wait();
      });

 // Future.wait( futures );

  return _.invoke( futures, 'get');
};

subscribeToPubSub = function( feeds ) {
  while ( feeds.length > 0 ){
		var ii = feeds.length -1;
		if ( listening ) {
			subscribe ( feeds[ ii ] ) 
			feeds.splice( ii, 1);
		}
	}	
};

unsubscribePubSub = function ( feeds ){
  feeds.forEach( function ( feed_id ) {
    var feed = subscriptions.feed_id;
    feedSubscriber.unsubscribe ( feed.url, feed.hub, function ( error, data ){
      if (error){
	console.log( "pubsub unsubscibe go error " + error );
      }	
      else {
	delete subscriptions[ feed.title ];
      }
    });
  });
};

var _npParse = function( feedXml ){

  var npFeed = new nodepie ( feedXml );
  try {
    npFeed.init();
    return npFeed;
  }
  catch ( e ){
    console.log("_npParese got error: " +  e);
console.log ( feedXml.substring( 0, 100) );
      return null
  } 
};

findArticlesNP = function ( feeds ){

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
			if ( npFeed) {
				 feed.title = npFeed.getTitle();
				feed.lastDate = npFeed.getDate();
				npFeed.url = feed.url;
				npFeed.feed_id = feed._id;
				for ( var ii = 0; ii < npFeed.getItemQuantity(); ii++){
					var doc = new Article().fromNodePieFeed( npFeed, ii );
					tmpStorage.insert( doc, function( error , result){
						if ( error ) console.log( 'getFeedNP error: ' + error);
					} );
				}
				returnObj = feed;
			}
		}
		else if (response && response.statusCode !== 304){
			console.log( feed.url + " received statusCode: " + response.statusCode);

		  }
		future.ret ( returnObj );	  
	});
	return future;
};



