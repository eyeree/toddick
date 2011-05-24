var toddick = require('toddick');

var HelloWorld = toddick(
  {
    SAY_HELLO: function() {
      console.log("hello world!");
    }
  }
);

var hello_world = new HelloWorld();

hello_world.SAY_HELLO();
