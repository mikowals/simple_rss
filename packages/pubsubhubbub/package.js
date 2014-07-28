Package.describe({
  summary: 'a pubsubhubbub subscription manager',
  version: "0.5"
});

Npm.depends({
  "pubsubhubbub":"0.3.4",
  "resumer": "0.0.0"
});

Package.on_use(function (api) {
  api.use( ['harmony','webapp','random'], "server" );
  api.add_files([ "pubsubhubbub.next.js"], "server");
  api.export && api.export( [ "FeedSubscriber" ], "server");
});
