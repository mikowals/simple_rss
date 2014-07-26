Package.describe({
	summary: "manage file downloads on the client"
});

/*
Npm.depends({
	'filesaver.js': '2013.1.23'
});
*/

Package.on_use(function (api) {
	 api.add_files(["filesaver.js"], 'client');
   api.export( 'saveAs', 'client' );
});
