var feedParser = Npm.require('feedparser');
var request = Npm.require('request');
var Future = Npm.require('fibers/future');

syncFP = function(url){
  var future = new Future();
  var articles = [];
  var future = new Future();
  console.log(url);
  var futures = request(url).pipe(new feedParser())
  .on('error', function(error){
      console.log(error);
      })
  .on('complete', function(meta,articles){
                                                       
                                                       var object = {};
                                                       object["meta"] = meta;
                                                       object["articles"] = articles;
                                                       future.return(object);
                                                       });
  
  return future.wait();
}

multipleSyncFP = function(urls){
  console.log("got feeds preparing to use feedparser");
  var futures = _.map(urls, function(url){
                      var future = new Future();
                      var onComplete = future.resolver();
                      request(url).pipe( new feedParser() )
                                      .on('error', function(error){
                                          console.log( JSON.stringify( error ) );
                                          })
                      
                                      .on('complete', function(meta,articles){
                                          var object = {};
                                          object["meta"] = meta;
                                          object["articles"] = articles;
                                          var error = null;
                                          onComplete( error, object);
                                          });
                                     
                                      
                      return future;
                      });
  Future.wait(futures);
 
  console.log('finished reading feeds');
  return _.invoke(futures,'get');
  
  
}