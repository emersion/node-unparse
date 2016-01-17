var Waterline = require('waterline');
var Q = require('q');

module.exports = {};
module.exports.collections = {};

module.exports.loadModel = function (orm, classData) {
	var name = classData.name,
		fields = classData.fields;

	if (!name) {
		throw new Error('invalid model: no name specified');
	}
	if (this.isModelLoaded(name)) {
		throw new Error('invalid model '+name+': already loaded');
	}

	console.log('Loading model '+name);

	var def = {
		identity: String(name).toLowerCase(), // See https://github.com/balderdashy/waterline/issues/745
		connection: 'default',
		autoCreatedAt: true,
		autoUpdatedAt: true,
		autoPK: true,
		types: {
			/*ACL: function (acl) {

			}*/
		},
		attributes: {
			ACL: 'json'
		}
	};

	var protectedFields = [];
	for (var fieldName in fields) {
		var field = fields[fieldName];

		if (def.attributes[fieldName]) { // Do not override default fields
			continue;
		}

		if (typeof field == 'string') {
			field = {
				type: field
			};
		}

		if (field.protected) {
			protectedFields.push(fieldName);
		}

		def.attributes[fieldName] = field;
	}

	def.attributes.toJSON = function () {
		var data;
		if (typeof fields.toJSON == 'function') {
			data = fields.toJSON.apply(this, arguments);
		} else {
			data = this.toObject();

			// If any of the fields is protected, we should remove it
			if (protectedFields.length) {
				for (var i = 0; i < protectedFields.length; i++) {
					var fieldName = protectedFields[i];

					if (typeof data[fieldName] !== 'undefined') {
						delete data[fieldName];
					}
				}
			}
		}

		if (data.id) {
			data.objectId = data.id;
			delete data.id;
		}

		return data;
	};

	def.attributes.getClassName = function () {
		return name;
	};

	var collection = Waterline.Collection.extend(def);
	orm.loadCollection(collection);
	this.collections[name] = collection;
};

module.exports.unloadModel = function (name) {
	if (!this.isModelLoaded(name)) {
		console.warn('Cannot unload model '+name+': not loaded');
		return;
	}

	delete this.collections[name];
	delete this[name];
};

module.exports.isModelLoaded = function (name) {
	return !!this.collections[name];
};

module.exports.loadBaseModels = function (orm) {
	this.loadModel(orm, {
		name: '__Class',
		fields: {
			name: {
				type: 'string',
				required: true,
				unique: true
			},
			fields: 'json'
		}
	});
};

module.exports.loadAllModels = function (orm, classes) {
	for (var i = 0; i < classes.length; i++) {
		var classData = classes[i];

		try {
			this.loadModel(orm, classData);
		} catch (e) {
			console.warn('Cannot load stored class '+classData.name, e);
		}
	}
};
