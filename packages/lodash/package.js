Package.describe({
  'name':'mikowals:lodash',
  'summary': 'adds lodash underscore compatible version from npm',
  'version': "0.1.0"
});

Npm.depends({
  "lodash":"3.6.0"
});

Package.on_use(function (api) {
  api.versionsFrom('METEOR-CORE@0.9.0-rc9');
  //api.use( ['mikowals:harmony@1.2.0','webapp','random'], "server" );
  api.add_files([ "lodash.js", 'post.js' ]);
  //api.add_files( [ 'lodash.js', 'post.js'], 'client');
  api.export && api.export( [ "lodash" ] );
});
