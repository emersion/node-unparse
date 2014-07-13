var mongoose = require('mongoose');
var models = require('./models');
var defer = require("promise").defer;

mongoose.connect('mongodb://localhost/unparse');

var db = mongoose.connection;
db.on('error', console.error.bind(console, 'connection error:'));
db.once('open', function () {
	models.Class.find(function (err, classes) {
		models.loadAllModels(classes);
	});

	console.log('Database opened');
});

module.exports.insertObject = function (className, objectData) {
	var deferred = defer();

	if (!models[className]) {
		deferred.reject({
			error: 'class not found: '+className
		});
	}

	var object = new models[className](objectData);
	object.save(function (err, object) {
		if (err) {
			deferred.reject({
				error: 'cannot insert object: '+err
			});
		} else {
			deferred.resolve(object);
		}
	});
};