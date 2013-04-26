
var DAY = 1000 * 60 * 60 * 24;
var articlesOnLoad = 10;
var intervalProcesses = []; //hold interval process id to start and stop with different functions.
Session.setDefault("loaded", false);
Session.setDefault("active", 1);
Session.setDefault("anonyous_id", amplify.store("anonymous_id"));
                   
Meteor.subscribe("feeds" );
var Feeds = new Meteor.Collection("feeds");


var article_sub = Meteor.subscribe("articles", function(){
                                   Session.set("loaded", true);
                                   });
             
                                            
var Articles = new Meteor.Collection("articles");


Deps.autorun( function(){
             if ( Session.equals( "loaded", true ) ){
                 var articlesToStore = [];
                 if ( amplify.store("quickArticles") !== null && amplify.store("quickArticles") !== undefined){
                 articlesToStore = amplify.store("quickArticles");
                 }
                 maxStore = 0;
                 Articles.find({},{sort: {date: -1}, limit: articlesOnLoad}).forEach (function (article){   
                                                                                                articlesToStore.push(article);
                                                                                                maxStore++;
                                                                                                console.log("new article stored ");
                                                                                                while (articlesToStore.length > articlesOnLoad) { articlesToStore.shift(); }
                                                                                                
                                                                                                });
                 while (articlesToStore.length > maxStore) { articlesToStore.shift(); }
                 
                 amplify.store("quickArticles", articlesToStore);
                 }
                 });

var timeago = function(some_date){
  var timeago = (new Date() - new Date(some_date)) / DAY;
  
  if (Math.floor(timeago )  >= 2) return Math.floor(timeago ) + " days ago";
  else if (Math.floor(timeago )  >= 1) return Math.floor(timeago ) + " day ago";
  else if (Math.floor(timeago  * 24)  >= 2 ) return Math.floor(timeago * 24) + " hours ago";
  else if (Math.floor(timeago * 24)  >= 1 ) return Math.floor(timeago  * 24) + " hour ago";
  else if (Math.floor(timeago  * 24 * 60) >= 2) return Math.floor(timeago * 24 * 60) + " minutes ago";
  else return "about a minute ago";
};

Handlebars.registerHelper('timeago', function(some_date){
                          return timeago(some_date);
                          });

Template.feedList.feeds= function () {
  return Feeds.find({}, {sort: {title: 1}});
};

Template.feedList.flash = function(){
  return Session.get("feedListFlash");
};

Template.feedModal.events({
                          'click #addFeed': function() {
                          
                          Feeds.insert( { url: $("#feedUrl").val() } );http://feeds.bbci.co.uk/news/system/latest_published_content/rss.xml
                          $("#feedUrl").val("");
                          }
                          });

Template.feedList.events({                                                   
                         'click #removeFeed': function(){
                         Feeds.remove(Session.get("selected_feed"));
                         }
                         
                         });

Template.articleList.events({
                         
                            });

Template.articleList.articles = function() {
  
   if ( Session.equals("loaded", true) ) { 
            return Articles.find({},{sort: {date: -1}, limit: 300});;
  }
  else{
    console.log("articles from QuickArticles");
    return amplify.store("quickArticles");
  }
};

Template.articleList.loaded = function(){
  return Session.equals( "loaded", true );
};


Template.feed.selected = function () {
  return Session.equals("selected_feed", this._id) ? "selected" : '';
};

Template.feed.article_count = function () {
  return Articles.find({source: this.title}).count();
};

Template.feed.events({
                     'click': function(){
                     Session.set("selected_feed", this._id);
                     }
                     });

Template.newriver.user = function(){
  return Meteor.user() || Session.get("anonymous_id");
};




