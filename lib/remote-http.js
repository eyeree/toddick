var toddick = require('toddick');
var timer = require('toddick/lib/timer');
var activity = require('toddick/lib/activity');

var http = require('http');
var url = require('url');
var os = require('os');

var remote = exports;

remote.hostname = os.hostname;
remote.default_port = 8090;


// ## Toddick: Portal
//
// Allows toddicks to send and receive messages to remote toddicks via HTTP.
//
//     var portal = new remote.Portal( [ port ] );
//
// *port* - the TCP port used for network io.
//
toddick( 'Portal', module,
  {
  
    // ### Message: INIT  
    //
    INIT: function( port ) {
      
      if( !port ) {
        port = remote.default_port;
      }
      
      this.url_base = 'http://' + remote.hostname() + ':' + port;
      
      this.published = {};
      this.proxies = {};
      
      this.server_supervisor = this.link(
        new activity.Supervisor(
          {
            toddick:        remote.Server,
            args:           [ portal, port ],
            restart:        activity.Supervisor.restart.always,
            restart_limit:  5,
            restart_period: 5000
          }
        )
      );
      this.server_supervisor.START();
      
      this.client_supervisor = this.link(
        new activity.Supervisor(
          {
          }
        )
      );
      
      this.info( 'initialized', { url : this.url_base } );
      
    },
    
    // ### Message: PUBLISH
    //
    // Allows a toddick to receive messages over the network.
    //
    //    portal.PUBLISH( [ alias, ] instance [, MSG ] )
    //
    // *alias* - An relative url path where the toddick will be published. The toddick is also
    // published under /toddick/module/Type/ID.
    //
    // *instance* - The toddick to publish.
    //
    // *MSG* - A message to send once the toddick is published.
    //
    PUBLISH: function( alias, instance, MSG ) {
      
      // alias is optional, shift args as needed
      if( typeof alias !== 'string' ) {
        MSG = instance;
        instance = alias;
        alias = undefined;
      }
      
      var path = '/toddick/' + instance.id;
      
      if( !this.published[ path ] ) {
      
        // TODO: store def as state in portal instead of on toddick
        instance.proxy_def = {
          is_toddick_proxy: true,
          toddick_url:      this.url_base + path,
          messages:         []
        };
        
        for( var name in instance ) {
          if( name != 'EXIT' && name != 'MONITOR_ADD' && name != 'MONITOR_REMOVE' ) {
            var msg = instance[ name ];
            if( typeof msg === 'function' && msg.is_toddick_message ) {
              instance.proxy_def.messages.push( name );
            }
          }
        }
        
        this.published[ path ] = instance;
        
        this.monitor( instance, this.PUBLISHED_EXITED.withArgs( path ) );
      
      }
      
      if( alias ) {
        
        if( alias.indexOf( '/' ) !== 0 ) {
          alias = '/' + alias;
        }
        
        this.published[ alias ] = instance;
        
        this.monitor( instance, this.UNPUBLISH.withArgs( alias ) );
        
      }
      
      if( MSG ) {
        MSG();
      }
      
    },
    
    // ### Message: UNPUBLISH
    //
    // Removes the alias underwich a toddick was previously published. The toddick can still 
    // receive messages via it's actual /toddick/module/Type/id address until it exits.
    //
    //     portal.UNPUBLISH( alias )
    //
    UNPUBLISH: function( alias ) {
      
      if( alias.indexOf( '/' ) === 0 ) {
        alias = alias.substring( 1 );
      }
      
      delete this.published[ alias ];
      
    },
    
    // ### Message: PUBLISHED_EXITED
    //
    // Sent via a monitor when a published toddick exits.
    //
    PUBLISHED_EXITED: function( path ) {

      var instance = this.published[ path ];
      
      if( instance ) {
        
        delete this.published[ path ];
        
        delete instance.proxy_def;
        for( var name in instance ) {
          var msg = instance[ name ];
          if( msg.is_toddick_message ) {
            delete msg.proxy_def;
          }
        }
        
      }
      
    },
    
    // ### Message: PROXY
    //
    // Creates a proxy toddick for a remote toddick.
    //
    //      portal.PROXY( url, MSG );
    //
    //      MSG( proxy )
    //
    // *url* - The url of the remote toddick.
    //
    // *MSG* - A message sent when the proxy has been created.
    //
    // *proxy* - The proxy toddick that was created.
    //
    PROXY: function( url, MSG ) {
      
      var proxy = this.proxies[ url ];
      if( proxy ) {
        
        MSG( proxy );
        
      } else {
        
        this.client_supervisor.SUPERVISE(
          new ProxyDefRequest( url, this.CREATE_PROXY.withArgs( MSG ) )
        );
        
      }
      
    },
    
    // ### Message: CREATE_PROXY
    //
    // Create a proxy using a proxy definition object. 
    //
    //     portal.CREATE_PROXY( MSG, def )
    //
    //     MSG( proxy )
    //
    //     def = {
    //         is_toddick_proxy: true
    //         url:              (string)
    //       [ messages:         (array of string) ]
    //       [ message:          (string)          ]
    //       [ exit_reason:      (string)          ]
    //       [ exit_data:        (object)          ]
    //     }
    //
    // *MSG* - A message sent when the proxy has been created.
    //
    // *def* - A proxy definition object.
    //
    // *proxy* - The proxy toddick that was created.
    //
    // *url* - The url where proxy messages will be sent via an HTTP POST.
    //
    // *messages* - A list of message names. The proxy toddick will have a dispatch function for
    // each of these.
    //
    // *message* - A message name. A dispatch function for this message will be added to the 
    // toddick if it doesn't already exits.
    // 
    // *exit_reason* - If provided, the proxy toddick will exit immediatly with this as the reason.
    //
    // *exit_data* - The data used when exiting because *exit_reason* was provided.
    //
    CREATE_PROXY: function( MSG, def ) {
      
      var proxy = this.proxies[ def.url ];
      if( !proxy ) {
        
        proxy = this.proxies[ def.url ] = new remote.Proxy( this.self, def );
        
        var path = '/proxy/' + proxy.id;
        this.published[ path ] = proxy;
        
        this.monitor( proxy, this.PROXY_EXITED.withArgs( def.url, path ) );
        
      } else {
        
        if( def.message ) {
          proxy.__ADD_PROXY_MESSAGE__( def.message );
        }
        
      }

      MSG( proxy );
      
    },
    
    // ### Message: PROXY_EXITED
    //
    // Sent via a monitor when a proxy toddick exits.
    //
    PROXY_EXITED: function( url, path ) {
      delete this.proxies[ url ];
      delete this.published[ path ];
    },
 
    // ### Message: PROXY_MONITOR_ADD
    // 
    // Sent by a remote.RequestHandler when a __PROXY_MONITOR_ADD__ message is sent to a proxied
    // toddick.
    //
    PROXY_MONITOR_ADD: function( instance, proxy_url ) {
      this.monitor( instance, this.MONITORED_PROXY_EXITED.withArgs( proxy_url ) );
    },
    
    // ### Message: MONITORED_PROXY_EXITED
    //
    // Sent by a monitor when a proxied toddick exits.
    //
    MONITORED_PROXY_EXITED: function( proxy_url, reason, data ) {
      this.client_supervisor.SUPERVISE(
        new remote.ProxyExitedRequest(
          this.self, 
          proxy_url, 
          reason,
          data
        )
      );
    },
    
    // ### Message: GET_TARGET
    //
    // Gets the toddick identified via a relative url. Used to find the recipient of messages
    // received over the network.
    //
    GET_TARGET: function( path, MSG ) {
      
      if( path.indexOf( '/' ) === 0 ) {
        path = path.substring( 1 );
      }
      
      MSG( this.published[ path ] );
      
    }

  }
);

// ## Toddick: Server
//
// An HTTP server that receives toddick messages and sends them to published toddicks. Created by
// a remote.Portal toddick.
//
toddick( 'Server', module,
  {
    
    // ### Message: INIT
    //
    INIT: function( portal, port ) {
      
      this.portal = portal;
      
      this.server = http.createServer( this.REQUEST.sync );
      this.server.listen( port );
      
      this.request_supervisor = this.link( 
        new activity.Supervisor() 
      );
      
    },
    
    // ### Message: REQUEST
    //
    // Sent when an HTTP request is initiated.
    //
    REQUEST: function( req, res ) {
      
      var handler = new remote.RequestHandler( this.portal, req, res );
      
      req.on( 'data', 
        function( chunk ) { 
          handler.REQUEST_DATA( chunk.toString() ); 
        } 
      );
      req.on( 'end', handler.REQUEST_END );
      req.on( 'close', handler.REQUEST_CLOSE );
      
      this.request_supervisor.SUPERVISE( handler );
      
      this.trace( 'request', { method: req.method, url: req.url } );
      
    },
    
    // ### Message: EXIT
    //
    EXIT: function( reason, data ) {
      this.server.close();
      this.exit( reason, data );
    }
    
  }
);

// ## Toddick: RequestHandler
//
// Handles HTTP requests. Created by a remote.Server toddick when a request is received.
// 
toddick( 'RequestHandler', module,
  {
    
    // ### Message: INIT
    //
    INIT: function( portal, req, res ) {
      
      this.portal = portal;
      this.req = req;
      this.res = res;
      
      this.content = '';
      
      this.errorResponse = function( status, text ) {
        this.trace( 'error-response', { status: status, text: text } );
        this.res.statusCode = status;
        this.res.setHeader('Content-Type', 'text/plain');
        this.res.end(text);
      }
    
    },
    
    // ### Message: REQUEST_CLOSE
    //
    // Sent when the HTTP request is closed.
    //
    REQUEST_CLOSE: function( err ) {
      if( err ) {
        this.exit( 'closed', { err: err } );
      }
    },
    
    // ### Message: REQUEST_DATA
    //
    // Sent when HTTP request content is received.
    //
    REQUEST_DATA: function( chunk ) {
      this.content += chunk;
    },
    
    // ### Message: REQUEST_END
    //
    // Sent when the HTTP request has been received.
    //
    REQUEST_END: function() {
      this.portal.GET_TARGET( this.req.url, this.GOT_TARGET );
    },
    
    // ### Message: GET_TARGET
    //
    // Receives the toddick identified by the url in an HTTP request.
    // 
    GOT_TARGET: function( instance ) {
      
      // Send 404 if the url in the request didn't identify a published toddick.
      if( !instance ) {
        this.errorResponse( 404, 'No toddick has been published with the url ' + this.req.url );
        this.exit();
      }
      
      switch( this.req.method ) {
        
        // GET requests are used to retreive a proxy definition. 
        case 'GET':
        
          if( this.req.headers[ 'accept' ] !== 'application/json' ) {
            this.errorResponse( 406, 'Accept is not application/json' );
            this.exit();
          }
          
          this.trace( 'response', { content: instance.proxy_def } );
          
          this.res.statusCode = 200;
          this.res.setHeader('Content-Type', 'application/json');
          this.res.end( JSON.stringify( instance.proxy_def ) );
          
          this.exit();
          
        // POST requests are used to send a message to a toddick. The request content should be 
        // a JSON object such as:
        //
        //     msg = {
        //         name: (string)
        //       [ args: (array of any value) ]
        //     }
        // 
        // *name* - The name of the message to send.
        // 
        // *args* - The arguments to send with the message.
        //
        case 'POST':
        
          if(this.req.headers['content-type'] !== 'application/json') {
            this.errorResponse( 400, 'content-type is not application/json' );
            this.exit();
          }
          
          this.instance = instance;
          
          this.msg = undefined;
          try {
            this.msg = JSON.parse( this.content );
          } catch( exception ) {
            this.trace( 'json-error', { exception: exception } );
          }
          
          this.trace( 'received', { content: this.msg } );
          
          if ( 
            typeof this.msg !== 'object'
            || !this.msg.name
            || !this.instance[ this.msg.name ]
            || (this.msg.args && !(this.msg.args instanceof Array))
          ) {
            this.errorResponse( 400, 'The posted message content is invalid' );
            this.exit();
          }
          
          this.task_count = 1;
          this.PROCESS_ARGS( this.msg.args );
          
          break;
        
        // Other methods not allowed.
        default:
          this.errorResponse( 405, 'Method is not POST or GET' );
          this.exit();
        
      }
      
    },
    
    // ### Message: PROCESS_ARGS
    //
    // Gets/creates proxies for all toddicks and messages received via as message arguments.
    //
    PROCESS_ARGS: function( args ) {
      
      for( var name in args ) {
        var value = args[ name ];
        if( typeof value === 'object' ) {
          
          if( value.is_toddick_proxy ) {
            
            this.trace('proxy def', { name: name, value: value } ); 
            
            ++this.task_count;
            this.portal.PROXY( 
              value, 
              this.SET_PROXY_ARG.withArgs( args, name, value.message ) 
            );
            
          } else {
            
            ++this.task_count;
            this.PROCESS_ARGS( value );
            
          }
          
        }
      }
      
      if( --this.task_count === 0 ) {
        this.DISPATCH_MESSAGE();
      }
      
    },
    
    // ### Message:: SET_PROXY_ARG
    //
    // Sets a proxy argument once the proxy has been retreived from the protal.
    //
    SET_PROXY_ARG: function( args, arg_name, message_name, proxy ) {
      
      if( message_name ) {
        if( !proxy[ message_name ] ) {
          ++this.task_count;
          proxy.__ADD_PROXY_MESSAGE__(
            message_name,
            this.SET_PROXY_ARG.withArgs( args, arg_name, message_name, proxy )
          );
        } else {
          args[ arg_name ] = proxy[ message_name ];
        }
      } else {
        args[ arg_name ] = proxy;
      }
      
      if( --this.task_count === 0 ) {
        this.DISPATCH_MESSAGE();
      }
      
    },
    
    // ### Message: DISPATCH_MESSAGE
    // 
    // Sends a message received via HTTP to a toddick.
    //
    DISPATCH_MESSAGE: function() {

      // __PROXY_MONITOR_ADD__ messages are sent to the proxied toddick, but are actually handled
      // by the protal toddick. All other messages are sent to the proxied toddick.      
      if( this.msg.name === '__PROXY_MONITOR_ADD__' ) {
        
        this.portal.PROXY_MONITOR_ADD( this.instance, this.msg.args[ 0 ] );
        
      } else {
      
        this.instance[ this.msg.name ].apply( null, this.msg.args );
      }
      
      this.res.statusCode = 204;
      this.res.end();
      this.exit();
        
    },
    
    // ### Message: EXIT
    //
    // Send 500 response if the request handler failed.
    //
    EXIT: function( reason, data ) {
      if( reason ) {
        this.errorResponse( 500, 'internal server error' );
      }
      this.exit( reason, data );
    }
    
  }
);

// ## Toddick: ProxyDefRequest
//
// Sends an HTTP request to retrieve a proxy definition object. Create by a remote.Portal toddick.
//
toddick( 'ProxyDefRequest', module,
  {
    
    // ### Message: INIT
    //
    INIT: function( MSG, url ) {
      
      this.MSG = MSG;
      this.url = url;
      
      this.client_supervisor = this.link(
        new activity.Supervisor(
          {
            toddick:       remote.Client,
            restart:       activity.Supervisor.restart.on_error,
            restart_limit: 5
          }
        )
      );
      
      this.client_supervisor.START( url, undefined, MSG );
      
    },
    
    /// ### Message: EXIT
    //
    EXIT: function( reason, data ) {
      
      // If the request failed, create a def that will cause the proxy to exit immediatly.
      if( reason === activity.Supervisor.reason.restart_limit ) {
        
        this.MSG(
          {
            is_toddick_proxy: true,
            url:              this.url,
            exit_reason:      remote.Proxy.reason.no_def,
            exit_data:        { reason: reason, data: data }
          }
        );
        
        this.exit();
        
      } else {
        
        this.exit( reason, data );
        
      }
      
    }
    
  }
);

// ## Toddick: ProxyExitRequest
//
// Sends an HTTP request to a proxy toddick so it exits when the proxied toddick exits.
//
toddick( 'ProxyExitRequest', module,
  {
    
    // ### Message: INIT
    //
    INIT: function( portal, proxy_url, reason, data ) {
      
      this.request_supervisor = this.link(
        new activity.Supervisor(
          {
            toddick:       remote.MessageSendRequest,
            restart:       activity.Supervisor.restart.on_error,
            restart_limit: 5
          }
        )
      );
      
      this.request_supervisor.START( 
        portal,
        proxy_url,
        '__PROXY_EXIT__',
        [ reason, data ]
      );
      
    },
    
    /// ### Message: EXIT
    //
    EXIT: function( reason, data ) {
      
      // If the request failed, we exit without error.
      if( reason === activity.Supervisor.reason.restart_limit ) {
        
        this.exit();
        
      } else {
        
        this.exit( reason, data );
        
      }
      
    }
    
  }
);

// ## Toddick: Proxy
//
// Forwards messages to a remote toddick. Created using remote.Portal.PROXY messages and as needed
// to represent toddicks and messages references via received message arguments.
//
toddick( 'Proxy', module,
  {
    
    // ### Message: INIT
    //
    INIT: function( portal, def, proxy_url ) {
      
      if( def.exit_reason ) {
        this.exit( def.exit_reason, def.exit_data );
      }
      
      this.portal = portal;
      
      this.send_supervisor = this.link(
        new activity.Supervisor(
          {
            toddick:       remote.MessageSendRequest,
            restart:       activity.Supervisor.restart.on_error,
            restart_count: 5,
            ERROR_EXIT:    this.__PROXY_SEND_FAILED__
          }
        )
      );
      
      this.addMessage = function( message_name ) {    
        this.defineMessage( message_name, 
          function() {
            var args = Array.prototype.slice.call( arguments );
            this.send_supervisor.START( this.portal, def.url, message_name, args );
          }
        );
      };
      
      if( def.messages ) {
        def.messages.forEach( this.addMessage, this );
      }
      
      if( def.message ) {
        this.addMessage( def.message );
      }
      
      this.addMessage( 'EXIT' );
      
      this.send_supervisor.START( 
        this.portal, 
        def.url, 
        "__PROXY_MONITOR_ADD__", 
        [ proxy_url ]
      );
      
    },
    
    // ### Message: __ADD_PROXY_MESSAGE__
    //
    // Adds a new message to the proxy. Sent via a remote.Portal toddick when a message proxy is
    // found in received HTTP request.
    //
    __ADD_PROXY_MESSAGE__: function( message_name, MSG ) {
      
      if( !this[ message_name ] ) {
        this.addMessage( message_name );
      }
      
      if( MSG ) {
        MSG();
      }
      
    },
    
    // ### Message: __PROXY_EXIT__
    //
    // Sent by the remote toddick when it exits.
    //
    __PROXY_EXIT__: function( reason, data ) {
      this.exit( reason, data );
    }
    
    // ### Message: __PROXY_SEND_FAILED__
    //
    // Sent when the HTTP requests sent to the proxied toddick fail.
    //
    __PROXY_SEND_FAILED__: function( reason, data ) {
      this.exit( remote.Proxy.reasons.send_failed, { reason: reason, data: data } );
    }
      
  }
);

// ### Constants: reasons
//
// Exit reason codes used by proxy toddicks.
//
remote.Proxy.reasons = {
  
  // *no-def* - the proxy definition could not be retrieved.
  no_def: 'no-def'
  
}

// ## Toddick: MessageSendRequest
//
// Sends a message to a toddick using an HTTP request.
//
toddick( 'MessageSendRequest', module,
  {
    
    // ### Message: INIT
    //
    INIT: function( portal, url, message_name, args ) {
      
      this.portal = portal;
      this.url = url;
      
      this.msg = {
        name: message_name,
        args: args
      };
      
      if( args ) {
        this.task_count = 1;
        this.PROCESS_ARGS( args );
      } else {
        this.SEND_MESSAGE();
      }
      
    },
    
    // ### Message: PROCSS_ARGS
    //
    // Replaces toddick and message references with proxy definitions.
    //
    PROCESS_ARGS: function( args ) {
      
      for( var name in args ) {
        
        var value = args[ name ];
        
        if( typeof value === 'object' ) {
          
          if( value.is_toddick ) {
            
            if( value.proxy_def ) {
              
              args[ name ] = value.proxy_def;
              
            } else {
              
              ++this.task_count;
              this.portal.PUBLISH( 
                value, 
                this.SET_TODDICK_ARG.withArgs( args, name, value )
              );
              
            }
            
          } else {
            ++this.task_count;
            this.PROCESS_ARGS( value );
          }
           
        } else if( typeof value === 'function' ) {
          
          if( value.is_toddick_message ) {
            
            if( value.proxy_def ) {
              
              args[ name ] = value.proxy_def;
              
            } else {
              
              if( value.toddick.proxy_def ) {
                
                ++this.task_count;
                this.SET_MESSAGE_ARG( args, name, value );
                
              } else {
                
                ++this.task_count;
                this.portal.PUBLISH(
                  value.toddick,
                  this.SET_MESSAGE_ARG.withArgs( args, name, value )
                );
                
              }
              
            }
          }
            
        }
      }
      
      if( --this.task_count === 0 ) {
        this.SEND_MESSAGE();
      }
      
    },
    
    // ### Message: SET_TODDICK_ARG
    // 
    // Replaces a toddick argument with a proxy definition.
    //
    SET_TODDICK_ARG: function( args, arg_name, instance ) {
      
      args[ arg_name ] = instance.proxy_def;
      
      if( --this.task_count === 0 ) {
        this.SEND_MESSAGE();
      }
      
    },
    
    // ### Message: SET_MESSAGE_ARG
    //
    // Replaces a message argument with a proxy definition.
    //
    SET_MESSAGE_ARG: function( args, arg_name, msg ) {
      
      msg.proxy_def = {
        is_toddick_proxy: true,
        url: msg.toddick.proxy_def.url,
        message: msg.message_name
      };
      
      args[ arg_name ] = msg.proxy_def;
      
      if( --this.task_count === 0 ) {
        this.SEND_MESSAGE();
      }
      
    },
    
    // ### Message: SEND_MESSAGE
    //
    // Sends the HTTP request with the message.
    //
    SEND_MESSAGE: function() {
      this.link( new remote.Client( this.url, this.msg, undefined ) );
    }
    
  }
);

// ## Toddick: Client
//
// An HTTP client that sends and receives JSON format objects.
//
toddick( 'Client', module,
  {
    
    // ### Message: INIT
    //
    INIT: function( req_url, content, MSG ) {
      
      this.MSG = MSG;
      
      var parsed = url.parse(req_url);
      
      var options = {
        host:    parsed.hostname,
        port:    parsed.port,
        path:    parsed.pathname,
        headers: {
          'accept' : 'application/json'
        }
      };
      
      if( content ) {
        options.method = 'POST';
        options.headers['content-type'] = 'application/json';
      } else {
        options.method = 'GET';
      }
      
      this.req = http.request(options, this.RESPONSE.sync);
      
      this.req.on( 'error', this.ERROR.sync );
      
      if( content ) {
        this.trace( 'sent', { content: content } );
        this.req.end( JSON.stringify( content ) );
      } else {
        this.req.end();
      }
      
      this.link( new timer.Timeout( 5000, this.TIMEOUT ) );
      
    },
    
    // ### Message: TIMEOUT
    //
    // Sent if HTTP request timesout.
    //
    TIMEOUT: function() {
      this.req.abort();
      this.exit( 'timeout' );
    },
    
    // ### Message: ERROR
    //
    // Sent if the HTTP request resulted in an error.
    //
    ERROR: function(error) {
      this.exit( 'http', {error: error} );
    },
    
    // ### Message: RESPONSE
    //
    // Sent when a response to the request is received.
    //
    RESPONSE: function(res) {
        
      this.content = '';
      this.res = res;
      
      this.res.on('data', this.RESPONSE_DATA.sync);
      this.res.on('end', this.RESPONSE_END.sync);
      
    },
    
    // ### Message: RESPONSE_DATA
    //
    // Sent when response data is received.
    //
    RESPONSE_DATA: function(chunk) {
      this.content += chunk;
    },
    
    // ### Message: RESPONSE_END
    //
    // Sent when all response data has been received.
    //
    RESPONSE_END: function() {
      
      if(this.res.statusCode !== 200 && this.res.statusCode !== 204) {
        this.exit('response-status', 
          { 
            statusCode: this.res.statusCode, 
            headers:    this.res.headers,
            content:    this.content
          }
        );
      }
      
      if( this.res.statusCode === 200 && this.res.headers['content-type'] !== 'application/json' ) {
        this.exit('response-content-type',
          { 
            statusCode: this.res.statusCode, 
            headers:    this.res.headers,
            content:    this.content
          }
        );
      }
  
      var result = undefined;
      if( this.content.length > 0 ) {
        try {
          result = JSON.parse(this.content);
          this.trace( 'received', { content: result } );
        } catch( exception ) {
          this.exit('content-parse',
            {
              content:   this.content,
              exception: exception
            }
          );
        }
      }
      
      if( this.MSG ) {
        this.MSG( result );
      }
      
      this.exit();
      
    }
    
  }
);

