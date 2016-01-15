var express = require('express');

// Roles
// @see https://www.parse.com/docs/rest#roles

module.exports = function (api) {
	var app = express();

	app.get('/', function(req, res) { // Querying roles
		api.notImplemented(res);
	});
	app.post('/', function(req, res) { // Creating roles
		api.notImplemented(res);
	});
	app.get('/:objectId', function(req, res) { // Retrieving roles
		var objectId = req.param('objectId');

		api.notImplemented(res);
	});
	app.put('/:objectId', function(req, res) { // Updating roles
		var objectId = req.param('objectId');

		api.notImplemented(res);
	});
	app.delete('/:objectId', function(req, res) { // Deleting roles
		var objectId = req.param('objectId');

		api.notImplemented(res);
	});

	return app;
};
