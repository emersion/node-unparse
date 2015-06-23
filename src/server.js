var app = require('./app');

var server = app.listen(process.env.PORT || 3000, function() {
  console.log("Server listening on port " + server.address().port);
});
module.exports = server;