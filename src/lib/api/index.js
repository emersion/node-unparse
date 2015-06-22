var fs = require('fs');
var express = require('express');
var app = module.exports = express();
var extend = require('extend');
var crypto = require('crypto');
var Q = require('q');

var path = require('path');
var db = require('../db');
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
ApiError.unauthorized = function () {
	return new ApiError('unauthorized', 401);
};
ApiError.notFound = function () {
	return new ApiError('object not found', 404);
};
ApiError.notImplemented = function () {
	return new ApiError('not implemented', 501);
};

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

// Working with promises and responses
api.rejected = function (err, res) {
	var code = 400,
		msg = err;

	if (err) {
		if (err instanceof ApiError) {
			code = err.code;
			msg = err.message;
		} else if (err instanceof Error) {
			msg = (err.name || err.code) + ': ' +(err.message || err.reason);

			console.warn(err);
			if (err.stack) console.warn(err.stack);
		}
	} else {
		msg = 'unknown error';

		console.warn('Unknown error');
		console.trace();
	}
//console.warn(err);
	res.status(code).send({ code: code, error: String(msg) });
};
api.notImplemented = function (res) {
	return api.rejected(ApiError.notImplemented(), res);
};
api.catch = function (promise, res) {
	return promise.catch(function (err) {
		return api.rejected(err, res);
	});
};
api.when = function (promise, res) {
	return promise.then(function (result) {
		res.send(result);
	}, function (err) {
		return api.rejected(err, res);
	});
};
api.call = function (method, args, res) {
	var promise = api[method].apply(this, args);
	return api.when(promise, res);
};

// ACLs
api.acl = {};
api.acl.defaults = function (object) {
	// TODO: defaults based on classes ACLs?
	return {
		'*': { read: true }
	};
};
api.acl.classDefaults = function (classObj) {
	return {
		'*': {
			// ACLs for the class row (in __Class)
			read: true,
			write: true,

			// ACLs for items in the class
			get: true,
			find: true,
			update: true,
			create: true,
			'delete': true
		}
	};
};
api.acl.get = function (object) {
	if (object.ACL) {
		return object.ACL;
	} else {
		if (object.constructor.modelName == '__Class') {
			return this.classDefaults(object);
		} else {
			return this.defaults(object);
		}
	}

	return object.ACL || this.defaults(object);
};
api.acl.verify = function (object, user, operation) {
	var acl = this.get(object),
		userGroups = [];

	if (user) {
		userGroups.push(user._id);
	}
	// TODO: roles support: "role:Members":{"write":true}
	userGroups.push('*');

	// The order of groups is important (more specific -> more general)
	for (var i = 0; i < userGroups.length; i++) {
		var group = userGroups[i];

		if (acl[group] && typeof acl[group][operation] == 'boolean') {
			return acl[group][operation];
		}
	}

	return false;
};
api.acl.try = function (object, user, operation, previous) { // read, write
	var promise = Q(previous || object);

	promise.then(function (result) {
		if (!api.acl.verify(object, user, operation)) {
			throw ApiError.unauthorized();
		}

		return result;
	});

	return promise;
};
api.acl.tryForClass = function (className, user, operation, previous) { // get, find, update. insert, delete
	return db.queryOne('__Class', { where: { name: className } }).then(function (classObj) {
		return api.acl.try(classObj, user, operation, previous);
	});
};

// API functions, with ACL checks
api.queryObjects = function (params, user) {
	// Check class ACL
	return api.acl.tryForClass(params.className, user, 'query').then(function () {
		// Execute the query
		return db.queryObjects(params.className, params.options);
	}).then(function (data) {
		// Serialize objects
		var results = [];
		for (var i = 0; i < data.results.length; i++) {
			var obj = data.results[i];

			// Check each object's ACL
			if (!api.acl.verify(obj, user, 'read')) {
				continue;
			}

			results.push(obj.toJSON());
		}
		data.results = results;

		return data;
	});
};
api.retrieveObject = function (params, user) {
	// Check class ACL
	return api.acl.tryForClass(params.className, user, 'get').then(function () {
		// Retrieve the object
		return db.retrieveObject(params.className, params.objectId);
	}).then(function (object) {
		// Check the object's ACL
		return api.acl.try(object, user, 'read');
	}).then(function (object) {
		if (!object) {
			throw ApiError.notFound();
		}

		// Serialize the result
		return object.toJSON();
	});
};
api.insertObject = function (params, user) {
	// Check class ACL
	return api.acl.tryForClass(params.className, user, 'insert').then(function () {
		// Insert the new object
		return db.insertObject(params.className, params.objectData);
	}).then(function (object) {
		return {
			createdAt: object.createdAt,
			objectId: object.id
		};
	});
};
api.updateObject = function (params, user) {
	// Check class ACL
	return api.acl.tryForClass(params.className, user, 'update').then(function () {
		// Retrieve the object
		return db.retrieveObject(params.className, params.objectId);
	}).then(function (object) {
		// Check the object's ACL
		return api.acl.try(object, user, 'write');
	}).then(function (object) {
		// Update the object
		// TODO: use object.save() instead?
		return db.updateObject(params.className, params.objectId, params.objectData);
	}).then(function (object) {
		return {
			updatedAt: object.updatedAt
		};
	});
};
api.deleteObject = function (params, user) {
	// Check class ACL
	return api.acl.tryForClass(params.className, user, 'delete').then(function () {
		// Retrieve the object
		return db.retrieveObject(params.className, params.objectId);
	}).then(function (obj) {
		// Check the object's ACL
		return api.acl.try(obj, user, 'write');
	}).then(function (obj) {
		// Delete the object
		return db.deleteObject(params.className, params.objectId);
	}).then(function () {
		return; // Return nothing
	});
};

// Connect to the database
db.connect().then(function () {
	console.log('Database connected.');
}, function (err) {
	console.error('Cannot connect to database: ', err);
	if (err.stack) {
		console.error(err.stack);
	}
	process.exit(1);
});
// Wait for the database before answering requests
app.use(function (req, res, next) {
	if (db.connecting.isPending()) { // Database not ready
		db.connecting.then(function () {
			next();
		}, function () { // Database connect error
			res.status(500).send('Cannot connect to database');
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
			delete req.body._SessionToken;
		}
	}

	// Delete other request fields
	if (req.body._ClientVersion) {
		req.clientVersion = req.body._ClientVersion;
		delete req.body._ClientVersion;
	}
	if (req.body._InstallationId) {
		req.installationId = req.body._InstallationId;
		delete req.body._InstallationId;
	}

	if (userAuth.sessionToken) {
		db.model('_User').findOne({
			sessionToken: userAuth.sessionToken
		}, function (err, user) {
			if (err) {
				api.rejected(new ApiError('cannot find session token: '+err, 500), res);
				return;
			}
			if (user) {
				req.user = user;
			} else {
				api.rejected(new ApiError('invalid session token', 401), res);
				return;
			}
			
			next();
		});
	} else {
		next();
	}
});

// Objects
// @see https://www.parse.com/docs/rest#objects
app.get('/1/classes/:className', function (req, res) { // Query objects
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
app.get('/1/classes/:className/:objectId', function(req, res) { // Get object
	var params = {
		className: req.param('className'),
		objectId: req.param('objectId')
	};

	api.call('retrieveObject', [params, req.user], res);
});
app.post('/1/classes/:className', function(req, res, next) { // Create object
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
app.put('/1/classes/:className/:objectId', function(req, res) { // Update object
	var params = {
		className: req.param('className'),
		objectId: req.param('objectId'),
		objectData: req.body
	};

	api.call('updateObject', [params, req.user], res);
});
app.delete('/1/classes/:className/:objectId', function(req, res) { // Delete object
	var params = {
		className: req.param('className'),
		objectId: req.param('objectId')
	};

	api.call('deleteObject', [params, req.user], res);
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

	db.model('_User').findOne({
		username: username
	}, function (err, user) {
		if (err || !user) {
			return api.rejected(invalidCredentials(), res);
		}

		// Check password
		var promise = hasher.compare(password, user.password).then(function (isCorrect) {
			if (!isCorrect) {
				throw invalidCredentials();
			}

			// TODO: check if password needs rehash

			// TODO: when do we refresh the session token?

			// TODO: set session cookie (only if using Javascript SDK?)

			var result = user.toJSON();
			if (user.sessionToken) { // Session token already generated
				result.sessionToken = user.sessionToken;
				return result;
			} else { // No session token available
				result.sessionToken = generateSessionToken();

				return api.updateObject({
					className: '_User',
					objectId: result.objectId,
					objectData: {
						sessionToken: result.sessionToken
					}
				}, req.user).then(function () {
					return result;
				});
			}
		}, function (err) {
			console.warn('Cannot verify password hash: ', err);
			throw invalidCredentials();
		});
		api.when(promise, res);
	});
});
app.get('/1/users/me', function(req, res) { // Validating Session Tokens, Retrieving Current User
	if (!req.user) {
		return api.rejected(new ApiError('invalid session', 403), res);
	}

	res.send(req.user.toJSON());
});
app.get('/1/users/:objectId', function(req, res) { // Retrieving users
	var objectId = req.param('objectId');

	var promise = db.retrieveObject('_User', objectId).then(function (object) {
		return object.toJSON();
	});
	api.when(promise, res);
});
app.get('/1/users', function(req, res) { // Querying Users
	// Try to parse JSON in the "where" parameter
	if (typeof req.query == 'object' && typeof req.query.where == 'string') {
		try {
			req.query.where = JSON.parse(req.query.where);
		} catch (e) {}
	}

	var params = {
		className: '_User',
		options: extend({}, req.query, req.body)
	};

	api.call('queryObjects', [params, req.user], res);
});
app.post('/1/users', function(req, res) { // Signing up, linking users
	var userData = req.body,
		result;

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
		return api.insertObject({
			className: '_User',
			objectData: userData
		}, req.user);
	}).then(function (creationResult) {
		// User created, we can generate the session token
		result = extend({}, creationResult, {
			sessionToken: generateSessionToken()
		});

		// Set the user's session token
		return api.updateObject({
			className: '_User',
			objectId: result.objectId,
			objectData: {
				sessionToken: result.sessionToken
			}
		}, req.user);
	}).then(function () {
		res
		.status(201)
		.location('/1/users/'+result.objectId)
		.send(result);
	}, function (err) {
		return api.rejected(err, res);
	});
});
app.put('/1/users/:objectId', function(req, res) { // Updating Users, Linking Users, Verifying Emails
	var objectId = req.param('objectId'),
		userData = req.body;

	// TODO: ACL
	if (!req.user || req.user.id !== objectId) {
		api.catch(res, Q.reject(ApiError.unauthorized()));
		return;
	}

	function updateUser(userData) {
		return api.call('updateObject', [{
			className: '_User',
			objectId: objectId,
			objectData: userData
		}, req.user], res);
	}

	if (userData.password) { // Password changed? Hash it!
		hasher.hash(userData.password).then(function (hash) {
			userData.password = hash;

			// Then, update the user
			updateUser(userData);
		}, function (err) {
			return api.rejected(err, res);
		});
	} else {
		updateUser(userData);
	}
});
app.post('/1/requestPasswordReset', function(req, res) { // Requesting a password reset
	var email = req.param('email');

	api.notImplemented(res);
});
app.delete('/1/users/:objectId', function(req, res) { // Deleting users
	var objectId = req.param('objectId');

	// TODO: ACL
	if (!req.user || req.user.id !== objectId) {
		return api.rejected(ApiError.unauthorized(), res);
	}

	api.call('deleteObject', [{
		className: '_User',
		objectId: objectId
	}, req.user], res);
});

// Roles
// @see https://www.parse.com/docs/rest#roles
app.get('/1/roles', function(req, res) { // Querying roles
	api.notImplemented(res);
});
app.post('/1/roles', function(req, res) { // Creating roles
	api.notImplemented(res);
});
app.get('/1/roles/:objectId', function(req, res) { // Retrieving roles
	var objectId = req.param('objectId');

	api.notImplemented(res);
});
app.put('/1/roles/:objectId', function(req, res) { // Updating roles
	var objectId = req.param('objectId');

	api.notImplemented(res);
});
app.delete('/1/roles/:objectId', function(req, res) { // Deleting roles
	var objectId = req.param('objectId');

	api.notImplemented(res);
});

// Files
// @see https://www.parse.com/docs/rest#files
app.post('/1/files/:fileName', function(req, res) { // Uploading Files
	api.notImplemented(res);
});

// Cloud functions
app.post('/1/functions/:functionName', function(req, res) { // Call a cloud function
	api.notImplemented(res);
});
app.post('/1/jobs/:jobName', function(req, res) { // Start a background job
	api.notImplemented(res);
});