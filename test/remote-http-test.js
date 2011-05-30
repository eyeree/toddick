var toddick = require('../lib/toddick');
var remote = require('../lib/remote-http');
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
  
  //remote.Portal.trace_enabled = true;
  //toddick.trace_enabled = true;
  
  var p1;
  var p2;
  
  test.expect( 1 );
  
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
        new require('../lib/timer').Timeout(10000, this.MSG.withArgs(pingpong));
      },
      
      MSG: function(pingpong) {
        pingpong.PING(this.PONG);
      },
      
      PONG: function() {
        test.done();
      }
    }
  );
  
  PingPong.trace_enabled = true;
  Pinger.trace_enabled = true;
  remote.RequestHandler.trace_enabled = true;
  remote.Proxy.trace_enabled = true;
  remote.MessageSender.trace_enabled = true;
  remote.Portal.trace_enabled = true;

  p1 = new remote.Portal(8910).PUBLISH("/pingpong", new PingPong());

  p2 = new remote.Portal(8911).PROXY("http://localhost:8910/pingpong", new Pinger().PING);
  
}

