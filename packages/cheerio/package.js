Package.describe({
  summary: "Parse html on server",
  'version':'0.17.0'
});

Npm.depends({
  "cheerio" : "1.0.0-rc.3"
});

Package.on_use(function (api) {
  api.add_files("cheerio.js", "server");
  api.export(['cheerio'], "server");
});
