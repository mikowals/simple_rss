Package.describe({
  'summary': "wrap node-feedparser for meteor",
  'version': '1.0.0'
});


Npm.depends({
  "feedparser": "1.0.1",
  "request": "2.55.0",
});

Package.on_use(function (api) {
  //api.versionsFrom('METEOR@1.0.3.2');
  api.use( ['ecmascript','ecmascript2015-runtime-extension','mikowals:lodash'], 'server');
  api.add_files("feedparser.es6.js", "server");
  api.export && api.export([ "FeedParser" ], "server");
});
