//
// Dispatch messages to multiple subscribers.
//

var toddick = require('./toddick');

// ## Toddick: Distributor
//
// Allows data to be sent to a set of subscribers.
//
//     distributor = new dispatch.Distributor( name )
//
// *name* - The name the distributor will be registed using.
//
toddick( 'Distributor', module,
  {
  
    // ### Message: distributor.init
    //
    // Initializes the toddick with arguments from the constructor.
    //
    init: function(name) {
      this.state.subscriptions = {};
      this.register(name);
    },

    // ### Message: distributor.subscribe
    //
    // Registers a message to be sent when distribute message is recieved.
    //
    //     ditributor.subscribe( msg )
    //
    // *msg* - The message that will be sent.
    //
    // The subscriber is automatically unsubscribed when it exits.
    //
    subscribe: function(msg) {
      this.state.subscriptions[msg.id] = msg;
      this.monitor(msg.self, this.self.unsubscribe, [msg]);
    },

    // ### Message: distributor.unsubscribe
    //
    // Deregisters a previsouly subscribed message.
    //
    //     ditributor.unsubscribe( msg )
    //
    // *msg* - The message to be unsubscribed.
    //
    unsubscribe: function(msg) {
      delete this.state.subscriptions[msg.id];
      this.unmonitor(msg.self, this.self.unsubscribe);
    },

    // ### Message: distributor.distribute
    //
    // Sends provided data to all subscribers.
    //
    //     ditributor.distribute( data )
    //
    // *data* - The data to send to all subscribers.
    //
    distribute: function(data) {
      var id;
      for(id in this.state.subscriptions) {
        this.state.subscriptions[id](data);
      }
    }

  }
);

// ## Toddick: Receiver
//
// Subscribes to messages from a Dispatcher.
//
//     receiver = new dispatch.Receiver( name, msg )
//
// *name* - The name used to register the dispatcher.
// *msg* - The message to be sent by the dispatcher.
//
toddick( 'Receiver', module,
  {
    
    // ### Message: receiver.init
    //
    // Initializes the toddick with arguments from the constructor.
    //
    init: function(name, msg) {
      var distributor = this.monitor(name);
      distributor.subscribe(msg);
    }
    
  }
);

