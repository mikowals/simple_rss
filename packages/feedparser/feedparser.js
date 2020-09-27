var parser = Npm.require('feedparser');
var request = Npm.require('request');
var Future = Npm.require('fibers/future');
//var zlib = Npm.require('zlib');
var DAY = 1000 * 60 * 60 * 24;
var daysStoreArticles = 2;

var onReadable = function (fp, feed) {
  return Meteor.bindEnvironment(function(){
    var item;
    while ( item = fp.read() ) {
      var doc = new Article( item );
      doc.sourceUrl = feed.url;
      doc.feed_id = feed._id;
      var keepLimitDate = new Date( new Date().getTime() - ( DAY * daysStoreArticles));
      if ( doc.date > keepLimitDate ){
        Articles.insert( doc, function( error, res) {
          if ( !error ) {
            console.log( doc.title + " : " + doc.source + " : ", res);
            Feeds.update( { _id: doc.feed_id, last_date: {$lt: doc.date}}, { $set: { last_date: doc.date }}, lodash.noop );
          }
        });
      }
    }
  });
};

function bindEnvironmentError( error ){
  console.error( error );
};

function makeRequestOptions( feed ) {
    var options = {
      headers: {
        'If-Modified-Since': feed.lastModified && new Date ( feed.lastModified ).toUTCString(),
        'If-None-Match': feed.etag
        },
      url: feed.url,
      timeout: 7000,
      gzip: true,
    };
    // remove falsy values
    options.headers = lodash.pick( options.headers, lodash.identity);
    return options;
}

function _fp( feed ) {
  //var future = new Future();
  var _request = function (feed, cb ) {
    if (! feed.url)
      throw new Error( "_request called without url");

    var responseStream = request( makeRequestOptions(feed), cb )
      .on( 'response', Meteor.bindEnvironment(function( response ){
        if ( response.statusCode === 200 ){
        //now try parsing the feed
          var fp = responseStream.pipe( new parser());
          fp.on( 'error', onError )
            .on('meta', onMeta )
            .on('readable',  onReadable(fp, feed));
        }
    }));
    return responseStream;
  };

  function onError( error ){
    feed.error = error;
  }

  function onMeta( meta ) {
    //console.log( "feedparser emmitted meta for url: " + url );
    if (meta !== null ){
      _.extend( feed, {
        url: meta.xmlurl || feed.url,
        hub: meta.cloud.href,
        title: meta.title,
        date: new Date( meta.date ),
        author: meta.author
      });
    }
  }

  try {
    var res = Meteor.wrapAsync(_request)( feed );
    
    feed.statusCode = res.statusCode;
    feed.lastModified = res.headers[ 'last-modified' ] || feed.lastModified;
    feed.etag = res.headers['etag'] || feed.etag;
  } catch (e) {
    feed.error = e.message
  }
  return feed;
};

var syncFP = function(feed) {
    if ( feed instanceof Array ){
      return feed.map(_fp);
    } else {
      return  _fp( feed );
    }
  }

FeedParser = {
  syncFP,
  readAndInsertArticles( fp, feed ) {
    if ( ! ( fp instanceof parser ) )
      fp = fp.pipe( new parser() );

    fp.on( 'readable', onReadable(fp, feed));
    return;
  }
};
