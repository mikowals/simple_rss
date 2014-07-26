Package.describe({
  summary: 'a pubsubhubbub subscription manager'
});

Package.on_use(function (api) {
  api.use( ['harmony','webapp','random'], "server" );
  api.add_files([ "pubsubhubbub.next.js"], "server");
  api.export && api.export( [ "FeedSubscriber" ], "server");
});
