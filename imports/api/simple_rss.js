import { Mongo } from 'meteor/mongo';
import { Meteor } from 'meteor/meteor';
import { onPageLoad } from 'meteor/server-render';
import { renderToNodeStream, renderToString } from 'react-dom/server';
import React from 'react';
import { unstable_createRoot } from 'react-dom';
import { ArticlesPage } from '/imports/ui/articles';
import { AppContainer, App } from '/imports/ui/app';

_ = lodash;

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

  onPageLoad(sink => {
    //need to rewrite this for real userID using cookies;
    const userId = "nullUser";
    const feedList = Meteor.users.findOne(
      {_id: userId},
      {fields: {feedList: 1}}
    ).feedList;
    const articlesCursor = Articles.find(
      {feed_id: {$in: feedList}},
      {limit: initialArticleLimit, sort: {date: -1, _id: 1}}
    );
    const articles = articlesCursor.fetch();

    const htmlStream = renderToNodeStream(<ArticlesPage articlesFromServer={articles}/>);
    sink.renderIntoElementById("app", htmlStream);
  });
} else {
  onPageLoad( sink => {
    Meteor.subscribe('articles', function(){
      const rootElement = document.getElementById("app");
      unstable_createRoot(rootElement, {
        hydrate: true
      }).render(<App />);
    });
  });
}
