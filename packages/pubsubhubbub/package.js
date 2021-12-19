Package.describe({
  'summary': 'a PubSubHubbub subscription manager',
  'version': "0.5.0"
});

Npm.depends({
  "pubsubhubbub":"1.0.1",
  "resumer": "0.0.0"
});

Package.onUse(function (api) {
  //api.versionsFrom('METEOR@1.0.3.2');
  api.use( ['ecmascript','webapp','random'], "server" );
  api.addFiles([ "pubsubhubbub.js"], "server");
  api.export && api.export( [ "FeedSubscriber" ], "server");
});
