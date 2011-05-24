//
// Sends messages on interval or timeout.
//
//     var toddick = require('toddick/lib/timer');
//
//     var TickTock = toddick(
//       {
//         INIT: function() {
//           this.timeout = new timer.Timeout(1000, this.TICK);
//           this.interval = new timer.Interval(1000, this.TOCK);
//         },
//         TICK: function() {
//           console.log('tick');
//         },
//         TOCK: function() {
//           console.log('tock');
//         },
//         CANCEL: function() {
//           this.interval.exit();
//           this.timeout.exit();
//         }
//       }
//     );
//
//     var ticktock = new TickTock();
//     ...
//     ticktock.CANCEL();
//

var toddick = require('./toddick');

// ## Toddick: Interval
//
// Repeatdly sends a message on an interval.
//
//     interval = new timer.Interval( delay, MSG )
//
// *delay* - Number of milliseconds to delay before sending each message.
//
// *MSG* - The messsage to send.
//
toddick( 'Interval', module,
  {
    
    // ### Message: INIT
    //
    // Initializes the toddick with the constructor arguments.
    //
    INIT: function(delay, MSG) {
      this.monitor(MSG.toddick);
      this.interval_id = setInterval(
        function() {
          MSG();
        },
        delay
      );
    },
    
    // ### Message: EXIT
    //
    // Cancels the interval timer and exits.
    //
    EXIT: function(reason) {
      clearInterval(this.interval_id);
      this.exit(reason);
    }
    
  }
);

// ## Toddick: Timeout
//
// Sends a single message after a delay.
//
//     timeout = new timer.Timeout( delay, MSG )
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
    init: function(delay, MSG) {
      this.monitor(MSG.toddick);
      this.timeout_id = setTimeout(
        function() {
          MSG();
          this.timeout_id = undefined;
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
      if(this.timeout_id) {
        clearTimeout(this.timeout_id);
      }
      this.exit(reason);
    }
    
  }
);


