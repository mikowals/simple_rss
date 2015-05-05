var Future = Npm.require( 'fibers/future');
var DAY = 1000 * 60 * 60 * 24;
var daysStoreArticles = 3.0;
var updateInterval = 1000 * 60 * 15;
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
  return !! Meteor.users.find({_id: userId, 'profile.admin': true}, {fields:{_id:1}}).count();
});

//  send feeds, articles and userdata in null publish to work with fast-render
//  Feeds are associated with userIds and articles are associated with feeds


FastRender.onAllRoutes(function(path) {
  if ( ! _.any(['.js','.css', '.woff', '/hubbub'], (s) => path.includes(s))) {
    console.log('fast-render path: ',path);
    this.subscribe('articles');
    this.subscribe('feeds');
  }
});


Meteor.publish( 'feeds', function() {
  var feedOptions = {fields: {_id: 1, title: 1, url: 1, last_date:1}};
  return Feeds.find( {subscribers: this.userId || 'nullUser'}, feedOptions );
});

Meteor.publish( 'articles', function() {
  var self = this;
  var userId = self.userId || 'nullUser';
  //var feedOptions = {fields: {_id: 1, title: 1, url: 1, last_date:1}};
  var articleFields = {_id: 1, title: 1, source: 1, date: 1, summary: 1, link: 1, feed_id: 1};
  var articleOptions = {fields: articleFields, limit: 70, sort: {date: -1, _id: 1}};
  var articlePublisher, userObserver;
  articlePublisher = new stoppablePublisher( self );
  function observeArticles( id, doc){
    var articleCursor = Articles.find({feed_id: {$in: doc.feedList}, date: {$gt: keepLimitDate()}}, articleOptions);
    articlePublisher.start( articleCursor );
  }

  userObserver = Meteor.users.find( userId, {fields: {feedList: 1}} ).observeChanges({
    added: observeArticles,
    // for bulk adds the observer would restart constantly
    // XXX could manage this with pause publish
    changed: _.debounce(Meteor.bindEnvironment(observeArticles), 300, {trailing: true})
  });

  self.onStop( () => {
    userObserver.stop();
    articlePublisher.stop();
  });

  return self.ready();
});

Meteor.startup( () => {
  
  Meteor.call('findArticles' );
  Meteor.call('removeOldArticles');

  Meteor.setInterval(
    () => Meteor.call('removeOldArticles'),
    DAY
  );
  
  var interval = Meteor.setInterval(
    () => Meteor.call('findArticles', { hub: null} ),
    updateInterval
  );
  
  _.each(['SIGINT', 'SIGHUP', 'SIGTERM'], function (sig) {
      process.once(sig, Meteor.bindEnvironment (function () {
        Meteor.clearInterval( interval );
      }, function ( e ) { throw e; }));
    });
});

Meteor.methods({
  findArticles: function( criteria = {} ) {
    check ( criteria,  Object );
    console.time("findArticles");

    var feeds = Feeds.find( criteria );
    if ( feeds.count() < 1) return;
    var rssResults = FeedParser.syncFP( feeds.fetch() );

    rssResults.forEach(({_id, statusCode, lastModified, etag, lastDate, error, url}) => {
      if ( statusCode === 200 ) {
        Feeds.update(_id, {$set: {lastModified, etag, lastDate}} , _.noop );
      }
      else if ( error ) console.log (url + " returned " + error);
      else if ( typeof statusCode === "number" && statusCode !== 304 ){
        console.log( url + " responded with " + statusCode );
      }
    });
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
  }
});
