var feedParser = Npm.require('feedparser');
var request = Npm.require('request');
var Future = Npm.require('fibers/future');
var zlib = Npm.require('zlib');
var URL = Npm.require('url');

var _fp = function( feed ){
  var future = new Future();
  feed.articles =[];
  
  var options = {
    uri: feed.url,
    headers: {
      'host': URL.parse( feed.url ).hostname,
      'Accept-Encoding': "gzip, deflate"  
  },
  timeout: 10000
  }
  
  if ( feed.lastModified ) options.headers['If-Modified-Since'] = new Date ( feed.lastModified ).toUTCString();
  
  var r = request( options,  function ( error, response ){
                  // need to return a future for cases where no response leads to nothing getting piped to feedparser
                  
                  if ( !response || response.statusCode !== 200 ){
                  future.ret ({ statusCode: response.statusCode } );
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
            console.log(url + " got feedparser error: " + err);
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