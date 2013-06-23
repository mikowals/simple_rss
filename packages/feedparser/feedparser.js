var feedParser = Npm.require('feedparser');
var request = Npm.require('request');
var Future = Npm.require('fibers/future');
var zlib = Npm.require('zlib');

var gzip = zlib.createGzip();


var _fp = function(url){
  var future = new Future();
  var object = {};
  object.articles =[];
  
  var options = {
    uri: url,
    headers: {
      'Connection': "keep-alive",
      'Cache-Control': "no-cache",
      'Accept': "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      'Pragma': "no-cache",
      'User-Agent': "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_8_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/29.0.1541.0 Safari/537.36",
      'DNT': "1",
      'Accept-Encoding': "gzip,deflate,sdch"
  
  },
  timeout: 7000
  }
  
  var r = request( options,  function ( error, response ){
                  // need to return a future for cases where no response leads to nothing getting piped to feedparser
                  
                  if ( !response || response.statusCode !== 200 ){
                  future.ret (null );
                  console.log( url + " returned abnormally" );
                  if ( error ) console.log( " error: " + error );
                  if ( response ) console.log( "statusCode: " + response.statusCode );
                  }
                  });
  
  r.on ( 'response', function ( response ){
       if ( response.statusCode === 200 ){
        if ( response.headers['content-encoding'] == 'gzip' ){
        r = r.pipe(zlib.createGunzip());
        }
        r.pipe( new feedParser() )
        .on('error', function(err ){
            console.log(url + " got feedparser error: " + err);
            object = null;
            })
        .on ( 'meta', function ( meta ){
             //console.log( "feedparser emmitted meta for url: " + url );
             if (meta !== null ){
             meta.url = meta.xmlurl || url;
             object["meta"] = meta;
             }
             else {
             object["meta"] = { url: url};
             }
             })
        .on('readable', function(){
            var stream = this, item;
            while ( item = stream.read() ) {
            object["articles"].push ( item );
            }
            
            })
        .on( 'end', function() {
            //console.log("feedparser emmitted end for url: " + url );
            future.ret ( object );
            });
        
        
       }
       
      });
  return future;
}

syncFP = function ( url ) {
  return _fp( url ).wait();
}

multipleSyncFP = function(urls){
  console.log("got feeds preparing to use feedparser");
  var futures = _.map(urls, function(url){
                      return _fp( url );
                      });
  
  Future.wait(futures);
  console.log(" all futures from feedparser resolved");
  return _.invoke(futures,'get');
                      
  
}