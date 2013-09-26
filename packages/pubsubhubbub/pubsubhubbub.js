var Future = Npm.require('fibers/future');
var request = Npm.require( 'request');
var Stream = Npm.require("stream").Stream;
var urllib = Npm.require("url");
var utillib = Npm.require("util")
var crypto = Npm.require("crypto");
var subscriptions = {};


var options = {
  callbackPath: "hubbub",  //leave slash off since this will be argument to eteor.AbsoluteUrl()
  secret: Random.id()
};


//if no ROOT_URL was set assume we are on my server
if ( Meteor.absoluteUrl() === "http://localhost:3000/"){
  options.callbackUrl = "http://localhost:3000/" + options.callbackPath;
}

console.log( options );
console.log ( Meteor.absoluteUrl() );
function FeedSubscriber ( options ){
  var self = this;
  Stream.call( self );

  options = options || {};
  
  self.callbackPath = options.callbackPath || "";
  self.callbackUri = options.callbackUri || "/" + self.callbackPath;
  self.callbackUrl = options.callbackUrl ||  Meteor.absoluteUrl( self.callbackPath );
  self.secret = options.secret || null;

  WebApp.connectHandlers.stack.splice(0,0,{
      route: self.callbackUri,
      handle: function(req, res, next) {
       if(req.method === 'POST') {
         return  self.onPostRequest( req, res);
       }
       else if(req.method === 'GET') {
         return self.onGetRequest( req, res);
     } else {
         return self._sendError(req, res, 405, "Method Not Allowed");
     }
    }
   });
  self.emit( "listen", { uri: self.callbackUri });

  self.listening = true;
  console.log ( "started a feed subscriberi : " + self.callbackUrl);

};

utillib.inherits( FeedSubscriber, Stream );

FeedSubscriber.prototype.onPostRequest = function(req, res){
  var self = this;

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
    return self._sendError(req, res, 400, "Bad Request");
  }

  if( self.secret && !req.headers['x-hub-signature']){
    return self._sendError(req, res, 403, "Forbidden");
  }

  if( self.secret){
    signatureParts = req.headers['x-hub-signature'].split("=");
    algo = (signatureParts.shift() || "").toLowerCase();
    signature = (signatureParts.pop() || "").toLowerCase();

    try{
      hmac = crypto.createHmac(algo, crypto.createHmac("sha1", self.secret).update( topic ).digest("hex"));
    }catch(E){
      console.log( "caught error - line 74 " + E);
      return self._sendError(req, res, 403, "Forbidden");
    }
  }
/**
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
**/
  var fp = req.pipe( new feedParser());
  req.on( 'data', function ( data) {
    hmac.update ( data );
  });
  req.on("end", (function(){
    var sig = hmac.digest('hex');
    if( self.secret && sig != signature){
      console.log( topic + " :  did not get matching signatures" );
      console.log( sig );
      console.log ( signature );
      return self._sendError(req, res, 403, "Forbidden");
    }
    self._parseFeed( fp  );
    res.writeHead(204, {'Content-Type': 'text/plain; charset=utf-8'});
    res.end();
  }).bind( self ));

};

FeedSubscriber.prototype._parseFeed = function ( fp ){
  var self = this;
  fp.on('error', function(err ){
      console.log(" got feedparser error: " + err);
      })
  .on('readable', function(){
      var stream = this, item, feedResult = {};
      while ( item = stream.read() ) {
        feedResult.meta = item.meta;
        feedResult.article = item ;
      }
      self.emit( 'feed', feedResult);
   })

};

FeedSubscriber.prototype.onGetRequest = function( req, res ){

  self = this;
  var params = urllib.parse(req.url, true, true),
      data;

  if(!params.query["hub.topic"] || !params.query['hub.mode']){
    return self._sendError(req, res, 400, "Bad Request");
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
      return self._sendError(req, res, 403, "Forbidden");
  }

  self.emit(params.query["hub.mode"], data);
};

FeedSubscriber.prototype.sendRequest = function( mode, topic, hub, callbackUrl, callback ){
  var self = this;
  console.log( "subscribing with : " + mode + ", " + topic);  
  if(!callback && typeof callbackUrl == "function"){
    callback = callbackUrl;
    callbackUrl = undefined;
  }

  callbackUrl = callbackUrl || self.callbackUrl + 
    (self.callbackUrl.replace(/^https?:\/\//i, "").match(/\//)?"":"/") +
    (self.callbackUrl.match(/\?/)?"&":"?") +
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

  if(self.secret){
    form["hub.secret"] = crypto.createHmac("sha1", self.secret).update(topic).digest("hex");
  }

  request.post(postParams, function(error, response, responseBody){

      if(error){
      if(callback){
      return callback(error);    
      }else{
      return self.emit("denied", {topic: topic, error: error});
      }
      }

      if(response.statusCode != 202 && response.statusCode != 204){
      var err = new Error("Invalid response status " + response.statusCode);
      err.responseBody = (responseBody || "").toString();
      if(callback){
      return callback(err);
      }else{
      return self.emit("denied", {topic: topic, error: err});
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

FeedSubscriber.prototype._sendError = function(req, res, code, message){
    res.writeHead( code, {"Content-Type": "text/html"});
    res.end("<!DOCTYPE html>\n"+
            "<html>\n"+
            "    <head>\n"+
            "        <meta charset=\"utf-8\"/>\n"+
            "        <title>" + code + " " + message + "</title>\n"+
            "    </head>\n"+
            "    <body>\n"+
            "        <h1>" + code + " " + message + "</h1>\n"+
            "    </body>\n"+
            "</html>");
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
	article.source = feed.meta && feed.meta.title;
        if ( subscriptions[ article.source ]){
	//	console.log( "pubsub - feed: " + JSON.stringify ( feed.meta ) );
		article.feed_id = subscriptions[ article.source ];
		tmpStorage.insert( article );  
	}
	console.log( "pubsub -feed: " + article.title + " : " + article.source + " : " + article.feed_id);
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

subscribeToPubSub = function( feeds ) {
  while ( feeds.length > 0 ){
    var ii = feeds.length -1;
    subscribe ( feeds[ ii ] ); 
    feeds.splice( ii, 1);
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


