var toddick = require('../lib/toddick');
var dispatch = require('../lib/dispatch');

exports.Distributor_distributes = function(test) {
  
  test.expect(2);
  
  var Helper = toddick(
    {
      MSG: function(a, b) {
        test.equal(a, 'a');
        test.equal(b, 'b');
        test.done();
      }
    }
  );
  
  var helper = new Helper();
  
  var distributor = new dispatch.Distributor();
  var receiver = new dispatch.Receiver(distributor, helper.MSG);

  process.nextTick(
    function() {
      distributor.DISTRIBUTE('a', 'b');
    }
  );
  
}

exports.Distributor_registers = function(test) {
  
  test.expect(0);
  
  var Helper = toddick(
    {
      MSG: function() {
        test.done();
      }
    }
  );

  var helper = new Helper();

  var distributor = new dispatch.Distributor('name');
  
  var receiver = new dispatch.Receiver('name', helper.MSG);
  
  process.nextTick(
    function() {
      distributor.DISTRIBUTE();
    }
  );
  
}

exports.Distributor_monitors = function(test) {
  
  test.expect(1);
  
  var Helper = toddick(
    {
      INIT: function() {
        this.self.MONITOR_ADD = this.MONITOR_ADD.preproc('hook',
          function(args) {
            test.equal(args[0].id, distributor.UNSUBSCRIBE.id);
            test.done();
            return args;
          }
        );
      },
      MSG: function() {
      }
    }
  );

  var helper = new Helper();
  
  var distributor = new dispatch.Distributor();

  process.nextTick(
    function() {
      distributor.SUBSCRIBE(helper.MSG);
    }
  );
  
}

