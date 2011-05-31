var toddick = require('../lib/toddick');
var remote = require('../lib/remote-http');
var activity = require('../lib/activity');
var http = require('http');

var test_port = 8910;
var test_url_base = "http://localhost:" + test_port + "/";

var TestServer = toddick(
  {
    
    INIT: function( READY, RECEIVED, response, content_type ) {
      
      var server = http.createServer();

      server.on('request',

        function(req, res) {
          
          var content = '';
          
          req.on('data',
            function(chunk) {
              content += chunk;
            }
          );
          
          req.on('end', 
            function() {
              res.setHeader('Content-Type', content_type);
              res.end(JSON.stringify(response));
              var json = undefined;
              if( content.length > 0 ) {
                json = JSON.parse(content);
              }
              RECEIVED( req.method, req.headers['content-type'], req.headers['accept'], json );
            }
          );
          
          req.on('close',
            function (err) {
              if( err ) {
                console.log('request closed with error: ', err);
              }
            }
          );
              
        }
        
      );

      server.on( 'close', 
        function (errno) {
          if( errno ) {
            console.log("server closed with error", errno);
          }
        }
      );

      server.on( 'clientError',
        function (exception) {
          console.log("server client error", exception);
        }
      );

      server.listen(test_port);
      
      this.server = server;
      
      READY();
      
    },
    
    EXIT: function(reason, data) {
      this.server.close();
      this.exit(reason, data);
    }
    
  }
  
);


exports.client_does_get = function(test) {
  
  test.expect( 5 );
  
  var test_response = {out: 1};
  
  var T = toddick(
    {
      INIT: function() {
        this.link( 
          new TestServer(
            this.READY,
            this.SERVER_RECEIVED,
            test_response,
            'application/json'
          )
        );
      },
      
      READY: function() {
        this.link(
          new remote.Client(
            test_url_base, 
            undefined,
            this.CLIENT_RECEIVED
          )
        );
      },
      
      SERVER_RECEIVED: function(method, content_type, accept, content) {
        test.equal('GET', method);
        test.equal(undefined, content_type);
        test.equal('application/json', accept);
        test.equal(undefined, content);
      },
      
      CLIENT_RECEIVED: function(content) {
        test.deepEqual(test_response, content);
        test.done();
        this.exit();
      }
    }
  );
  
  var t = new T();
  
}


exports.client_does_post = function(test) {
  
  test.expect( 5 );
  
  var test_request  = {in: 2};
  var test_response = {out: 1};
  
  var T = toddick(
    {
      INIT: function() {
        this.link( 
          new TestServer(
            this.READY,
            this.SERVER_RECEIVED,
            test_response,
            'application/json'
          )
        );
      },
      
      READY: function() {
        this.link(
          new remote.Client(
            test_url_base, 
            test_request,
            this.CLIENT_RECEIVED
          )
        );
      },
      
      SERVER_RECEIVED: function(method, content_type, accept, content) {
        test.equal('POST', method);
        test.equal('application/json', content_type);
        test.equal('application/json', accept);
        test.deepEqual(test_request, content);
      },
      
      CLIENT_RECEIVED: function(content) {
        test.deepEqual(test_response, content);
        test.done();
        this.exit();
      }
    }
  );
  
  var t = new T();
  
}

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




