var parser = Npm.require('feedparser');
var request = Npm.require('request');
var Future = Npm.require('fibers/future');
//var zlib = Npm.require('zlib');
var DAY = 1000 * 60 * 60 * 24;
var daysStoreArticles = 2;

var _request = ( feed, cb ) => {
  if (! feed.url)
    throw new Error( "_request called without url");

  var options = {
    headers: {
      'If-Modified-Since': feed.lastModified && new Date ( feed.lastModified ).toUTCString(),
      'If-None-Match': feed.etag
      },
    url: feed.url,
    timeout: 5000,
    gzip: true,
  };

  options.headers = lodash.pick( options.headers, lodash.identity);  // remove falsy values
  return request( options, cb );
};

var onReadable = function (fp, feed) {
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
          Feeds.update( { _id: doc.feed_id, last_date: {$lt: doc.date}}, { $set: { last_date: doc.date }}, lodash.noop );
        }
      });
    }
  }
}

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
  var r = _request( feed, ( err, res) => {
    if ( err )
      feed.error = err;
    if ( res ) {
      feed.statusCode = res.statusCode;
      feed.lastModified = res.headers[ 'last-modified' ] ;
      feed.etag = res.headers['etag'];
    }

    feed = lodash.pick( feed, lodash.identity ); // remove falsy values
    future.return( feed );
  })
    // this response fires before the callback written above
    .on( 'response', Meteor.bindEnvironment(
      function( response ){
        if ( response.statusCode === 200 ){

          //now try parsing the feed
          var fp = r.pipe( new parser());
          fp.on( 'error', onError )
            .on('meta', onMeta )
            .on('readable',  Meteor.bindEnvironment(() => onReadable(fp, feed)));
        }
      },
      (e) => {throw e}
    ));
  return future;
};

FeedParser = {
  syncFP(feed) {
    if ( feed instanceof Array ){
      return feed.map( _fp ).map( (f) => f.wait() );
    } else {
      return _fp( feed ).wait();
    }
  },
  readAndInsertArticles( fp, feed ) {
    if ( ! ( fp instanceof parser ) )
      fp = fp.pipe( new parser() );

    fp.on( 'readable', Meteor.bindEnvironment(() => onReadable(fp, feed)));
    return;
  }
};
