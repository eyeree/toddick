var toddick = require('toddick');

var HelloWorld = toddick(
  {
    init: function() {
      console.log("hello world!");
    }
  }
);

new HelloWorld();
