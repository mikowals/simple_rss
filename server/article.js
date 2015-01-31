Article = function( doc ){
  var self = this;

  if ( doc ) {
    self.title = _.unescape( doc.title ) || null;
    self.author = doc.author ||  null;
    self.source = doc.meta.title || null;
    self.sourceUrl = doc.sourceUrl || doc.meta || doc.meta.xmlurl || doc.source && doc.source.url || null;
    self.feed_id = doc.feed_id || null;
    self.date = new Date( doc.date ) || new Date();
    self.link = doc.link || doc.origlink || null;
    self.setSummary( doc.description || doc.summary );
  }
};

Article.prototype.setSourceUrl = function( sourceUrl ){
  this.sourceUrl = sourceUrl;
};

Article.prototype.setSummary = function( summary ){
  this.summary = summary && cleanSummary( summary );
};

function cleanSummary(text){
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
