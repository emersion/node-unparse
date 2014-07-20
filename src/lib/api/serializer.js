var serializer = {};

var transformers = {
	object: function (obj, ret, options) {
		ret.objectId = ret._id;
		delete ret._id;
		delete ret.__v;
		return ret;
	},
	user: function (obj, ret, options) {
		delete ret.password;
		delete ret.sessionToken;
		return ret;
	}
};

// TODO: use model functions instead of this serializer
serializer.serialize = function (obj) {
	var transform = transformers.object;

	if (obj.constructor.modelName == '_User') {
		transform = function (obj, ret, options) {
			ret = transformers.object(obj, ret, options);
			return transformers.user(obj, ret, options);
		};
	}

	return obj.toObject({
		transform: transform
	});
};

module.exports = serializer;