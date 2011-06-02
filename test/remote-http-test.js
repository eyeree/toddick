var toddick = require('../lib/toddick');
var remote = require('../lib/remote-http');
var activity = require('../lib/activity');
var http = require('http');

var test_port = 8910;
var test_url_base = "http://localhost:" + test_port + "/";

exports.portal_works = function(test) {
  
  test.expect( 1 );
  
  var p1, p2;
  
  var PingPong = toddick(
    {
      PING: function(PONG) {
        test.ok( true );
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
        
        p1.EXIT();
        p2.EXIT();
        
        test.done();
        
      }
    }
  );
  
  p1 = new remote.Portal(8910);
  p1.PUBLISH("pingpong", new PingPong());

  p2 = new remote.Portal(8911);
  p2.PROXY("http://localhost:8910/pingpong", new Pinger().PING);
  
}

exports.remote_monitor_works = function(test) {

  test.expect( 0 );
  
  var p1, p2;
  
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
        this.monitor( pingpong, this.EXITED );
        pingpong.EXIT();
      },     
      EXITED: function() {
        p1.EXIT();
        p2.EXIT();
        test.done();
      }
    }
  );
  
  p1 = new remote.Portal(8910);
  p1.PUBLISH("/pingpong", new PingPong());

  p2 = new remote.Portal(8911);
  p2.PROXY("http://localhost:8910/pingpong", new Pinger().PING);
  
}

exports.remote_exit_returns_args = function(test) {

  test.expect( 2 );
    
  var p1, p2;
  
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
        this.monitor( pingpong, this.EXITED );
        pingpong.EXIT( 'test-reason', { test: 'data' } );
      },     
      EXITED: function( reason, data ) {
        p1.EXIT();
        p2.EXIT();
        test.equal( 'test-reason', reason );
        test.deepEqual( { test: 'data' }, data );
        test.done();
      }
    }
  );
  
  p1 = new remote.Portal(8910);
  p1.PUBLISH("/pingpong", new PingPong());

  p2 = new remote.Portal(8911);
  p2.PROXY("http://localhost:8910/pingpong", new Pinger().PING);
  
}

exports.proxy_message_withArgs_works = function(test) {

  test.expect( 2 );
    
  var p1, p2;
  
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
        pingpong.PING(this.PONG.withArgs( 1, 2 ));
      },     
      PONG: function(a, b) {
        
        p1.EXIT();
        p2.EXIT();
        
        test.equal( a, 1 );
        test.equal( b, 2 );
        
        test.done();
        
      }
    }
  );
  
  p1 = new remote.Portal(8910);
  p1.PUBLISH("pingpong", new PingPong());

  p2 = new remote.Portal(8911);
  p2.PROXY("http://localhost:8910/pingpong", new Pinger().PING);

}
