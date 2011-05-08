var log = require('../lib/log');

exports.write_executes = function(test) {
   test.expect(0);
   log.write("type", "entity", "activity", {data:"data"});
   test.done();
}

exports.trace_executes = function(test) {
   test.expect(0);
   log.trace("entity", "activity", {data:"data"});
   test.done();
}

exports.info_executes = function(test) {
   test.expect(0);
   log.info("entity", "activity", {data:"data"});
   test.done();
}

exports.error_executes = function(test) {
   test.expect(0);
   log.error("entity", "activity", {data:"data"});
   test.done();
}

