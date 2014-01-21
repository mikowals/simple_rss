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
  self.subscriptions = {};

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
    console.error ( "denied request: " + JSON.stringify( data ) ); 
  });

  self.on ( 'subscribe' , function ( data ) {
    var sub = self.subscriptions[ data.topic ];
    if ( sub ){
      sub['expiry'] = new Date().getTime() + data.lease * 1000;
      console.log ( "subscribed to : " + data.hub + " : " + data.topic );
      setTimeout( function(){
         self.subscribe( data.topic, data.hub, sub._id );
      } , (  Math.min(  data.lease - 60 * 60 ) * 1000, 6 * 24 * 60 * 60 * 1000));
    } else { 
      console.error( "unmatched subscription: " + data.topic);
    }
   });
    
  self.on ( 'unsubscribe' , function ( data ) {
    var sub = self.subscriptions[ data.topic ];
    if ( ! sub ){
       console.error( "unmatched unsubscribe: " + data.topic );
    }
    else if ( sub.unsub ){
     console.log ( " unsubscribed from : " + data.topic); 
     delete sub [ data.topic ];
    } else {
        console.error( "resubscribing to: " + data.topic );
        self.subscribe( data.topic, data.hub, sub._id );
    }   
  });
};

utillib.inherits( FeedSubscriber, Stream );

FeedSubscriber.prototype.stopAllSubscriptions = function(){

    var self = this;
    var count = 0;
    for (var key in self.subscriptions ){
      self.unsubscribe( self.subscriptions[ key ]._id );
      count++;
    };
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
      hmac = crypto.createHmac(algo, crypto.createHmac("sha1", self.secret).update(topic).digest("hex") );
    }catch(E){
      console.log( "caught error - line 74 " + E);
      res.writeHead(204, {'Content-Type': 'text/plain; charset=utf-8'});
      res.end();
      return;
    }
  }
  var fp = req.pipe( new feedParser());
  req.on( 'data', function ( data) {
    hmac.update ( data );
  });
  req.on("end", function(){
    var sig = hmac.digest('hex');
    if( self.secret && sig != signature){
      console.log( topic + " :  did not get matching signatures" );
      console.log( sig );
      console.log ( signature );
      res.writeHead(204, {'Content-Type': 'text/plain; charset=utf-8'});
      res.end();
      return;
    }
    self._parseFeed( topic, fp  );
    res.writeHead(204, {'Content-Type': 'text/plain; charset=utf-8'});
    res.end();
  });
};

FeedSubscriber.prototype._parseFeed = function ( topic, fp ){
  var self = this;
  fp.on('error', function(err ){
      console.log(" got feedparser error: " + err);
      });
  var sub = self.subscriptions[ topic ];
  self.emit( 'liveFeed',  fp, sub );
 
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
     if ( ! self.subscriptions[ params.query["hub.topic"] ] ){
         console.error( "subscription verification error for : " + params.query["hub.topic"]); 
         return self._sendError(req, res, 404, "Not Found");
        } 
        res.writeHead(200, {'Content-Type': 'text/plain'});
        res.end(params.query['hub.challenge']);
        data = {
          lease: Number(params.query["hub.lease_seconds"] || 0) + Math.round(Date.now()/1000),
          topic: params.query["hub.topic"],
          hub: params.query.hub
        };
        break;
    case "unsubscribe":
        if ( ! self.subscriptions[ params.query["hub.topic"] ] ||  ! self.subscriptions[ params.query["hub.topic"] ].unsub ){
          return self._sendError(req, res, 404, "Not Found");
        }
        res.writeHead(200, {'Content-Type': 'text/plain'});
        res.end(params.query['hub.challenge']);
        data = {
          lease: Number(params.query["hub.lease_seconds"] || 0) + Math.round(Date.now()/1000),
          topic: params.query["hub.topic"],
          hub: params.query.hub
        };
        break;
    default:
      return self._sendError(req, res, 404, "Not Found");
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
  self.subscriptions[ topic ] = {_id: _id, url: topic, hub: hub, unsub: false};
  self.sendRequest( "subscribe", topic, hub, callback );
   
};

FeedSubscriber.prototype.unsubscribe = function ( id ){ 
   var self = this;
   var sub = getKey ( self.subscriptions, "_id", id );
   if ( sub ){ 
     self.sendRequest( "unsubscribe", sub.url, sub.hub );
     sub.unsub = true; 
   }  else {
      console.error( " No subscription found with id :  " + id );
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

var getKey = function( obj, field, value ){
  for ( var key in obj ) {
    if ( obj.hasOwnProperty( key) && obj[key][field] === value ) return obj[key];
  }
  return null;
}
