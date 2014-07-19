var mongoose = require('mongoose');
var models = require('./models');
var Q = require('q');

mongoose.connect('mongodb://localhost/unparse');

var db = mongoose.connection;
db.on('error', console.error.bind(console, 'connection error:'));
db.once('open', function () {
	models.loadBaseModels();

	models.__Class.find(function (err, classes) {
		models.loadAllModels(classes);
	});

	console.log('Database opened');
});

function isClass(className) {
	return !!models[className];
}
function ensureClassExists(className, deferred) {
	if (!isClass(className)) {
		deferred.reject({
			error: 'class not found: '+className
		});
		return false;
	}
	return true;
}

module.exports.insertObject = function (className, objectData) {
	var deferred = Q.defer();

	if (!ensureClassExists(className, deferred)) {
		return deferred.promise;
	}

	// If we're inserting a new class, check that we can load the corresponding model
	if (className == '__Class') {
		try {
			models.loadModel(objectData);
		} catch (e) {
			deferred.reject({
				error: e.getMessage()
			});
			return deferred.promise;
		}
	}

	var object = new models[className](objectData);

	object.save(function (err, object) {
		if (err) {
			models.unloadModel(objectData.name);

			deferred.reject({
				error: 'cannot insert object: '+err
			});
		} else {
			deferred.resolve(object);
		}
	});

	return deferred.promise;
};

module.exports.retrieveObject = function (className, objectId) {
	var deferred = Q.defer();

	if (!ensureClassExists(className, deferred)) {
		return deferred.promise;
	}

	models[className].findById(objectId, function (err, object) {
		if (err) {
			deferred.reject({
				error: 'cannot retrieve object: '+err
			});
		} else {
			deferred.resolve(object);
		}
	});

	return deferred.promise;
};

module.exports.queryObjects = function (className, opts) {
	var deferred = Q.defer();

	if (!ensureClassExists(className, deferred)) {
		return deferred.promise;
	}

	var conditions = opts.where || undefined,
		fields = opts.keys || undefined,
		options = { //TODO: opts.include, opts.count
			sort: opts.order || undefined,
			skip: opts.skip || undefined,
			limit: opts.limit || undefined //TODO: support falsy values (0)
		};

	models[className].find(conditions, fields, options, function (err, results) {
		if (err) {
			deferred.reject({
				error: 'cannot query objects: '+err
			});
		} else {
			deferred.resolve({ results: results });
		}
	});

	return deferred.promise;
};

module.exports.updateObject = function (className, objectId, objectData) {
	var deferred = Q.defer();

	if (!ensureClassExists(className, deferred)) {
		return deferred.promise;
	}

	models[className].findByIdAndUpdate(objectId, objectData, function (err, object) {
		if (err) {
			deferred.reject({
				error: 'cannot update object: '+err
			});
		} else {
			deferred.resolve(object);
		}
	});

	return deferred.promise;
};

module.exports.deleteObject = function (className, objectId) {
	var deferred = Q.defer();

	if (!ensureClassExists(className, deferred)) {
		return deferred.promise;
	}

	models[className].findByIdAndRemove(objectId, function (err, object) {
		if (err) {
			deferred.reject({
				error: 'cannot delete object: '+err
			});
		} else {
			if (className == '__Class') {
				models.unloadModel(object.name);
			}

			deferred.resolve();
		}
	});

	return deferred.promise;
};

module.exports.init = function () {
	var deferred = Q.defer();

	// Default classes
	var classes = [{
		name: 'User',
		fields: [{
			name: 'username',
			type: 'String'
		}, {
			name: 'password',
			type: 'String'
		}, {
			name: 'email',
			type: 'String'
		}]
	}];

	for (var i = 0; i < classes.length; i++) {
		this.insertObject('__Class', classes[i]);
	}

	return deferred.promise;
};