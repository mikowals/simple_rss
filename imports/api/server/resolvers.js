import { Meteor } from 'meteor/meteor';
import { Articles, Feeds } from '/imports/api/simple_rss';
import {
  countLoader,
  userLoader,
  feedLoader,
  feedListLoader,
  articlesLoader,
} from '/imports/api/server/loaders';

export const resolvers = {
  Query: {
    //articles: (parent, {userId}, context, info) => articlesLoader.load(userId),
    articles: (_, {userId}) => {
      const user = Meteor.users.findOne({_id: userId}, {fields: {feedList: 1}})
      if (! user){
        return [];
      }
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

    feedIds(parent, {userId}, context, info) {
      // This needs to check the userID and preferably get it from server.
      const user = Meteor.users.findOne({_id: userId}, {fields: {feedList: 1}});
      return user && user.feedList || [];
    },

    feeds(parent, {userId}, context, info) {
      const result =  Feeds.find(
        {subscribers: userId},
        {sort: {title: 1}, fields: {_id: 1, title: 1, url: 1, date: 1}})
        .fetch();
      return result;
    },
    //feeds: (_, {userId}) => feedLoader.load(userId),

    user: (parent, {userId}) =>  userLoader.load(userId)
  },

  User: {
    feedList: ({_id}) => feedListLoader.load(_id),
    /*feeds: ({_id}) => Feeds.find(
      {subscribers: _id},
      {sort: {title: 1}, fields: {_id: 1, title: 1, url: 1, date: 1}}
    ).fetch(),*/
    feeds: ({_id}) => feedLoader.load(_id),
    articles: ({feedList}) => {
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
      return Articles.find({feed_id: {$in: feedList}}, options).fetch();
    }
  },

  Feed: {
    count: ({_id}) => countLoader.load(_id)
  },

  Mutation: {
    removeFeed(parent, {id}, context, info) {
      // This probably is not able to get userId as method expects.
      Meteor.call('removeFeed', id, () =>{});
      return {_id: id};
    },

    addFeed(parent, {_id, url}, context, info) {
      return Meteor.call('addFeed', {_id, url});
    }
  }
};
