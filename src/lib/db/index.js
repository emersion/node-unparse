var Waterline = require('waterline');
var Q = require('q');
var EventEmitter = require('events').EventEmitter;
var extend = require('extend');

var models = require('./models');
var configCtrl = require('../../config');

var controller = new EventEmitter();

var orm;
var connections, collections;

function isClass(className) {
	return !!controller.model(className);
}
function ensureClassExists(className) {
	if (!isClass(className)) {
		return Q.reject('class not found: '+className);
	}
	return Q();
}

function getConfig() {
	return configCtrl.read().then(function (config) {
		return {
			// Setup Adapters
			// Creates named adapters that have have been required
			adapters: {
				'default': 'mongo',
				disk: require('sails-disk'),
				memory: require('sails-memory'),
				mongo: require('sails-mongo')
			},

			// Build Connections Config
			// Setup connections using the named adapter configs
			connections: {
				'default': config.connection
			}
		};
	});
}
function initialize() {
	return getConfig().then(function (config) {
		// Start Waterline passing adapters in
		var deferred = Q.defer();
		orm.initialize(config, function(err, data) {
			if (err) {
				deferred.reject(err);
				return;
			}

			connections = data.connections;
			collections = data.collections;

			deferred.resolve();
		});
		return deferred.promise;
	});
}
function teardown() {
	var deferred = Q.defer();
	orm.teardown(function () {
		deferred.resolve();
	});
	return deferred.promise;
}
function reload() {
	var promise = teardown().then(function () {
		return initialize();
	});
	this.connecting = promise;
	return promise;
}

function loadAllModels(classes) {
	return Q.try(function () {
		models.loadAllModels(orm, classes);
	}).then(function () {
		console.log('Reloading database connections after models update');
		return reload();
	});
}
function loadModel(classData) {
	return loadAllModels([classData]);
}
function unloadModel(className) {
	models.unloadModel(className);

	delete orm.collections[className.toLowerCase()];
}

controller.connect = function () {
	var that = this;

	orm = new Waterline();
	models.loadBaseModels(orm);

	var promise = initialize().then(function () {
		// Load stored models
		return that.model('__Class').find().then(function (classes) {
			return loadAllModels(classes);
		}, function (err) {
			throw 'Cannot load classes from database: '+err;
		});
	}).then(function () {
		// Database opened!
		controller.emit('open');
	});
	this.connecting = promise;
	return promise;
};

controller.model = function (className) {
	return collections[String(className).toLowerCase()];
};

controller.retrieveObject = function (className, objectId) {
	var that = this;

	return ensureClassExists(className).then(function () {
		var deferred = Q.defer();

		that.model(className).findById(objectId, function (err, object) {
			if (err) {
				deferred.reject('cannot retrieve object: '+err);
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
		return that.model(className).create(objectData).then(function (object) {
			// If we're inserting a new class
			if (className == '__Class') {
				return loadModel(object).catch(function (err) {
					return object.destroy().thenReject(err);
				}).thenResolve(object);
			}
			return object;
		});
	});
};

/**
 * @see https://github.com/balderdashy/sails/blob/master/lib/hooks/blueprints/actions/update.js
 */
controller.updateObject = function (className, objectId, objectData) {
	var that = this;

	return ensureClassExists(className).then(function () {
		return that.model(className).update(objectId, objectData).then(function (objects) {
			return objects[0];
		});
	}).then(function (object) {
		// Unload and reload the class when updated
		if (className == '__Class') {
			unloadModel(object.name);
			return loadModel(object).thenResolve(object);
		}
		return object;
	});
};

/**
 * @see https://github.com/balderdashy/sails/blob/master/lib/hooks/blueprints/actions/remove.js
 */
controller.deleteObject = function (className, objectId) {
	var that = this,
		model = that.model(className);

	return ensureClassExists(className).then(function () {
		return model.findOne(objectId);
	}).then(function (object) {
		return that.model(className).destroy(objectId).then().thenResolve(object);
	}).then(function (object) {
		// Unload the class when deleted
		if (className == '__Class') {
			unloadModel(object.name);
		}
	});
};

controller.init = function () {
	var deferred = Q.defer();

	// Default classes
	var classes = [{
		name: '_User',
		attributes: {
			username: {
				type: 'string',
				required: true,
				unique: true
			},
			password: {
				type: 'string',
				'protected': true
			},
			email: {
				type: 'email',
				unique: true
			},
			sessionToken: {
				type: 'string',
				'protected': true
			},
			authData:  {
				type: 'json',
				'protected': true
			}/*,
			roles: {
				collection: '_Role',
				via: 'users'
			}*/
		}
	}/*, {
		name: '_Role',
		attributes: {
			name: 'string',
			roles: {
				collection: '_Role'
			},
			users: {
				collection: '_User',
				via: 'roles',
				dominant: true
			}
		}
	}*/];

	var promises = [];
	for (var i = 0; i < classes.length; i++) {
		var classData = classes[i];

		// The class will be automatically loaded when inserting it
		var promise = this.insertObject('__Class', classData).catch(function (err) {
			if (models.isModelLoaded(classData.name)) {
				models.unloadModel(classData.name);
			}
			throw err;
		});
		promises.push(promise);
	}

	return Q.all(promises);
};

module.exports = controller;