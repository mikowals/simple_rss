import { Meteor } from 'meteor/meteor';
import { Articles, Feeds } from '/imports/api/simple_rss'

export const resolvers = {
  Query: {
    feeds(ids) {
      let feeds = Feeds.find(
        {_id: {$in: ids}},
        {sort: {title: 1}, fields: {_id: 1, title: 1, url: 1, last_date: 1}})
        .fetch();
      return feeds;
    },

    feedsBySubscriber(parent, args, context, info) {
      console.log(args.id);
      const user = Meteor.users.findOne({_id: args.id}, {fields: {feedList: 1}});
      let feeds = Feeds.find(
        {_id: {$in: user.feedList}},
        {sort: {title: 1}, fields: {_id: 1, title: 1, url: 1, last_date: 1}})
        .fetch();
      return feeds;
    },

    articlesBySubscriber(parent, args, context, info) {
      console.log("articlesBySubscriber with id: ", args.id);
      const user = Meteor.users.findOne({_id: args.id}, {fields: {feedList: 1}});
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
