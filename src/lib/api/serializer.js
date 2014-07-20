var serializer = {};

serializer.object = function (obj) {
	return obj.toObject({
		transform: function (doc, ret, options) {
			ret.objectId = ret._id;
			delete ret._id;
			delete ret.__v;
			return ret;
		}
	});
};

serializer.user = function (user) {
	var result = this.object(user);

	delete result.password;
	delete result.sessionToken;

	return result;
};

module.exports = serializer;