var toddick = require('../lib/toddick');
var activity = require('../lib/activity');
var timer = require('../lib/timer');

exports.super_starts_toddick = function(test) {
  
  test.expect(2);
  
  var T = toddick(
    {
      INIT: function(a, b) {
        test.equal(a, 1);
        test.equal(b, 2);
        test.done();
      }
    }
  );
  
  var s = new activity.Supervisor(
    {
      toddick: T
    }
  );
  
  s.START(1, 2);
  
}

exports.super_default_exits_if_error = function(test) {
  
  test.expect( 0 );
  
  var T = toddick(
    {
      INIT: function() {
        this.exit('test-error');
      }
    }
  );
  
  var O = toddick(
    {
      INIT: function() {
        var s = this.monitor(
          new activity.Supervisor(
            {
              toddick: T
            }
          ),
          this.EXITED
        );
        s.START();
      },
      
      EXITED: function() {
        test.done();
      }
    }
  );
  
  var o = new O();
  
}

exports.super_default_does_not_exit_if_no_error = function(test) {
  
  test.expect( 0 );
  
  var T = toddick(
    {
      INIT: function() {
        this.exit();
      }
    }
  );
  
  var O = toddick(
    {
      INIT: function() {
        var s = this.monitor(
          new activity.Supervisor(
            {
              toddick: T
            }
          ),
          this.EXITED
        );
        s.START();
        this.A();
      },
      
      A: function() {
        this.B();
      },
      
      B: function() {
        test.done();
      },
      
      EXITED: function() {
        test.ok(false);
      }
    }
  );
  
  var o = new O();
  
}

exports.super_on_error_exits_if_error = function(test) {
  
  test.expect( 0 );
  
  var T = toddick(
    {
      INIT: function() {
        this.exit('test-error');
      }
    }
  );
  
  var O = toddick(
    {
      INIT: function() {
        var s = this.monitor(
          new activity.Supervisor(
            {
              toddick: T,
              restart: activity.Supervisor.restart.on_error
            }
          ),
          this.EXITED
        );
        s.START();
      },
      
      EXITED: function() {
        test.done();
      }
    }
  );
  
  var o = new O();
  
}

exports.super_on_error_does_not_exit_if_no_error = function(test) {
  
  test.expect( 0 );
  
  var T = toddick(
    {
      INIT: function() {
        this.exit();
      }
    }
  );
  
  var O = toddick(
    {
      INIT: function() {
        var s = this.monitor(
          new activity.Supervisor(
            {
              toddick: T,
              restart: activity.Supervisor.restart.on_error
            }
          ),
          this.EXITED
        );
        s.START();
        this.A();
      },
      
      A: function() {
        this.B();
      },
      
      B: function() {
        test.done();
      },
      
      EXITED: function() {
        test.ok(false);
      }
    }
  );
  
  var o = new O();
  
}

exports.super_always_exits_if_error = function(test) {
  
  test.expect( 0 );
  
  var T = toddick(
    {
      INIT: function() {
        this.exit('test-error');
      }
    }
  );
  
  var O = toddick(
    {
      INIT: function() {
        var s = this.monitor(
          new activity.Supervisor(
            {
              toddick: T,
              restart: activity.Supervisor.restart.always
            }
          ),
          this.EXITED
        );
        s.START();
      },
      
      EXITED: function() {
        test.done();
      }
    }
  );
  
  var o = new O();
  
}

exports.super_always_exits_if_no_error = function(test) {
  
  test.expect( 0 );
  
  var T = toddick(
    {
      INIT: function() {
        this.exit();
      }
    }
  );
  
  var O = toddick(
    {
      INIT: function() {
        var s = this.monitor(
          new activity.Supervisor(
            {
              toddick: T,
              restart: activity.Supervisor.restart.always
            }
          ),
          this.EXITED
        );
        s.START();
      },
      
      EXITED: function() {
        test.done();
      }
    }
  );
  
  var o = new O();
  
}

exports.super_applies_default_restart_limit = function(test) {
  
  test.expect( 0 );
  
  var T = toddick(
    {
      INIT: function() {
        this.exit('test-error');
      }
    }
  );
  
  var O = toddick(
    {
      INIT: function() {
        var s = this.monitor(
          new activity.Supervisor(
            {
              toddick: T,
              restart: activity.Supervisor.restart.always
            }
          ),
          this.EXITED
        );
        s.START();
      },
      
      EXITED: function() {
        test.done();
      }
    }
  );
  
  var o = new O();
  
}

exports.super_applies_restart_limit = function(test) {
  
  test.expect( 4 );
  
  var T = toddick(
    {
      INIT: function() {
        test.ok( true );
        this.exit('test-error');
      }
    }
  );
  
  var O = toddick(
    {
      INIT: function() {
        var s = this.monitor(
          new activity.Supervisor(
            {
              toddick: T,
              restart_limit: 3,
              restart: activity.Supervisor.restart.always
            }
          ),
          this.EXITED
        );
        s.START();
      },
      
      EXITED: function() {
        test.done();
      }
    }
  );
  
  var o = new O();

}

exports.super_exits_on_restarts_in_period = function(test) {
  
  test.expect( 4 );
  
  var T = toddick(
    {
      INIT: function() {
        test.ok( true );
        this.exit('test-error');
      }
    }
  );
  
  var O = toddick(
    {
      INIT: function() {
        var s = this.monitor(
          new activity.Supervisor(
            {
              toddick:        T,
              restart_limit:  3,
              restart_period: 50,
              restart_factor: 1,
              restart_delay:  10,
              restart: activity.Supervisor.restart.always
            }
          ),
          this.EXITED
        );
        s.START();
      },
      
      EXITED: function() {
        test.done();
      }
    }
  );
  
  var o = new O();
  
}

exports.super_does_not_exit_on_restarts_out_of_period = function(test) {
  
  var count = 0;
  
  var T = toddick(
    {
      INIT: function() {
        test.ok( true );
        if( ++count < 10 ) {
          this.exit('test-error');
        }
      }
    }
  );
  
  var O = toddick(
    {
      INIT: function() {
        var s = this.monitor(
          new activity.Supervisor(
            {
              toddick:        T,
              restart_limit:  6,
              restart_period: 50,
              restart_factor: 1,
              restart_delay:  10,
              restart: activity.Supervisor.restart.always
            }
          ),
          this.EXITED
        );
        s.START();
        this.s = s;
        new timer.Timeout( 100, this.EXIT );
      },
      
      EXITED: function() {
        test.ok( false );
      },
      
      EXIT: function() {
        this.unmonitor( this.s, this.EXITED );
        this.s.EXIT();
        test.done();
      }
      
    }
  );
  
  var o = new O();
  
}

