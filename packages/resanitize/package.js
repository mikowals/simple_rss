

Npm.depends({
            "resanitize": "0.1.10"
            
            });

Package.on_use(function (api) {
               api.add_files("resanitize.js", "server");
               });