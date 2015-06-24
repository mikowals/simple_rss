Package.describe({
  'summary': 'a PubSubHubbub subscription manager',
  'version': "0.5.0"
});

Npm.depends({
  "pubsubhubbub":"0.4.1",
  "resumer": "0.0.0"
});

Package.on_use(function (api) {
  //api.versionsFrom('METEOR@1.0.3.2');
  api.use( ['grigio:babel@0.1.3','webapp','random'], "server" );
  api.add_files([ "pubsubhubbub.es6.js"], "server");
  api.export && api.export( [ "FeedSubscriber" ], "server");
});
