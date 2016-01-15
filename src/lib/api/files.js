var express = require('express');

// Files
// @see https://www.parse.com/docs/rest#files

module.exports = function (api) {
	var app = express();

	app.post('/:fileName', function(req, res) { // Uploading Files
		api.notImplemented(res);
	});

	return app;
};
