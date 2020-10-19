import { Meteor } from 'meteor/meteor';
import { Articles, Feeds } from '/imports/api/simple_rss'

export const resolvers = {
  Query: {
    feedIds(parent, args, context, info) {
      const user = Meteor.users.findOne({_id: args.id}, {fields: {feedList: 1}});
      return user && user.feedList || [];
    },

    feeds(parent, args, context, info) {
      const user = Meteor.users.findOne({_id: args.id}, {fields: {feedList: 1}});
      if (! user) return [];
      return Feeds.find(
        {_id: {$in: user.feedList}},
        {sort: {title: 1}, fields: {_id: 1, title: 1, url: 1, last_date: 1}})
        .fetch();
    },

    articles(parent, args, context, info) {
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
      const user = Meteor.users.findOne({_id: args.id}, {fields: {feedList: 1}});
      if (! user) return [];
      return Articles.find({feed_id: {$in: user.feedList}}, options).fetch();
    },

    articlesCountByFeed(parent, args, context, info) {
      return Articles.find({feed_id: args.id}, {_id: 1}).count();
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
