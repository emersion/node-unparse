var fs = require('fs');
var extend = require('extend');
var Q = require('q');

var configFile = null,
	config = null;

function load(filepath) {
	var json = fs.readFileSync(filepath);
	config = JSON.parse(json);
	configFile = filepath;
}

var env = process.env.NODE_ENV || 'development';
try {
	load(__dirname+'/'+env+'.json');
} catch (e) {
	console.warn('Cannot load config', e);
}

var controller = {};

controller.setPath = function (filepath) {
	return load(filepath);
};

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