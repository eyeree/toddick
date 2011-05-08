var toddick = require('./toddick');
var registry = require('./registry');

var dispatch = exports;

dispatch.Distributor = toddick(
  {
    
    init: function(name) {
      this.state.subscriptions = {};
      registry.register(this.self, name);
    },

    subscribe: function(msg) {
      this.state.subscriptions[msg.id] = msg;
      this.monitor(msg.self, this.unsubscribe, [msg]);
    },

    unsubscribe: function(msg) {
      delete this.state.subscriptions[msg.id];
      this.unmonitor(msg.self, this.unsubscribe);
    },

    dispatch: function(data) {
      var id;
      for(id in this.state.subscriptions) {
        this.state.subscriptions[id](data);
      }
    }

  }
);

dispatch.Receiver = toddick(
  {
    init: function(msg, name) {
      var distributor = this.link(name);
      distributor.subscribe(msg);
    },
  }
);

toddick.register( module );
