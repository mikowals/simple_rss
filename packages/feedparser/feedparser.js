var feedParser = Npm.require('feedparser');
var request = Npm.require('request');
var Future = Npm.require('fibers/future');
var fs = Npm.require('fs');

syncFP = function(url){
  var future = new Future();
 
  Meteor.http.get( url, {timeout: 5000}, function( error, response){
                  if (error) { 
                  console.log (url + " : " + error);
                  future.ret( ); 
                  }
                  else if (response && response.statusCode !== 200) { 
                  var error = {message: url + " returned statusCode : " + response.statusCode};
                  future.ret();
                  }
                  else{
                  feedParser.parseString(response.content, function(error, meta, articles) {
                                         if (error || !articles || !meta ) { 
                                         console.log (url + " : " + error);
                                         future.ret (  ); 
                                         }
                                         else{
                                         var object = {};
                                         object["meta"] = meta;
                                         object.meta.url = meta.xmlurl || url;
                                         object["articles"] = articles;
                                         future.ret ( object );                                                    
                                         
                                         }
                                         });
                  }
                  });
  return future.wait();
}
/** not working
multipleSyncFP = function(urls){
  console.log("got feeds preparing to use feedparser");
  var futures = _.map(urls, function(url){
                      var future = new Future();
                      console.log ("trying " + url);
                      Meteor.http.get( url, {timeout: 5000}, function( error, response){
                                      if (error) { 
                                      console.log (url + " : " + error);
                                      future.resolver ( error, null ); 
                                      }
                                      else if (response && ( response.statusCode !== 200  || response.statusCode === 304 )) { 
                                      var error = {message: url + " returned statusCode : " + response.statusCode};
                                      future.resolver ( error, null );
                                      }
                                      else{
                                      console.log ("response for: " + url);
                                      feedParser.parseString(response.content, function(error, meta, articles) {
                                                             if (error || !articles || !meta ) { 
                                                             console.log (url + " : " + error);
                                                             future.resolver ( error || url , null); 
                                                             }
                                                             else{
                                                             var object = {};
                                                             object["meta"] = meta;
                                                             object.meta.url = meta.xmlurl || url;
                                                             object["articles"] = articles;
                                                             future.resolver ( null, object );                                                    
                                                             
                                                             }
                                                             });
                                      }
                                      });
                      return future;            
                      });
  Future.wait(futures);
 
  console.log('finished reading feeds');
  return _.invoke(futures,'get');
}
**/