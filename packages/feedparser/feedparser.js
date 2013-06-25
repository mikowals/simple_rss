var feedParser = Npm.require('feedparser');
var request = Npm.require('request');
var Future = Npm.require('fibers/future');
var zlib = Npm.require('zlib');
var cheerio = Npm.require( 'cheerio');
  //var URL = Npm.require('url');

var _fp = function( arg ){
  var future = new Future();
  var feed = arg.feed;
  var keepTimeLimit = arg.keepTimeLimit || null;
  var insert = arg.callback || null;
  
  
  feed.articles = [];
  
  var options = {
    uri: feed.url,
    headers: {
      'accept-encoding': "gzip, deflate"
  },
  timeout: 10000,
  }
  
  if ( feed.lastModified ) options.headers['if-modified-since'] = new Date ( feed.lastModified ).toUTCString();
  
  var r = request( options,  function ( error, response ){
                  // return a future for cases where no http response leads to nothing getting piped to feedparser
                  
                  if ( !response || response.statusCode !== 200 ){
                  var retObj = response && { statusCode:  response.statusCode };
                  future.ret ( retObj );
                  if ( error ) console.log( feed.url + " error: " + error );
                  if ( response && response.statusCode !== 304 ) console.log( feed.url + " statusCode: " + response.statusCode );
                  }
                  });
  
  r.on ( 'response', function ( response ){
       if ( response.statusCode === 200 ){
        
        if ( response.headers['content-encoding'] === 'gzip' ){
          r = r.pipe( zlib.createGunzip() );
        }
        
        if ( response.headers['last-modified'] ){
          feed.lastModified = response.headers[ 'last-modified' ] ;
        }
        
        r.pipe( new feedParser() )
        .on('error', function(err ){
            console.log(feed.url + " got feedparser error: " + err);
            feed = null;
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
            
            if ( new Date ( item.date ).getTime() - keepTimeLimit > 0 ){
            console.log( "found " + feed.title + " : " + item.title || item.link );
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
            if ( insert && feed.existingGuids.indexOf( doc.guid ) === -1 ){
            insert ( doc , function( error, newId) {
                          console.log('%s: %s', doc.source, doc.title );
                          }) ;
            
            if ( feed.newCount ) feed.newCount++;
            else feed.newCount = 1;
            }
            
            else{
             feed.articles.push( doc );
            }
            
            }
            }
          })
        .on( 'end', function() {
           
            future.ret ( feed );
            });
      
       }
       
      });
  
  return future;
}

syncFP = function ( feed ) {
  return _fp( { feed: feed } ).wait();
}

multipleSyncFP = function( feeds, keepTimeLimit, cb ){
  console.log("got feeds preparing to use feedparser");
  var futures = _.map( feeds, function( feed ){
          
                      return _fp( { feed: feed, keepTimeLimit: keepTimeLimit, callback: cb } );
                      });
  
  Future.wait(futures);
  console.log(" all futures from feedparser resolved");
  return _.invoke(futures,'get');
                      
  
}

var cleanSummary = function (text){
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