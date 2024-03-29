import { Meteor } from 'meteor/meteor';
import { Articles, Feeds } from '/imports/api/simple_rss';
import {
  countLoader,
  userLoader,
  feedLoader,
  feedListLoader,
  articlesLoader,
} from '/imports/api/server/loaders';

const articlesFromFeedIds = (feedIds) => {
  const fields = {
    _id: 1,
    source: 1,
    date: 1,
    title: 1,
    link: 1,
    summary: 1,
    feed_id: 1
  };
  const options = {
    limit: 40,
    sort: {date: -1, source: 1, title: 1},
    fields: fields
  };
  return Articles.find({feed_id: {$in: feedIds}}, options).fetch();
}

const feedsFromUserId = (userId) => {
  return Feeds.find(
    {subscribers: userId},
    {sort: {title: 1}, fields: {_id: 1, title: 1, url: 1, date: 1}}
  ).fetch();
}

export const resolvers = {
  Feed: {
    count : async ({_id}) => countLoader.load(_id),
  },

  Mutation: {
    async removeFeed(parent, {id}, context, info) {
      // This probably is not able to get userId as method expects.
      Meteor.call('removeFeed', id, () =>{});
      return {_id: id};
    },

    async addFeed(parent, {_id, url}, context, info) {
      let feed = Meteor.call('addFeed', {_id, url});
      //feed.count = countLoader.load(feed._id)
      return feed;
    }
  },

  User: {
    feedList: async ({_id}) => feedListLoader.load(_id),
    //feeds: ({_id}) => feedsFromUserId(_id),
    //feeds: ({feedList}) => feedLoader.loadMany(feedList),
    //articles: ({feedList}) => articlesFromFeedIds(feedList)
  },

  Query: {
    //articles: (parent, {userId}, context, info) => articlesLoader.load(userId),
    articles: async (_, {userId}) => {
      const feedList = await feedListLoader.load(userId);
      if (feedList.length === 0) {
        return [];
      }
      return articlesFromFeedIds(feedList);
    },

    feedIds: async (_, {userId}) => feedListLoader.load(userId),
    feeds: async (_, {userId}) => feedsFromUserId(userId),
    //feeds: (_, {userId}) => feedLoader.load(userId),
    user: async (_, {userId}) =>  userLoader.load(userId)
  },
};
