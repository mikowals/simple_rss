Feeds = new Meteor.Collection ( "feeds" );
Articles = new Meteor.Collection ( "articles" );

var handleError = function( error ){
  if ( error ) console.log( error );
};
Meteor.methods({
  removeFeed: function (feedId) {
    var self = this;
    check(feedId, String);

    var feed = Feeds.findOne( feedId );

    if (!feed )
      return false;

    if ( Meteor.isServer ) {
      if ( self.userId )
        Meteor.users.update( self.userId, {$pull: {feedList: feedId }});

      if ( feed.subscribers && feed.subscribers.length > 1 ) {
        Feeds.update( feedId, {$pull: {subscribers: self.userId }} );
        return true;
      }
      if ( feed.subscribers && feed.subscribers[0] !== self.userId )
        return false;
    }

    //always run on client but only run on server if this is the last subscriber unsubscribing
    Articles.remove( { feed_id: feedId });
    Feeds.remove( feedId, handleError );
    return true;
  },

  addFeed: function( doc ){
    var self = this;
    check ( doc, { url: String});
    var userId = self.userId;
    if ( Meteor.isServer ) {
      self.unblock();
      var existing = Feeds.findOne( doc );
      if ( existing ) {
        Meteor.users.update( self.userId, {$addToSet:{ feedList: existing._id }});
        Feeds.update( existing._id, {$addToSet:{ subscribers: self.userId }});
        return true;
      }
    }

    Meteor.isServer && ( doc.subscribers = [ userId ]);
    doc._id = Feeds.insert( doc );


    if ( Meteor.isServer ){
      var rssResult = syncFP( doc );
      if ( rssResult.error || rssResult.statusCode !== 200 ){
	console.log(JSON.stringify (rssResult) + " has no data to insert");
	Feeds.remove( doc._id );
	throw new Meteor.Error( 500, "bad url for new feed", "The server at " + doc.url + " responded with statusCode " + rssResult.statusCode + " and content " + rssResult.content);
      }

      if ( doc.url !== rssResult.url) {
	console.log( "added url: " +  doc.url + ", canonical url: " + rssResult.url );
	var existing = Feeds.findOne( { url: rssResult.url });
	if ( existing ) {
	  Feeds.remove( doc._id );
	  Feeds.update( existing._id, {$addToSet: { subscribers: userId }}, function( error, result){
	    if (error) console.log( error );
	  });
	  Meteor.users.update( self.userId, {$addToSet:{ feedList: existing._id }});
	  return true;
	}
      }

      console.log( "insertedId: ",  doc._id );

      Meteor.users.update( self.userId, {$addToSet:{ feedList: rssResult._id }});
      Feeds.update( rssResult._id, {$set: {
	url: rssResult.url,
	hub: rssResult.hub || null,
	title: rssResult.title,
	last_date: rssResult.date,
	lastModified: rssResult.lastModified
      }}
      , function( error, result){
	  if ( error )
	    console.error( error );
	});
    }
    return true;
  }

});

eachRecursive = function (obj, resultArr) {
  for (var k in obj) {

    if (typeof obj[k] === "object"){
      eachRecursive(obj[k], resultArr);
    }
    else{
      if (k === 'xmlUrl'){
        resultArr.push( obj['xmlUrl'] );
      }
    }
  }
};
