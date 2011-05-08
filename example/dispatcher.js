var toddick = require('toddick');

var Dispatcher = require('toddick/lib/common').Dispatcher;

exports.Hello = function() {

  var dispatcher;
  var count = 5;

  return {

    init: function () {
      dispatcher = new Dispatcher();
      dispatcher.register('greeter');
      this.link(dispatcher);
      this.repeat(this.self.greet, 2000);
    },

    greet: function () {
      if (count-- > 0) {
        dispatcher.dispatch('hello');
      } else {
        this.exit();
      }
    }

  };

}

exports.World = function() {

  return {

    init: function() {
      var greeter = this.find('greeter');
      this.monitor(greeter, this.self.exit);
      greeter.subscribe(this.self.greeting);
    },

    greeting: function(greeting) {
      this.trace(greeting + ' world!');
    }

  };

}

toddick( module );

var example = require('toddick/examples/example-2');

new exports.Hello();
new exports.Wolrd();
new exports.World();



toddick( module,
  {

    Dispatcher: function() {

      var subscriptions = {};

      return {

        subscribe: function(msg) {
          subscriptions[msg.id] = msg;
          this.monitor(msg.toddick, this.unsubscribe, msg);
        }

        unsubscribe: function(msg) {
          delete subscriptions[msg.id];
          this.unmonitor(msg.toddick, this.unsubscribe);
        }

        dispatch: function(data) {
          for id in subscriptions {
            subscriptions[id](data);
          }
        }

      }

    },

    Hello: function() {

      var dispatcher;
      var count = 5;

      return {

        init: function () {
          dispatcher = new Dispatcher();
          dispatcher.register('greeter');
          this.link(dispatcher);
          this.repeat(this.self.greet, 2000);
        },

        greet: function () {
          if (count-- > 0) {
            dispatcher.dispatch('hello');
          } else {
            this.exit();
          }
        }

      };

    },

    World: function() {

      return {

        init: function() {
          var greeter = this.find('greeter');
          this.monitor(greeter, this.self.exit);
          greeter.subscribe(this.self.greeting);
        },

        greeting: function(greeting) {
          this.trace(greeting + ' world!');
        }

      };

    }

  }

);

