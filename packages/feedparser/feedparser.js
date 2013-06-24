var feedParser = Npm.require('feedparser');
var request = Npm.require('request');
var Future = Npm.require('fibers/future');
var zlib = Npm.require('zlib');
var URL = Npm.require('url');

var _fp = function( feed ){
  var future = new Future();
  feed.articles = [];
  
  var options = {
    uri: feed.url,
    headers: {
      'host': URL.parse( feed.url ).hostname,
      'accept-encoding': "gzip, deflate"
  },
  timeout: 10000,
  }
  
  if ( feed.lastModified ) options.headers['if-modified-since'] = new Date ( feed.lastModified ).toUTCString();
  
  var r = request( options,  function ( error, response ){
                  // return a future for cases where no http response leads to nothing getting piped to feedparser
                  
                  if ( !response || response.statusCode !== 200 ){
                  var retObj = response && { statusCode:  response.statusCode };
                  future.ret ( retObj );
                  if ( error ) console.log( feed.url + " error: " + error );
                  if ( response && response.statusCode !== 304 ) console.log( feed.url + " statusCode: " + response.statusCode );
                  }
                  });
  
  r.on ( 'response', function ( response ){
       if ( response.statusCode === 200 ){
        
        if ( response.headers['content-encoding'] === 'gzip' ){
          r = r.pipe( zlib.createGunzip() );
        }
        
        if ( response.headers['last-modified'] ){
          feed.lastModified = response.headers[ 'last-modified' ] ;
        }
        
        r.pipe( new feedParser() )
        .on('error', function(err ){
            console.log(feed.url + " got feedparser error: " + err);
            feed = null;
            })
        .on ( 'meta', function ( meta ){
             //console.log( "feedparser emmitted meta for url: " + url );
             if (meta !== null ){
             feed.url = meta.xmlurl || feed.url;
             feed.title = meta.title;
             feed.date = new Date( meta.date );
             feed.author = meta.author;
             }
             })
        .on('readable', function(){
            var stream = this, item;
            while ( item = stream.read() ) {
            feed.articles.push ( item );
            }
            
            })
        .on( 'end', function() {
            //console.log("feedparser emmitted end for url: " + url );
            future.ret ( feed );
            });
      
       }
       
      });
  return future;
}

syncFP = function ( feed ) {
  return _fp( feed ).wait();
}

multipleSyncFP = function( feeds ){
  console.log("got feeds preparing to use feedparser");
  var futures = _.map( feeds, function( feed ){
                      return _fp( feed );
                      });
  
  Future.wait(futures);
  console.log(" all futures from feedparser resolved");
  return _.invoke(futures,'get');
                      
  
}