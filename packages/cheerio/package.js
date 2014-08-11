Package.describe({
  summary: "Parse html on server",
  'version':'0.16.0'
});

Npm.depends({
  "cheerio" : "0.16.0"
});


Package.on_use(function (api) {
  api.add_files("cheerio.js", "server");
  api.export(['cheerio'], "server");
});
