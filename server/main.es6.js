var Future = Npm.require( 'fibers/future');
var DAY = 1000 * 60 * 60 * 24;
var daysStoreArticles = 3.0;
var updateInterval = 1000 * 60 * 15;
var intervalProcesses = new Map([]);
var articlePubLimit = 150;
var maxArticlesFromSource = 25;
var keepLimitDate = function(){
  return new Date( new Date().getTime() - ( DAY * daysStoreArticles ));
};

BrowserPolicy.content.allowConnectOrigin("https://*.mak-play.com");

Feeds._ensureIndex( { url: 1 }, {unique: true} );
Articles._ensureIndex( { link: 1 }, {unique: true, dropDups: true });
Articles._ensureIndex( { feed_id: 1, date: -1} );

//Accounts.config({sendVerificationEmail: true});
Meteor.users.deny({
  update: () => true
});

Facts.setUserIdFilter( ( userId )  => {
  return !! Meteor.users.findOne({_id: userId, 'profile.admin': true}, {fields:{_id:1}});;
});

//  send feeds, articles and userdata in null publish to work with fast-render
//  Feeds are associated with userIds and articles are associated with feeds
Meteor.publish( null, function() {
  var feedOptions = {fields: {_id: 1, title: 1, url: 1, last_date:1}};
  return Feeds.find( {subscribers: this.userId || 'nullUser'}, feedOptions );
});

Meteor.publish( null, function() {
  var self = this;
  var userId = self.userId || 'nullUser';
  //var feedOptions = {fields: {_id: 1, title: 1, url: 1, last_date:1}};
  var articleFields = {_id: 1, title: 1, source: 1, date: 1, summary: 1, link: 1, feed_id: 1};
  var articleOptions = {fields: articleFields, limit: 70, sort: {date: -1, _id: 1}};
  var feedPublisher, articlePublisher, userObserver, nullUserObserver, nullUserCursor;

  articlePublisher = new stoppablePublisher( self );

  function observeArticles( id, doc){
    if ( ! doc || ! doc.feedList || doc.feedList.length === 0 )
      return;

    var articleCursor = Articles.find( {feed_id: {$in: doc.feedList}, date: {$gt: keepLimitDate()}}, articleOptions);
    articlePublisher.start( articleCursor );
  }

  userObserver = Meteor.users.find( userId, {fields: {feedList: 1}} ).observeChanges({
    added: observeArticles,
    changed: observeArticles
  });

  self.onStop( () => {
    userObserver.stop();
    articlePublisher.stop();
  });

  self.ready();
});

Meteor.startup( () => {

  Meteor.call('findArticles' );
  Meteor.call('removeOldArticles');

  intervalProcesses["removeOldArticles"] = Meteor.setInterval(
    () => Meteor.call('removeOldArticles'),
    DAY
  );

  intervalProcesses[ "findArticles"] = Meteor.setInterval(
    () => Meteor.call('findArticles', { hub: null} ),
    updateInterval
  );

});

Meteor.methods({

  findArticles: function( criteria = {} ) {
    check ( criteria,  Object );
    console.time("findArticles");

    var article_count = 0;
    var feeds = Feeds.find( criteria );
    if ( feeds.count() < 1) return;
    var rssResults = FeedParser.syncFP( feeds.fetch() );

    rssResults.forEach( function( rssResult ){
      if ( rssResult.statusCode === 200 ) {
        var modifier = _.pick( rssResult, 'lastModified', 'etag', 'lastDate' );
        Feeds.update(rssResult._id, {$set: modifier } , _.noop );
      }
      else if ( rssResult.error ) console.log (rssResult.url + " returned " + rssResult.error);
      else if ( typeof rssResult.statusCode === "number" && rssResult.statusCode !== 304 ){
        console.log( rssResult.url + " responded with " + rssResult.statusCode );
      }
    });

    console.timeEnd("findArticles");

  },

  removeOldArticles: function(){
    console.log("removeOldArticles method called on server");
    var error = Articles.remove({date:  {$lt: keepLimitDate()}, clicks: 0 }, function(error){ return error;});
    return error || 'success';
  },

  addSubscriberToFeeds: function(){
    var self = this;
    Feeds.find({}).forEach( function ( feed ){
      console.log("adding subscriber " + self.userId);
      Feeds.update( feed._id,{ $addToSet: { subscribers: self.userId }});
    });
  },

  createNullSubscriber: function(){
    var feedList = Feeds.find( {subscribers: null}, {fields: {_id:1}}).map( feed => feed._id );
    Meteor.users.upsert( 'nullUser', { _id: 'nullUser', feedList }, error => {
      if ( error ) console.log( error );
    });
  },

  addFeed_idToArticles: function(){
    Articles.find({}).forEach( function (article){
      var feed_id = Feeds.findOne({title: article.source})._id;
      Articles.update(article._id,{$set: {feed_id: feed_id}});
    });

  },

  cleanUrls: function(){
    Feeds.find({}).forEach( (feed) => {
      var result = FeedParser.syncFP( feed );
      if (result && result.url && feed.url !== result.url ){
	      console.log("changing url " + feed.url + " to " + result.url);
	      Feeds.update(feed._id, {$set: {url: result.url }});
      }
    });
  },

  markRead: function( link ){
    var self = this;
    check( link, String );
    Articles.update({link: link}, {$addToSet: {readBy: self.userId }, $inc: {clicks: 1, readCount: 1}}, _.noop );
  },

  XML2JSparse: function ( file ) {
    check( file, String);
    return XML2JS.parse( file );
  },

  createFeedListByUser: function () {
    Meteor.users.find( {}, {_id:1} ).forEach(  ( user ) => {
      var feedList = Feeds.find( {subscribers: user._id}, {_id: 1} ).map( function( feed ) { return feed._id });
      Meteor.users.update( user._id, {$set: {feedList: feedList}, $pull:{feedList: null}});
    //  Meteor.users.update( user._id, { $pull:{feedList: null}});
    });
  },

  checkAdmin: function (){
    return !! Meteor.users.findOne({_id: this.userId, 'profile.admin': true}, {fields: {_id: 1}});
  }


});
