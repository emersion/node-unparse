var express = require('express');
var path = require('path');
var bodyParser = require('body-parser');
var methodOverride = require('method-override');
var errorhandler = require('errorhandler');
//var cookieParser = require('cookie-parser');
var session = require('cookie-session');

var apiBuilder = require('./lib/api');

module.exports = function (configCtrl) {
	var app = express();

	//app.use(express.logger('dev'));
	app.use(bodyParser.json());
	app.use(bodyParser.json({
		type: 'text/plain' // Parse JS SDK is not setting request Content-Type to "application/json"
	}));
	//app.use(cookieParser());
	//app.use(session(config.session));
	//app.use(express.compress());
	app.use(methodOverride(function (req, res) {
		if (req.body && typeof req.body === 'object' && '_method' in req.body) {
			var method = req.body._method;
			delete req.body._method;
			return method;
		}
	}));
	app.use(function (req, res, next) {
		res.setHeader('Access-Control-Allow-Origin', '*');
		next();
	});
	app.use(function (req, res, next) { // App authentication
		// Authentication with headers
		var appAuth = {
			appId: req.get('X-Parse-Application-Id') || '',
			javascriptKey: req.get('X-Parse-Javascript-API-Key') || '',
			restKey: req.get('X-Parse-REST-API-Key') || ''
		};

		// Authentication with basic HTTP authentication
		// @see https://gist.github.com/charlesdaniel/1686663
		if (req.headers['authorization']) {
			// auth is in base64(username:password)  so we need to decode the base64
			// Split on a space, the original auth looks like  "Basic Y2hhcmxlczoxMjM0NQ==" and we need the 2nd part
			var base64 = auth.split(' ')[1];
			var buf = new Buffer(base64, 'base64');
			var credentials = buf.toString().split(':');

			var username = credentials[0],
				password = credentials[1];

			appAuth.appId = username;

			var passwdFields = password.split('&');
			for (var i = 0; i < passwdFields.length; i++) {
				var field = passwdFields[i],
					fieldParts = field.split('=', 2),
					fieldName = fieldParts[0],
					fieldVal = fieldParts[1];

				switch (fieldName) {
					case 'javascript-key':
						appAuth.javascriptKey = fieldVal;
						break;
					case 'rest-key':
						appAuth.restKey = fieldVal;
						break;
				}
			}
		}

		if (req.body && typeof req.body === 'object') {
			// Authentication with request body fields
			if (req.body._ApplicationId) {
				appAuth.appId = req.body._ApplicationId;
				delete req.body._ApplicationId;

				if (req.body._JavaScriptKey) {
					appAuth.javascriptKey = req.body._JavaScriptKey;
					delete req.body._JavaScriptKey;
				}
			}
		}

		// Check API credentials
		configCtrl.read().then(function (config) {
			var authenticated = false;
			if (config.appId == appAuth.appId) {
				if (config.javascriptKey == appAuth.javascriptKey) {
					authenticated = true;
				} else if (config.restKey == appAuth.restKey) {
					authenticated = true;
				}
			}

			if (authenticated) { // No problem
				next();
			} else { // Access denied
				res.status(401).send({ error: 'unauthorized' });
			}
		}, function () {
			res.status(500).send({ error: 'unable to read config file' });
		});
	});

	configCtrl.read().then(function (config) {
		return apiBuilder(config);
	}).then(function (api) {
		app.use(api);
	}, function (err) {
		console.error('Cannot connect to database:', err);
		if (err.stack) {
			console.error(err.stack);
		}
		process.exit(1);
	});

	// Error handling
	if ('development' === app.get('env')) {
	  app.use(errorhandler());
	}
	app.use(function(err, req, res, next){
		console.error(err.stack);
		res.status(500).send('Something broke!');
	});

	return app;
};