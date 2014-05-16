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
      Meteor.users.update( self.userId, {$pull: {feedList: feedId }}, handleError);

      if ( feed.subscribers && feed.subscribers.length > 1 ) {
        Feeds.update( feedId, {$pull: {subscribers: self.userId }} , handleError);
        return true;
      }
      if ( feed.subscribers && feed.subscribers[0] !== self.userId )
      return false;
    }

    //always run on client but only run on server if this is the last subscriber unsubscribing
    Articles.remove( { feed_id: feedId }, handleError);
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
        Feeds.update( existing._id, {$addToSet:{ subscribers: userId }}, handleError);
        Meteor.users.update( self.userId, {$addToSet:{ feedList: existing._id }}, handleError);
        return true;
      }
    }

    Meteor.isServer && ( doc.subscribers = [ userId ]);
    doc._id = Feeds.insert( doc );


    if ( Meteor.isServer ){
      var rssResult = FeedParser.syncFP( doc );
      if ( rssResult.error || rssResult.statusCode !== 200 ){
        console.log(JSON.stringify (rssResult) + " has no data to insert");
        Feeds.remove( doc._id , handleError);
        throw new Meteor.Error( 500, "bad url for new feed", "The server at " + doc.url + " responded with statusCode " + rssResult.statusCode + " and content " + rssResult.content);
      }

      if ( doc.url !== rssResult.url) {
        console.log( "added url: " +  doc.url + ", canonical url: " + rssResult.url );
        var existing = Feeds.findOne( { url: rssResult.url });
        if ( existing ) {
          Feeds.remove( doc._id );

          Feeds.update( existing._id, {$addToSet: { subscribers: userId }}, handleError);
          Meteor.users.update( userId, {$addToSet:{ feedList: existing._id }}, handleError);
          return true;
        }
      }

      console.log( "insertedId: ",  doc._id );

      Feeds.update( doc._id, {$set: {
        url: rssResult.url,
        hub: rssResult.hub || null,
        title: rssResult.title,
        last_date: rssResult.date,
        lastModified: rssResult.lastModified,
        etag: rssResult.etag
      }}, handleError );

      Meteor.users.update( userId, {$addToSet:{ feedList: doc._id }}, handleError );
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
