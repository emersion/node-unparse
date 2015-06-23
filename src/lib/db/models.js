var Waterline = require('waterline');
var Q = require('q');

module.exports = {};
module.exports.collections = {};

module.exports.loadModel = function (orm, classData) {
	var name = classData.name,
		attributes = classData.attributes;

	if (!name) {
		throw new Error('invalid model: no name specified');
	}
	if (this.isModelLoaded(name)) {
		throw new Error('invalid model '+name+': already loaded');
	}

	console.log('Loading model '+name);

	var def = {
		identity: String(name),
		connection: 'default',
		autoCreatedAt: true,
		autoUpdatedAt: true,
		autoPK: true,
		types: {
			/*ACL: function (acl) {

			}*/
		},
		attributes: {
			ACL: 'json',
			toJSON: function () {
				
			}
		}
	};

	var protectedAttrs = [];
	for (var attrName in attributes) {
		var attr = attributes[attrName];

		if (def.attributes[attrName]) { // Do not override default fields
			continue;
		}

		if (typeof attr == 'string') {
			attr = {
				type: attr
			};
		}

		if (attr.protected) {
			protectedAttrs.push(attrName);
		}

		def.attributes[attrName] = attr;
	}

	def.attributes.toJSON = function () {
		var data;
		if (typeof attributes.toJSON == 'function') {
			data = attributes.toJSON.apply(this, arguments);
		} else {
			data = this.toObject();

			// If any of the attributes are protected, we should remove them
			if (protectedAttrs.length) {
				for (var i = 0; i < protectedAttrs.length; i++) {
					var attrName = protectedAttrs[i];

					if (typeof data[attrName] !== 'undefined') {
						delete data[attrName];
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
		attributes: {
			name: {
				type: 'string',
				required: true,
				unique: true
			},
			attributes: 'json'
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