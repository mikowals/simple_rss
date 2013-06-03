
var DAY = 1000 * 60 * 60 * 24;
var articlesOnLoad = 20;
var intervalProcesses = []; //hold interval process id to start and stop with different functions.
Session.setDefault("loaded", false);
Session.setDefault("importOPML", false);
                   
var article_sub;
var Feeds = new Meteor.Collection("feeds");           
var Articles = new Meteor.Collection("articles");
var timeUpdateInterval;

Meteor.startup( function() {
                          
                          Meteor.subscribe( "feeds" );
                          article_sub = Meteor.subscribe("articles", function(){
                                                         Session.set("loaded", true);
                                                         });
               if (timeUpdateInterval) Meteor.clearInterval ( timeUpdateInterval);
               
               timeUpdateInterval = Meteor.setInterval ( 10 * 60 * 1000 , function () {
                                                        Session.set( "now", new Date() );
                                                        });
                          
});

  //always keep localStorage up to date with most recent articles
  //not too efficient currently - every change rewrites all articles in localStorage
Deps.autorun( function(){
             if ( Session.equals( "loaded", true ) ){
             
             amplify.store( "quickArticles", Articles.find( {}, {sort: {date: -1}, limit: articlesOnLoad} ).fetch() );
           
             }
             });

var timeago = function(some_date){
  var timeago = (new Date( Session.get( "now" )) - new Date(some_date)) / DAY;
  
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

Template.modalButtons.importOPML = function(){
  return Session.equals("importOPML", true);
};

Template.modalButtons.events({
                             
                             //could modify this to verify feed and populate fields for insertion
                             'click #addFeed': function() {
                             var url = $("#feedUrl").val();
                             var regex =/(((f|ht){1}tp|tps:\/\/)[-a-zA-Z0-9@:%_\+.~#?&\/\/=]+)/g;
                             if ( Match.test ( url, String ) && regex.test(url) ){
                               Feeds.insert( { url: url } );
                               $("#feedUrl").val("");
                             } else{
                             alert("RSS feed entered is not a valid url");
                             }
                                       
                             },
                             
                             'click #importToggle': function(){
                             Session.set("importOPML", true);
                             console.log(Session.equals("importOPML", true));
                             },
                             
                             'click #opmlUpload' : function(){
                             Session.set("importOPML", false);
                             
                             var opmlFile = $("#opmlFile")[0].files[0];
                             console.log(JSON.stringify(opmlFile));
                             var fr = new FileReader();
                             fr.readAsText(opmlFile);
                             fr.onloadend = function(evt) {
                             if (evt.target.readyState === FileReader.DONE) { // DONE == 2
                             Meteor.call('importOPML', evt.target.result);
                             }
                             }
                             },
                          
                             'click #importCancel' : function(){
                             Session.set("importOPML", false);
                             }
                          
                         
                             });

Template.feedList.events({                                                   
                         'click #removeFeed': function(){
                         Feeds.remove(Session.get("selected_feed"));
                         }
                         
                         });
                           

Template.articleList.articles = function() {
  
   if ( Session.equals( "loaded", true ) ) { 
            return Articles.find( {}, { sort: { date: -1 } } );;
  }
  else{
    console.log("articles from QuickArticles");
    return amplify.store("quickArticles");
  }
};

Template.articleList.loaded = function(){
  return Session.equals( "loaded", true );
};

Template.menubar.loaded = function(){
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


