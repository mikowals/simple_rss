

Npm.depends({
            "pubsubhubbub": "0.1.1",
            "nodepie": "0.6.1",

            });

Package.on_use(function (api) {
               api.use( ['random'], "server" );
	       api.add_files([ "pubsubhubbub.js"], "server");
               api.export && api.export( ["unsubscribePubSub", "subscribeToPubSub"],"server");
	       });
