var mongoose = require('mongoose');
var Schema = mongoose.Schema;

module.exports = {};
module.exports.schemas = {};

module.exports.schemas.Class = new Schema({
	name: String,
	fields: Array
});
module.exports.Class = mongoose.model('__Class', module.exports.schemas.Class);

module.exports.schemas.Object = new Schema({
	objectId: Schema.Types.ObjectId
});

module.exports.loadModel = function (classData) {
	var def = {};
	for (var i = 0; i < classData.fields.length; i++) {
		var field = classData.fields[i];

		def[field.name] = Schema.Types[field.type];
	}

	var schema = new Schema(def),
		model = mongoose.model(classData.name, module.exports.schemas.Class);

	module.exports.schemas[classData.name] = schema;
	module.exports[classData.name] = model;
};
module.exports.loadAllModels = function (classes) {
	for (var i = 0; i < classes.length; i++) {
		module.exports.loadModel(classes[i]);
	}
};