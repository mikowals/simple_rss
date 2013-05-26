var feedParser = Npm.require('feedparser');
var request = Npm.require('request');
var Future = Npm.require('fibers/future');

syncFP = function(url){
  var future = new Future();
  request(url, {timeout: 20000}, function(error){
          if (error){
          console.log(url + " : " + error);
          future.ret(  );
          }
          }).pipe(new feedParser())
  .on('error', function(err){
      console.log(url + " : " + err);
      future.ret( );
      })
  
  .on('complete', function(meta,articles){
      
      var object = {};
      meta.url = meta.xmlurl || url;
      object["meta"] = meta;
      object["articles"] = articles;
      future.ret (object);
      });
  
  return future.wait();
}

multipleSyncFP = function(urls){
  console.log("got feeds preparing to use feedparser");
  var futures = _.map(urls, function(url){
                      var future = new Future();
                      var onComplete = future.resolver();
                      
                      request(url, {timeout: 20000}, function(error){
                              if (error){
                              console.log(url + " : " + error);
                              onComplete();
                              }
                              }).pipe(new feedParser())
                      .on('error', function(error){
                          console.log( url + " : " + error  );
                          onComplete( );
                          })
                      
                      .on('complete', function(meta,articles){
                          var object = {};
                          meta.url = meta.xmlurl || url;
                          object["meta"] = meta;
                          object["articles"] = articles;
                          onComplete(null, object);
                          });
                      
                      
                      return future;
                      });
  Future.wait(futures);
  
    return _.invoke(futures,'get');
  
  
}