var toddick = require('toddick');
var timer = require('toddick/lib/timer');

toddick.trace_enabled = true;

exports.World = toddick(
  {
    init: function() {
      this.state.count = 5;
    },
    greet: function(greeting) {
      console.log(greeting + ' world!');
      if(--this.state.count == 0) {
        this.exit('all done');
      }
    }
  }
);

exports.Greeter = toddick(
  {
    init: function (target, greeting) {
      this.state.target = this.monitor(target);
      this.link(new timer.Interval(1000, this.self.greet, [greeting]));
    },
    greet: function (greeting) {
      this.state.target.greet(greeting);
    }
  }
);

toddick.setTypeNames(module);

var world = new exports.World();
var hello = new exports.Greeter(world, 'hello');
var howdy = new exports.Greeter(world, 'howdy');
