Package.describe({
  summary: "wrap node-feedparser for meteor"
});


Npm.depends({
  "feedparser": "0.16.6",
  "request": "2.34.0",
});

Package.on_use(function (api) {
  api.add_files("feedparser.js", "server");
  api.export && api.export([ "readAndInsertArticles", "syncFP", "multipleSyncFP"], "server");
});
