var Fiber = Npm.require( 'fibers');

Article = function( doc ){
  var self = this;
  self.title = null;
  self.author = null;
  self.source = null;
  self.feed_id = null;
  self.date = null;
  self.link = null;

  var link = null,
    sourceUrl,
    summary = null;

  self.getSourceUrl = function(){
    return self.source;
  }

  self.setSourceUrl = function( sourceUrl ){
    if (self.sourceUrl && typeof self.sourceUrl === "string" ){
      self.sourceUrl = sourceUrl;
    }
    else{
      self.sourceUrl = null;
    }
  }

  self.getSummary = function(){
    return self.summary;
  }
  self.setSummary = function( summary ){
    self.summary =  cleanSummary( summary );
  }
  if ( doc ) {
    self.title = doc.title || null;
    self.author = doc.author ||  null;
    self.source = doc.source || null;
    self.feed_id = doc.feed_id || null;
    self.date = doc.date || null;
    self.link = doc.link || null;
    if ( doc.summary ) self.setSummary( doc.summary );
    if ( doc.sourceUrl ) self.setSourceUrl ( doc.sourceUrl );
  }
};

Article.prototype.toDB = function(){
  if ( this.sourceUrl ) this.setSourceUrl( this.sourceUrl );

  if ( !keepLimitDate || this.date < keepLimitDate ){
    //console.error ( ( this.title || this.link) + " too old to insert to Articles");
    return  null;
  }
  else{
    if ( this._id ) { 
      //console.error ( ( this.title || this.link) + " already in Articles");
      return  null;
    }
    else{
      var existing = null;
      if ( this.link ) {
         existing = Articles.findOne( {$or:[{ link: this.link },{ link: this.link.toLowerCase()}]} );
      } else{
        console.log ( "No link errror saving to db - " + this.title + " : " + this.source );
        return null;
      }
     
      if ( existing ){
	return  null;
      }
      else if (! this.feed_id ){
	if ( this.sourceUrl && this.source ) {
	  this.feed_id = Feeds.findOne( {$or:[ {url: this.sourceUrl},{url: this.sourceUrl.toLowerCase()}, {title: this.source}, {title: this.source.toLowerCase()}] })._id;
	}	
	else if ( this.sourceUrl ) {
	  this.feed_id = Feeds.findOne( {$or: [{url: this.sourceUrl }, {url: this.sourceUrl.toLowerCase()}]})._id;
	}
	else if ( this.source ) {
	  this.feed_id = Feeds.findOne( {$or:[ { title: this.source }, {title: this.source.toLowerCase()}]})._id;  
	}
	else {
	  console.log (( this.title || this.link) + " Can't insert article without feed_id, sourceUrl, or source" );
	  return  null;
	}
      }
      var callback = function (error, result) { 
	if ( error ) {
	  console.log ("Attempted insert of " + ( this.title || this.link) + " to Articles and got error: " + error);
	}
	else{
	  //console.log( "inserted to DB: " + result);
	}
      }
      Articles.insert(  {
summary: this.summary, 
feed_id: this.feed_id, 
title: this.title, 
source: this.source, 
link: this.link, 
date: this.date, 
author: this.author 
	});
    return true;
    }
  }
  
};

Article.prototype.fromFeedParserItem =  function( item ){
  this.feed_id = item.feed_id;
  this.title = item.title;
  this.date = item.date || new Date();
  this.author =item.author;
  this.link = item.origlink || item.link;
  this.setSummary( item.description );
  this.source = item.meta && item.meta.title || item.source && item.source.title;
  this.setSourceUrl( item.sourceUrl || item.meta && item.meta.xmlurl );
  if ( this.link === null || this.link === undefined){
    console.log ( "null link from feed: " );
    console.log ( this.source +" : " + this.sourceUrl );  
  }
  return this;
};


