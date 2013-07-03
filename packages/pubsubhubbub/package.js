

Npm.depends({
            "pubsubhubbub": "0.1.1",
            "nodepie": "0.6.1",

            });

Package.on_use(function (api) {
               api.add_files([ "pubsub.js", "pubsubhubbub.js"], "server");
               });
