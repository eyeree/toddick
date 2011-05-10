var toddick = require('./toddick');

var timer = exports;


timer.Interval = toddick(
  {
    
    init: function(delay, msg, args) {
      this.state.interval_id = setInterval(
        function() {
          msg.apply(null, args);
        },
        delay
      );
    },
    
    exit: function(reason) {
      clearInterval(this.state.interval_id);
      this.exit(reason);
    }
    
  }
);

timer.Timeout = toddick(
  {
    
    init: function(delay, msg, args) {
      this.state.timeout_id = setTimeout(
        function() {
          msg.apply(null, args);
        },
        delay
      );
    },
    
    exit: function(reason) {
      clearTimeout(this.state.timeout_id);
      this.exit(reason);
    }
    
  }
);

toddick.register(module);
