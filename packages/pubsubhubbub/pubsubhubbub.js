var pubsub = Npm.require('pubsubhubbub');
var nodepie = Npm.require('nodepie');
var Future = Npm.require('fibers/future');
var request = Npm.require( 'request');
var urllib = Npm.require("url");
var crypto = Npm.require("crypto");
var subscriptions = {};
var listening;

var options = {
  callbackUrl: Meteor.absoluteUrl() + "hubbub",
  secret: Random.id()
};

var feedSubscriber = new pubsub.createServer( options );

  WebApp.connectHandlers.stack.splice(0,0,{
      route: "/hubbub",
      handle: function(req, res, next) {
       if(req.method === 'POST') {
         return  onPostRequest( req, res);

       }

       if(req.method === 'GET') {
         return feedSubscriber._onGetRequest( req, res);
     }
    }
   });
   feedSubscriber.emit( "listen", { uri: "/" + "hubbub" });

  listening = true;

onPostRequest = function(req, res){

    var bodyChunks = [],
        params = urllib.parse(req.url, true, true),
        topic = params && params.query && params.query.topic,
        hub = params && params.query && params.query.hub,
        bodyLen = 0,
        tooLarge = false,
        signatureParts, algo, signature, hmac;

    // v0.4 hubs have a linke header that includes both the topic url and hub url
    (req.headers && req.headers.link || "").
      replace(/<([^>]+)>\s*(?:;\s*rel=['"]([^'"]+)['"])?/gi, function(o, url, rel){
        switch((rel || "").toLowerCase()){
            case "self":
                topic = url;
                break;
            case "hub":
                hub = url;
                break;
        }
    });

    if(!topic){
        console.log ( "no topic" );
        return feedSubscriber._sendError(req, res, 400, "Bad Request");
    }

    if( feedSubscriber.secret && !req.headers['x-hub-signature']){
        return feedSubcriber._sendError(req, res, 403, "Forbidden");
    }

    if( feedSubscriber.secret){
        signatureParts = req.headers['x-hub-signature'].split("=");
        algo = (signatureParts.shift() || "").toLowerCase();
        signature = (signatureParts.pop() || "").toLowerCase();

        try{
            hmac = crypto.createHmac(algo, crypto.createHmac("sha1", feedSubscriber.secret).update( topic ).digest("hex"));
        }catch(E){
            console.log( "caught error - line 74 " + E);
            return feedSubscriber._sendError(req, res, 403, "Forbidden");
        }
    }

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
          feedSubscriber.emit( 'feed', feedResult);
      })
      .on( 'end', function() {
      //    console.log( feedResult.meta ); 
          });
     
      req.on( 'data', function( data ){
         hmac.update( data );
      }); 
      req.on("end", (function(){;
        var sig = hmac.digest('hex');
        if( feedSubscriber.secret && sig != signature){
           console.log( sig );
           console.log ( signature );
           return this._sendError(req, res, 403, "Forbidden");
        }
        res.writeHead(204, {'Content-Type': 'text/plain; charset=utf-8'});
        res.end();
    }).bind( feedSubscriber));

}

console.log("pubsub token: " + options.token); 

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
	future.return ( updatedFeed );
	}
	else future.return ( null );
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
    var feed = subscriptions[ feed_id ] || null;
    if (feed){
      feedSubscriber.unsubscribe ( feed.url, feed.hub, function ( error, data ){
        if (error){
	  console.log( "pubsub unsubscibe go error " + error );
        }	
        else {
	  delete subscriptions[ feed.title ];
          delete subscriptions[ feed_id ];
        }
      });
    }
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
		future.return ( returnObj );	  
	});
	return future;
};



