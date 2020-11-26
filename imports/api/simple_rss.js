import { Mongo } from 'meteor/mongo';
import { Meteor } from 'meteor/meteor';

export const Feeds = new Mongo.Collection ( "feeds" );
export const Articles = new Mongo.Collection ( "articles" );
export const initialArticleLimit = 40;
export const DAY = 1000 * 60 * 60 * 24;
export const keepLimitDate = function(){
  return new Date( new Date().getTime() - ( DAY * daysStoreArticles ));
};
export const daysStoreArticles = 3.0;
