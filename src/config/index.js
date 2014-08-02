var fs = require('fs');
var extend = require('extend');
var Q = require('q');

var env = process.env.NODE_ENV || 'development';

var configFile = __dirname+'/'+env+'.json',
	json = fs.readFileSync(configFile),
	config = null;

try {
	config = JSON.parse(json);
} catch (e) {
	console.warn('Cannot parse config', e);
}

var controller = {};

controller.read = function () {
	return Q(config);
};
controller.readSync = function () {
	return config;
};

controller.write = function (newConfig) {
	return this.read().then(function (currentConfig) {
		extend(currentConfig, newConfig);

		var json = JSON.stringify(currentConfig, null, 2);

		return Q.Promise(function(resolve, reject, notify) {
			fs.writeFile(configFile, json, function (err) {
				if (err) {
					reject(err);
				} else {
					resolve(currentConfig);
				}
			});
		});
	});
};

module.exports = controller;