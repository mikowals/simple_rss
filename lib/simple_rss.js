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
  }
});
