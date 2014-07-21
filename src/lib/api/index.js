var fs = require('fs');
var express = require('express');
var app = module.exports = express();
var extend = require('extend');
var crypto = require('crypto');
var Q = require('q');

var path = require('path');
var db = require('../db');
var serializer = require('./serializer');
var hasher = require('../hasher');

/**
 * An API error.
 * @param {String} msg  The error message.
 * @param {Number} code The HTTP error code.
 * @see https://en.wikipedia.org/wiki/List_of_HTTP_status_codes
 */
function ApiError(msg, code) {
	this.name = 'ApiError';
	this.message = msg;
	this.code = code || 400;
}

/**
 * Generate a session token.
 * @return {String} The session token.
 */
function generateSessionToken() {
	var sha = crypto.createHash('sha1');
	sha.update(Math.random().toString());
	return sha.digest('hex');
}

var api = {};

api.queryObjects = function (className, opts) {
	return db.queryObjects(className, opts).then(function (data) {
		// Serialize objects
		for (var i = 0; i < data.results.length; i++) {
			data.results[i] = serializer.serialize(data.results[i]);
		}

		return data;
	});
};

api.retrieveObject = function (className, objectId) {
	return db.retrieveObject(className, objectId).then(function (object) {
		return serializer.serialize(object);
	});
};

api.insertObject = function (className, objectData) {
	return db.insertObject(className, objectData).then(function (object) {
		return {
			createdAt: object.createdAt,
			objectId: object._id
		};
	});
};

api.updateObject = function (className, objectId, objectData) {
	return db.updateObject(className, objectId, objectData).then(function (object) {
		return {
			updatedAt: object.updatedAt
		};
	});
};

api.deleteObject = function (className, objectId) {
	return db.deleteObject(className, objectId).then(function () {
		return; // Return nothing
	});
};

api.catch = function (res, promise) {
	return promise.catch(function (err) {
		var code = 400,
			msg = err;

		if (err && err instanceof ApiError) {
			code = err.code;
			msg = err.message;
		}

		res.send(code, { error: msg });
	});
};
api.when = function (res, promise) {
	return promise.then(function (result) {
		res.send(result);
	}, function (err) {
		res.send(400, err);
	});
};
api.call = function (method, args, res) {
	var promise = api[method].apply(this, args);
	return api.when(res, promise);
};

// Connect to the database
var dbOpening = db.connect().then(function () {
	console.log('Database opened.');
}, function (err) {
	console.warn('Cannot connect to database', err);
});
// Wait for the database before answering requests
app.use(function(req, res, next) {
	if (dbOpening.isPending()) { // Database not ready
		dbOpening.then(function () {
			next();
		}, function () { // Database connect error
			res.send(500, 'Cannot connect to database');
		});
	} else {
		next();
	}
});

// User authentication
app.use(function (req, res, next) {
	var userAuth = {
		sessionToken: req.get('X-Parse-Session-Token') || ''
	};

	if (req.body && typeof req.body === 'object') {
		if (req.body._SessionToken) {
			userAuth.sessionToken = req.body._SessionToken;
		}
	}

	if (userAuth.sessionToken) {
		db.model('_User').findOne({
			sessionToken: userAuth.sessionToken
		}, function (err, user) {
			if (!err && user) {
				req.user = user;
			}
			// TODO: print an error message if invalid session token
			
			next();
		});
	} else {
		next();
	}
});

// Objects
// @see https://www.parse.com/docs/rest#objects
app.get('/1/classes/:className', function(req, res) { // Query objects
	var className = req.param('className'),
		opts = extend({}, req.query, req.body);

	// TODO: parse JSON in req.query.where

	api.call('queryObjects', [className, opts], res);
});
app.get('/1/classes/:className/:objectId', function(req, res) { // Get object
	var className = req.param('className'),
		objectId = req.param('objectId');

	api.call('retrieveObject', [className, objectId], res);
});
app.post('/1/classes/:className', function(req, res, next) { // Create object
	var className = req.param('className'),
		objectData = req.body;

	console.log('Inserting a new '+className);
	var promise = api.insertObject(className, objectData).then(function (result) {
		res
		//.location('/1/classes/'+className+'/'+result.objectId)
		.send(result);
	});
	api.catch(res, promise);
});
app.put('/1/classes/:className/:objectId', function(req, res) { // Update object
	var className = req.param('className'),
		objectId = req.param('objectId'),
		objectData = req.body;

	// TODO: ACL

	api.call('updateObject', [className, objectId, objectData], res);
});
app.delete('/1/classes/:className/:objectId', function(req, res) { // Delete object
	var className = req.param('className'),
		objectId = req.param('objectId');

	// TODO: ACL

	api.call('deleteObject', [className, objectId], res);
});

// Users
// @see https://www.parse.com/docs/rest#users
app.get('/1/login', function(req, res) { // Logging in
	var username = req.param('username'),
		password = req.param('password');

	function invalidCredentials() {
		// TODO: add a little delay to prevent bruteforce attacks
		return new ApiError('invalid login parameters', 404);
	}

	// TODO: check if the user is not already logged in?

	db.model('_User').findOne({
		username: username
	}, function (err, user) {
		if (err) {
			api.catch(res, Q.reject(invalidCredentials()));
			return;
		}

		// Check password
		var promise = hasher.compare(password, user.password).then(function (isCorrect) {
			if (!isCorrect) {
				throw invalidCredentials();
			}

			// TODO: check if password needs rehash

			// TODO: when do we refresh the session token?

			var result = serializer.serialize(user);
			if (user.sessionToken) { // Session token already generated
				result.sessionToken = user.sessionToken;
				return result;
			} else { // No session token available
				result.sessionToken = generateSessionToken();

				return api.updateObject('_User', result.objectId, {
					sessionToken: result.sessionToken
				}).then(function () {
					return result;
				});
			}
		}, function (err) {
			console.warn('Cannot verify password hash: ', err);
			throw invalidCredentials();
		}).then(function (result) {
			res.send(result);
		});
		api.catch(res, promise);
	});
});
app.get('/1/users/me', function(req, res) { // Validating Session Tokens, Retrieving Current User
	if (!req.user) {
		res.send(403, { error: 'invalid session' });
		return;
	}

	res.send(serializer.serialize(req.user));
});
app.get('/1/users/:objectId', function(req, res) { // Retrieving users
	var objectId = req.param('objectId');

	var promise = db.retrieveObject('_User', objectId).then(function (object) {
		return serializer.serialize(object);
	});
	api.when(res, promise);
});
app.get('/1/users', function(req, res) { // Querying Users
	// Try to parse JSON in the "where" parameter
	if (typeof req.query == 'object' && typeof req.query.where == 'string') {
		try {
			req.query.where = JSON.parse(req.query.where);
		} catch (e) {}
	}

	var opts = extend({}, req.query, req.body);

	api.call('queryObjects', ['_User', opts], res);
});
app.post('/1/users', function(req, res) { // Signing up, linking users
	var userData = req.body,
		result;

	// TODO: check if the user is not already logged in?

	console.log('Inserting a new user');

	// First, hash password if present
	var promise;
	if (userData.password) {
		promise = hasher.hash(userData.password).then(function (hash) {
			userData.password = hash;
			return userData;
		})
	} else {
		promise = Q(userData);
	}

	promise.then(function (userData) {
		// Then, insert the user
		return api.insertObject('_User', userData);
	}).then(function (creationResult) {
		// User created, we can generate the session token
		result = extend({}, creationResult, {
			sessionToken: generateSessionToken()
		});

		// Set the user's session token
		return api.updateObject('_User', result.objectId, {
			sessionToken: result.sessionToken
		});
	}).then(function () {
		res
		//.location('/1/users/'+result.objectId)
		.send(201, result);
	});
	api.catch(res, promise);
});
app.put('/1/users/:objectId', function(req, res) { // Updating Users, Linking Users, Verifying Emails
	var objectId = req.param('objectId'),
		userData = req.body;

	// TODO: ACL
	if (!req.user || req.user.id !== objectId) {
		api.catch(res, Q.reject(new ApiError('unauthorized', 401)));
		return;
	}

	function updateUser(userData) {
		return api.call('updateObject', ['_User', objectId, userData], res);
	}

	if (userData.password) { // Password changed? Hash it!
		var promise = hasher.hash(userData.password).then(function (hash) {
			userData.password = hash;

			// Then, update the user
			updateUser(userData);
		});
		api.catch(res, promise);
	} else {
		updateUser(userData);
	}
});
app.post('/1/requestPasswordReset', function(req, res) { // Requesting a password reset
	var email = req.param('email');

	res.send(501, { error: 'not implemented' });
});
app.delete('/1/users/:objectId', function(req, res) { // Deleting users
	var objectId = req.param('objectId');

	// TODO: ACL
	if (!req.user || req.user.id !== objectId) {
		api.catch(res, Q.reject(new ApiError('unauthorized', 401)));
		return;
	}

	api.call('deleteObject', ['_User', objectId], res);
});

// Roles
// @see https://www.parse.com/docs/rest#roles
app.get('/1/roles', function(req, res) { // Querying roles
	res.send(501, { error: 'not implemented' });
});
app.post('/1/roles', function(req, res) { // Creating roles
	res.send(501, { error: 'not implemented' });
});
app.get('/1/roles/:objectId', function(req, res) { // Retrieving roles
	var objectId = req.param('objectId');

	res.send(501, { error: 'not implemented' });
});
app.put('/1/roles/:objectId', function(req, res) { // Updating roles
	var objectId = req.param('objectId');

	res.send(501, { error: 'not implemented' });
});
app.delete('/1/roles/:objectId', function(req, res) { // Deleting roles
	var objectId = req.param('objectId');

	res.send(501, { error: 'not implemented' });
});

// Files
// @see https://www.parse.com/docs/rest#files
app.post('/1/files/:fileName', function(req, res) {
	// Uploading Files
	res.send(501, { error: 'not implemented' });
});

// Cloud functions
app.post('/1/functions/:functionName', function(req, res) { // Call a cloud function
	res.send(501, { error: 'not implemented' });
});
app.post('/1/jobs/:jobName', function(req, res) { // Start a background job
	res.send(501, { error: 'not implemented' });
});