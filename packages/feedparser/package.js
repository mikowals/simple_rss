

Npm.depends({
            "feedparser": "0.16.1",
            "request": "2.21.0",
            "sax":"0.5.2",
            "addressparser": "0.1.3",
            "resanitize": "0.1.10",
            "array-indexofobject": "0.0.1",
            "readable-stream": "1.0.2",
            "cheerio" : "0.12.0"

            });

Package.on_use(function (api) {
	       api.use(["meteor"], "server");
	       api.add_files("feedparser.js", "server");
               api.export && api.export(["cleanSummary", "syncFP", "multipleSyncFP"], "server");
	       });
