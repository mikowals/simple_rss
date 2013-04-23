
var DAY = 1000 * 60 * 60 * 24;
var daysStoreArticles = 2;
var updateInterval = 1000 * 60 * 15;
var intervalProcesses = {};

var Feeds = new Meteor.Collection("feeds");
var Articles = new Meteor.Collection("articles");
 

Meteor.publish("feeds", function () {
               return Feeds.find({});
               });

Meteor.publish( "articles", function(){
               return  Articles.find({}, {fields: {_id: 1, title: 1, source:1, date:1, summary:1, link:1, proofed:1}});
                       
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
           var rssResult = syncFP(doc.url);
           doc.title = rssResult.meta.title;
           doc.last_date = rssResult.meta.date;
           doc.articles = rssResult.articles;
           return false;
           }
           
});


Meteor.startup( function(){
               var process = Meteor.setInterval(function (){
                                  Meteor.call('removeOldArticles');
                                  Meteor.call('removeOldUsers');
                                                },
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

var newArticlesToDb = function(articlesFromWeb, meta){
  var existingArticles={};
  var last_dates = {};
  var article_count=0;
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
                          summary: EJSON.parse( EJSON.stringify(article.summary) ) || "",
                          date: date,
                          author: article.author,
                          link: article.link,
                          source: meta.title
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
               "addFeed": function( url) {
               var rssResult = syncFP(url);
        
               console.log("running feedparse in addfeed for " + url + " : " + rssResult.meta.title)
               
               if (Feeds.find( {title: rssResult.meta.title} ).count() === 0){
               Feeds.insert({url: url, title: rssResult.meta.title, last_date: rssResult.meta.date});
               var added = newArticlesToDb(rssResult.articles, rssResult.meta);
               var message = added + "new articles with feed";
               }
               else{
               
               var message = "Feed already exists";
               }
               
               return message;
               },
               
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
               }
               
               
               });




