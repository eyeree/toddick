var toddick = require('toddick');
var dispatch = require('toddick/lib/dispatch');
var timer = require('toddick/lib/timer');

toddick.trace_enabled = true;

var World = toddick('World',
  {
    init: function () {
      this.state.count = 3;
      this.state.distributor = this.link(new dispatch.Distributor('greeter'));
      this.link(new timer.Interval(1000, this.self.greet));
    },
    greet: function () {
      if (this.state.count-- > 0) {
        this.state.distributor.distribute('the world says hello!');
      } else {
        this.exit();
      }
    }
  }
);

var Person = toddick('Person',
  {
    init: function(name) {
      this.state.name = name;
      this.link(new dispatch.Receiver('greeter', this.self.greeting));
    },
    greeting: function(greeting) {
      console.log(this.state.name + ", " + greeting);
    }
  }
);

var world = new World();
var john = new Person('John');
var mary = new Person('Mary');
