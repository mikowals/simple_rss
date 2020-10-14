import { Feeds, Articles, initialArticleLimit, keepLimitDate } from '/imports/api/simple_rss';
import { StoppablePublisher } from '/imports/api/server/stoppablePublisher';

const articlePubLimit = 150;
const maxArticlesFromSource = 25;

Meteor.publish( 'feeds', function() {
  var feedOptions = {fields: {_id: 1, title: 1, url: 1, last_date:1}};
  return Feeds.find( {subscribers: this.userId || 'nullUser'}, feedOptions );
});
/* Could publish this so client has knowledge of feeds subscribed.
Meteor.publish('users', function() {
  var self = this;
  const userId = self.userId || "nullUser";
  const options = {limit: 1, fields: {_id: 1, feedList: 1}};
  return Meteor.users.find({_id: userId}, options);
})
*/

Meteor.publish( 'articles', function() {
  var self = this;
  var userId = self.userId || 'nullUser';
  //var feedOptions = {fields: {_id: 1, title: 1, url: 1, last_date:1}};
  var articleFields = {_id: 1, title: 1, source: 1, date: 1, summary: 1, link: 1, feed_id: 1};
  var articleOptions = {fields: articleFields, limit: 200, sort: {date: -1, _id: 1}};
  var articlePublisher, userObserver;
  articlePublisher = new StoppablePublisher( self );
  function observeArticles( id, doc){
    var articleCursor = Articles.find(
      {feed_id: {$in: doc.feedList}, date: {$gt: keepLimitDate()}},
      articleOptions
    );
    articlePublisher.start( articleCursor );
  }

  //Observing the Users collection to watch changes in the feedLists.
  //removes don't matter because the user will always exist or log out.
  userObserver = Meteor.users.find( userId, {fields: {feedList: 1}} ).observeChanges({
    added: observeArticles,
    // for bulk adds the observer would restart constantly
    // XXX could manage this with pause publish
    changed:  _.debounce(Meteor.bindEnvironment(observeArticles), 300, {trailing: true})
  });

  self.onStop( () => {
    userObserver.stop();
    articlePublisher.stop();
  });

  return self.ready();
});
