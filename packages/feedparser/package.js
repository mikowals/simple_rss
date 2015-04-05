Package.describe({
  'summary': "wrap node-feedparser for meteor",
  'version': '1.0.0'
});


Npm.depends({
  "feedparser": "0.19.2",
  "request": "2.53.0",
});

Package.on_use(function (api) {
  api.versionsFrom('METEOR@1.1.0.1');
  api.use( ['grigio:babel','mikowals:lodash'], 'server');
  api.add_files("feedparser.es6.js", "server");
  api.export && api.export([ "FeedParser" ], "server");
});
