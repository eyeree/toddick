//
// Sends messages using timers.
//
var toddick = require('./toddick');

// ## Toddick: Interval
//
// Repeatdly sends a message on an interval.
//
//     interval = new timer.Interval( delay, msg [, args ] )
//
// *delay* - Number of milliseconds to delay before sending each message.
//
// *msg* - The messsage to send.
//
// *args* - An array of arguments to send with the message.
//
toddick( 'Interval', module,
  {
    
    // ### Message: interval.init
    //
    // Initializes the toddick with the constructor arguments.
    //
    init: function(delay, msg, args) {
      this.monitor(msg.self);
      this.state.interval_id = setInterval(
        function() {
          msg.apply(null, args);
        },
        delay
      );
    },
    
    // ### Message: interval.exit
    //
    // Cancels the interval timer and exits.
    //
    exit: function(reason) {
      clearInterval(this.state.interval_id);
      this.exit(reason);
    }
    
  }
);

// ## Toddick: Timeout
//
// Sends a single message after a delay.
//
//     timeout = new timer.Timeout( delay, msg [ , args ] )
//
// *delay* - Number of milliseconds to delay before sending the message.
//
// *msg* - The message to send.
//
// *args* - An array of arguments to send with the message.
//
toddick( 'Timeout', module,
  {
    
    // ### Message: timeout.init
    //
    // Initializes the toddick using the constructor arguments.
    //
    init: function(delay, msg, args) {
      this.monitor(msg.self);
      this.state.timeout_id = setTimeout(
        function() {
          msg.apply(null, args);
          this.state.timeout_id = undefined;
          this.exit();
        },
        delay
      );
    },
    
    // ### Message: timeout.exit
    //
    // Cancels the timeout timer and exits.
    //
    exit: function(reason) {
      if(this.state.timeout_id) {
        clearTimeout(this.state.timeout_id);
      }
      this.exit(reason);
    }
    
  }
);
