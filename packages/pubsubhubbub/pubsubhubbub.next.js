//based on and inspired by https://github.com/andris9/pubsubhubbub
// customised to work with Meteor and within Simple_RSS app

var Stream = Npm.require( 'stream'),
  inherits = Npm.require('util').inherits,
  PubSubHubbub = Npm.require("pubsubhubbub"),
  resumer = Npm.require("resumer"),
  urlParse = Npm.require( 'url' ).parse,
  Future = Npm.require( 'fibers/future');

// a PuSH subcription manager that wraps
FeedSubscriber = function ( options ) {
  Stream.call( this );

  var self = this;
  self.server = PubSubHubbub.createServer( options );
  var server = self.server;

  if ( ! (self instanceof FeedSubscriber) )
    throw new Error('use "new" to construct a FeedSubscriber');

  self.subscriptions = {};

  WebApp.connectHandlers.stack.splice(0,0,{
    route: urlParse( server.callbackUrl ).pathname,
    handle: function(req, res, next) {
      if(req.method === 'POST') {
        return  server._onPostRequest( req, res);
      } else if(req.method === 'GET') {
        return server._onGetRequest( req, res);
      } else {
        return server._sendError(req, res, 405, "Method Not Allowed");
      }
    }
  });

  self.startEventListeners();
};

inherits( FeedSubscriber, Stream );

// turn on and handle 'feed', 'subscribe', and 'unsubscribe' events
FeedSubscriber.prototype.startEventListeners = function () {
  var self = this;
  var server = self.server;

  server.on( 'feed', data =>{
    var stream = resumer().queue( data.feed ).end();
    self.emit( 'feedStream', stream, data.topic );
  });

  // check that subscribe events match our requests and manage subscriptions object
  // create resubscription event 6 hours before expected expiry
  server.on ( 'subscribe' , function ( data ) {
    var interval,
    fn,
    sub = self.subscriptions[ data.topic ];

    if ( sub ){
      sub.expiry = new Date( data.lease * 1000 );
      sub.resub && clearTimeout( sub.resub );
      console.log (["subscribed to : ", data.hub, " : ", data.topic, " : ", sub.expiry].join());
      //  interval in ms with plan to resubscribe 6 hours before expiry
      interval =  sub.expiry - new Date.getTime() - 6 * 60 * 60 * 1000;
      sub.resub = setTimeout( function(){
        sub.unsub = new Future();
        server.unsubscribe( data.topic, data.hub );
        server.subscribe( data.topic, data.hub );
      }, interval );
    } else {
      console.error("unmatched subscription: " + data.topic);
    }
  });

  // check that unsubscribe events match our requests and manage subscriptions object
  self.on ( 'unsubscribe' , function ( data ) {
    var self = this;
    var sub = self.subscriptions[ data.topic ];
    if ( ! sub ){
      console.error( "unmatched unsubscribe: " + data.topic );
    }
    else if ( sub.unsub ){
      if (sub.unsub instanceof Future)
        sub.unsub.return( data );
      console.log(" unsubscribed from : " + data.topic);
      delete self.subscriptions[ data.topic ];
    } else {
      console.error("resubscribing to: " + data.topic);
      server.subscribe( data.topic, data.hub );
    }

  });
};

// allow user to stop all subscriptions with one synchronous call
FeedSubscriber.prototype.stopAllSubscriptions = function () {
  var self = this;
  var waitingOn = _.map( self.subscriptions, sub => {
    sub.unsub =  new Future();
    self.server.unsubscribe( sub.url, sub.hub );
    return sub.unsub;
  });
  return Future.wait( waitingOn );
};

FeedSubscriber.prototype.subscribe = function ( topic, hub ) {
  this.server.subscribe( topic, hub );
};

FeedSubscriber.prototype.unsubscribe = function ( url, hub ) {
  this.server.unsubscribe( url, hub );
};
