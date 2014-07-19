var fs = require('fs');

var env = process.env.NODE_ENV || 'development';

var json = fs.readFileSync(__dirname+'/'+env+'.json'),
	config = null;

try {
	config = JSON.parse(json);
} catch (e) {
	console.warn('Cannot parse config', e);
}

module.exports = config;