
var DAY = 1000 * 60 * 60 * 24;
var daysStoreArticles = 2;
var updateInterval = 1000 * 60 * 5;
var intervalProcesses = {};
var articlePubLimit = 300;

Accounts.config({sendVerificationEmail: true});

var Feeds = new Meteor.Collection("feeds");
var Articles = new Meteor.Collection("articles");
Articles._ensureIndex( {"date": 1} );
 

Meteor.publish("feeds", function () {
               var self = this;
               return Feeds.find({subscribers: self.userId }, {_id: 1, title: 1, url:1, last_date:1});
               });

Meteor.publish( "articles", function(){
               var self= this;
               var feed_ids = [];
               
               
               var observer = Feeds.find({ subscribers: self.userId }, {_id: 1}).observeChanges({
                                                                                added: function (id){
                                                                                  feed_ids.push(id);                                       
                                                                                },
                                        
                                                                                removed: function (id){
                                                                                  var ax;
                                                                                  while (( ax = feed_ids.indexOf(id)) !== -1) {
                                                                                  feed_ids.splice(ax, 1);
                                                                                }
                                        
                                                                                }

                                        });
               
               self.onStop( function() {
                           observer.stop();
                           });
               
               return Articles.find({ feed_id: {$in: feed_ids} }, { sort: {date: -1}, limit: articlePubLimit, fields: {_id: 1, title: 1, source: 1, date: 1, summary: 1, link: 1} } );
               
               });

Articles.allow({
               insert: function ( doc ) {
               return false //(userId && doc.owner === userId);
               },
               update: function (userId, doc, fieldNames, modifier ) {
               return false;
               },
               
               remove: function ( doc ) {
               // can only remove your own documents
               return false //doc.owner === userId;
               }
               //fetch: ['owner']
               });

Feeds.allow({
            insert: function (userId, doc) {
            return doc.subscribers[0] === userId;
            },
            
            update: function (doc, fields, modifier) {
              return false;
            },
            
            remove: function(userId, doc){
              if(doc.subscribers.length > 1){
                Feeds.update(doc._id, {$pull: {subscribers: userId}} );
                return false;
              }
              else{
                return doc.subscribers[0] === userId;
              }
            }
            
            //fetch: ['owner']
            });

Feeds.deny({
           insert: function(userId, doc){
           var existingFeed = Feeds.findOne({url: doc.url});
           if( existingFeed ){
           console.log(doc.url + " exists in db");
            Feeds.update(existingFeed._id, {$addToSet: {subscribers: userId}});
            return true;
           }
           
           var rssResult = syncFP( doc );
           if ( ! rssResult || ! rssResult.url ){
           console.log(doc.url + " has no data to insert");
           return true;
           }
           else if (rssResult.url && doc.url !== rssResult.url ) {
             doc.url = rssResult.url;
             existingFeed = Feeds.findOne( {url: doc.url} );
           }
           
           if( existingFeed ){
             console.log(doc.url + " exists in db at different url");
             Feeds.update(existingFeed._id, {$addToSet: {subscribers: userId}});
             return true;
           }
           
           else{
           console.log(doc.url + " not in db - adding");
           doc.title = rssResult.title;  
           doc.last_date = rssResult.date;
           doc.articles = rssResult.articles;
           doc.subscribers = [];
           doc.subscribers.push(userId);
           doc.lastModified = null;
           return false;
           }
                     
           }
           
           
           
});


Meteor.startup( function(){
               console.log( Meteor.call('findArticles') + " added to db" );
               Meteor.call('removeOldArticles');
               
               if ( !intervalProcesses[ "removeOldArticles"] ){
               var process = Meteor.setInterval(function (){
                                                Meteor.call('removeOldArticles'); },
                                                DAY);
               intervalProcesses["removeOldArticles"] = process;
               }
               
               if ( !intervalProcesses[ "findArticles"] ){
               var process = Meteor.setInterval( function(){
                                                console.log( Meteor.call('findArticles') + " added to db" );
                                                }, 
                                                updateInterval);
               intervalProcesses[ "findArticles"] = process;
               console.log("updating on");
               }


               });

var newArticlesToDb = function( updatedFeed ){ //using metadata rather than feed from database -> feed should be up to date and passed if needed
  var existingGuid = {};
  var existingLink = {};
  var last_dates = {};
  var article_count=0;
    //var feed = Feeds.findOne({url: feed.url }); // see comment above
  Articles.find({feed_id: updatedFeed._id},{guid:1, date:1, link:1}).forEach(function(article){
                                                                      existingGuid[article.guid] = 1;
                                                                      existingLink[article.link] = 1;
                                                               
                                                              });
  if ( updatedFeed.lastModified ) Feeds.update( updatedFeed._id, {$set: { lastModified: updatedFeed.lastModified }} );
  
  maxDate = updatedFeed.date || 0;
 
  updatedFeed.articles.forEach(function (article) {
                          
                          if(existingGuid[article.guid] !== 1 && existingLink[article.link] !== 1){
                          var date = article.date || new Date();
                          date = Math.min( new Date ( date ).getTime(), new Date().getTime() );
                          date = new Date(date);
                          maxDate = Math.max( date , maxDate);
                          if ( (new Date() - date) / DAY <= daysStoreArticles ){
                            var new_article = {
                              title: article.title,
                              guid: article.guid,
                              summary: cleanSummary( article.description ),
                          
                              date: date,
                              author: article.author,
                              link: article.link,
                              source: updatedFeed.title,
                              feed_id: updatedFeed._id
                            };
                         
                            Articles.insert(new_article);
                            existingGuid[article.guid] = 1;
                            existingLink[article.link] = 1;
                          
                            article_count++;
                            console.log('%s: %s', updatedFeed.title, article.title || article.description);
                          }
                          }
                          });
  if (article_count > 0){
    var feed_date = updatedFeed.last_date;
    if (feed_date === null || maxDate > feed_date ){
      
      Feeds.update(updatedFeed._id, {$set:{last_date: maxDate }});
    }
  }
  return article_count;
}

var cleanSummary = function (text){
  var $ = cheerio.load(text);  //relies on cheerio package
  
  $('img').remove();
  $('table').remove();
  $('script').remove();
  $('iframe').remove();
  $('.feedflare').remove();
  
  if( $('p').length ) 
    {
    text = $('p').eq(0).html() + ( $('p').eq(1).html() || ''); 
    }
  else if( $('li').length ){
    text = '<ul>';
    $('ul li').slice(0,6).each( function(){
                               text += "<li>" + $(this).html() + "</li>";
                               });
    text += "</ul>";
  }
  
  else{
    if ( $.html() ){
        text = $.html();
    }
    
    if ( text.indexOf('<br') !== -1 ){
      text = text.substring(0, text.indexOf('<br'));
    }
    
    text = text.substring(0, 500);
  }

  if (text === null || text === undefined || text === "null") {
    text = '';
  }
  return text;
}

  //recursively read javascript object tree looking for urls of rss feeds
var eachRecursive = function (obj, resultArr) {
  for (var k in obj)
    {

    if (typeof obj[k] === "object"){
      eachRecursive(obj[k], resultArr);
    }
    else{
      if (k === 'xmlUrl'){
        resultArr.push( obj['xmlUrl'] );
      }
    }
    }
}

/** a first effort at parsing rss.  probably not much need for it if feedParser works
 
var rssUrlHandler = function(urls){
  var futures = _.map(urls, function(url){
                      var future = new Future();
                      var onComplete = future.resolver();
                      
                      if ( url.indexOf('http://') === -1 && url.indexOf('https://') === -1 ) {
                      console.log(url);
                      url = 'http://' + url; 
                      }
                      
                      Meteor.http.get(url, function (error, result) {
                                      if( error){
                                      console.log( error ); 
                                      }
                                      if ( result.statusCode === 200 ){
                                      var $ = cheerio.load (result.content);
                                      console.log( $('channel').find('title').text() );
                                      var meta = {};
                                      
                                      meta['title'] = $('channel').title;
                                      meta['date'] = $('channel').pubDate || $('channel').PubDate;
                                      meta['xmlUrl'] = $('channel').xmlUrl || url;
                                  
                                      var articles = $('item');
                                      var object = {};
                                      console.log(url + " : " + meta.title); 
                                      object["meta"] = meta;
                                      object["articles"] = articles;
                                      
                                      onComplete( object );
                                      }
                                      
                          });    
                      return future;
                      });
  Future.wait(futures);
  
  console.log('finished reading feeds');
  return _.invoke(futures,'get');
}
 **/

var handle = Feeds.find({}, {sort:{_id: 1}}).observe({
                                                     _suppress_initial: true,
                                                     
                                                     added: function(doc){
                                                     if (doc.articles) {
                                                     console.log( "found " + newArticlesToDb( doc ) + " for new feed - " + doc.title);
                                                     Feeds.update(doc._id, {$unset: {articles: 1}});
                                                     }
                                                     else{ 
                                                     result = syncFP( doc );
                                                     console.log( "found " + newArticlesToDb( result ) + " for new feed - " + doc.title);
                                                     }
                                                     
                                                     },
                                                     
                                                     removed: function(doc){
                                                     
                                                     Articles.remove({ feed_id: doc._id });
                                                     console.log("removed all articles from source: " + doc.title );
                                                     
                                                     }
                        
                                                     });



Meteor.methods({
               
               findArticles: function() {         
               console.log("looking for new articles");
               var article_count = 0;         
               
               var feeds = [];
               Feeds.find({}).forEach( function(feed){
                                      if ( feed && feed.url !== null && feed.url !== undefined && feed.url !== "null" ){
                                      feeds.push( feed );
                                      }
                                      else{
                                      console.log( "feed with no URL - removing : " + JSON.stringify (feed));
                                           Feeds.remove( feed._id );
                                      }
                                      });
               
               var rssResults = multipleSyncFP ( Feeds.find({}), daysStoreArticles, Articles.update );
               
               rssResults.forEach(function(rssResult){ 
                                  if ( rssResult && rssResult.url && rssResult.articles ){
                                  article_count += newArticlesToDb ( rssResult );
                                  }
                                  else if ( !rssResult || rssResult.statusCode !== 304 ){
                                  console.log( "a feed returned no data");
                                  }
                                  }); 
               
               
               console.log("finished find articles");
               return article_count; 
               },
               
               removeOldArticles: function(){
                 console.log("removeOldArticles method called on server");
                 var dateLimit = new Date(new Date() - (daysStoreArticles* DAY));
               
                 var error = Articles.remove({date:  {$lt: dateLimit} }, function(error){ return error;});
               
                 return error || 'success';
               },
               
               addSubscriberToFeeds: function(){
               var self = this;
               Feeds.find({}).forEach( function ( feed ){
                                      console.log("adding subscriber " + self.userId);
                                       Feeds.update( feed._id,{ $addToSet: { subscribers: self.userId }});
                                       });
               },
               
               addFeed_idToArticles: function(){
               Articles.find({}).forEach( function (article){
                                         var feed_id = Feeds.findOne({title: article.source})._id;
                                         Articles.update(article._id,{$set: {feed_id: feed_id}});
                                         });
               
               },
               
               cleanUrls: function(){
               Feeds.find({}).forEach( function(feed){
                                      var result = syncFP( feed );
                                      if (result && result.url && feed.url !== result.url ){
                                      console.log("changing url " + feed.url + " to " + result.url);
                                      Feeds.update(feed._id, {$set: {url: result.url }});
                                      }
                                      });
               },
               
               importOPML: function(upload){
               check (upload, String);
               var self = this;
               var opml = XML2JS.parse(upload);
               var xmlToAdd = [];
               eachRecursive(opml, xmlToAdd); 
               var fpResults = [];
               
               xmlToAdd.forEach( function(url){
                                try{
                                var feed = { url: url };
                                if (url !== null && url !== undefined){
                                fpResults.push( syncFP( feed ) );
                                }
                                }
                                catch(e){
                                console.log( e + " parsing url " + url);
                                }
                                });
               console.log( "finished with feedparser");
               if ( fpResults ){
               fpResults.forEach( function (rssResult){
                                 
                                 var doc = {url: rssResult.url, title: rssResult.title, last_date: rssResult.date, subscribers: [] };
                                 doc.subscribers.push(self.userId);
   
                                 var existingFeed = Feeds.findOne( {url: doc.url} );
                                 if( existingFeed ){
                                 Feeds.update(existingFeed._id, {$addToSet: {subscribers: self.userId} } );
                                 console.log( rssResult.title +" in db - subscribing user");
                                 }
                                
                                else {
                                 console.log(doc.url + " not in db - adding");
                                 doc.articles = rssResult.articles;
                                 Feeds.insert(doc);
                                 }
                                 
                                 
                                });
               }
               },
               
               exportOPML: function(){
               var self = this;
               var opmlFile = "<?xml version='1.0' encoding='UTF-8'?> <opml version='1.0'><body>";
               Feeds.find( {subscribers: self.userId} ).forEach( function ( feed ) {
                                                               opmlFile += "<outline xmlUrl=\"" + feed.url + "\" />";
                                                               });
               opmlFile += "</body></opml>";
               console.log( opmlFile );
               return opmlFile;
               }
               
               });




