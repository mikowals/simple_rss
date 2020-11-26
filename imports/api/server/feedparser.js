import { HTTP } from 'meteor/http';
import FeedParser from 'feedparser';
import { Readable } from 'stream';
import { Article } from '/imports/api/server/article';
import assignIn from 'lodash.assignin';
import pick from 'lodash.pick';
import identity from 'lodash.identity';
import subDays from 'date-fns/subDays';
import isAfter from 'date-fns/isAfter';
import Future from 'fibers/future';

function makeHTTPOptions( feed ) {
    var options = {headers: {}};
    if (feed.etag) {
      options.headers['If-None-Match'] = feed.etag;
    } else if (feed.lastModified){
      options.headers['If-Modified-Since'] =
        new Date ( feed.lastModified ).toUTCString();
    }
    options["npmRequestOptions"] = {gzip: true};
    return options;
}

// Return a future from HTTP calls to allow multiple calls in parallel.
const _getFeed = (feed) => {
  let keepDate = subDays(new Date(), 2);
  let lastUpdate = feed.date && new Date(feed.date);
  if (lastUpdate && lastUpdate > keepDate) {
    keepDate = lastUpdate;
  }
  let articles = [];
  let error = null;
  let future = new Future;

  const options = makeHTTPOptions(feed);
  console.time(feed.url);
  HTTP.get(feed.url, options, (error, res) => {
    if (error) {
      future.return({feed, articles: null, error});
      return future;
    }
    console.timeEnd(feed.url)
    feed.lastModified = res.headers[ 'last-modified' ] || feed.lastModified;
    feed.etag = res.headers['etag'] || feed.etag;

    if (res.statusCode === 200){
      const fp = Readable.from(res.content).pipe(new FeedParser());
      fp.on('error', (err) => error = err);
      fp.on('meta', (meta) => {
        assignIn( feed, {
          url: meta.xmlurl || feed.url,
          hub: meta.cloud.href,
          title: meta.title,
          date: new Date( meta.date ),
          author: meta.author
        })
      });
      fp.on('readable', function() {
          let item;
          while ( item = fp.read() ) {
            // Ignore articles older than last feed check or 2 days.
            if (isAfter(new Date(item.date || item.pubDate), keepDate)) {
              assignIn(item, {sourceUrl: feed.url, feed_id: feed._id});
              let doc = new Article( item );
              articles = [...articles, doc];
            }
          }
        });
      fp.on('end', () => future.return({feed, articles, error}));
    } else if (res.statusCode === 304){
      future.return({
        feed,
        articles,
        error
      });
    } else {
      future.return({
        feed,
        articles: null,
        error: new Meteor.Error(500, "URL: " + feed.url + " response status: " + res.statusCode)
      });
    }
  })
  return future;
};

export const getFeed = (feed) => _getFeed(feed).wait();

export const getFeeds = (feeds) => {
  const concatenatedFeeds = [];
  const concatenatedArticles = [];
  let results = feeds.map(requestedFeed => _getFeed(requestedFeed));
  results.forEach(res => {
    const {feed, articles, error} = res.wait();
    if (error) {
      console.log( error )
    } else {
      articles && concatenatedArticles.push(...articles);
      feed && concatenatedFeeds.push(feed);
    }
  });
  Future.wait(...results);
  return {
    feeds: concatenatedFeeds,
    articles: concatenatedArticles,
  };

}
