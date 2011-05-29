var toddick = require('../lib/toddick');
var fs = require('fs');
var log = require('../lib/log');

toddick.trace_enabled = true;
//log.stream = fs.createWriteStream('/dev/null');

exports.toddick_returns_constructor = function(test) {
  test.expect(2);
  var constructor = toddick( {} );
  test.equal(typeof constructor, 'function');
  test.ok(constructor.is_toddick_constructor);
  test.done();
}

exports.constructor_returns_toddick = function(test) {
  test.expect(2);
  var constructor = toddick( {} );
  var instance = new constructor('a', 'b');
  test.equal(typeof instance, 'object');
  test.ok(instance.is_toddick);
  test.done();
} 

exports.toddick_id_is_unique = function(test) {
  test.expect(3);
  var constructor_1 = toddick( {} );
  var instance_1 = new constructor_1();
  var constructor_2 = toddick( {} );
  var instance_2 = new constructor_2();
  test.ok(instance_1.id);
  test.ok(instance_2.id);
  test.notEqual(instance_1.id, instance_2.id);
  test.done();
}

exports.toddick_id_is_unique_for_type = function(test) {
  test.expect(3);
  var constructor = toddick( {} );
  var instance_1 = new constructor();
  var instance_2 = new constructor();
  test.ok(instance_1.id);
  test.ok(instance_2.id);
  test.notEqual(instance_1.id, instance_2.id);
  test.done();
}

exports.toddick_uses_name_for_trace_name = function(test) {
  test.expect(1);
  var constructor = toddick( 'Test', {} );
  var instance = new constructor();
  test.ok(/^Test:\d+$/, instance.id);
  test.done();
}

exports.toddick_uses_name_and_module_for_trace_name = function(test) {
  test.expect(1);
  var mock_mod = {
    filename: '/test/filename.ext',
    exports: { }
  };
  var constructor = toddick( 'Test', mock_mod, {} );
  var instance = new constructor();
  test.ok(/^filename.Test:\d+$/, instance.id);
  test.done();
}

exports.toddick_exports_constructor = function(test) {
  test.expect(1);
  var mock_mod = {
    filename: '/test/filename.ext',
    exports: { }
  };
  var constructor = toddick( 'Test', mock_mod, {} );
  test.deepEqual(mock_mod.exports['Test'], constructor);
  test.done();
}

exports.constructor_sends_initialize = function(test) {
  
  test.expect(3);
  
  var was_async = false;
  
  var constructor = toddick(
    {
      INIT: function(a, b) {
        test.ok(was_async);
        test.equal(a, 'a');
        test.equal(b, 'b');
        test.done();
      }
    }
  );
  
  var instance = new constructor('a', 'b');
  
  was_async = true;
  
}

exports.constructor_creates_dispatcher = function(test) {
   
  test.expect(3);
   
  var was_async = false;
   
  var constructor = toddick( 
    {
      MSG: function(a, b) {
        test.equal(a, 'a');
        test.equal(b, 'b');
        test.ok(was_async);
        test.done();
      }
    }
  );
  
  var instance = new constructor();
  
  instance.MSG('a', 'b');
   
  was_async = true;
   
}

exports.dispatcher_id_is_unique = function(test) {
  
  test.expect(15);
  
  var constructor_a = toddick( 
    {
      MSG_A: function() {},
      MSG_B: function() {}
    }
  );
  
  var constructor_b = toddick( 
    {
      MSG_A: function() {},
      MSG_B: function() {}
    }
  );
  
  var instance_a_1 = new constructor_a();
  var instance_a_2 = new constructor_a();
  var instance_b_1 = new constructor_b();
  var instance_b_2 = new constructor_b();
  
  test.ok(instance_a_1.MSG_A.id);
  test.ok(instance_a_1.MSG_B.id);
  test.ok(instance_a_2.MSG_A.id);
  test.ok(instance_a_2.MSG_B.id);
  test.ok(instance_b_1.MSG_A.id);
  test.ok(instance_b_1.MSG_B.id);
  test.ok(instance_b_2.MSG_A.id);
  test.ok(instance_b_2.MSG_B.id);
  
  test.notEqual(instance_a_1.MSG_A.id, instance_a_1.MSG_B.id);
  test.notEqual(instance_a_1.MSG_A.id, instance_a_2.MSG_A.id);
  test.notEqual(instance_a_1.MSG_A.id, instance_a_2.MSG_B.id);
  test.notEqual(instance_a_1.MSG_A.id, instance_b_1.MSG_A.id);
  test.notEqual(instance_a_1.MSG_A.id, instance_b_1.MSG_B.id);
  test.notEqual(instance_a_1.MSG_A.id, instance_b_2.MSG_A.id);
  test.notEqual(instance_a_1.MSG_A.id, instance_b_2.MSG_B.id);
  
  test.done();
  
}

exports.handler_self_is_toddick = function (test) {
  
  test.expect(1);
  
  var constructor = toddick(
    {
      INIT: function() {
        test.deepEqual(this.self, instance);
        test.done();
      }
    }
  );
  
  var instance = new constructor();
  
}

exports.dispatcher_toddick_is_toddick = function (test) {
  
  test.expect(1);
  
  var constructor = toddick(
    {
      MSG: function() {}
    }
  );
  
  var instance = new constructor();
  
  test.deepEqual(instance.MSG.toddick, instance);
  test.done();
  
}

exports.this_is_preserved = function (test) {
  
  test.expect(1);
  
  var constructor = toddick(
    {
      INIT: function() {
        this.test = 1;
      },
      
      MSG: function() {
        test.equal(this.test, 1);
        test.done();
      }
    }
  );
  
  var instance = new constructor();
  instance.MSG();
  
}

exports.this_is_not_toddick = function (test) {
  
  test.expect(1);
  
  var constructor = toddick(
    {
      INIT: function() {
        test.notDeepEqual(this, this.self);
        test.done();
      }
    }
  );
  
  var instance = new constructor();
  
}

exports.exit_makes_inactive = function (test) {
  
  test.expect(2);
  
  var constructor = toddick(
    {
      MSG: function() {
        process.nextTick(
          function() {
            test.ok(!instance.is_active);
            test.done();
          }
        );
        this.exit();
      }
    }
  );
  
  var instance = new constructor();
  
  test.ok(instance.is_active);
  
  instance.MSG();
  
}

exports.messages_ignored_when_inactive = function (test) {
  
  test.expect(0);
  
  var constructor = toddick(
    {
      INIT: function() {
        this.exit();
      },
      
      MSG: function() {
        test.ok(false);
      }
    }
  );
  
  var instance = new constructor();
  
  instance.MSG();
  
  process.nextTick(
    function () {
      test.done();
    }
  );
  
}

exports.has_exit_dispatcher = function(test) {
  
  test.expect(3);
  
  var constructor = toddick(
    {
    }
  );
  
  var instance = new constructor();
  
  instance.EXIT('test reason', {test: 'data'});
  
  process.nextTick(
    function() {
      test.ok(!instance.is_active);
      test.equal(instance.exit_reason, 'test reason');
      test.equal(instance.exit_data.test, 'data');
      test.done();
    }
  );
  
}
  
exports.exception_sends_exit = function(test) {
  
  test.expect(2);
  
  var error = new Error('test exception');
  
  var constructor = toddick(
    {
      MSG: function() {
        throw error;
      },
      EXIT: function(reason, data) {
        test.equal('handler-exception', reason);
        test.deepEqual(data.exception, error);
        test.done();
        this.exit(reason);
      }
    }
  );
  
  var instance = new constructor();
  
  instance.MSG();
  
}

exports.monitor_sends_exit = function(test) {
  
  test.expect(2);
  
  var constructor_1 = toddick(
    {
      MSG: function() {
        this.exit('test reason', {test: 'data'});
      }
    }
  );
  
  var constructor_2 = toddick(
    {
      
      INIT: function(target) {
        this.monitor(target);
        target.MSG();
      },
      
      EXIT: function(reason, data) {
        test.equal('test reason', reason);
        test.equal('data', data.test);
        test.done();
        this.exit(reason, data);
      }
      
    }
  );
  
  var instance_1 = new constructor_1();
  var instance_2 = new constructor_2(instance_1);
  
}

exports.monitor_sends_msg = function(test) {
  
  test.expect(2);
  
  var constructor_1 = toddick(
    {
      MSG: function() {
        this.exit('test reason', {test: 'data'});
      }
    }
  );
  
  var constructor_2 = toddick(
    {
      
      INIT: function(target) {
        this.monitor(target, this.MSG);
        target.MSG();
      },
      
      MSG: function(reason, data) {
        test.equal('test reason', reason);
        test.equal('data', data.test);
        test.done();
      }
      
    }
  );
  
  var instance_1 = new constructor_1();
  var instance_2 = new constructor_2(instance_1);

}

exports.monitor_inactive_sends_msg = function(test) {
  
  test.expect(1);
  
  var constructor_1 = toddick(
    {
      INIT: function(target) {
        this.exit();
      }
    }
  );
  
  var constructor_2 = toddick(
    {
      
      INIT: function(target) {
        this.monitor(target, this.MSG);
      },
      
      MSG: function(reason, data) {
        test.equal(reason, 'already-exited');
        test.done();
      }
      
    }
  );
  
  var instance_1 = new constructor_1();
  var instance_2 = new constructor_2(instance_1);
  
}

exports.link_exits_source = function(test) {
  
  test.expect(0);
  
  var constructor_1 = toddick(
    {
    }
  );
  
  var constructor_2 = toddick(
    {
      INIT: function(target) {
        this.link(target);
        target.EXIT('test reason');
      },
      EXIT: function(reason, data) {
        test.done();
        this.exit(reason, data);
      }
    }
  );
  
  var instance_1 = new constructor_1();
  var instance_2 = new constructor_2(instance_1);
  
}


exports.link_exits_target = function(test) {
  
  test.expect(0);
  
  var constructor_1 = toddick(
    {
      EXIT: function(reason, data) {
        test.done();
        this.exit(reason, data);
      }
    }
  );
  
  var constructor_2 = toddick(
    {
      INIT: function(target) {
        this.link(target);
        this.exit();
      }
    }
  );
  
  var instance_1 = new constructor_1();
  var instance_2 = new constructor_2(instance_1);
  
}

exports.exit_in_init_exits = function(test) {
 
  test.expect(1);
   
  var constructor = toddick(
    {
      INIT: function() {
        this.exit();
      }
    }
  );
  
  var instance = new constructor();
  
  process.nextTick(
    function() {
      test.ok(!instance.is_active);
      test.done();
    }
  );
  
}

exports.register_registers = function(test) {
  
  test.expect(3);
  
  var constructor = toddick(
    {
      INIT: function() {
        
        this.register('a');
        
        test.deepEqual(instance, toddick.tryFind('a'));
        test.deepEqual(instance, toddick.tryFind('b'));
        test.deepEqual(instance, toddick.find('a'));
        
        test.done();
  
      }
    }
  );
  
  var instance = new constructor();
  
  instance.register('b');
  
}

exports.exit_unregisters = function(test) {
  
  test.expect(2);
  
  var constructor = toddick(
    {
    }
  );
  
  var instance = new constructor();
  
  instance.register('c');
  
  instance.EXIT();
  
  process.nextTick(
    function() {
      test.equal(undefined, toddick.tryFind('c'));
      try {
        toddick.find('c');
      } catch(e) {
        test.ok(true);
      }
      test.done();
    }
  );
  
}

exports.unregister_unregisters = function(test) {
  
  test.expect(4);
  
  var constructor = toddick(
    {
      INIT: function() {
        
        this.register('d');
        
        test.deepEqual(instance, toddick.tryFind('d'));
        test.deepEqual(instance, toddick.tryFind('e'));
        
        this.unregister('e');
        instance.unregister('d');
        
        test.equal(undefined, toddick.tryFind('d'));
        test.equal(undefined, toddick.tryFind('e'));
        
        test.done();
        
      }
    }
  );
  
  var instance = new constructor();
  
  instance.register('e');
  
}

exports.unmonitor_with_name_unmonitors = function(test) {
  
  test.expect(1);
  
  var constructor_1 = toddick(
    {
      INIT: function() {
        this.register('f');
      }
    }
  );
  
  var constructor_2 = toddick(
    {
      INIT: function() {
        this.target = this.monitor('f');
        test.deepEqual(this.target, instance_1);
        this.MSG1();
      },
      
      MSG1: function() {
        this.unmonitor('f');
        this.target.EXIT();
        this.MSG2();
      },
      
      MSG2: function() {
        this.MSG3();
      },
      
      MSG3: function() {
        test.done();
      },
      
      EXIT: function() {
        test.ok(false);
      }
    }
  );
  
  var instance_1 = new constructor_1();
  var instance_2 = new constructor_2();
      
}

exports.monitor_with_name_monitors = function(test) {
  
  test.expect(1);
  
  var constructor_1 = toddick(
    {
      INIT: function() {
        this.register('g');
      }
    }
  );
  
  var constructor_2 = toddick(
    {
      INIT: function() {
        this.target = this.monitor('g');
        test.deepEqual(this.target, instance_1);
        this.MSG1();
      },
      
      MSG1: function() {
        this.target.EXIT();
      },
      
      EXIT: function() {
        test.done();
      }
    }
  );
  
  var instance_1 = new constructor_1();
  var instance_2 = new constructor_2();
      
}

exports.link_with_name_links = function(test) {
  
  test.expect(1);
  
  var constructor_1 = toddick(
    {
      INIT: function() {
        this.register('h');
      }
    }
  );
  
  var constructor_2 = toddick(
    {
      INIT: function() {
        this.target = this.link('h');
        test.deepEqual(this.target, instance_1);
        this.MSG1();
      },
      
      MSG1: function() {
        this.target.EXIT();
      },
      
      EXIT: function() {
        test.done();
      }
    }
  );
  
  var instance_1 = new constructor_1();
  var instance_2 = new constructor_2();
      
}

exports.constructor_returns_self = function(test) {
  
  test.expect(1);
  
  var constructor = toddick(
    {
      MSG: function(instance) {
        test.deepEqual(this.self, instance);
        test.done();
      }
    }
  );
  
  var instance = constructor();
  
  instance.MSG(instance);
  
}

// TODO: 
// link anonymous toddicks
// preproc
// withArgs

exports.link_creates_anonymous_toddick = function(test) {
  
  test.expect(0);
  
  var constructor = toddick(
    {
      INIT: function() {
        this.link(
          {
            INIT: function() {
              test.done();
            }
          }
        );
      }
    }
  );
  
  var instance = new constructor();
  
}

exports.preproc_calls_function_and_uses_args = function(test) {
  
  test.expect(2);
  
  var constructor = toddick(
    {
      INIT: function() {
        var MSG2 = this.MSG.preproc('test',
          function(args) {
            test.equal(args[0], 'b');
            return ['a'];
          }
        );
        MSG2('b');
      },
      MSG: function(a) {
        test.equal(a, 'a');
        test.done();
      }
    }
  );
  
  var instance = new constructor();
  
}

exports.preproc_calls_function_and_skips_handler = function(test) {
  
  test.expect(0);
  
  var constructor = toddick(
    {
      INIT: function() {
        var MSG2 = this.MSG.preproc('test',
          function(args) {
            return undefined;
          }
        );
        MSG2('b');
        this.MSG3();
      },
      MSG: function(a) {
        test.ok(false);
      },
      MSG3: function() {
        test.done();
      }
    }
  );
  
  var instance = new constructor();
  
}

exports.withArgs_calls_handler_with_args = function(test) {
  
  test.expect(2);
  
  var constructor = toddick(
    {
      INIT: function() {
        var MSG2 = this.MSG.withArgs('a');
        MSG2('b');
      },
      MSG: function(a, b) {
        test.equal(a, 'a');
        test.equal(b, 'b');
        test.done();
      }
    }
  );
  
  var instance = new constructor();
  
}


exports.exit_sets_exit_reason_and_data = function(test) {
  
  test.expect(3);

  toddick.trace_enabled = true;
    
  var constructor = toddick(
    {
      INIT: function() {
        this.exit('reason', {test: 'data'});
      }
    }
  );
  
  var instance = new constructor();
  
  process.nextTick(
    function() {
      process.nextTick(
        function() {
          test.equal(false, instance.is_active);
          test.equal(instance.exit_reason, 'reason');
          test.equal(instance.exit_data.test, 'data');
          test.done();
        }
      );
    }
  );
  
  
}

