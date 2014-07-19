var express = require('express');
var path = require('path');
var bodyParser = require('body-parser');
var errorhandler = require('errorhandler');
//var cookieParser = require('cookie-parser');
var session = require('cookie-session');

var api = require('./lib/api');
var app = module.exports = express();

app.set('env', 'development');
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
	next();
});
app.use(api);
app.use(function(err, req, res, next){
	console.error(err.stack);
	res.send(500, 'Something broke!');
});

if ('development' === app.get('env')) {
  app.use(errorhandler());
}