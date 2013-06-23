var feedParser = Npm.require('feedparser');
var request = Npm.require('request');
var Future = Npm.require('fibers/future');

syncFP = function(url){
  var future = new Future();
  var object = {};
  object.articles =[];
  
  var r = request( url, {timeout: 10000}, function ( error, response ){
                  if ( error || response.statusCode !== 200 ){
                  future.ret (null );
                  console.log( url + " returned abnormally" );
                  if ( error ) console.log( " error: " + error );
                  if ( response ) console.log( "statusCode: " + response.statusCode );
                  }
                  });
  
  r.on ( 'response', function ( response ){
       if ( response.statusCode === 200 ){
       r.pipe(new feedParser())
       .on('error', function(err ){
           console.log(url + " got feedparser error: " + err);
           object = null;
           })
       .on ( 'meta', function ( meta ){
            //console.log( "feedparser emmitted meta for url: " + url );
            if (meta !== null){
            meta.url = meta.xmlurl || url;
            object["meta"] = meta;
            }
            else {
            object["meta"] = { url: url};
            }
            })
       .on('readable', function(){
           var stream = this, item;
           while (item = stream.read()) {
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

multipleSyncFP = function(urls){
  console.log("got feeds preparing to use feedparser");
  var futures = _.map(urls, function(url){
                      return syncFP( url );
                      /**
                      var future = new Future();
                      var onComplete = future.resolver();
                      var object = {};
                      object.articles = [];
                      
                      var r = request( url, {timeout: 6000})
                      .on ( 'error', function ( error ) {
                            console.log(url + " : " + error);
                            })
                      .on ( 'response', function ( response) {
                           
                           if ( response.statusCode === 200 ) {
                           r.pipe(new feedParser())
                           .on( 'error', function( error ) {
                               console.log( url + " : " + error  );
                               object = null;
                               })
                           .on ( 'meta', function ( meta ){
                                if (meta !== null) {
                                meta.url = meta.xmlurl || url;
                                object["meta"] = meta;
                                }
                                else {
                                object["meta"] = { url: url};
                                }
                                })
                           .on( 'readable', function(){
                               var stream = this, item;
                               while (item = stream.read()) {
                               object["articles"].push ( item );
                               }
                               
                               })
                           .on( 'end', function(){
                               onComplete( object );
                               });
                           }
                           else {
                           
                           console.log( url + " statusCode: " + response.statusCode );
                           onComplete ( null );
                           }
                                      
                           
                        
                      });
                      return future;
                      **/
                      });
  Future.wait(futures);
  console.log(" all futures from feedparser resolved");
  return _.invoke(futures,'get');
                      
  
}