var configCtrl = require('./config');

module.exports = {
	config: function () {
		return configCtrl;
	},
	app: function () {
		return require('./app')(configCtrl);
	},
	init: function () {
		var crypto = require('crypto');
		var db = require('./lib/db');

		/**
		 * Generate a key.
		 * @return {String} The generated key.
		 */
		function generateKey() {
			var sha = crypto.createHash('sha1');
			sha.update(Math.random().toString());
			return sha.digest('hex');
		}

		// Generate app ID and keys if empty
		var config = null;
		return configCtrl.read().then(function (cfg) {
			config = cfg;

			if (!config.appId) {
				config.appId = generateKey();
				console.log('App ID generated: '+config.appId);
			}

			var keysNames = ['javascriptKey', 'restKey'];
			for (var i = 0; i < keysNames.length; i++) {
				var keyName = keysNames[i],
					keyValue = config[keyName];

				if (!keyValue) {
					keyValue = generateKey();
					config[keyName] = keyValue;

					console.log(keyName+' generated: '+keyValue);
				}
			}

			return configCtrl.write(config);
		}).then(function () {
			// Populate the database with default classes
			console.log('Connecting to the database...');
			return db.connect(config).then(function () {
				console.log('Populating database with default classes...');
				return db.init();
			}).then(function () {
				console.log('Database populated with default classes.');
			}, function (err) {
				console.error('Failed to populate the database.');
				throw err;
			});
		});
	},
	server: function () {
		var server = this.app().listen(process.env.PORT || 3000, function() {
			console.log('Server listening on port ' + server.address().port);
		});
		return server;
	}
};