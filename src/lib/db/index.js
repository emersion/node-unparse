var mongoose = require('mongoose');
var Q = require('q');
var EventEmitter = require('events').EventEmitter;
var extend = require('extend');

var models = require('./models');
var configCtrl = require('../../config');

function isClass(className) {
	return !!models[className];
}
function ensureClassExists(className) {
	if (!isClass(className)) {
		return Q.reject({
			error: 'class not found: '+className
		});
	}
	return Q();
}

var controller = new EventEmitter();

controller.connect = function () {
	return configCtrl.read().then(function (config) {
		var deferred = Q.defer();

		mongoose.connect(config.database.uri);

		var db = mongoose.connection;
		db.on('error', console.error.bind(console, 'connection error:'));
		db.once('open', function () {
			console.log('Connected to the database');
			models.loadBaseModels();

			models.__Class.find(function (err, classes) {
				models.loadAllModels(classes);

				controller.emit('open');
				deferred.resolve();
			});
		});
		db.on('disconnected', function () {
			console.log('Connection to database closed.');
			process.exit(1);
		});

		return deferred.promise;
	});
};

controller.model = function (className) {
	return models[className];
};

controller.retrieveObject = function (className, objectId) {
	var that = this;

	return ensureClassExists(className).then(function () {
		var deferred = Q.defer();

		that.model(className).findById(objectId, function (err, object) {
			if (err) {
				deferred.reject({
					error: 'cannot retrieve object: '+err
				});
			} else {
				deferred.resolve(object);
			}
		});

		return deferred.promise;
	});
};

controller.queryObjects = function (className, opts) {
	var that = this;

	return ensureClassExists(className).then(function () {
		var deferred = Q.defer();

		var model = that.model(className),
			where = opts.where,
			select = opts.keys,
			options = {
				sort: opts.order,
				skip: opts.skip,
				limit: (typeof opts.limit != 'undefined') ? parseInt(opts.limit) : undefined
			},
			populate = opts.include || '',
			count = (opts.count) ? parseInt(opts.count) : 0;

		if (options.limit !== 0) {
			var query = model.find();

			if (where) {
				var constraints = {
					$lt: 'lt',
					$lte: 'lte',
					$gt: 'gt',
					$gte: 'gte',
					$ne: 'ne',
					$in: 'in',
					$nin: 'nin',
					$exists: 'exists',
					$select: function (value) {
						//return this.lte(value);
						//TODO
					},
					$dontSelect: function (value) {
						//TODO
					},
					$all: 'all'
				};

				for (var path in where) {
					var pathConstraints = where[path];

					if (path == '$or') {
						query.or(pathConstraints); //TODO: parse each subquery
					} else if (path == '$and') {
						query.and(pathConstraints); //TODO: parse each subquery
					} else if (pathConstraints instanceof Array) {
						query.where(path, pathConstraints);
					} else if (typeof pathConstraints == 'object') {
						query.where(path);
						for (var name in constraints) {
							if (typeof pathConstraints[name] == 'undefined') {
								continue;
							}

							var value = pathConstraints[name],
								method = constraints[name];

							if (typeof method == 'function') {
								constraints[name].call(query, value);
							} else {
								query[method].call(query, value);
							}
						}

						if (typeof pathConstraints.__type != 'undefined') {
							if (pathConstraints.__type == 'Pointer') {

							} else if (pathConstraints.__type == 'Object') {

							}
						}
					} else {
						query.where(path, pathConstraints);
					}
				}
			}

			if (populate) {
				populate.split(',').forEach(function (path) {
					query.populate(path);
				});
			}

			if (options.skip) {
				query.skip(options.skip);
			}
			if (options.limit) {
				query.limit(options.limit);
			}
			if (options.sort) {
				options.sort.split(',').forEach(function (path) {
					query.sort(path);
				});
			}
			if (select) {
				query.select(select.split(',').join(' '));
			}

			query.exec(function (err, results) {
				if (err) {
					deferred.reject('cannot query objects: '+err);
				} else {
					deferred.resolve({ results: results });
				}
			});
		} else {
			deferred.resolve({ results: [] });
		}

		if (count) {
			var countDeferred = Q.defer();

			var countQuery = model.find().merge(query).skip(0).limit(0).count();
			countQuery.exec(function (err, count) {
				if (err) {
					countDeferred.reject('cannot count objects: '+err);
				} else {
					countDeferred.resolve({ count: count });
				}
			});

			return Q.spread([deferred.promise, countDeferred.promise], function (queryResult, countResult) {
				return extend(queryResult, countResult);
			});
		} else {
			return deferred.promise;
		}
	});
};

controller.queryOne = function (className, opts) {
	opts = opts || {};
	opts.skip = 0;
	opts.limit = 1;
	opts.count = 0;

	//TODO: is it better to use .findOne() instead?

	return this.queryObjects(className, opts).then(function (data) {
		return data.results[0];
	});
};

controller.insertObject = function (className, objectData) {
	var that = this;

	return ensureClassExists(className).then(function () {
		var deferred = Q.defer();

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

		var object = new that.model(className)(objectData);

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
	});
};

controller.updateObject = function (className, objectId, objectData) {
	var that = this;

	return ensureClassExists(className).then(function () {
		var deferred = Q.defer();

		that.model(className).findByIdAndUpdate(objectId, objectData, function (err, object) {
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
	});
};

controller.deleteObject = function (className, objectId) {
	var that = this;

	return ensureClassExists(className).then(function () {
		var deferred = Q.defer();

		that.model(className).findByIdAndRemove(objectId, function (err, object) {
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
	});
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