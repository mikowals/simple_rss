//based on and inspired by https://github.com/andris9/pubsubhubbub
// customised to work with Meteor and within Simple_RSS app

var PubSubHubbub = Npm.require("pubsubhubbub");
var resumer = Npm.require("resumer");
FeedSubscriber = (options) => {
  var pubsub = PubSubHubbub.createServer( options );
  console.log( pubsub );

  WebApp.connectHandlers.stack.splice(0,0,{
      route: '/hubbub',
      handle: function(req, res, next) {
       if(req.method === 'POST') {
         return  pubsub._onPostRequest( req, res);
       }
       else if(req.method === 'GET') {
         return pubsub._onGetRequest( req, res);
     } else {
         return pubsub._sendError(req, res, 405, "Method Not Allowed");
     }
    }
   });
   pubsub.on( 'feed', data =>{
     var stream = resumer().queue( data.feed ).end();
     pubsub.emit( 'feedStream', stream, data.topic );
   });


   return pubsub;
};
