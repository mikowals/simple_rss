Package.describe({
  name: 'mikowals:react-waypoint',
  version: '0.0.1',
  // Brief, one-line summary of the package.
  summary: 'web page waypoints for React',
  // URL to the Git repository containing the source code for this package.
  git: '',
  // By default, Meteor will default to using README.md for documentation.
  // To avoid submitting documentation, set this field to null.
  documentation: 'README.md'
});

Npm.depends({
  'react-waypoint': "9.0.3"
});

Package.onUse(function(api) {
  api.versionsFrom('1.1.0.2');
  api.use(['react-runtime','jsx']);
  api.addFiles('react-waypoint.jsx');
  api.export('Waypoint');
});

Package.onTest(function(api) {
  api.use('tinytest');
  api.use('mikowals:react-waypoint');
  api.addFiles('react-waypoint-tests.js');
});
