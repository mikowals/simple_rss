
Package.on_use(function (api) {
               api.use( ['webapp','random'], "server" );
	       api.add_files([ "pubsubhubbub.js"], "server");
               api.export && api.export( ["unsubscribePubSub", "subscribeToPubSub"], "server");
	       });
