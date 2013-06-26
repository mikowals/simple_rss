var pubsub = Npm.require('pubsubhubbub').PubSubHubbub;
var nodepie = Npm.require('nodepie');
var Future = Npm.require('fibers/future');



var options = {
  port: 8921,
  callbackServer: "http://new-river.mak-play.com",
  token: Random.id()
}

var feedSubscriber = new pubsub( options );

feedSubscriber.on( 'subscribe', function ( data ){
           console.log ("pubsub - subscribe: " + JSON.stringify ( data ) );
           });

feedSubscriber.on( 'error', function (err){
           console.log ("pubsub - error: " + err );
           });

feedSubscriber.on( 'feed', function (feed){
           console.log ("pubsub - feed: " + JSON.stringify( feed ));
           });


feedSubscriber.on("listen", function(){
          var topic = "http://feeds.reuters.com/Reuters/worldNews";
          var hub = "http://pubsubhubbub.appspot.com/";
          
          feedSubscriber.subscribe(topic, hub, function(err, subscription){
                           if(err){
                           console.log("Subscribing failed");
                           console.log(err);
                           return;
                           }
                           
                           if(subscription === topic){
                           console.log("Subscribed "+topic+" to "+hub);
                           }else{
                           console.log("Invalid response");
                           return;
                           }
                           });
          });
