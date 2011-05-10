var toddick = require('toddick');
var dispatch = require('toddick/lib/dispatch');
var timer = require('toddick/lib/timer');

exports.Hello = toddick(
  {

    init: function () {
      this.state.count = 5;
      this.state.distributor = this.link(new dispatch.Distributor('greeter'));
      this.link(new timer.Interval(2000, this.self.greet));
    },

    greet: function () {
      if (this.state.count-- > 0) {
        this.state.distributor.distribute('hello');
      } else {
        this.exit();
      }
    }

  }
);


exports.World = toddick(
  {

    init: function() {
      this.monitor(new dispatch.Receiver('greeter', this.self.greeting));
    },
    
    greeting: function(greeting) {
      console.log(greeting + ' world!');
    }

  }
);


toddick.register( module );


var hw2 = require('toddick/example/hello-world-2');

new hw2.Hello();
new hw2.World();
new hw2.World();
