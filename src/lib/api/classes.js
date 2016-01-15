var express = require('express');

// Objects
// @see https://www.parse.com/docs/rest#objects

module.exports = function (api) {
	var app = express();

	app.get('/:className', function (req, res) { // Query objects
		// Try to parse JSON in the "where" parameter
		if (typeof req.query == 'object' && typeof req.query.where == 'string') {
			try {
				req.query.where = JSON.parse(req.query.where);
			} catch (e) {}
		}

		var params = {
			className: req.param('className'),
			options: extend({}, req.query, req.body)
		};

		api.call('queryObjects', [params, req.user], res);
	});

	app.post('/:className', function(req, res, next) { // Create object
		var params = {
			className: req.param('className'),
			objectData: req.body
		};

		console.log('Inserting a new '+params.className);
		api.insertObject(params, req.user).then(function (result) {
			res
			//.location('/1/classes/'+className+'/'+result.objectId)
			.send(result);
		}, function (err) {
			return api.rejected(err, res);
		});
	});

	app.get('/:className/:objectId', function(req, res) { // Get object
		var params = {
			className: req.param('className'),
			objectId: req.param('objectId')
		};

		api.call('retrieveObject', [params, req.user], res);
	});

	app.put('/:className/:objectId', function(req, res) { // Update object
		var params = {
			className: req.param('className'),
			objectId: req.param('objectId'),
			objectData: req.body
		};

		api.call('updateObject', [params, req.user], res);
	});

	app.delete('/:className/:objectId', function(req, res) { // Delete object
		var params = {
			className: req.param('className'),
			objectId: req.param('objectId')
		};

		api.call('deleteObject', [params, req.user], res);
	});

	return app;
};
