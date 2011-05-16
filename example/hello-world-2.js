var tmp = require('toddick');
var dispatch = require('toddick/lib/dispatch');
var timer = require('toddick/lib/timer');

tmp.trace_enabled = true;

function toddick( name, module, scope, handlers ) {
  
  if(typeof handlers === 'undefined') {
    handlers = scope;
    scope = global;
  }
  
  if(typeof handlers === 'undefined') {
    handlers = module;
    module = undefined;
  }
  
  var typeName = name;

  if(typeof module === 'object') {
    typeName = tmp.makeTypeName(module, name, null);
  }
  
  scope[name] = tmp(handlers);
  scope[name].setTypeName(typeName);
 
}

var internal = {};

toddick( 'Hello', module, internal,
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


toddick( 'World', module, internal,
  {
    init: function() {
      this.monitor(new dispatch.Receiver('greeter', this.self.greeting));
    },
    greeting: function(greeting) {
      console.log(greeting + ' world!');
    }
  }
);

//require('./test');

var hello = new internal.Hello();
var world1 = new internal.World();
var world2 = new internal.World();

console.log("****** module", module);
