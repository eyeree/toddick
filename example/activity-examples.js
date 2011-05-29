var toddick = require('toddick');
var activity = require('toddick/lib/activity');

var example = exports;

toddick( 'FooProducer', module,
  {
    
    INIT: function(spec, MSG) {
      
      this.supervisor = this.link( 
        new activity.Transient(
          {
            retry:         'on-error',
            max_retries:   3,
            retry_delay:   1000,
            retry_backoff: 'exponential'
          }
        )
      );
      this.MSG = MSG;
      this.count = spec.length;
      this.parts = [];
      
      for(var i = 0; i < spec.length; ++i) {
        new example.BarProducer(spec[i], this.PART.withArgs(i));
      }
      
    },
    
    PART: function(index, part) {
      
      this.parts[index] = part;
      
      if(--count == 0) {
        MSG(this.parts);
      }
      
    }
    
  }
);

toddick( 'BarProducer', module,
  {
    INIT: function(base, MSG) {
      var delay = base + Math.floor(Math.random() * (500 - 100 + 1) + 100);
      this.link( new timer.Timeout(delay, MSG.withArgs(delay)) );
    },
  }
);

var Owner = toddick(
  {
    
    INIT: function() {
      this.supervisor = this.link( 
        new activity.Pool(
          {
            pool_size:      10,
            restart_max:     5,
            restart_time: 2000
          },
          example.FooProducer
        )
      );
    },
    
    NEED_FOO: function(options, MSG) {
      this.supervisor.START(example.FooProducer, spec, MSG);
    }
    
  }
);

var  
