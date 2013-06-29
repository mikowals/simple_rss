var feedParser = Npm.require('feedparser');
var request = Npm.require('request');
var Future = Npm.require('fibers/future');
var zlib = Npm.require('zlib');
var cheerio = Npm.require( 'cheerio');
//var http = Npm.require('http');
//http.globalAgent.maxSockets = 200;
//var URL = Npm.require('url');

var _fp = function( fd, kl ){
  var start = new Date();
  var future = new Future();
  var feed = fd;
  
  var options = {
    url: feed.url,
    headers: {
      'Accept-Encoding': "gzip, deflate"
  },
  timeout: 10000
 }
  
  
  if ( feed.lastModified ) options.headers['If-Modified-Since'] = new Date ( feed.lastModified ).toUTCString(); // 
  if ( feed.etag ) options.headers['If-None-Match'] =  feed.etag; //
  

  var r = request( options,  function ( error, response ){
                  // return a future for cases where no http response leads to nothing getting piped to feedparser
                  
                  if ( !response || response.statusCode !== 200 ){
                  if ( error ) console.log( feed.url + " error: " + error + " in " + (new Date() - start )/1000+ " seconds");
                  if ( response  && response.statusCode !== 304 ) console.log( feed.url + " statusCode: " + response.statusCode + " in " + (new Date() - start )/1000+ " seconds");
                  future.ret ({url: feed.url, error: error, statusCode: response && response.statusCode} );
		  }
                  });
  
  r.on ( 'response', function ( response ){
       if ( response.statusCode === 200 ){
       feed.statusCode = 200; 
        if ( response.headers['content-encoding'] === 'gzip' ){
          r = r.pipe( zlib.createGunzip() );
        }
        
        if ( response.headers['last-modified'] ){
          feed.lastModified = response.headers[ 'last-modified' ] ;
        }
        
        
        
  r.pipe( new feedParser() )
        .on('error', function(err ){
            console.log(feed.url + " got feedparser error: " + err);
            feed.error = err;
            })
        .on ( 'meta', function ( meta ){
             //console.log( "feedparser emmitted meta for url: " + url );
             if (meta !== null ){
             feed.url = meta.xmlurl || feed.url;
             feed.title = meta.title;
             feed.date = new Date( meta.date );
             feed.author = meta.author;
             }
             })
        .on('readable', function(){
            var stream = this, item;
            while ( item = stream.read() ) {
            
	      if ( new Date ( item.date ).getTime() - keepLimitDate > 0 && ! _.findWhere (commonDuplicates, { link: item.link })){
		//console.log( "found " + feed.title + " : " + item.title || item.link );
		var doc = {
            
		  feed_id: feed._id,
		  title: item.title,
		  guid: item.guid,
		  summary: cleanSummary( item.description ),
		  date: item.date || new Date(),
		  author: item.author,
		  link: item.link,
		  source: feed.title
            
		}
            
		tmpStorage.insert ( doc, function( error, result){
		  if ( error ) console.log( "tmpStorage error: " + error + " in " + (new Date() - start ) /1000 + " seconds");
		   //else console.log( "tmpStorage inserted " + (doc.title || doc.link) + " in " + (new Date() - start ) /1000 + " seconds"); 
		});
            
            
	      }
            }
          })
        .on( 'end', function() {
		  //console.log( feed.url + " returned in " + ( new Date() -start ) /1000 + " seconds"); 
            future.ret ( feed );
            });
      
       }
       
      });
  
  return future;
}

syncFP = function ( feed ) {
  return _fp( feed ).wait();
}

multipleSyncFP = function( feeds ){
  var start = new Date();
  console.log("got feeds preparing to use feedparser");
  
  var futures = _.map( feeds, function( feed ){
          
                      return _fp( feed );
                      });

  
  Future.wait(futures);
  console.log(" all futures from feedparser resolved in " + ( new Date() - start ) /1000 + " seconds");
 
  return _.invoke(futures,'get');
                      
  
}

cleanSummary = function (text){
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
