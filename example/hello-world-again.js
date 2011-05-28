var toddick = require('toddick');
var dispatch = require('toddick/lib/dispatch');
var timer = require('toddick/lib/timer');

toddick.trace_enabled = true;

var World = toddick('World', module,
  {
    INIT: function () {
      this.count = 3;
      this.distributor = this.link(new dispatch.Distributor('greeter'));
      this.link(new timer.Interval(1000, this.GREET));
    },
    GREET: function () {
      if (this.count-- > 0) {
        this.distributor.DISTRIBUTE('the world says hello!');
      } else {
        this.exit();
      }
    }
  }
);

var Person = toddick('Person', module,
  {
    INIT: function(name) {
      this.name = name;
      this.link(new dispatch.Receiver('greeter', this.GREETING));
    },
    GREETING: function(greeting) {
      console.log(this.name + ", " + greeting);
    }
  }
);

var world = new World();
var john = new Person('John');
var mary = new Person('Mary');
