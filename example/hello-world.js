var toddick = require('toddick');

var HelloWorld = toddick(
  {
    sayHello: function() {
      console.log("hello world!");
    }
  }
);

var hello_world = new HelloWorld();

hello_world.sayHello();
