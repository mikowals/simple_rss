Package.describe({
                 summary: "Parse html on server"
                 });

Npm.depends({
            "cheerio" : "0.11.0"
            
            });


Package.on_use(function (api) {
               api.add_files("cheerio.js", "server");
               });