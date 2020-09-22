Package.describe({
  'name':'ecmascript2015-runtime-extension',
  'summary': 'add ecmascript2015 Object polyfill',
  'version': "0.0.1"
});

Npm.depends({
  "core-js":"0.9.8"
});

Package.onUse(function (api) {
  api.use(['mikowals:browserify']);
  api.addFiles([ "ecmascript2015RuntimeExtension.browserify.js"], 'client');
  api.addFiles([ "ecmascript2015RuntimeExtension.js"], 'server');
  api.export && api.export( ["Set", "Reflect", "Map"]);
});

Package.onTest(function (api) {
	api.use(['ecmascript','tinytest','ecmascript2015-runtime-extension']);
	api.addFiles('ecmascript2015RuntimeExtension.test.js');
});