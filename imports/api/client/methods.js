import { Meteor } from 'meteor/meteor';
import { Articles, Feeds } from '/imports/api/simple_rss';

var handleError = function( error ){
  if ( error ) console.log( error );
};

Meteor.methods({
  removeFeed: function (feedId) {
    var self = this;
    var userId = self.userId || 'nullUser';
    check(feedId, String);

    var feed = Feeds.findOne( {_id: feedId, subscribers: userId}, {fields:{_id: 1, subscribers: 1, url: 1, hub: 1}});

    Articles.remove({feed_id: feedId});
    Feeds.remove(feedId);
  },

  addFeed: function( doc ){
    var self = this;
    self.unblock();
    check ( doc, { url: String});
    var originalUrl = doc.url;
    var userId = self.userId || 'nullUser';

    // create id so we can insert articles before feed itself is inserted.
    doc._id = Feeds._makeNewID();
    if ( self.isSimulation ) {
      Feeds.insert( doc, handleError );
      return;
    }
  }
});
