_ = lodash;

Feeds = new Meteor.Collection ( "feeds" );
Articles = new Meteor.Collection ( "articles" );

var handleError = function( error ){
  if ( error ) console.log( error );
};
Meteor.methods({
  removeFeed: function (feedId) {
    var self = this;
    var userId = self.userId || 'nullUser';
    check(feedId, String);

    var feed = Feeds.findOne( feedId, {fields:{_id:1, subscribers:1 }});

    if (!feed )
      return false;

    if ( Meteor.isServer ) {

      Meteor.users.update( {_id: userId, feedList: feedId}, {$pull: {feedList: feedId }});

      if ( feed.subscribers && feed.subscribers.length > 1 ) {
        Feeds.update( feedId, {$pull: {subscribers: userId }});
        return true;
      }
      if ( feed.subscribers && feed.subscribers[0] !== userId ){
        console.error( 'user: ', userId, " feedSub: ", feed.subscribers[0]);
        return false;
      }
    }

    //always run on client but only run on server if this is the last subscriber unsubscribing
    Articles.remove( { feed_id: feedId } );
    Feeds.remove( feedId );
    return true;
  },

  addFeed: function( doc ){
    var self = this;
    check ( doc, { url: String});
    var originalUrl = doc.url;
    var userId = self.userId || 'nullUser';
    if ( Meteor.isServer ) {
      self.unblock();
      var existing = Feeds.findOne( doc, {fields: { _id:1 }} );

      if ( existing ) {
        Feeds.update( existing._id, {$addToSet:{ subscribers: userId }} );
        return Meteor.users.update( userId, {$addToSet:{ feedList: existing._id }} );
      }
    }

    if( Meteor.isServer ) doc.subscribers = [ userId ];
    doc._id = Feeds.insert( doc, handleError );

    if ( Meteor.isServer ){
      var rssResult = FeedParser.syncFP( doc );
      if ( rssResult.error || rssResult.statusCode !== 200 ){
        console.log(JSON.stringify (rssResult) + " has no data to insert");
        Feeds.remove( doc._id , handleError);
        throw new Meteor.Error( 500, "bad url for new feed", "The server at " + doc.url + " responded with statusCode " + rssResult.statusCode + " and content " + rssResult.content);
      }

      if ( rssResult.url !== originalUrl ) {
        console.log( "added url: " +  originalUrl + ", canonical url: " + rssResult.url );
        var existing = Feeds.findOne( { url: rssResult.url });
        if ( existing ) {
          Feeds.remove( doc._id );
          Articles.remove( {feed_id: doc._id });
          Feeds.update( existing._id, {$addToSet: { subscribers: userId }});
         
          return Meteor.users.update( userId, {$addToSet:{ feedList: existing._id }});
        }
      }

      console.log( "insertedFeed: ", rssResult.title );

      Feeds.update( rssResult._id, {$set: {
        url: rssResult.url,
        hub: rssResult.hub || null,
        title: rssResult.title,
        last_date: rssResult.date,
        lastModified: rssResult.lastModified,
        etag: rssResult.etag
      }} );

     
      return Meteor.users.update( userId, {$addToSet:{ feedList: rssResult._id }} );
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
