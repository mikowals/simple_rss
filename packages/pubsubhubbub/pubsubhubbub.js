var pubsub = Npm.require('pubsubhubbub').PubSubHubbub;
var nodepie = Npm.require('nodepie');
var Future = Npm.require('fibers/future');



var options = {
  port: 8084,
  callbackServer: "http://pubsub.mak-play.com",
  token: Random.id()

}

console.log("pubsub token: " + options.token);
var feedSubscriber = new pubsub( options );

feedSubscriber.on( 'subscribe', function ( data ){
           console.log ("pubsub - subscribe: " + JSON.stringify ( data ) );
           });

feedSubscriber.on( 'error', function (err){
           console.log ("pubsub - error: " + err );
           });

feedSubscriber.on( 'feed', function (feed){
	console.log ("pubsub - feed: " + feed.getTitle() + " : " + feed.getItem().getTitle());
	var item = feed.getItem();
	var doc = {
		title: item.getTitle(),
		link: item.getPermalink(),
		summary: cleanSummary( item.getContents() ),
		date: item.getDate(),
		source: feed.getTitle(),
		guid: item.getPermalink(),
		sourceUrl : feed.getPermalink()
	};
	tmpStorage.insert( doc );

           });


feedSubscriber.on("listen", function(){
          var topic = ["http://feeds.reuters.com/Reuters/worldNews", "http://feeds.feedburner.com/calculatedrisk"];
          var hub = ["http://pubsubhubbub.appspot.com/", "http://pubsubhubbub.appspot.com/"];
          
  for ( var ii = 0; ii < topic.length; ii++){
          feedSubscriber.subscribe(topic[ii], hub[ii], function(err, subscription){
                           if(err){
                           console.log("Subscribing failed");
                           console.log(err);
                           return;
                           }
                           
                           if(subscription === topic){
                           console.log("Subscribed "+topic[ ii ]+" to "+hub[ ii ]);
                           }else{
                           console.log("Invalid response");
                           return;
                           }
                           });


  }
});
