import { Meteor } from 'meteor/meteor';
import { check, Match } from 'meteor/check';
import { Articles, Feeds, DAY, keepLimitDate,  } from '/imports/api/simple_rss';
import { getFeed, getFeeds } from '/imports/api/server/feedParser';
import { feedSubscriber } from '/imports/api/server/startup';

var handleError = function( error ){
  if ( error ) console.log( error );
};

const eachRecursive = function (obj, resultArr) {
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

Meteor.methods({
  removeFeed: function (feedId) {
    var self = this;
    var userId = self.userId || 'nullUser';
    check(feedId, String);
    Meteor.users.update( userId, {$pull: {feedList: feedId}});
    Feeds.update({_id: feedId}, {$pull: {subscribers: userId }});
    Feeds.remove({_id: feedId, subscribers: {$size: 0}}, (err, removed) => {
      // Success means no more subscribers so remove articles from db.
      // Unsubscribe to pubsub listeners also.
      if (removed) {
        Articles.remove({feed_id: feedId});
        feedSubscriber.unsubscribe(feedId);
      }
    });
    return true;
  },

  addFeed: function( doc ){
    var self = this;
    self.unblock();
    check(doc, Match.OneOf({_id: String, url: String}, {url: String}));
    var originalUrl = doc.url;
    var userId = self.userId || 'nullUser';

    // create id so we can insert articles before feed itself is inserted.
    doc._id = doc._id || Feeds._makeNewID();

    // check existence with findOne since we need the feedId anyway to update user
    var existing = Feeds.findOne(
      {url: doc.url},
      {fields: { _id: 1, title: 1, url: 1, date: 1, subscribers: 1}}
    );
    if ( existing ) {
      if (existing.subscribers.includes(userId)) {
        console.log("existing feed being subscribed: ", existing);
        throw new Meteor.Error(500, existing.title + " already subscribed to.");
      }
      Feeds.update( {url: doc.url}, {$addToSet:{ subscribers: userId }}, _.noop );
      Meteor.users.upsert( {_id: userId}, {$addToSet:{ feedList: existing._id }}, _.noop );
      delete existing.subscribers;
      return existing;
    }
    const {feed, articles, error} = getFeed( doc );
    if ( error ){
      console.log(JSON.stringify (feed) + " has no data to insert");
      var err = new Meteor.Error(
        500,
        "Bad url for new feed. Got message " + error.message);
      throw err;
    }

    // the url sets a different feed url so check if we have that one
    if ( feed.url !== originalUrl ) {
      console.log( "added url: " +  originalUrl + ", canonical url: " + feed.url );
      var existing = Feeds.findOne(
        { url: feed.url },
        {fields: { _id:1 , title: 1, url: 1, date: 1}}
      );
      if ( existing ) {
        Feeds.update( existing._id, {$addToSet: { subscribers: userId }}, _.noop );
        Meteor.users.upsert( {_id: userId}, {$addToSet:{ feedList: existing._id }}, _.noop );
        return existing;
      }
    }

    // all checks pass so insert the new feed.
    console.log( "insertedFeed: ", feed.title );
    feed["hub"] = feed.hub || null;
    feed["subscribers"] = [userId];
    delete feed.error;
    Feeds.insert(feed, _.noop);

    if (feed.hub)
      feedSubscriber.subscribe(feed.url, feed.hub, feed._id);

    Meteor.users.upsert( {_id: userId}, {$addToSet:{ feedList: feed._id }}, _.noop );
    Articles.batchInsert(articles, _.noop );

    return {
      _id: feed._id,
      url: feed.url,
      title: feed.title,
      date: feed.date
    }
  },

  findArticles: function( criteria = {} ) {
    check ( criteria,  Object );
    var fetchedFeeds = Feeds.find( criteria ).fetch();
    if ( fetchedFeeds.length < 1) {
      return;
    }
    console.time("findArticles");
    let {articles, error, feeds} = getFeeds( fetchedFeeds );
    if (feeds.length > 0) {
      feeds.forEach(
        ({_id, lastModified, etag, date}) => {
          Feeds.update(_id, {$set: {lastModified, etag, date}} , _.noop );
      });
    }
    let existingArticles = Articles.find(
      {link: {$in: articles.map(article => article.link)}},
      {fields: {link: 1}}
    ).fetch()

    const articlesToAdd = articles.filter(
      article => ! existingArticles.some(
        oldArticle => oldArticle.link === article.link
    ));
    if (articlesToAdd.length > 0) {
      try{
        Articles.batchInsert(articlesToAdd, (err, res) => {
          if (err) {
            console.log(err);
          } else {
            console.log("inserted: ", res.length);
          }
        });
      } catch(e) {}
    }
    console.timeEnd("findArticles");
  },

  removeOldArticles: function(){
    return Articles.remove({date:  {$lt: keepLimitDate()}, clicks: null});
  },

  addSubscriberToFeeds: function(){
    Feeds.find({},{fields:{ _id: 1}}).forEach( ({_id}) => {
      console.log("adding subscriber " + this.userId);
      Feeds.update( _id,{ $addToSet: { subscribers: this.userId }});
    });
  },

  markRead: function( link ){
    var self = this;
    check( link, String );
    Articles.update({link: link},
      {$addToSet: {readBy: self.userId }, $inc: {clicks: 1, readCount: 1}},
       _.noop
    );
  },

  XML2JSparse: function ( file ) {
    check( file, String);
    return XML2JS.parse( file );
  },

  createFeedListByUser: function () {
    Meteor.users.find({}, {fields: {_id:1}}).forEach(({_id}) => {
      var feedList = Feeds.find({subscribers: _id},{fields: {_id: 1}}).map(({_id}) => _id);
      Meteor.users.update( user._id, {$set: {feedList: feedList}, $pull:{feedList: null}});
    //  Meteor.users.update( user._id, { $pull:{feedList: null}});
    });
  },

  stopAndRestartPubSub: function(){
    function subscribe(feed){
      feedSubscriber.subscribe( feed.url, feed.hub, feed._id);
    };

    feedSubscriber.stopAllSubscriptions();
    Feeds.find({hub: {$ne: null}},{fields: {_id: 1, hub:1, url:1}}).forEach( subscribe );
  }
});
