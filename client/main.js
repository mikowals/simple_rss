var DAY = 1000 * 60 * 60 * 24;
var articlesOnLoad = 20;
var updateNowFreq = 1 * 60 * 1000;

var intervalProcesses = []; //hold interval process id to start and stop with different functions.
Session.setDefault("loaded", false);
Session.setDefault("importOPML", false);
Session.setDefault( "now", new Date() );
Session.setDefault("articleLimit", articlesOnLoad );
Session.setDefault( "page", "articleList" );
Session.setDefault( "offline", null);

Deps.autorun( function( comp ){
  if ( Feeds.find().count() > 0 ){
    var ids = _.pluck( Feeds.find({}, {fields: {_id: 1}}).fetch(), '_id' );
    Meteor.subscribe( "articles", ids, + Session.get( "articleLimit" ));
  }
});

Deps.autorun( function(){
  if ( + Session.get( "articleLimit") <= Articles.find().count() )
    Session.set( 'loaded', true);
  else
    Session.set( 'loaded', false);
});

Deps.autorun( function(){
  var status = Meteor.status();
  if ( ! status.connected && status.status !== 'connecting' && Session.equals( "loaded", true) )
    Session.set ("offline", "offline" );
  else
    Session.set("offline", null);
});

Meteor.startup( function() {

  intervalProcesses['updateNow'] = intervalProcesses['updateNow'] || Meteor.setInterval( function() {
    Session.set( "now", new Date() );
    },
    updateNowFreq );

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

Template.feedList.helpers({
  feeds: function () {
    return Feeds.find({}, {sort: {title: 1}});
  },

  importOPML: function(){
    return Session.equals("importOPML", true);
  },

  flash: function(){
    return Session.get("feedListFlash");
  }


});

Template.feedListButtons.importOPML = function(){
  return Session.equals("importOPML", true);
};

Template.feedList.events({

  //could modify this to verify feed and populate fields for insertion
  'submit, click #addFeed': function(e,t) {
    e.stopImmediatePropagation();
    e.preventDefault();
    var $feedUrl = t.$("#feedUrl");
    var url = $feedUrl.val();
    var regex =/(((f|ht){1}tp|tps:\/\/)[-a-zA-Z0-9@:%_\+.~#?&\/\/=]+)/g;
    if ( Match.test ( url, String ) && regex.test(url) ){
      Meteor.call( 'addFeed', { url: url } );
      $feedUrl.val("");
    } else{
      alert("RSS feed entered is not a valid url");
    }
    return false;
  },

  'click #importToggle': function(){
    Session.set("importOPML", true);
    console.log(Session.equals("importOPML", true));
  },

  'click #opmlUpload' : function(e,t){
    Session.set("importOPML", false);

    var opmlFile = t.$("#opmlFile")[0].files[0];
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
      "text=\"" + _( feed.title ).escape() + "\" " +
      "title=\"" + _( feed.title ).escape() + "\" " +
      "type=\"rss\" " +
      "xmlUrl=\"" + _( feed.url ).escape() + "\"/>";
    });
    exportOPML += "</body></opml>";
    //exportOPML = ( new window.DOMParser() ).parseFromString( exportOPML, "text/xml");
    //exportOPML = (new XMLSerializer()).serializeToString( exportOPML );
    var blob = new Blob([exportOPML], {type: "application/xml"});
    var fname = Meteor.absoluteUrl().split( "//" )[1];
    saveAs ( blob, fname + ".opml");
  },

  'click #removeFeed': function(){
    Meteor.call( 'removeFeed', Session.get("selected_feed"), function( error ){
      if ( error === false ) console.error( "could not remove feed");
      else Session.set( "selected_feed", null);
    });
  }

});

Template.articleList.articles = function() {
  //must sort by _id or order can flicker where dates are equal and the query updates
   return Articles.find( {}, { sort: { date: -1, _id: 1}});
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

  'tap a':  function( e, t){
    Session.set( "handleTap", true);
    e.preventDefault();
    e.stopImmediatePropagation();
    var dest = t.$( e.currentTarget ).attr('href');
    Meteor.call( 'markRead', dest, function(){
      window.location.href = dest;
    });
    return false;
  }
});

Template.article.helpers({
  subscribed: function(){
    return Feeds.findOne({title: this.source}) !==null;
  },

  subscribeRss: function(){
    if (this.sourceUrl) return this.sourceUrl;

    var feed = Feeds.findOne( {title: this.source});
    return feed && feed.url;
  }
});

Template.newriver.helpers({
  currentPage: function(){
    return Template[ Session.get( "page" ) ];
  },
  admin: function() {
    var user = Meteor.user();
    return user && user.admin;
  }
});

Template.menubar.events({
  'click #page,  tap #page': function( e ){
    e.stopImmediatePropagation();
    e.preventDefault();
    var newPage = Session.equals( "page", "feedList") ? "articleList" : "feedList";
    Session.set( "page", newPage );
    if ( newPage === "articleList" )
      Session.set( "lastArticleId", null );
    return false;
  }
});

Template.menubar.helpers({
  loaded: function(){
    return Session.equals( "loaded", true );
  },

  offline: function(){
    return Session.get("offline");
  },

  pageButton: function(){
    return Session.equals( "page", "feedList") ? "glyphicon glyphicon-list" : "glyphicon glyphicon-cog";
  }
});

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
Template.article.rendered = function(){
  setLastArticleWaypoint( $( this.lastNode ) );
};

Template.articleList.destroyed = function(){
  $.waypoints('destroy');
  Session.set( "articleLimit", 20 );
};

var oldTarget;
var setLastArticleWaypoint = _.debounce( function( target ){
  oldTarget && oldTarget.waypoint( 'destroy' );
  if ( Session.get( "articleLimit" ) <= Articles.find().count() ){
    target.waypoint({
      handler: function( dir ){
        if ( dir === 'down' )
        Session.set( "articleLimit" , Session.get( "articleLimit" ) + 20);
      }
      ,offset: '110%'     //offset percentage must be a string
      ,triggerOnce: true
    });
    oldTarget = target;
  }
}, 100
);
