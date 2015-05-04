Package.describe({
	'summary': "manage file downloads on the client",
	'version': '1.0.0'
});

/*
Npm.depends({
	'filesaver.js': '2013.1.23'
});
*/

Package.onUse(function (api) {
  api.versionsFrom('METEOR-CORE@0.9.0-rc5');
	api.addFiles(["filesaver.js"], 'client');
	api.export( 'saveAs', 'client' );
});
