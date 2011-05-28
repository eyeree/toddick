var toddick = require('toddick');
var remote = require('toddick/lib/remote/http');

var PingPong = toddick(
  {
    PING: function(PONG) {
      PONG();
    }
  }
);

var Pinger = toddick(
  {
    PING: function(pingpong) {
      pingpong.PING(this.PONG);
    },
    PONG: function() {
      console.log("PONG!");
    }
  }
);

new remote.HttpPortal(8910).PUBLISH("/pingpong", new PingPong());

new remote.HttpPortal(8911).PROXY("http://localhost:8910/pingpong", new Pinger().PING);
