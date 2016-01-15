var express = require('express');
var crypto = require('crypto');
var extend = require('extend');
var db = require('../db');
var hasher = require('../hasher');

// Users
// @see https://www.parse.com/docs/rest#users

/**
 * Generate a session token.
 * @return {String} The session token.
 */
function generateSessionToken() {
	var sha = crypto.createHash('sha1');
	sha.update(Math.random().toString());
	return sha.digest('hex');
}

function users(api) {
	var app = express();

	app.post('/', function(req, res) { // Signing up, linking users
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

	app.get('/me', function(req, res) { // Validating Session Tokens, Retrieving Current User
		if (!req.user) {
			return api.rejected(new api.Error('invalid session token', 403, 209), res);
		}

		res.send(req.user.toJSON());
	});

	app.get('/:objectId', function(req, res) { // Retrieving users
		var objectId = req.param('objectId');

		var promise = db.retrieveObject('_User', objectId).then(function (object) {
			return object.toJSON();
		});
		api.when(promise, res);
	});

	app.get('/', function(req, res) { // Querying Users
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

	app.put('/:objectId', function(req, res) { // Updating Users, Linking Users, Verifying Emails
		var objectId = req.param('objectId'),
			userData = req.body;

		// TODO: ACL
		if (!req.user || req.user.id !== objectId) {
			api.catch(res, Q.reject(api.Error.unauthorized()));
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
	app.delete('/:objectId', function(req, res) { // Deleting users
		var objectId = req.param('objectId');

		// TODO: ACL
		if (!req.user || req.user.id !== objectId) {
			return api.rejected(api.Error.unauthorized(), res);
		}

		api.call('deleteObject', [{
			className: '_User',
			objectId: objectId
		}, req.user], res);
	});

	return app;
}

module.exports = function (api) {
	var app = express();

	app.use('/users', users(api));

	app.get('/login', function(req, res) { // Logging in
		var username = req.param('username'),
			password = req.param('password');

		function invalidCredentials() {
			// Add a little delay to prevent bruteforce attacks
			var error = new api.Error('invalid login parameters', 404);
			return Q.delay(500).thenReject(error);
		}

		db.model('_User').findOne({
			username: username
		}).populate('roles').exec(function (err, user) {
			if (err || !user) {
				return api.rejected(invalidCredentials(), res);
			}

			// Check password
			var promise = hasher.compare(password, user.password).then(function (isCorrect) {
				if (!isCorrect) {
					return invalidCredentials();
				}

				// TODO: check if password needs rehash

				// TODO: when do we refresh the session token?

				// TODO: set session cookie (only if using Javascript SDK?)

				var result = user.toJSON();
				if (user.sessionToken) { // Session token already generated
					result.sessionToken = user.sessionToken;
					return result;
				} else { // No session token available
					user.sessionToken = generateSessionToken();
					result.sessionToken = user.sessionToken;
					return Q(user.save()).thenResolve(result);
				}
			}, function (err) {
				console.warn('Cannot verify password hash: ', err);
				return invalidCredentials();
			});
			api.when(promise, res);
		});
	});

	app.post('/requestPasswordReset', function(req, res) { // Requesting a password reset
		var email = req.param('email');

		api.notImplemented(res);
	});

	return app;
};
