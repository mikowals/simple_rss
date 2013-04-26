
var DAY = 1000 * 60 * 60 * 24;
var daysStoreArticles = 2;
var updateInterval = 1000 * 60 * 15;
var intervalProcesses = {};

var Feeds = new Meteor.Collection("feeds");
var Articles = new Meteor.Collection("articles");
Articles._ensureIndex( {"date": 1} );
 

Meteor.publish("feeds", function () {
               var self = this;
               return Feeds.find({subscribers: self.userId }, {title: 1, url:1, last_date:1});
               });

Meteor.publish( "articles", function(){
               var self= this;
               var feed_ids = [];              
               Feeds.find({subscribers: self.userId }, {_id: 1}).observeChanges({
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
               
               return Articles.find({feed_id: {$in: feed_ids}}, {fields: {_id: 1, title: 1, source:1, date:1, summary:1, link:1, proofed:1}} );
               
               });

Articles.allow({
               insert: function ( doc ) {
               return false //(userId && doc.owner === userId);
               },
               update: function (userId, doc, fieldNames, modifier ) {
               return ( '$set' in modifier );
               },
               
               remove: function ( doc ) {
               // can only remove your own documents
               return false //doc.owner === userId;
               },
               fetch: ['owner']
               });

Feeds.allow({
            insert: function (doc) {
            
            return true //(userId && doc.owner === userId);
            },
            update: function (doc, fields, modifier) {
            // can only change your own documents
            return false //doc.owner === userId;
            },
            remove: function (doc) {
            // can only remove your own documents
            return true //doc.owner === userId;
            },
            fetch: ['owner']
            });

Feeds.deny({
           insert: function(userId, doc){
           var existingFeed = Feeds.findOne({url: doc.url});
           if( existingFeed ){
            Feeds.update(existingFeed._id, {$addToSet: {subscribers: userId}});
            return true;
           }
           
           var rssResult = syncFP( doc.url);
           if (rssResult.meta.xmlurl && doc.url !== rssResult.meta.xmlurl ) { doc.url = rssResult.meta.xmlurl; }
           existingFeed = Feeds.findOne( {url: doc.url} );
           if( existingFeed ){
           Feeds.update(existingFeed._id, {$addToSet: {subscribers: userId}});
           return true;
           } 
           else {
           console.log(doc.url + " not in db - adding");
           doc.title = rssResult.meta.title;  
           doc.last_date = rssResult.meta.date;
           doc.articles = rssResult.articles;
           doc.subscribers = [];
           doc.subscribers.push(userId);
           return false;
           }
                     
           },
           
           remove: function(userId, doc){
           if(doc.subscribers.length > 1){
             Feeds.update(doc._id, {$pull: {subscribers: userId}} );
             return true;
           }
           else{
             return false;
           }
           }
           
});


Meteor.startup( function(){
               var process = Meteor.setInterval(function (){
                                  Meteor.call('removeOldArticles'); },
                                  DAY);
               intervalProcesses["removeOldArticles"] = process;
               
               if ( !intervalProcesses[ "findArticles"] ){
               var process = Meteor.setInterval( function(){
                                                console.log( Meteor.call('findArticles') + " added to db" );
                                                }, 
                                                updateInterval);
               intervalProcesses[ "findArticles"] = process;
               console.log("updating on");
               }


               });

var newArticlesToDb = function(articlesFromWeb, meta){ //using metadata rather than feed from database -> feed should be up to date and passed if needed
  var existingArticles={};
  var last_dates = {};
  var article_count=0;
  var feed = Feeds.findOne({title: meta.title}); // see comment above
  Articles.find({source: meta.title},{guid:1, date:1}).forEach(function(article){
                                                               existingArticles[article.guid]=1;
                                                               
                                                              });
  
  maxDate = meta.date || 0;
  articlesFromWeb.forEach(function (article) {
                          
                          
                          var date = article.date || new Date();
                          date = new Date(date);
                          maxDate = (date > maxDate) ? date : maxDate;
                          if ( (new Date() - date) / DAY <= daysStoreArticles ){
                          var new_article = {
                          title: article.title,
                          guid: article.guid,
                          summary: cleanSummary( article.summary ),
                          date: date,
                          author: article.author,
                          link: article.link,
                          source: meta.title,
                          feed_id: feed._id
                          };
                          if(existingArticles[new_article.guid] != 1){
                          Articles.insert(new_article);
                          
                          article_count++;
                          console.log('%s: %s', meta.title, article.title || article.description);
                          }
                          }
                          });
  if (article_count > 0){
    var feed_date = Feeds.findOne({title: meta.title}, {last_date:1}).last_date;
    if (feed_date === null || maxDate > feed_date){
      Feeds.update({title: meta.title}, {$set:{last_date: maxDate}});
    }
  }
  return article_count;
}

var cleanSummary = function (text){
  
  var $ = cheerio.load(text);
  text = $('p').first().text();
  
  if (text === "") { 

    $('img').remove(); 
    $('a').remove();
    text = $.html();
  }
  return text ;
}


var handle = Feeds.find({}, {sort:{_id: 1}}).observe({
                                                     _suppress_initial: true,
                                                     
                                                     added: function(doc){
                                                     
                                                     console.log( "found " + newArticlesToDb(doc.articles, doc) + " for new feed - " + doc.title);
                                                     Feeds.update(doc._id, {$unset: {articles: 1}});
                                              
                                                     
                                                     },
                                                     
                                                     removed: function(doc){
                                                     
                                                     Articles.find({source: doc.title}, {_id:1}).forEach( function (article){
                                                                                                     console.log("removing article " + article._id);
                                                                                                     Articles.remove(article._id);
                                                                                                     });
                                                     
                                                     }
                        
                                                     });



Meteor.methods({
               
               findArticles: function() {         
               console.log("looking for new articles");
               var article_count = 0;
               var urls = [];
               Feeds.find({}).forEach( function(feed){
                                urls.push( feed.url);
                                });
               try{
                 var rssResults = multipleSyncFP(urls);
               }
               catch (e){
                 console.log(e.message );
               throw Meteor.Error(500, "trouble parsing feeds", "feedparser is having an error with one of the URLs passed");
               }
               rssResults.forEach(function(rssResult){
                                  
                                  article_count += newArticlesToDb (rssResult.articles, rssResult.meta);
                                  
                                  });            
               
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
               Feeds.find({}).forEach( function (feed){
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
                                      var result = syncFP(feed.url);
                                      if (result.meta.xmlurl && feed.url !== result.meta.xmlurl ){
                                      console.log("changing url " + feed.url + " to " + result.meta.xmlurl);
                                      Feeds.update(feed._id, {$set: {url: result.meta.xmlurl }});
                                      }
                                      });
               }
               
               
               });




