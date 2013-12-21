Feeds = new Meteor.Collection ( "feeds" );
Articles = new Meteor.Collection ( "articles" );

Meteor.methods({
  removeFeed: function (feedId) {
    check(feedId, String);
    var feed = Feeds.findOne({ _id: feedId });
   
    if (!feed )
      return false; 
    
    if ( Meteor.isServer ) {
        if ( feed.subscribers && feed.subscribers.length > 1 ) {
          Feeds.update( feedId, {$pull: {subscribers: this.userId }} );
          return true;
        }
        if ( feed.subscribers && feed.subscribers[0] !== this.userId )
          return false;
    }

    Articles.remove( { feed_id: feedId });
    Feeds.remove( feedId );
    return true; 
  },

  addFeed: function( doc ){
    var self = this;
    check ( doc, { url: String});
    var userId = self.userId;
    doc = { url: doc.url };
    if ( Meteor.isServer ) self.unblock();
    
    Feeds.upsert ( doc, { $addToSet: { subscribers: userId }}, function ( error, result){
      if ( error ) console.log ( error);
      else if (Meteor.isServer && result.insertedId ){
        console.log( "insertedId: " + result.insertedId);
         
        var rssResult = syncFP( {_id: result.insertedId, url: doc.url} );
        if ( rssResult.error || rssResult.statusCode !== 200 ){
          console.log(JSON.stringify (rssResult) + " has no data to insert");
          Feeds.remove( {_id: result.insertedId });
          return false;
        }
        else {
          if ( doc.url !== rssResult.url) {
            console.log( "added url: " +  doc.url + ", canonical url: " + rssResult.url );
            var existing = Feeds.find( { url: rssResult.url });
            if ( existing ) {
              Feeds.remove( result.insertedId );           
              Feeds.update( existing._id, {$addToSet: { subscribers: userId }});
              return true;
            }
          }
           console.log( "added url: " +  doc.url + ", canonical url: " + rssResult.url );
          Feeds.update( rssResult._id, {$set: {
            url: rssResult.url,
            hub: rssResult.hub || null,
            title: rssResult.title,
            last_date: rssResult.date,
            lastModified: doc.lastModified
          }}
          , function( error, result){
              if ( error )
                console.error( error );
            }); 
        }
    return true;
    }
  });

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
