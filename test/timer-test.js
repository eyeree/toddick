var toddick = require('../lib/toddick');
var timer = require('../lib/timer');

exports.timeout_sends_msg = function(test) {
  
  test.expect(0);
  
  var Helper = toddick(
    {
      MSG: function() {
        test.done();
      }
    }
  );
  
  var helper = new Helper();
  
  var timeout = new timer.Timeout(10, helper.MSG);
  
}

exports.timeout_cancels_on_exit = function(test) {
  
  test.expect(0);
  
  var Helper = toddick(
    {
      MSG: function() {
        test.ok(false);
      }
    }
  );
  
  var helper = new Helper();
  
  var timeout = new timer.Timeout(100, helper.MSG);
  
  process.nextTick(
    function() {
      timeout.EXIT();
      setTimeout(
        function() {
          test.done();
        },
        200
      )
    }
  );
  
}

exports.interval_sends_msg = function(test) {
  
  test.expect(0);
  
  var count = 0;
  
  var Helper = toddick(
    {
      MSG: function() {
        if(++count === 3) {
          test.done();
        }
      }
    }
  );
  
  var helper = new Helper();
  
  var interval = new timer.Interval(10, helper.MSG);
  
}

exports.interval_cancels_on_exit = function(test) {
  
  test.expect(0);
  
  var count = 0;
  
  var Helper = toddick(
    {
      MSG: function() {
        if(++count === 3) {
          interval.EXIT();
        } else if (count > 3) {
          test.ok(false);
        }
      }
    }
  );
  
  var helper = new Helper();
  
  var interval = new timer.Interval(10, helper.MSG);
  
  setTimeout(
    function() {
      test.done();
    },
    200
  );
  
}

