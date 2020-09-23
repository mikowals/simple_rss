Package.describe({
  name: 'mikowals:trim-html',
  summary: "trim html on server",
  'version':'0.0.1'
});

Npm.depends({
  "trim-html" : "0.1.9"
});

Package.on_use(function (api) {
  api.add_files("trim-html.js", "server");
  api.export(['trimHTML'], "server");
});
