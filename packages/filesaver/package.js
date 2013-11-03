
Package.on_use(function (api) {
	       api.add_files(["filesaver.js"], 'client');
               api.export( 'saveAs', 'client' );	       
});
