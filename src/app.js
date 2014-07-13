var express = require('express');
var path = require('path');
var bodyParser = require('body-parser');
var errorhandler = require('errorhandler');
//var cookieParser = require('cookie-parser');
var session = require('cookie-session');

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
app.use(function(req, res) {
	res.setHeader('Access-Control-Allow-Origin', '*');
});
app.use(function(req, res) { // Authentication
	var auth = {
		appId: req.get('X-Parse-Application-Id') || '',
		javascriptKey: req.get('X-Parse-Javascript-API-Key') || '',
		restKey: req.get('X-Parse-REST-API-Key') || ''
	};

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

	// TODO: check auth
});
app.use(api);

if ('development' === app.get('env')) {
  app.use(errorhandler());
}