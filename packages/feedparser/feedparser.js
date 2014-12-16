FeedParser = Npm.require('feedparser');
var request = Npm.require('request');
var Future = Npm.require('fibers/future');
var zlib = Npm.require('zlib');
var DAY = 1000 * 60 * 60 * 24;
var daysStoreArticles = 2;

function _request( feed, cb ){
  if (! feed.url)
    throw new Error( "_request called without url");

  var options = {
    url: feed.url,
    headers: {
      'Accept-Encoding': "gzip, deflate"
    },
    timeout: 7000,
    pool: false
  };

  if ( feed.lastModified ) options.headers['If-Modified-Since'] = new Date ( feed.lastModified ).toUTCString();
  if ( feed.etag ) options.headers['If-None-Match'] =  feed.etag;

  return request( options, cb );
};

var onReadable = Meteor.bindEnvironment( function(fp, feed) {
  var item;
  while ( item = fp.read() ) {
    var doc = new Article( item );
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
}, bindEnvironmentError );

function bindEnvironmentError( error ){
  console.error( error );
  return;
};

function _fp( feed ) {

  function onError( err ){
    console.log(feed.url + " got feedparser error: " + err);
    feed.error = err;
    future.return( feed );
    return;
  };

  function onMeta( meta ) {

    //console.log( "feedparser emmitted meta for url: " + url );
    if (meta !== null ){
      feed.url = meta.xmlurl || feed.url;
      feed.hub = meta.cloud.href;
      feed.title = meta.title;
      feed.date = new Date( meta.date );
      feed.author = meta.author;
    }
    future.return( feed );
    return;
  };

  function onEnd(){
    if( ! future.isResolved() )
      future.return( feed );
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

        if ( response.headers['last-modified'] ) feed.lastModified = response.headers[ 'last-modified' ] ;
        if ( response.headers['etag'] )  feed.etag = response.headers['etag'];

        var fp = r.pipe( new FeedParser());
        fp.on( 'error', onError )
          .on('meta', onMeta )
          .on('readable',  lodash.partial( onReadable, fp, feed ) )
          .on( 'end', onEnd );
      }
    },
    function ( e ) { throw e;}
  ));

  return future;
};

FeedParser.syncFP = function( feed ){

  if ( ! feed.length ){
    return _fp( feed ).wait();
  } else {
    var futures = lodash.map( feed, _fp );
    Future.wait(futures);
    return lodash.invoke( futures, 'get');
  }
};

//separate function so pubsubhubbub package can also add articles.
FeedParser.readAndInsertArticles = function ( fp, feed ){
  if ( ! ( fp instanceof FeedParser ) )
    fp = fp.pipe( new FeedParser() );

  fp.on( 'readable', lodash.partial( onReadable, fp, feed ) );
  return;
};
