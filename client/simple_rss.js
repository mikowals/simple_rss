
var DAY = 1000 * 60 * 60 * 24;
var articlesOnLoad = 10;
var intervalProcesses = []; //hold interval process id to start and stop with different functions.

Meteor.subscribe("feeds" );
var Feeds = new Meteor.Collection("feeds");

var articles_sub = Meteor.subscribe("articles", amplify.store("oldId"));
var Articles = new Meteor.Collection("articles");

Session.setDefault("active", 1);
Session.setDefault("loaded", false);

Deps.autorun( function(){
             var articlesToStore = [];
             if ( amplify.store("quickArticles") !== null && amplify.store("quickArticles") !== undefined){
             articlesToStore = amplify.store("quickArticles");
             }
             Articles.find({},{limit: 10, sort: {date: -1}}).forEach (function (article){
                                             
                                                                      
                                                                      articlesToStore.push(article);
                                                                      while (articlesToStore.length > articlesOnLoad) { articlesToStore.shift(); }
                                                                      });
             
                                                                      console.log("new article stored ");
                                                                      amplify.store("quickArticles", articlesToStore);
                                             });

  //need to use dom to remove html tags from articles when added - would be better on server where articles are added to collection.
Deps.autorun( function(){
             Articles.find({ proofed:{ $nin: [1] }}).forEach( function(doc) {
                                                             
                                                             var tmp = document.createElement("DIV");
                                                             tmp.innerHTML = doc.summary;
                                                             var newSummary =  tmp.textContent || tmp.innerText;
                                                             newSummary = newSummary.substring(0,500);
                                                             if (newSummary != doc.summary){
                                                             console.log("shortened summary of " + doc.title);
                                                             Articles.update( {_id: doc._id}, {$set: {summary: newSummary, proofed: 1}} );
                                                             }
                                                             else{
                                                             console.log("marked " + doc.title + " as proofed with no change");
                                                             Articles.update( {_id: doc._id}, {$set: {proofed: 1}} );
                                                             }
                                                             } );
             
             
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

Template.feedList.events({
                         'click #addFeed': function() {
                         
                         },
                         
                         'click #removeFeed': function(){
                         Feeds.remove(Session.get("selected_feed"));
                         }
                         
                         });

Template.articleList.events({
                            'click #addFeed': function() {
                            var new_url = $("#feedUrl").val();
                            if (Feeds.find({url: new_url}).count() === 0){
                            $("#feedUrl").val("");
                            Feeds.insert({url: new_url});
                            }
                            else{
                            Session.set("feedListFlash", "flash");
                            alert("feed already exists");
                            }
                            
                            },
                            
                            'onFocus' : function(){
                            console.log("onFocus event in articleList");
                            }
                         
                            });

Template.articleList.articles = function() {
  var articlesDisplayed = Articles.find({}, {sort: {date: -1}});
  
  if ( articlesDisplayed.count() ) { 
    Session.set( "loaded", true) ;
    return articlesDisplayed;
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





