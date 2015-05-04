//based on and inspired by https://github.com/andris9/pubsubhubbub
// customised to work with Meteor and within Simple_RSS app

var Stream = Npm.require( 'stream').Stream,
  PubSubHubbub = Npm.require("pubsubhubbub"),
  resumer = Npm.require("resumer"),
  urlParse = Npm.require( 'url' ).parse,
  Future = Npm.require( 'fibers/future');

// a PuSH subcription manager that wraps
FeedSubscriber = class FeedSubscriber extends Stream {
  constructor ( options ) {
    super();
    var self = this;

    // The 'pubsubhubbub' module only exports createServer().
    // Otherwise the manager could inherit from it.
    // With inheritence no need for own subscribe and unsubscribe methods.
    self.server = PubSubHubbub.createServer( options );
    var server = self.server;

    self.subscriptions = new Map([]);

    WebApp.connectHandlers.use(
      urlParse( server.callbackUrl ).pathname,
      function (req, res, next) {
        if(req.method === 'POST')
          return  server._onPostRequest(req, res);
        if(req.method === 'GET')
          return server._onGetRequest(req, res);

        return server._sendError(req, res, 405, "Method Not Allowed");
      }
    );
    self.startEventListeners();
  }

  startEventListeners() {
    var self = this;
    var server = self.server;

    server.on( 'feed', data => {
      var stream = resumer().queue( data.feed ).end();
      self.emit( 'feedStream', stream, {url: data.topic});
    });

    // check that subscribe events match our requests and manage subscriptions object
    // create resubscription event 6 hours before expected expiry
    server.on ( 'subscribe' ,  ({topic, lease, hub}) => {
      var interval,
      fn,
      sub = self.subscriptions.get( topic );

      if ( sub ){
        sub.expiry = new Date( lease * 1000 );
        sub.resub && clearTimeout( sub.resub );
        console.log (["subscribed to : ", hub, " : ", topic, " : ", sub.expiry].join());
        //  interval in ms with plan to resubscribe 6 hours before expiry
        interval =  sub.expiry - new Date().getTime() - 6 * 60 * 60 * 1000;
        sub.resub = setTimeout( () => {
          sub.unsub = new Future();
          server.unsubscribe( topic, hub );
          server.subscribe( topic, hub );
        }, interval );
      } else {
        console.error("unmatched subscription: " + topic);
      }
    });

    // check that unsubscribe events match our requests and manage subscriptions object
    self.on ( 'unsubscribe' ,  ({topic, hub}) => {
      var sub = self.subscriptions.get( topic );
      if ( sub && sub.unsub ){
        if (sub.unsub instanceof Future)
          sub.unsub.return( {topic, hub} );
        console.log(" unsubscribed from : " + topic);
        self.subscriptions.delete( topic );
      } else {
        console.error("resubscribing to: " + topic);
        server.subscribe( topic, hub );
      }
    });
  }

  // stop all subscriptions with one synchronous call
  stopAllSubscriptions() {
    var self = this;
    self.subscriptions.forEach(({url, hub, _id}) => {
      self.unsubscribe(url, hub);
    });
    self.subscriptions.forEach( (sub) => sub.unsub.wait());
  }

  subscribe( url, hub, _id ) {
    var self = this;
    self.subscriptions.set(url, {url, hub, _id});
    self.server.subscribe( url, hub );
  }

  unsubscribe( url, hub ) {
    var self = this;
    var sub = self.subscriptions.get(url);
    if (! sub) return;
    sub.unsub = new Future;
    self.server.unsubscribe( url, hub || sub.hub);
  }
}
