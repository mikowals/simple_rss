var pubsub = Npm.require('pubsubhubbub').PubSubHubbub;
var nodepie = Npm.require('nodepie');
var Future = Npm.require('fibers/future');

var listening = false;

var options = {
  port: 8084,
  callbackServer: "http://pubsub.mak-play.com",
  token: Random.id()

}

console.log("pubsub token: " + options.token);
var feedSubscriber = new pubsub( options );

feedSubscriber.on( 'subscribe', function ( data ){
           console.log ("pubsub - subscribe: " + JSON.stringify ( data ) );
           return
});

feedSubscriber.on( 'error', function (err){
           console.log ("pubsub - error: " + err );
           return
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
		sourceUrl : feed.getSelf()
	};
	tmpStorage.insert( doc, function( error, result){
		if (error) console.log ( "pubsub error inserting to tmpStorage: " + error );
//		if (result) console.log ( "tmpStorage insert: " + ( doc.title || doc.source ));	
	});
//	console.log("done handling pubsub feed event.  Feed: " + doc.title);
	return
});


feedSubscriber.on("listen", function(){
	listening = true;
	return
});

var subscribe =  function ( topic, hub ){
 feedSubscriber.subscribe(topic, hub, function(err, subscription){
                           if(err){
//                           console.log("Subscribing failed");
                           console.log("pubsub subscription " + topic + " got error " + err);
                           return;
                           }

                           if(subscription === topic){
                           //console.log("Subscribed "+topic+" to "+hub);
                           }else{
                           console.log("pubsub - Invalid response: " + subscription + " !== " + topic );
                           return;
                           }
                           });
}

getHubs = function ( feeds ){
	var updatedFeeds = [];
	feeds.forEach( function ( feed ) {
		var feedObj = new nodepie( getXml ( feed ));
                feedObj.init();
		console.log( "getHubs nodepie : " +  feedObj.getTitle() + " : " + feedObj.getHub());
		var updatedFeed = feed;
		updatedFeed.hub = feedObj.getHub() || null;
		updatedFeeds.push (updatedFeed);
	})
	return updatedFeeds;
};

subscribeToPubSub = function( feeds ) {
	while ( feeds.length > 0 ){
		var ii = feeds.length -1;
		if ( listening ) {
			subscribe ( feeds[ ii ].url, feeds[ ii ].hub ) 
				feeds.splice( ii, 1);
		}


	}	
};
