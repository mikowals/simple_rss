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
    headers: {},
    url: feed.url,
    timeout: 5000,
    gzip: true,
  };

  if ( feed.lastModified ) options.headers['If-Modified-Since'] = new Date ( feed.lastModified ).toUTCString();
  if ( feed.etag ) options.headers['If-None-Match'] =  feed.etag;

  return request( options, cb );
};

var onReadable = Meteor.bindEnvironment( function( fp, feed) {
  var item;
  while ( item = fp.read() ) {
    var doc = new Article( item );
    doc.sourceUrl = feed.url;
    doc.feed_id = feed._id;
    feed.last_date = Math.max( feed.last_date  || 0, doc.date );
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
  var future = new Future();

  function onError( error ){
    feed.error = error;
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
  };

  // need to request and pipe result so use events rather than callback
  // response event fires before callback, piping won't work inside callback
  var r = _request( feed, function ( err, res) {
    if ( err ){
      feed.error = err;
      if ( res ) {
        feed.statusCode = res.statusCode;
        feed.lastModified = response.headers[ 'last-modified' ] ;
        feed.etag = response.headers['etag'];
      }
    }
    feed = _.pick( feed, _.identity );
    future.return( feed );
  }).on( 'response', Meteor.bindEnvironment(
      function( response ){
        feed.statusCode = response.statusCode;
        if ( feed.statusCode === 200 ){

          //now try parsing the feed
          var fp = r.pipe( new FeedParser());
          fp.on( 'error', onError )
            .on('meta', onMeta )
            .on('readable',  lodash.partial( onReadable, fp, feed ) );
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
    var futures = feed.map( _fp );
    Future.wait( futures );
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
