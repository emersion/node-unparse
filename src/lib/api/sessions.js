var express = require('express');

// Sessions

module.exports = function (api) {
	var app = express();

	app.get('/', function (req, res) { // Querying sessions
		api.notImplemented(res);
	});
	app.post('/', function (req, res) { // Creating restricted sessions
		api.notImplemented(res);
	});
	app.get('/me', function (req, res) { // Retrieving current sessions
		api.notImplemented(res);
	});
	app.put('/me', function (req, res) { // Pairing with installation
		api.notImplemented(res);
	});
	app.get('/:objectId', function (req, res) { // Retrieving sessions
		api.notImplemented(res);
	});
	app.put('/:objectId', function (req, res) { // Updating sessions
		api.notImplemented(res);
	});
	app.delete('/:objectId', function (req, res) { // Deleting sessions
		api.notImplemented(res);
	});

	return app;
};
