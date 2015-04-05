class Article {
  constructor({title, author, meta,sourceUrl, source,
               feed_id, date, link, origLink, description, summary} = {}) {

    this.title = _.unescape( title ) || null;
    this.author = author ||  null;
    this.source = meta && meta.title || null;
    this.sourceUrl = sourceUrl || ( meta && meta.xmlurl) || (source && source.url) || null;
    this.feed_id = feed_id || null;
    this.date = new Date();
    this.link = link || origLink || null;
    this.setSummary( description || summary );

    if ( Object.prototype.toString.call(date) === "[object Date]" &&
      ! isNaN( date) && date.getTime() < this.date.getTime()) {
        this.date = date;
    }
  }

  setSourceUrl(sourceUrl) {
    this.sourceUrl = sourceUrl;
  }

  setSummary(summary) {
    this.summary = summary && cleanSummary( summary );
  }

}

this.Article = Article;

function cleanSummary (text) {
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
