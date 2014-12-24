//based on and inspired by https://github.com/andris9/pubsubhubbub
// customised to work with Meteor and within Simple_RSS app

var PubSubHubbub = Npm.require("pubsubhubbub");
var resumer = Npm.require("resumer");
var urlParse = Npm.require( 'url' ).parse;
var Future = Npm.require( 'fibers/future');

FeedSubscriber = (options) => {
  var self = PubSubHubbub.createServer( options );
  console.log( self );

  self.subscriptions = {};

  WebApp.connectHandlers.stack.splice(0,0,{
    route: urlParse( self.callbackUrl ).pathname,
    handle: function(req, res, next) {
      if(req.method === 'POST') {
        return  self._onPostRequest( req, res);
      } else if(req.method === 'GET') {
        return self._onGetRequest( req, res);
      } else {
        return self._sendError(req, res, 405, "Method Not Allowed");
      }
    }
  });

  self.on( 'feed', data =>{
    var stream = resumer().queue( data.feed ).end();
    self.emit( 'feedStream', stream, data.topic );
  });

  self.stopAllSubscriptions = () => {
    var waitingOn = _.map( self.subscriptions, sub => {
      sub.unsub =  new Future();
      self.unsubscribe( sub.url, sub.hub );
      return sub.unsub;
    });
    return Future.wait( waitingOn );
  };

  self.on ( 'subscribe' , function ( data ) {
    var interval,
        fn,
        sub = self.subscriptions[ data.topic ];

    if ( sub ){
      //sub.expiry = new Date().getTime() + data.lease * 1000;
      //sub.resub && clearTimeout( sub.resub );
      console.log ( "subscribed to : " + data.hub + " : " + data.topic );
      //interval = Math.max( ( data.lease - 60 * 60 ) * 1000, 9 * 24 * 60 * 60 * 1000 );
      //fn = function(){
      //  sub.unsub = new Future();
      //  self.unsubscribe( data.topic, data.hub );
      //  self.subscribe( data.topic, data.hub );
      //};
      //sub.resub = setTimeout( fn, interval );
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
      if ( sub.unsub instanceof Future )
        sub.unsub.return( data );
      console.log ( " unsubscribed from : " + data.topic);
      delete self.subscriptions[ data.topic ];
    } else {
      console.error( "resubscribing to: " + data.topic );
      self.subscribe( data.topic, data.hub );
    }
  });

  return self;
};
