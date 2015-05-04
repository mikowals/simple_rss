Package.describe({
  'name':'mikowals:lodash',
  'summary': 'adds lodash underscore compatible version from npm',
  'version': "0.1.0"
});

Npm.depends({
  "lodash":"3.8.0",
  "upper-case":"1.1.2"
});

Package.on_use(function (api) {
  api.versionsFrom('METEOR-CORE@0.9.0-rc9');
  api.use('cosmos:browserify','client');
  api.addFiles(['lodash.browserify.js','test.browserify.js'],'client');
  api.addFiles(["lodash-server.js"],'server');

  api.export && api.export([ '_', 'lodash']);
});
