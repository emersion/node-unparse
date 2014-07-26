var mongoose = require('mongoose');
var Schema = mongoose.Schema;

module.exports = {};
module.exports.schemas = {};

var builtInTypes = {
	'String': String,
	'Number': Number,
	'Boolean': Boolean,
	'Array': Array,
	'Date': Date,

	'Mixed': Schema.Types.Mixed,
	'ObjectId': Schema.Types.ObjectId,

	'Pointer': Schema.Types.Mixed
};
function parseType(type) {
	if (typeof type == 'function') { // Already a type
		return type;
	} else if (typeof type == 'string') {
		return builtInTypes[type] || type;
	} else if (type instanceof Array) {
		var parsedType = [];
		for (var i = 0; i < type.length; i++) {
			parsedType.push(parseType(type[i]));
		}
		return parsedType;
	} else if (typeof type == 'object') {
		var parsedType = {};
		for (var i in type) {
			parsedType[i] = parseType(type[i]);
		}
		return parsedType;
	}

	return type;
}

module.exports.loadModel = function (classData, methods) {
	var name = classData.name,
		fields = classData.fields;

	if (!name) {
		throw new Error('invalid model: no name specified');
	}
	if (this[name]) {
		console.warn('Cannot load model '+name+': already loaded');
		throw new Error('invalid model '+name+': already loaded');
	}

	console.log('Loading model '+name);

	var def = {
		createdAt: Date,
		updatedAt: Date,
		ACL: Object
	};

	// TODO: schema as an Object
	for (var i = 0; i < fields.length; i++) {
		var field = fields[i];

		if (def[field.name]) { // Do not override default fields
			continue;
		}

		def[field.name] = {
			type: parseType(field.type),
			unique: (field.unique) ? true : false,
			required: (field.required) ? true : false,
			ref: field.ref //TODO: https://www.parse.com/docs/rest#queries
		};
	}

	var schema = new Schema(def);
	schema.pre('save', function (next) {
		if (!this.createdAt) {
			this.createdAt = new Date();
		}

		this.updatedAt = new Date();

		next();
	});

	if (methods) {
		schema.method(methods);
	}
	
	var model = mongoose.model(name, schema);

	this.schemas[name] = schema;
	this[name] = model;
};

module.exports.unloadModel = function (name) {
	if (!this[name]) {
		console.warn('Cannot unload model '+name+': not loaded');
		return;
	}

	delete this.schemas[name];
	delete this[name];
};

module.exports.loadBaseModels = function () {
	this.loadModel({
		name: '__Class',
		fields: [{
			name: 'name',
			type: String
		}, {
			name: 'fields',
			type: [{ name: String, type: { type: String } }]
		}, {
			name: 'ACL',
			type: Object
		}]
	});
};

module.exports.loadAllModels = function (classes) {
	for (var i = 0; i < classes.length; i++) {
		var classData = classes[i];

		try {
			this.loadModel(classData);
		} catch (e) {
			console.warn('Cannot load stored class '+classData.name, e);
		}
	}
};