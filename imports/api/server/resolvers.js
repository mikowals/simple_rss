import { Meteor } from 'meteor/meteor';
import { Articles, Feeds } from '/imports/api/simple_rss';
import { countLoader } from '/imports/api/server/loaders';

export const resolvers = {
  Query: {
    feedIds(parent, {userId}, context, info) {
      // This needs to check the userID and preferably get it from server.
      const user = Meteor.users.findOne({_id: userId}, {fields: {feedList: 1}});
      return user && user.feedList || [];
    },

    feeds(parent, {userId}, context, info) {
      const user = Meteor.users.findOne({_id: userId}, {fields: {feedList: 1}});
      const feeds = Feeds.find(
        {_id: {$in: user.feedList}},
        {sort: {title: 1}, fields: {_id: 1, title: 1, url: 1, last_date: 1}})
        .fetch();
      return feeds;
    },

    articles(parent, {userId}, context, info) {
      const user = Meteor.users.findOne({_id: userId}, {fields: {feedList: 1}});
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
      return Articles.find({feed_id: {$in: user.feedList}}, options).fetch();
    },

    // This countLoader caches which will share data between users.
    // This function is identical across users but beware if copying this pattern.
    articlesCountByFeed(parent, {id}, context, info) {
      console.log("resolver - countByFeed key: ", id);
      return countLoader.load(id);
    }
  },
  Mutation: {
    removeFeed(parent, args, context, info) {
      // This probably is not able to get userId as method expects.
      Meteor.call('removeFeed', args.id, () =>{});
      return {_id: args.id};
    },

    addFeed(parent, args, context, info) {
      return Meteor.call('addFeed', {url: args.url});
    }
  }
};
