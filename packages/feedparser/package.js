

Npm.depends({
            "feedparser": "0.15.2",
            "request": "2.16.6",
            "sax":"0.5.2",
            "addressparser": "0.1.3",
            "resanitize": "0.1.10",
            "array-indexofobject": "0.0.1"

            });

Package.on_use(function (api) {
               api.add_files("feedparser.js", "server");
               });
