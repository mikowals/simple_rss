Package.describe({
  'summary': 'a PubSubHubbub subscription manager',
  'version': "0.5.0"
});

Npm.depends({
  "pubsubhubbub":"0.4.0",
  "resumer": "0.0.0"
});

Package.on_use(function (api) {
  api.versionsFrom('METEOR@1.1.0.1');
  api.use( ['grigio:babel','webapp','random'], "server" );
  api.add_files([ "pubsubhubbub.es6.js"], "server");
  api.export && api.export( [ "FeedSubscriber" ], "server");
});
