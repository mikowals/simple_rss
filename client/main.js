var DAY = 1000 * 60 * 60 * 24;
var articlesOnLoad = 20;
var updateNowFreq = 1 * 60 * 1000;

var intervalProcesses = []; //hold interval process id to start and stop with different functions.
Session.setDefault("loaded", false);
Session.setDefault("importOPML", false);
Session.setDefault( "now", new Date() );
Session.setDefault("articleLimit", articlesOnLoad );

var cleanForXml = function ( string ){
  string = string.replace ( /\"/g, "&quot;");
  string = string.replace ( /\'/g, "&apos;");
  string = string.replace ( /\&/g, "&amp;");
  string = string.replace ( /\>/g, "&gt;");
  
  return  string.replace ( /\</g, "&lt;");
};
                   
var articleSub;

Deps.autorun( function(){
  console.log( Session.get( "articleLimit" ) );
  articleSub = Meteor.subscribe( "feedsWithArticles", + Session.get( "articleLimit" ) );
});

Deps.autorun( function(){
  if ( articleSub && articleSub.ready()) 
    Session.set( "loaded",  true);
});

Meteor.startup( function() {
                          
  intervalProcesses['updateNow'] = intervalProcesses['updateNow'] || Meteor.setInterval( function() {
    Session.set( "now", new Date() );
    },
    updateNowFreq );
  Session.set( "offline", null);

});

Deps.autorun( function(){
    if ( ! Meteor.status().connected && Session.equals( "loaded", true) ) {
      console.log( "Meteor.status().connected = " + Meteor.status().connected );
      Session.set ("offline", "offline" );
    }
    else if ( articleSub && articleSub.ready() ){
      Session.set("offline", null);
    }
});


var timeago = function( some_date ){
  var now = new Date( Session.get( "now" ) );
  var referenceDate = new Date( some_date );

  var timeago = ( now -  referenceDate ) / DAY;

  if (Math.floor(timeago )  >= 2) return Math.floor(timeago ) + " days ago";
  else if (Math.floor(timeago )  >= 1) return Math.floor(timeago ) + " day ago";
  else if (Math.floor(timeago  * 24)  >= 2 ) return Math.floor(timeago * 24) + " hours ago";
  else if (Math.floor(timeago * 24)  >= 1 ) return Math.floor(timeago  * 24) + " hour ago";
  else if (Math.floor(timeago  * 24 * 60) >= 2) return Math.floor(timeago * 24 * 60) + " minutes ago";
  else {
    return "about a minute ago";
  }
};

Handlebars.registerHelper('timeago',  function(some_date){
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
                             'submit, click #addFeed': function(e) {
                               e.stopImmediatePropagation();
                               e.preventDefault();
                               var url = $("#feedUrl").val();
                               var regex =/(((f|ht){1}tp|tps:\/\/)[-a-zA-Z0-9@:%_\+.~#?&\/\/=]+)/g;
                               if ( Match.test ( url, String ) && regex.test(url) ){
                                 Meteor.call( 'addFeed', { url: url } );
                                 $("#feedUrl").val("");
                               } else{
                                 alert("RSS feed entered is not a valid url");
                               }
                               return false;        
                             },
                             
                             'click #importToggle': function(){
                             Session.set("importOPML", true);
                             console.log(Session.equals("importOPML", true));
                             },
                             
                             'click #opmlUpload' : function(){
                               Session.set("importOPML", false);
                             
                               var opmlFile = $("#opmlFile")[0].files[0];
                               var fr = new FileReader();
                               fr.readAsText(opmlFile);
                               fr.onloadend = function(evt) {
                                 if (evt.target.readyState === FileReader.DONE) { // DONE == 2
                                   //Meteor.call( 'XML2JSparse', evt.target.result, function ( error, result ){
                                   $(  evt.target.result ).find( 'outline').each( function( ){
                                      var url = $( this ).attr("xmlUrl");
                                      if ( url )
                                        Meteor.call('addFeed', {url: url} );
                                   });
                                 }
                               }
                             },
                          
                             'click #importCancel' : function(){
                             Session.set("importOPML", false);
                             },
                             
                             'click #exportOPML': function(){
                               var exportOPML = "<?xml version=\"1.0\" encoding=\"UTF-8\"?>" +
                                               "<opml version=\"1.0\">" +
                                                "<head>" +
                                                 "<title>" + Meteor.user.username + " subscriptions from New-River</title>" +
                                                 "</head>" +
                                               "<body>";
                               Feeds.find().forEach( function( feed ) {
                                 exportOPML += "<outline " +
                                               "text=\"" + cleanForXml( feed.title ) + "\" " +
                                               "title=\"" + cleanForXml( feed.title ) + "\" " +
                                               "type=\"rss\" " +
                                               "xmlUrl=\"" + cleanForXml( feed.url ) + "\"/>";
                               });
                                exportOPML += "</body></opml>";
                                //exportOPML = ( new window.DOMParser() ).parseFromString( exportOPML, "text/xml");
                                //exportOPML = (new XMLSerializer()).serializeToString( exportOPML );
                                var blob = new Blob([exportOPML], {type: "application/xml"});
                                var fname = Meteor.absoluteUrl().split( "//" )[1];
                                saveAs ( blob, fname + ".opml");
                             }
                         
                             });

Template.feedList.events({                                                   
                         'click #removeFeed': function(){
                           Meteor.call( 'removeFeed', Session.get("selected_feed"), function( error ){
                             if ( error === false ) console.error( "could not remove feed"); 
                             else Session.set( "selected_feed", null);
                             });
                         }
                         
                         });
                           
Template.articleList.articles = function() {
  
   return Articles.find( {}, { sort: { date: -1, _id: 1} } );
};

Template.articleList.loaded = function(){
  return Session.equals( "loaded", true );
};

Template.articleList.events({
  'click a, contextmenu a': function( e ){
     if ( ! Session.equals( "handleTap", true)){
       Meteor.call( 'markRead', $( e.currentTarget ).attr('href'));
     } else{
       e.preventDefault();
       e.stopImmediatePropagation();
       return false;
     }
     return true;
  },
  
  'tap a':  function( e ){
    Session.set( "handleTap", true);
    e.preventDefault();
    e.stopImmediatePropagation();
    var dest = $( e.currentTarget ).attr('href');
    Meteor.call( 'markRead', dest, function(){
      window.location.href = dest;
    });
    return false;
  }
}); 

Template.article.subscribed = function(){
  return Feeds.findOne({title: this.source}) !==null;
};

Template.article.subscribeRss = function(){
  if (this.sourceUrl) return this.sourceUrl;

  var feed = Feeds.findOne( {title: this.source});
  return feed && feed.url;
  
};

Template.menubar.loaded = function(){
  return Session.equals( "loaded", true );
};

Template.menubar.offline = function(){
  return Session.get("offline");
}

Template.updated.updated = function(){
  return Session.get( "updated" );
}

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


Template.articleList.rendered = function(){

  $('#footer').waypoint( function( evt, dir) {
    if ( dir === 'down' )
      Session.set( "articleLimit", Session.get( "articleLimit" ) + 20 );
    },
    { offset: '110%'}); 
};
