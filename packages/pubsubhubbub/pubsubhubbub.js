var Future = Npm.require('fibers/future');

var request = Npm.require( 'request');
var Stream = Npm.require("stream").Stream;
var urllib = Npm.require("url");
var utillib = Npm.require("util")
var crypto = Npm.require("crypto");


FeedSubscriber = function ( options ){
  var self = this;
  Stream.call( self );

  options = options || {};
  
  self.callbackPath = options.callbackPath || "";
  self.callbackUri = options.callbackUri || "/" + self.callbackPath;
  self.callbackUrl = options.callbackUrl ||  Meteor.absoluteUrl( self.callbackPath );
  self.secret = options.secret || null;
  self.subscriptions = new Meteor.Collection( null );

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
  console.log ( "started a feed subscriber with url : " + self.callbackUrl);
  
  self.on( 'denied', function ( data ){
    console.error ( "denied request: " + data); 
  });

  self.on ( 'subscribe' , Meteor.bindEnvironment( function ( data ) {
    self.subscriptions.update( {sourceUrl: data.topic}, {$set: {subscribed: true}}, function ( error ) {
      if ( error ) { 
        console.error( "unmatched subscription: " + data);
        console.error( "subscrition collection responded: " + error);
      } else {
         console.log ( "subscribed to : " + data.hub + " : " + data.topic );
      }
   })}, function () { console.log('Failed to bind environment'); }) );
    
  self.on ( 'unsubscribe' , Meteor.bindEnvironment( function ( data ) {
    self.subscriptions.remove( {sourceUrl: data.topic} , function ( error ) { 
      if ( error ) {
        console.error( "unmatched removal: " + data);
        console.error( "subscrition collection responded: " + error);
      } else console.log( "unsubscribed from : " + data.topic);
    } )}, function () { console.log('Failed to bind environment'); }) );

  process.stdin.resume();

  process.on( 'EXIT', function(){

    console.log( "stopped, will unsubscribe");
    self.stopAllSubscriptions();
    self.on( 'exitOK', function(){
      process.exit();
    });
  });

  process.on( 'SIGINT', function(){
    
    console.log( "stopped, will unsubscribe");
    self.stopAllSubscriptions();
    self.on( 'exitOK', function(){
      process.exit();
    });
  });

};

utillib.inherits( FeedSubscriber, Stream );


FeedSubscriber.prototype.stopAllSubscriptions = function(){

    var self = this;
    var count = 0;
    self.subscriptions.find({ subscribed: true }).forEach( function ( sub ){  
      self.unsubscribe( sub );
      count++;
    });
    self.on( 'unsubscribe', function(){
      count--;
      count === 0 && self.emit( 'exitOk', null);
    });
};

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
    self._parseFeed( topic, fp  );
    res.writeHead(204, {'Content-Type': 'text/plain; charset=utf-8'});
    res.end();
  }).bind( self ));

};

FeedSubscriber.prototype._parseFeed = function ( topic, fp ){
  var self = this;
  fp.on('error', function(err ){
      console.log(" got feedparser error: " + err);
      })
  .on('readable', function(){
      var stream = this, item, feedResult = {};
      while ( item = stream.read() ) {
        item.sourceUrl = topic;
        var fut = new Future();
	fut.return ( self.subscriptions.findOne({ sourceUrl: topic }) );
        var sub = fut.wait();
        console.log( sub );
	if ( sub ) item.feed_id = sub._id;
        
        self.emit( 'feed', item);      
      }
   }
  );

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
//  console.log(  mode + " : " + topic);  
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
        } else{
          return self.emit("denied", {topic: topic, error: error});
        }
      }

      if(response.statusCode != 202 && response.statusCode != 204){
        var err = new Error("Invalid response status " + response.statusCode);
        err.responseBody = (responseBody || "").toString();
        if(callback){
          return callback(err);
        } else{
          return self.emit("denied", {topic: topic, error: err});
        }
      }

      return callback && callback(null, topic);
  });

};

FeedSubscriber.prototype.subscribe = function ( topic, hub, _id, callbackUrl, callback ){
  self = this;
  self.subscriptions.insert ( {_id: _id, sourceUrl: topic, hub: hub }, function( error, id ) {
    if ( error ) {
      console.error ( error );
    } else {
     self.sendRequest( "subscribe", topic, hub, callback );
   } 
  });
};

FeedSubscriber.prototype.unsubscribe = function ( sub ){ 
   var self = this;
   sub.subscribed = true;
   var feed = self.subscriptions.findOne( sub );
   if ( feed ){ 
      self.sendRequest( "unsubscribe", feed.sourceUrl, feed.hub );
   }  else {
      console.error( " No subscription found with  :  " + JSON.stringify( sub )  );
   }
   
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
