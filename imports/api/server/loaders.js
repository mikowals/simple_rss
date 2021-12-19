import DataLoader from 'dataloader';
import { Mongo } from 'meteor/mongo';
import { Articles, Feeds } from '/imports/api/simple_rss';
import { Meteor } from 'meteor/meteor';
import findWhere from 'lodash.findwhere';

export const countLoader = new DataLoader(async (keys) => {
  countLoader.clearAll();
  // findWhere() requies a falsy check to handle 0 counts.
  let counts = keys.map(() => 0);
  for await ({_id, count} of Articles.rawCollection().aggregate([
      { $match: {feed_id: {$in: keys}} },
      { $group: { _id: "$feed_id", count: { $sum: 1 } } }
    ])) {
      counts[keys.indexOf(_id)] = count;
    }
    return counts;
}, {
  batchScheduleFn: callback => setTimeout(callback, 5)
});

export const userLoader = new DataLoader(async keys => {
  userLoader.clearAll();
  const users = await Meteor.users.rawCollection().find(
    {_id: {$in: keys}},
    {_id: 1, feedList: 1})
    .toArray();
  return keys.map(_id => findWhere(users, {_id}));
});

export const feedLoader = new DataLoader(async keys => {
  console.time('feedLoader');
  feedLoader.clearAll();
  const feeds = await Feeds.rawCollection().find({_id: {$in: keys}}).toArray();
  console.timeEnd('feedLoader')
  return keys.map(_id => findWhere(feeds, {_id}));
});

export const feedbyUserIdLoader = new DataLoader(async keys => {
  feedbyUserIdLoader.clearAll();
  // findWhere() requires a falsy check if a user has no subscriptions.
  let feedsResult = keys.map(() => []);
  for await ({_id, feeds} of Feeds.rawCollection().aggregate([
    {$match: {subscribers: {$in: keys}}},
    {$project: {subscribers: 1, title: 1, url: 1, date: 1}},
    {$unwind: "$subscribers"},
    {$group: {_id: "$subscribers", feeds: {$push: "$$ROOT"}}},
  ])) {
    feedsResult[keys.indexOf(_id)] = feeds;
  }
  return feedsResult;
});

export const feedListLoader = new DataLoader(async keys => {
  feedListLoader.clearAll();
  const feedLists = await Meteor.users.rawCollection().find(
    {_id: {$in: keys}},
    {_id: 1, feedList: 1}
  ).toArray();
  return keys.map(_id => {
    const result = findWhere(feedLists, {_id});
    return result?.feedList || [];
  });
});

export const articlesLoader = new DataLoader( async keys => {
  articlesLoader.clearAll();
  let articlesResult = keys.map(() => []);
  for await ({_id, articles} of Meteor.users.rawCollection().aggregate([
    {$match: {_id: {$in: keys}}},
    {$lookup: {
      from: "articles",
      localField: "feedList",
      foreignField: "feed_id",
      as: "articles"
    }},
    {$unwind: "$articles"},
    {$sort: {"articles.date": -1, "articles.source": 1, "articles.title": 1}},
    {$group: {_id: "$_id", articles: {$push: "$articles"}}},
    {$project:{articles:{$slice:["$articles", 40]}}}])) {
      articlesResult[keys.indexOf(_id)] = articles;
    }
  return articlesResult;
})
