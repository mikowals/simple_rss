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

if (Meteor.isServer) {
  BrowserPolicy.content.allowConnectOrigin("*.mak-play.com");
  BrowserPolicy.content.allowEval();

  Feeds._ensureIndex( { url: 1 }, {unique: true} );
  Articles._ensureIndex( { link: 1 }, {unique: true, dropDups: true });
  Articles._ensureIndex( { feed_id: 1, date: -1} );

  //Accounts.config({sendVerificationEmail: true});
  Meteor.users.deny({
    update: () => true
  });
}
