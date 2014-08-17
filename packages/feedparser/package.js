Package.describe({
  'summary': "wrap node-feedparser for meteor",
  'version': '1.0.0'
});


Npm.depends({
  "feedparser": "0.19.1",
  "request": "2.40.0",
});

Package.on_use(function (api) {
  api.versionsFrom('METEOR-CORE@0.9.0-rc9');
  api.use( 'underscore', 'server');
  api.add_files("feedparser.js", "server");
  api.export && api.export([ "FeedParser" ], "server");
});
