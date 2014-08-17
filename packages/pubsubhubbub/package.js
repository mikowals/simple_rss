Package.describe({
  'summary': 'a PubSubHubbub subscription manager',
  'version': "0.5.0"
});

Npm.depends({
  "pubsubhubbub":"0.3.4",
  "resumer": "0.0.0"
});

Package.on_use(function (api) {
  api.versionsFrom('METEOR-CORE@0.9.0-rc9');
  api.use( ['mikowals:harmony@1.2.0','webapp','random'], "server" );
  api.add_files([ "pubsubhubbub.next.js"], "server");
  api.export && api.export( [ "FeedSubscriber" ], "server");
});
