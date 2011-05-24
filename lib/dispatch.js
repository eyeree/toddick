//
// Dispatch messages to multiple subscribers.
//
//     var dispatch = require('toddick/lib/dispatch');
//
//     var Source = toddick(
//       {
//         INIT: function () {
//           this.distributor = this.link(
//             new dispatch.Distributor('the source')
//           );
//         },
//         DISTRIBUTE: function () {
//           this.distributor.distribute(
//             'the time is: ' + new Date()
//           );
//         }
//       }
//     );
//
//     var Destination = toddick(
//       {
//         INIT: function() {
//           this.link(
//             new dispatch.Receiver('the source', this.RECEIVE)
//           );
//         },
//         RECEIVE: function(something) {
//           console.log(something);
//         }
//       }
//     );
//
//     var source = new Source();
//     var destination1 = new Destination();
//     var destination2 = new Destination();
//     source.DISTRIBUTE();
//

var toddick = require('./toddick');

// ## Toddick: Distributor
//
// Allows data to be sent to a set of subscribers.
//
//     distributor = new dispatch.Distributor( [ name ] )
//
// *name* - The name the distributor will be registed using.
//
toddick( 'Distributor', module,
  {
  
    // ### Message: INIT
    //
    // Initializes the toddick with arguments from the constructor.
    //
    INIT: function(name) {
      this.subscriptions = {};
      if(name) {
        this.register(name);
      }
    },

    // ### Message: SUBSCRIBE
    //
    // Registers a message to be sent when distribute message is recieved.
    //
    //     ditributor.SUBSCRIBE( MSG )
    //
    // *MSG* - The message that will be sent.
    //
    // The subscriber is automatically unsubscribed when it exits.
    //
    SUBSCRIBE: function(MSG) {
      this.subscriptions[MSG.id] = MSG;
      this.monitor(MSG.toddick, this.UNSUBSCRIBE.withArgs(MSG));
    },

    // ### Message: UNSUBSCRIBE
    //
    // Deregisters a previsouly subscribed message.
    //
    //     ditributor.UNSUBSCRIBE( MSG )
    //
    // *MSG* - The message to be unsubscribed.
    //
    UNSUBSCRIBE: function(MSG) {
      delete this.subscriptions[MSG.id];
      this.unmonitor(MSG.toddick, this.UNSUBSCRIBE);
    },

    // ### Message: DISTRIBUTE
    //
    // Sends provided data to all subscribers.
    //
    //     ditributor.DISTRIBUTE( data )
    //
    // *data* - The data to send to all subscribers.
    //
    DISTRIBUTE: function(data) {
      for(var id in this.subscriptions) {
        var MSG = this.subscriptions[id];
        MSG(data);
      }
    }

  }
);

// ## Toddick: Receiver
//
// Subscribes to messages from a Dispatcher.
//
//     receiver = new dispatch.Receiver( source, MSG )
//
// *source* - The name used to register the distributor or the distributor itself.
//
// *MSG* - The message to be sent by the distributor.
//
toddick( 'Receiver', module,
  {
    
    // ### Message: INIT
    //
    // Initializes the toddick with arguments from the constructor.
    //
    INIT: function(source, MSG) {
      var distributor = this.monitor(source);
      distributor.SUBSCRIBE(MSG);
    }
    
  }
);

