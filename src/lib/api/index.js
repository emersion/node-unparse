var express = require('express');
var app = module.exports = express();
var fs = require('fs');
var path = require('path');
var db = require('../db');

app.use(function(req, res) {
	res.setHeader('Content-Type', 'application/json');
});

// Objects
app.get('/1/classes/:className', function(req, res) {
	// Query objects
});
app.post('/1/classes/:className', function(req, res) { // Create object
	var className = req.param('className'),
		objectData = req.body;

	db.insertObject(className, objectData).then(function (object) {
		res
		.set('Location', '/1/classes/'+className+'/'+objectId)
		.json(201, {
			createdAt: object.createdAt,
			objectId: object.objectId
		});
	}, function (err) {
		res.json(400, err);
	});
});
app.get('/1/classes/:className/:objectId', function(req, res) {
	// Get object
});
app.put('/1/classes/:className/:objectId', function(req, res) {
	// Update object
});
app.delete('/1/classes/:className/:objectId', function(req, res) {
	// Delete object
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