var express = require('express');

// Schemas

module.exports = function (api) {
	var app = express();

	app.get('/:className', function (req, res) { // Fetch schema
		api.notImplemented(res);
	});
	app.post('/:className', function (req, res) { // Create schema
		api.notImplemented(res);
	});
	app.put('/:className', function (req, res) { // Modify schema
		api.notImplemented(res);
	});
	app.delete('/:className', function (req, res) { // Delete schema
		api.notImplemented(res);
	});

	return app;
};
