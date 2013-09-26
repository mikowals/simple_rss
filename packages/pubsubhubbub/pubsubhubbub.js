var Future = Npm.require('fibers/future');
var request = Npm.require( 'request');
var Stream = Npm.require("stream").Stream;
var urllib = Npm.require("url");
var utillib = Npm.require("util")
var crypto = Npm.require("crypto");
var subscriptions = {};


var options = {
  callbackUri: "/hubbub",
  callbackUrl: Meteor.absoluteUrl() + "hubbub",
  secret: Random.id()
};

console.log( options );
function FeedSubscriber ( options ){
  var self = this;
  Stream.call( self );

  options = options || {};
  
  var callbackUri = options.callbackUri || "/";
  var callbackUrl = options.callbackUrl ||  Meteor.absoluteUrl() + callbackUri;
  var secret = options.secret || null;

  WebApp.connectHandlers.stack.splice(0,0,{
      route: callbackUri,
      handle: function(req, res, next) {
       if(req.method === 'POST') {
         return  self.onPostRequest( req, res);
       }
       if(req.method === 'GET') {
         return self.onGetRequest( req, res);
     }
    }
   });
  self.emit( "listen", { uri: callbackUri });

  self.listening = true;
};

utillib.inherits( FeedSubscriber, Stream );

FeedSubscriber.prototype.onPostRequest = function(req, res){

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
           console.log( topic + " : " + feedResult.article.title + " -  did not get matching signatures" );
           console.log( sig );
           console.log ( signature );
           return this._sendError(req, res, 403, "Forbidden");
        }
        res.writeHead(204, {'Content-Type': 'text/plain; charset=utf-8'});
        res.end();
    }).bind( feedSubscriber));

  };

  FeedSubscriber.prototype.onGetRequest = function( req, res ){
    
    var params = urllib.parse(req.url, true, true),
            data;

    if(!params.query["hub.topic"] || !params.query['hub.mode']){
            return this._sendError(req, res, 400, "Bad Request");
    }

    switch(params.query['hub.mode']){
      case "denied":
	res.writeHead(200, {'Content-Type': 'text/plain'});
	data = {topic: params.query["hub.topic"], hub: params.query.hub};
	res.end(params.query['hub.challenge'] || "ok");
	break;
      case "subscribe":
      case "unsubscribe":
	res.writeHead(200, {'Content-Type': 'text/plain'});
	res.end(params.query['hub.challenge']);
	data = {
          lease: Number(params.query["hub.lease_seconds"] || 0) + Math.round(Date.now()/1000),
          topic: params.query["hub.topic"],
          hub: params.query.hub
	};
        break;
      default:
        return this._sendError(req, res, 403, "Forbidden");
      }
      
      this.emit(params.query["hub.mode"], data);
    };

  FeedSubscriber.prototype.sendRequest = function( mode, topic, hub, callbackUrl, callback ){
    
    if(!callback && typeof callbackUrl == "function"){
      callback = callbackUrl;
      callbackUrl = undefined;
    }

    callbackUrl = callbackUrl || this.callbackUrl + 
      (this.callbackUrl.replace(/^https?:\/\//i, "").match(/\//)?"":"/") +
      (this.callbackUrl.match(/\?/)?"&":"?") +
      "topic="+encodeURIComponent(topic)+
      "&hub="+encodeURIComponent(hub);

    var form = {
      "hub.callback": callbackUrl,
      "hub.mode": mode,
      "hub.topic": topic,
      "hub.verify": "async"
    },

	postParams = {
          url: hub,
          form: form,
          encoding: "utf-8"
	};

    if(this.secret){
      form["hub.secret"] = crypto.createHmac("sha1", this.secret).update(topic).digest("hex");
    }

    request.post(postParams, function(error, response, responseBody){

	if(error){
	if(callback){
	return callback(error);    
	}else{
	return this.emit("denied", {topic: topic, error: error});
	}
	}

	if(response.statusCode != 202 && response.statusCode != 204){
	var err = new Error("Invalid response status " + response.statusCode);
	err.responseBody = (responseBody || "").toString();
	if(callback){
	return callback(err);
	}else{
	return this.emit("denied", {topic: topic, error: err});
	}
	}

	return callback && callback(null, topic);
    });

  };

FeedSubscriber.prototype.subscribe = function ( topic, hub, callbackUrl, callback ){

   this.sendRequest( "subscribe", topic, hub, callbackUrl, callback );

};

FeedSubscriber.prototype.unsubscribe = function ( topic, hub, callbackUrl, callback ){

   this.sendRequest( "unsubscribe", topic, hub, callbackUrl, callback );

};







var feedSubscriber = new FeedSubscriber( options );

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



