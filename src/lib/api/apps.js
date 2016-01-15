var express = require('express');

module.exports = function (api) {
	var app = express();

	// Apps
	app.get('/', function (req, res) { // Fetch apps
		api.notImplemented(res);
	});
	app.get('/:applicationId', function (req, res) { // Fetch app
		api.notImplemented(res);
	});
	app.post('/:applicationId', function (req, res) { // Create app
		api.notImplemented(res);
	});
	app.put('/:applicationId', function (req, res) { // Modify app
		api.notImplemented(res);
	});

	return app;
};
