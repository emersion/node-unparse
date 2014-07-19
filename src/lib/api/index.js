var express = require('express');
var app = module.exports = express();
var fs = require('fs');
var path = require('path');
var db = require('../db');

app.use(function(req, res, next) {
	res.setHeader('Content-Type', 'application/json');
	next();
});

// Objects
app.get('/1/classes/:className', function(req, res) { // Query objects
	var className = req.param('className'),
		opts = {};

	for (var queryName in req.query) {
		var queryVal = req.query[queryName];

		// Try to parse JSON
		if (~['where'].indexOf(queryName)) {
			try {
				queryVal = JSON.parse(queryVal);
			} catch(e) {}
		}

		opts[queryName] = queryVal;
	}

	db.queryObjects(className, opts).then(function (data) {
		for (var i = 0; i < data.results.length; i++) {
			data.results[i] = data.results[i].toObject();
		}

		res.send(data);
	}, function (err) {
		res.send(400, err);
	});
});
app.get('/1/classes/:className/:objectId', function(req, res) { // Get object
	var className = req.param('className'),
		objectId = req.param('objectId');

	db.retrieveObject(className, objectId).then(function (object) {
		res.send(object.toObject());
	}, function (err) {
		res.send(400, err);
	});
});
app.post('/1/classes/:className', function(req, res, next) { // Create object
	var className = req.param('className'),
		objectData = req.body;

	console.log('Inserting a new '+className);
	db.insertObject(className, objectData).then(function (object) {
		res
		//.location('/1/classes/'+className+'/'+objectId)
		.send(201, {
			createdAt: object.createdAt,
			objectId: object._id
		});
	}, function (err) {
		res.send(400, err);
	});
});
app.put('/1/classes/:className/:objectId', function(req, res) { // Update object
	var className = req.param('className'),
		objectId = req.param('objectId'),
		objectData = req.body;

	db.updateObject(className, objectId, objectData).then(function (object) {
		res.send({
			updatedAt: object.updatedAt
		});
	}, function (err) {
		res.send(400, err);
	});
});
app.delete('/1/classes/:className/:objectId', function(req, res) { // Delete object
	var className = req.param('className'),
		objectId = req.param('objectId');

	db.deleteObject(className, objectId).then(function (object) {
		res.send();
	}, function (err) {
		res.send(400, err);
	});
});

// Users
app.get('/1/login', function(req, res) {
	// Logging in
});
app.get('/1/users', function(req, res) {
	// Querying Users
});
app.post('/1/users', function(req, res) {
	// Signing up, linking users
});
app.get('/1/users/me', function(req, res) {
	// Validating Session Tokens, Retrieving Current User
});
app.get('/1/users/:objectId', function(req, res) {
	// Retrieving users
});
app.put('/1/users/:objectId', function(req, res) {
	// Updating Users, Linking Users, Verifying Emails
});
app.post('/1/requestPasswordReset', function(req, res) {
	// Requesting A Password Reset
});
app.delete('/1/users/:objectId', function(req, res) {
	// Deleting Users
});

// Roles

// Files
/*app.post('/1/files/:fileName', function(req, res) {
	// Uploading Files
});*/