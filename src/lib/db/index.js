var mongoose = require('mongoose');
var Q = require('q');
var EventEmitter = require('events').EventEmitter;
var extend = require('extend');

var models = require('./models');
var config = require('../../config');

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

var controller = new EventEmitter();

controller.connect = function () {
	var deferred = Q.defer();

	mongoose.connect(config.database.uri);

	var db = mongoose.connection;
	db.on('error', console.error.bind(console, 'connection error:'));
	db.once('open', function () {
		models.loadBaseModels();

		models.__Class.find(function (err, classes) {
			models.loadAllModels(classes);

			controller.emit('open');
			deferred.resolve();
		});
	});

	return deferred.promise;
};

controller.model = function (className) {
	return models[className];
};

controller.retrieveObject = function (className, objectId) {
	var deferred = Q.defer();

	if (!ensureClassExists(className, deferred)) {
		return deferred.promise;
	}

	this.model(className).findById(objectId, function (err, object) {
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

controller.queryObjects = function (className, opts) {
	var deferred = Q.defer();

	if (!ensureClassExists(className, deferred)) {
		return deferred.promise;
	}

	var model = this.model(className),
		conditions = opts.where,
		fields = opts.keys,
		options = {
			sort: opts.order,
			skip: opts.skip,
			limit: (opts.limit) ? parseInt(opts.limit) : undefined
		},
		populate = opts.include || '',
		count = (opts.count) ? parseInt(opts.count) : 0;

	var query = model.find(conditions, fields, options);

	if (populate) {
		populate.split(',').forEach(function (path) {
			query.populate(path);
		});
	}

	query.exec(function (err, results) {
		if (err) {
			deferred.reject({
				error: 'cannot query objects: '+err
			});
		} else {
			deferred.resolve({ results: results });
		}
	});

	if (count) {
		var countDeferred = Q.defer();

		var countQuery = model.find(conditions).count();
		countQuery.exec(function (err, count) {
			if (err) {
				countDeferred.reject({
					error: 'cannot count objects: '+err
				});
			} else {
				deferred.resolve({ count: count });
			}
		});

		return Q.spread([deferred.promise, countDeferred.promise], function (queryResult, countResult) {
			return extend(queryResult, countResult);
		});
	} else {
		return deferred.promise;
	}

};

controller.insertObject = function (className, objectData) {
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

	var object = new this.model(className)(objectData);

	object.save(function (err, object) {
		if (err) {
			// The class was not created as expected, unload the model
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

controller.updateObject = function (className, objectId, objectData) {
	var deferred = Q.defer();

	if (!ensureClassExists(className, deferred)) {
		return deferred.promise;
	}

	this.model(className).findByIdAndUpdate(objectId, objectData, function (err, object) {
		if (err) {
			deferred.reject({
				error: 'cannot update object: '+err
			});
		} else {
			// Unload and reload the class when updated
			if (className == '__Class') {
				models.unloadModel(object.name);
				models.loadModel(object);
			}

			deferred.resolve(object);
		}
	});

	return deferred.promise;
};

controller.deleteObject = function (className, objectId) {
	var deferred = Q.defer();

	if (!ensureClassExists(className, deferred)) {
		return deferred.promise;
	}

	this.model(className).findByIdAndRemove(objectId, function (err, object) {
		if (err) {
			deferred.reject({
				error: 'cannot delete object: '+err
			});
		} else {
			// Unload the class when deleted
			if (className == '__Class') {
				models.unloadModel(object.name);
			}

			deferred.resolve();
		}
	});

	return deferred.promise;
};

controller.init = function () {
	var deferred = Q.defer();

	// Default classes
	var classes = [{
		name: '_User',
		fields: [{
			name: 'username',
			type: 'String',
			unique: true
		}, {
			name: 'password',
			type: 'String'
		}, {
			name: 'email',
			type: 'String',
			unique: true
		}, {
			name: 'sessionToken',
			type: 'String'
		}, {
			name: 'authData',
			type: 'Object'
		}]
	}/*, {
		name: '_Role',
		fields: [{
			name: 'name',
			type: 'String'
		}, {
			name: 'roles',
			type: '[Relation<_Role>]'
		}, {
			name: 'users',
			type: '[Relation<_User>]'
		}]
	}*/];

	var promises = [];
	for (var i = 0; i < classes.length; i++) {
		var classData = classes[i];

		// The class will be automatically loaded when inserting it
		var promise = this.insertObject('__Class', classData).catch(function (err) {
			models.unloadModel(classData.name);
		});
		promises.push(promise);
	}

	return Q.all(promises);
};

module.exports = controller;