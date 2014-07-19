var express = require('express');
var path = require('path');
var bodyParser = require('body-parser');
var errorhandler = require('errorhandler');
//var cookieParser = require('cookie-parser');
var session = require('cookie-session');

var config = require('./config');
var api = require('./lib/api');
var app = module.exports = express();

app.set('port', process.env.PORT || 3000);
//app.use(express.logger('dev'));
app.use(bodyParser.json());
//app.use(cookieParser());
app.use(session({
	keys: ['abc', 'def']
}));
//app.use(express.compress());
app.use(function (req, res, next) {
	res.setHeader('Access-Control-Allow-Origin', '*');
	next();
});
app.use(function (req, res, next) { // Authentication
	// Authentication with headers
	var auth = {
		appId: req.get('X-Parse-Application-Id') || '',
		javascriptKey: req.get('X-Parse-Javascript-API-Key') || '',
		restKey: req.get('X-Parse-REST-API-Key') || ''
	};

	// Authentication with basic HTTP authentication
	if (req.body.username && req.body.password) {
		auth.appId = req.body.username;

		var passwdFields = req.body.password.split('&');
		for (var i = 0; i < passwdFields.length; i++) {
			var field = passwdFields[i],
				fieldParts = field.split('=', 2),
				fieldName = fieldParts[0],
				fieldVal = fieldParts[1];

			switch (fieldName) {
				case 'javascript-key':
					auth.javascriptKey = fieldVal;
					break;
				case 'rest-key':
					auth.javascriptKey = fieldVal;
					break;
			}
		}
	}

	// Check API credentials
	var authenticated = false;
	if (config.appId == auth.appId) {
		if (config.javascriptKey == auth.javascriptKey /*&& req.xhr*/) {
			authenticated = true;
		} else if (config.restKey == auth.restKey) {
			authenticated = true;
		}
	}

	if (authenticated) { // No problem
		next();
	} else { // Access denied
		res.send(401, { error: 'unauthorized' });
	}
});
app.use(api);

// Error handling
if ('development' === app.get('env')) {
  app.use(errorhandler());
}
app.use(function(err, req, res, next){
	console.error(err.stack);
	res.send(500, 'Something broke!');
});