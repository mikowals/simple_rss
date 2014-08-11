Package.describe({
  'summary': "wrap node-feedparser for meteor",
  'version': '1.0.0'
});


Npm.depends({
  "feedparser": "0.16.6",
  "request": "2.34.0",
});

Package.on_use(function (api) {
  api.versionsFrom('METEOR-CORE@0.9.0-rc5');
  api.use( 'underscore', 'server');
  api.add_files("feedparser.js", "server");
  api.export && api.export([ "FeedParser" ], "server");
});
