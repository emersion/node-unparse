var bcrypt = require('bcrypt-nodejs');
var Q = require('q');

var hasher = {};

hasher.hash = function (password) {
	var deferred = Q.defer();

	bcrypt.hash(password, null, null, function(err, hash) {
		if (err) {
			deferred.reject(err);
			return;
		}

		deferred.resolve(hash);
	});

	return deferred.promise;
};
hasher.needsRehash = function (hash) {
	var hashInfo = this.info(hash);

	return (hashInfo.algoName == 'bcrypt');
};
hasher.compare = function (password, hash) {
	var deferred = Q.defer();

	bcrypt.compare(password, hash, function(err, res) {
		if (err) {
			deferred.reject(err);
			return;
		}

		deferred.resolve(res);
	});

	return deferred.promise;
};
hasher.info = function (hash) {
	var info = {};

	if (hash.substr(0, 4) == '$2a$' || hash.substr(0, 4) == '$2y$') {
		info.algoName = 'bcrypt';
	}

	return info;
};

module.exports = hasher;