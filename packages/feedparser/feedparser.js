FeedParser = Npm.require('feedparser');
var request = Npm.require('request');
var Future = Npm.require('fibers/future');
var zlib = Npm.require('zlib');
var DAY = 1000 * 60 * 60 * 24;
var daysStoreArticles = 2;
//var http = Npm.require('http');
//http.globalAgent.maxSockets = 200;
//var URL = Npm.require('url');
function _request( feed, cb ){
  if (! feed.url)
    throw new Error( "_request called without url");

  var options = {
    url: feed.url,
    headers: {
      'Accept-Encoding': "gzip, deflate"
    },
    timeout: 7000
  };

  if ( feed.lastModified ) options.headers['If-Modified-Since'] = new Date ( feed.lastModified ).toUTCString();
  if ( feed.etag ) options.headers['If-None-Match'] =  feed.etag;

  return request( options, cb );
};

function onError( err ){
  var feed = this.feed;
  console.log(feed.url + " got feedparser error: " + err);
  feed.error = err;
  return;
};

function onMeta( meta ) {
  var feed = this.feed;
  //console.log( "feedparser emmitted meta for url: " + url );
  if (meta !== null ){
    feed.url = meta.xmlurl || feed.url;
    feed.hub = meta.cloud.href;
    feed.title = meta.title;
    feed.date = new Date( meta.date );
    feed.author = meta.author;
  }
  return;
};

function onReadable() {
  var fp = this.feedparser;
  var feed = this.feed;
  var item, doc;
  while ( item = fp.read() ) {
    doc = new Article( item );
    doc.sourceUrl = feed.url;
    doc.feed_id = feed._id;
    var keepLimitDate = new Date( new Date().getTime() - ( DAY * daysStoreArticles));
    if ( doc.date > keepLimitDate ){
      Articles.insert( doc, function( error ) {
        if ( !error ) {
          console.log( doc.title + " : " + doc.source );
          Feeds.update( { _id: doc.feed_id, last_date: {$lt: doc.date}}, { $set: { last_date: doc.date }}, function( error){});
        }
      });
    }
  }
  return;
};

function bindEnvironmentError( error ){
  console.error( error );
  return;
};

//separate function so pubsubhubbub package can also add articles.
readAndInsertArticles = function ( fp, feed ){
  if ( ! ( fp instanceof FeedParser ) )
    fp = fp.pipe( new FeedParser() );

  fp.on( 'readable', Meteor.bindEnvironment( onReadable, err, {feedparser: fp, feed: feed} ));
  return;
};

function _fp( feed ) {
  var fp;

  function parseFeed( onError, onMeta, onReadable ){
    if ( ! ( fp instanceof FeedParser ) )
      fp = fp.pipe( new feedParser() );

    fp.on( 'error', Meteor.bindEnvironment( onError, bindEnvironmentError, {feed: feed}))
      .on('meta', Meteor.bindEnvironment( onMeta, bindEnvironmentError, {feed: feed}))
      .on('readable', Meteor.bindEnvironment( onReadable, bindEnvironmentError, {feedparser: fp, feed: feed}));

    return;
  };

  var future = new Future();
  var r = _request( feed, function( error, response ){
    if ( ! response || response.statusCode !== 200){
      response && response.statusCode !== 304 && console.error( "url: ", feed.url, "response: ", response && response.statusCode );
      //future.return for all non-200 responses
      future.return ({url: feed.url, error: error, statusCode: response && response.statusCode} );
    }
  });
  //bindEnvironment because adding articles calls Articles.insert()
  r.on( 'response', Meteor.bindEnvironment(
    function( response ){
      if ( response.statusCode === 200 ){
        feed.statusCode = 200;
        if ( response.headers['content-encoding'] === 'gzip' ){
          r = r.pipe( zlib.createGunzip() );
        }

        if ( response.headers['last-modified'] ){
          feed.lastModified = response.headers[ 'last-modified' ] ;
        }

        //future.return() in onEnd handles all 200 responses
        fp = r.pipe( new FeedParser());
        parseFeed ( onError, onMeta, onReadable);
        future.return( feed );
      }

    },
    function ( e ) { throw e;}
  ));

  return future;
};

syncFP = function( feed ){

  if ( ! feed.length ){
    return _fp( feed ).wait();
  } else {
    var futures = _.map( feed, _fp );
    Future.wait(futures);
    return _.invoke( futures, 'get');
  }
}

multipleSyncFP = syncFP;
