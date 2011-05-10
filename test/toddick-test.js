var toddick = require('../lib/toddick');

toddick.trace_enabled = false;

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

exports.register_sets_type_name = function(test) {
  test.expect(1);
  var constructor = toddick( {} );
  var mock_mod = {
    filename: '/test/filename.ext',
    exports: {
      Test: constructor
    }
  };
  toddick.register(mock_mod);
  var instance = new constructor();
  test.ok(/^filename.Test:\d+$/, instance.id);
  test.done();
}

exports.constructor_sends_initialize = function(test) {
  
  test.expect(3);
  
  var was_async = false;
  
  var constructor = toddick(
    {
      init: function(a, b) {
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
      msg: function(a, b) {
        test.equal(a, 'a');
        test.equal(b, 'b');
        test.ok(was_async);
        test.done();
      }
    }
  );
  
  var instance = new constructor();
  
  instance.msg('a', 'b');
   
  was_async = true;
   
}

exports.dispatcher_id_is_unique = function(test) {
  
  test.expect(15);
  
  var constructor_a = toddick( 
    {
      msg_a: function() {},
      msg_b: function() {}
    }
  );
  
  var constructor_b = toddick( 
    {
      msg_a: function() {},
      msg_b: function() {}
    }
  );
  
  var instance_a_1 = new constructor_a();
  var instance_a_2 = new constructor_a();
  var instance_b_1 = new constructor_b();
  var instance_b_2 = new constructor_b();
  
  test.ok(instance_a_1.msg_a.id);
  test.ok(instance_a_1.msg_b.id);
  test.ok(instance_a_2.msg_a.id);
  test.ok(instance_a_2.msg_b.id);
  test.ok(instance_b_1.msg_a.id);
  test.ok(instance_b_1.msg_b.id);
  test.ok(instance_b_2.msg_a.id);
  test.ok(instance_b_2.msg_b.id);
  
  test.notEqual(instance_a_1.msg_a.id, instance_a_1.msg_b.id);
  test.notEqual(instance_a_1.msg_a.id, instance_a_2.msg_a.id);
  test.notEqual(instance_a_1.msg_a.id, instance_a_2.msg_b.id);
  test.notEqual(instance_a_1.msg_a.id, instance_b_1.msg_a.id);
  test.notEqual(instance_a_1.msg_a.id, instance_b_1.msg_b.id);
  test.notEqual(instance_a_1.msg_a.id, instance_b_2.msg_a.id);
  test.notEqual(instance_a_1.msg_a.id, instance_b_2.msg_b.id);
  
  test.done();
  
}

exports.handler_self_is_toddick = function (test) {
  
  test.expect(1);
  
  var constructor = toddick(
    {
      init: function() {
        test.deepEqual(this.self, instance);
        test.done();
      }
    }
  );
  
  var instance = new constructor();
  
}

exports.dispatcher_self_is_toddick = function (test) {
  
  test.expect(1);
  
  var constructor = toddick(
    {
      msg: function() {}
    }
  );
  
  var instance = new constructor();
  
  test.deepEqual(instance.msg.self, instance);
  test.done();
  
}

exports.state_is_preserved = function (test) {
  
  test.expect(1);
  
  var constructor = toddick(
    {
      init: function() {
        this.state.test = 1;
      },
      
      msg: function() {
        test.equal(this.state.test, 1);
        test.done();
      }
    }
  );
  
  var instance = new constructor();
  instance.msg();
  
}

exports.exit_makes_inactive = function (test) {
  
  test.expect(2);
  
  var constructor = toddick(
    {
      msg: function() {
        this.exit();
        test.ok(!instance.is_active);
        test.done();
      }
    }
  );
  
  var instance = new constructor();
  
  test.ok(instance.is_active);
  
  instance.msg();
  
}

exports.messages_ignored_when_inactive = function (test) {
  
  test.expect(0);
  
  var constructor = toddick(
    {
      init: function() {
        this.exit();
      },
      
      msg: function() {
        test.ok(false);
      }
    }
  );
  
  var instance = new constructor();
  
  instance.msg();
  
  process.nextTick(
    function () {
      test.done();
    }
  );
  
}

exports.has_exit_dispatcher = function(test) {
  
  test.expect(1);
  
  var constructor = toddick(
    {
    }
  );
  
  var instance = new constructor();
  
  instance.exit('test reason');
  
  process.nextTick(
    function() {
      test.ok(!instance.is_active);
      test.done();
    }
  );
  
}
  
exports.exception_sends_exit = function(test) {
  
  test.expect(1);
  
  var error = new Error('test exception');
  
  var constructor = toddick(
    {
      msg: function() {
        throw error;
      },
      exit: function(reason) {
        this.exit(reason);
        test.deepEqual(reason, error);
        test.done();
      }
    }
  );
  
  var instance = new constructor();
  
  instance.msg();
  
}

exports.monitor_sends_exit = function(test) {

  test.expect(0);
  
  var constructor_1 = toddick(
    {
      msg: function() {
        this.exit('test reason');
      }
    }
  );
  
  var constructor_2 = toddick(
    {
      
      init: function(target) {
        this.monitor(target);
        target.msg();
      },
      
      exit: function(reason) {
        this.exit(reason);
        test.done();
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
      msg: function() {
        this.exit('test reason');
      }
    }
  );
  
  var constructor_2 = toddick(
    {
      
      init: function(target) {
        this.monitor(target, this.self.msg, ['a', 'b']);
        target.msg();
      },
      
      msg: function(a, b) {
        test.equal(a, 'a');
        test.equal(b, 'b');
        test.done();
      }
      
    }
  );
  
  var instance_1 = new constructor_1();
  var instance_2 = new constructor_2(instance_1);

}

exports.monitor_inactive_sends_msg = function(test) {
  
  test.expect(0);
  
  var constructor_1 = toddick(
    {
      init: function(target) {
        this.exit();
      }
    }
  );
  
  var constructor_2 = toddick(
    {
      
      init: function(target) {
        this.monitor(target, this.self.msg);
      },
      
      msg: function() {
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
      init: function(target) {
        this.link(target);
        target.exit('test reason');
      },
      exit: function(reason) {
        this.exit(reason);
        test.done();
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
      exit: function(reason) {
        this.exit(reason);
        test.done();
      }
    }
  );
  
  var constructor_2 = toddick(
    {
      init: function(target) {
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
      init: function() {
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
  
  test.expect(5);
  
  var constructor = toddick(
    {
      init: function() {
        
        this.register('a');
        
        test.deepEqual(instance, toddick.tryFind('a'));
        test.deepEqual(instance, toddick.tryFind('b'));
        test.deepEqual(instance, toddick.find('a'));
        test.deepEqual(instance, this.find('a'));
        test.deepEqual(instance, this.tryFind('a'));
        
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
  
  instance.exit();
  
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
      init: function() {
        
        this.register('d');
        
        test.deepEqual(instance, toddick.tryFind('d'));
        test.deepEqual(instance, toddick.tryFind('e'));
        
        this.unregister('e');
        instance.unregister('d');
        
        test.equal(undefined, toddick.tryFind('d'));
        test.equal(undefined, toddick.tryFind('e'));
        
        this.exit();
  
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
      init: function() {
        this.register('f');
      }
    }
  );
  
  var constructor_2 = toddick(
    {
      init: function() {
        this.state.target = this.monitor('f');
        test.deepEqual(this.state.target, instance_1);
        this.self.msg1();
      },
      
      msg1: function() {
        this.unmonitor('f');
        this.state.target.exit();
        this.self.msg2();
      },
      
      msg2: function() {
        this.self.msg3();
      },
      
      msg3: function() {
        test.done();
      },
      
      exit: function() {
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
      init: function() {
        this.register('g');
      }
    }
  );
  
  var constructor_2 = toddick(
    {
      init: function() {
        this.state.target = this.monitor('g');
        test.deepEqual(this.state.target, instance_1);
        this.self.msg1();
      },
      
      msg1: function() {
        this.state.target.exit();
      },
      
      exit: function() {
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
      init: function() {
        this.register('h');
      }
    }
  );
  
  var constructor_2 = toddick(
    {
      init: function() {
        this.state.target = this.link('h');
        test.deepEqual(this.state.target, instance_1);
        this.self.msg1();
      },
      
      msg1: function() {
        this.state.target.exit();
      },
      
      exit: function() {
        test.done();
      }
    }
  );
  
  var instance_1 = new constructor_1();
  var instance_2 = new constructor_2();
      
}

