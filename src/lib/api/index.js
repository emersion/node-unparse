var fs = require('fs');
var express = require('express');
var Q = require('q');

var db = require('../db');

var api = {};

/**
 * An API error.
 * @param {String} msg  The error message.
 * @param {Number} code The HTTP error code.
 * @param {Number} parseCode The Parse error code.
 * @see https://en.wikipedia.org/wiki/List_of_HTTP_status_codes
 */
api.Error = function ApiError(msg, code, parseCode) {
	this.name = 'ApiError';
	this.message = msg;
	this.code = code || 400;
	this.parseCode = parseCode || this.code;
};

api.Error.unauthorized = function () {
	return new api.Error('unauthorized', 401);
};
api.Error.notFound = function () {
	return new api.Error('object not found', 404);
};
api.Error.notImplemented = function () {
	return new api.Error('not implemented', 501);
};

// Working with promises and responses
api.rejected = function (err, res) {
	var code = 400,
		parseCode = null,
		msg = err;

	if (err) {
		if (err instanceof api.Error) {
			code = err.code;
			parseCode = err.parseCode;
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
	res.status(code).send({ code: parseCode || code, error: String(msg) });
};
api.notImplemented = function (res) {
	return api.rejected(api.Error.notImplemented(), res);
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
	if (object && object.ACL) {
		return object.ACL;
	} else {
		if (object && object.getClassName && object.getClassName() == '__Class') {
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
		userGroups.push(String(user.id));
		if (user.roles) {
			user.roles.forEach(function (role) {
				userGroups.push('role:'+role.name);
			});
		}
	}
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
	return Q(previous || object).then(function (result) {
		if (!api.acl.verify(object, user, operation)) {
			throw api.Error.unauthorized();
		}

		return result;
	});
};
api.acl.tryForClass = function (className, user, operation, previous) { // get, find, update. create, delete
	if (className == '__Class') {
		return Q(previous).then(function (result) {
			var object = {
				ACL: api.acl.classDefaults() // TODO: __Class is not like other classes
			};

			if (!api.acl.verify(object, user, operation)) {
				throw api.Error.unauthorized();
			}

			return result;
		});
	}

	return db.queryOne('__Class', { where: { name: className } }).then(function (classObj) {
		return api.acl.try(classObj, user, operation, previous);
	}).then(function (res) {
		return res;
	});
};

// API functions, with ACL checks
api.queryObjects = function (params, user) {
	// Check class ACL
	return api.acl.tryForClass(params.className, user, 'find').then(function () {
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
			throw api.Error.notFound();
		}

		// Serialize the result
		return object.toJSON();
	});
};
api.insertObject = function (params, user) {
	// Check class ACL
	return api.acl.tryForClass(params.className, user, 'create').then(function () {
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
		return {}; // Return nothing
	});
};

function v1(api) {
	var app = express();

	app.use('/classes', require('./classes')(api));
	app.use(require('./users')(api));
	app.use('/sessions', require('./sessions')(api));
	app.use('/roles', require('./roles')(api));
	app.use('/files', require('./files')(api));
	app.use('/schemas', require('./schemas')(api));
	app.use('/apps', require('./apps')(api));

	// Cloud functions
	app.post('/functions/:functionName', function(req, res) { // Call a cloud function
		api.notImplemented(res);
	});
	app.post('/jobs/:jobName', function(req, res) { // Start a background job
		api.notImplemented(res);
	});

	return app;
}

module.exports = function (config) {
	var app = express();

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
			}).populate('roles').exec(function (err, user) {
				if (err) {
					api.rejected(new api.Error('cannot find session token: '+err, 500), res);
					return;
				}
				if (user) {
					req.user = user;
				} else {
					api.rejected(new api.Error('invalid session token', 401, 209), res);
					return;
				}

				next();
			});
		} else {
			next();
		}
	});

	app.use('/1', v1(api));

	// Connect to the database
	return db.connect(config).then(function () {
		console.log('Database connected.');
		return app;
	});
};
