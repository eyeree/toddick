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
      this.MSG = MSG;
      this.interval_id = setInterval( this.INTERVAL.sync, delay );
    },
    
    // ### Message: INTERVAL
    //
    // Sent when the interval timeout occurs.
    //
    INTERVAL: function() {
      this.MSG();
    },
    
    // ### Message: EXIT
    //
    // Cancels the interval timer and exits.
    //
    EXIT: function(reason, data) {
      clearInterval(this.interval_id);
      this.exit(reason, data);
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
    
    // ### Message: INIT
    //
    // Initializes the toddick using the constructor arguments.
    //
    INIT: function(delay, MSG) {
      this.monitor(MSG.toddick);
      this.MSG = MSG;
      this.timeout_id = setTimeout( this.TIMEOUT.sync, delay);
    },
    
    // ### Message: TIMEOUT
    //
    // Sent when the tiemout occurs.
    //
    TIMEOUT: function() {
      this.MSG();
      this.timeout_id = undefined;
    },
    
    // ### Message: timeout.exit
    //
    // Cancels the timeout timer and exits.
    //
    EXIT: function(reason, data) {
      if(this.timeout_id) {
        clearTimeout(this.timeout_id);
        this.timeout_id = undefined;
      }
      this.exit(reason, data);
    }
    
  }
);


