

Npm.depends({
            "newrelic": "1.0.1",
            "bunyan" : "0.22.0",
            "continuation-local-storage" : "2.4.3"

            });

Package.on_use(function (api) {
	       api.add_files(["newrelic.js"], 'server');
	       });
