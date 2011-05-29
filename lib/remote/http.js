var toddick = require('toddick');
var http = require('http');
var url = require('url');
var os = require('os');

var remote = exports;

remote.hostname = os.hostname;
remote.default_port = 8910;

toddick( 'Portal', module,
  {
    
    INIT: function( port ) {
      
      if( !port ) {
        port = remote.default_port;
      }
      
      this.published = {};
      this.proxied = {};
      
      this.server = this.link( new remote.Server( port, this.self ) );
      this.proxy_factory = this.link( new remote.ProxyFactory( this.self ) );
      
      this.url_base = 'http://' + remote.hostname + ':' + port;
      
    },
    
    PUBLISH: function( path, instance ) {
      
      if( path.indexOf( '/' ) > 0 ) {
        path = '/' + path;
      }
      
      instance.proxy_definition = {
        is_toddick_proxy: true,
        url: this.url_base + path,
        messages: []
      };
      
      for( var name in instance ) {
        if( name != 'EXIT' && name != 'MONITOR_ADD' && name != 'MONITOR_REMOVE' ) {
          var msg = instance[ name ];
          if( msg.is_toddick_dispatcher ) {
            instance.proxy_definition.messages.push( name );
          }
        }
      }
      
      this.published[path] = instance;
      
    },
    
    UNPUBLISH: function( path ) {
      var instance = this.published[ path ];
      if( instance ) {
        delete this.published[ path ];
        delete instance.proxy_definition;
        for( var name in instance ) {
          var msg = instance[ name ];
          if( msg.is_toddick_dispatcher ) {
            delete msg.proxy_definition;
          }
        }
      }
    },
    
    GET_PUBLISHED: function( path, MSG ) {
      MSG( this.published[ path ] );
    },

    PROXY: function( url, MSG ) {
      
      if( typeof url === 'object' ) {
        var definition = url;
        url = defintion.url;
      }
      
      var proxy = this.proxied[ url ];
      if( proxy ) {
        
        MSG( proxy );
        
      } else {
        
        if( definition ) {
          this.proxy_factory.PROXY_FROM_DEFINITION( 
            definition, 
            this.PROXY_CREATED.withArgs( definition.url, MSG )
          );
        } else {
          this.proxy_factory.PROXY_FROM_URL( 
            url, 
            this.PROXY_CREATED.withArgs( url, MSG )
          );
        }
        
      }
    },
    
    PROXY_CREATED: function( url, MSG, proxy ) {
      this.proxied[ url ] = proxy;
      MSG( proxy );
    }
    
  }
);

toddick( 'Server', module,
  {
    INIT: function( port, portal ) {
      this.listener = this.link(
        new activity.Supervisor(
          {
            toddick:        remote.Listener,
            args:           [ portal, port ],
            restart:        'always',
            restart_count:  10,
            restart_period: 5000,
            restart_delay:  100
          }
        )
      );
      this.listener.START();
    }
  }
);

toddick( 'Listener', module,
  {
    
    INIT: function( port, portal ) {
      
      this.server = http.createServer(this.REQUEST.sync);
      this.server.listen(port);
      
      this.portal = portal;
      
      this.request_handler = this.link(
        new activity.Supervisor(
          {
            toddick: remote.RequestHandler,
            restart: 'on-error',
            restart-count: 3
          }
        )
      );
      
    },
    
    REQUEST: function( req, res ) {
      this.request_handler.START( this.portal, req, res );
    }
    
  }
);

toddick( 'RequestHandler', module,
  {
    
    INIT: function( portal, req, res ) {
      
      this.portal = portal;
      this.req = req;
      this.res = res;
    
      if(this.req.headers['accept'] !== 'application/json') {
        this.res.statusCode = 406;
        this.res.end('Accept is not application/json', 'text/plain');
        this.exit();
      }
      
      this.portal.GET_PUBLISHED( req.url, this.GOT_PUBLISHED );
      
    },
    
    GOT_PUBLISHED: function( instance ) {
      
      if(!instance) {
        this.res.statusCode = 404;
        this.res.end('No toddick has been published with the url ' + req.url, 'text/plain');
        this.exit();
      }
      
      switch( this.req.method ) {
        
        case 'GET':
          this.res.statusCode = 200;
          this.res.end(
            JSON.stringify( instance.proxy_definition ), 
            'application/json'
          );
          this.exit();
          
        case 'POST':
        
          if(this.req.header['content-type'] !== 'application/json') {
            this.res.statusCode = 400;
            this.res.end('content-type is not application/json', 'text/plain');
            this.exit();
          }
          
          this.instance = instance;
          this.content = '';
          
          this.req.on( 'data', this.REQUEST_DATA.sync );
          this.req.on( 'end', this.REQUEST_END.sync );
          
          break;
        
        default:
          this.res.statusCode = 405;
          this.res.end('Method is not POST or GET', 'text/plain');
          this.exit();
        
      }
      
    },
    
    REQUEST_DATA: function( chunk ) {
      this.content += chunk;
    },
    
    REQUEST_END: function() {
      
      try {
        this.msg = JSON.parse(content);
      } catch(e) {
      }
      
      if ( 
        typeof this.msg !== 'object'
        || !this.msg.name
        || !this.instance[ this.msg.name ]
        || (msg.args && !(msg.args instanceof Array))
      ) {
        this.res.statusCode = 400;
        this.res.end('The posted message content is invalid', 'text/plain');
        this.exit();
      }
      
      this.msg = msg;
      this.count = 1;
      
      this.PROCESS_ARGS( msg.args );
      
    },
    
    PROCESS_ARGS: function( args ) {
      
      for( var name in args ) {
        var value = args[ name ];
        if( typeof value === 'object' ) {
          
          if( value.is_toddick_proxy ) {
            
            ++this.task_count;
            this.portal.GET_PROXY( 
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
        this.SEND_MESSAGE();
      }
      
    },
    
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
        this.SEND_MESSAGE();
      }
      
    },
    
    SEND_MESSAGE: function() {
      
      this.instance[ this.msg.name ].apply( null, this.msg.args );
      
      this.res.statusCode = 204;
      this.res.end();
      this.exit();
      
    },
    
    EXIT: function( reason, data ) {
      if( reason ) {
        this.res.statusCode = 500;
        this.end( 'internal server error', 'text/plain' );
        this.exit( reason, data );
      }
    }
    
  }
);

toddick( 'ProxyFactory', module,
  {
    
    INIT: function( portal ) {
      
      this.portal = portal;
      
      this.proxy_definition_request = this.link(
        new activity.Supervisor(
          {
            toddick:       remote.ProxyDefinitionRequest,
            restart:       'on-error',
            restart-count: 4,
            restart-delay: 100
          }
        )
      );
      
    },
    
    PROXY_FROM_URL: function(url, MSG) {
      proxy_definition_request.START(url, this.PROXY_FROM_DEFINITION, this.NO_DEFINITION);
    },
    
    PROXY_FROM_DEFINITION: function(definition) {
      MSG( new remote.Proxy( this.portal, definition ) );
    },
    
    NO_DEFINITION: function(reason, data) {
      MSG( new remote.FailedProxy( reason, data ) );
    }
    
  }
);

toddick( 'FailedProxy', module,
  {
    INIT: function(reason, data) {
      this.exit(reason, data);
    }
  }
);

toddick( 'Proxy', module,
  {
    
    INIT: function(portal, definition) {
      
      this.message_sender = this.link(
        new activity.Supervisor(
          {
            toddick: remote.MessageSender,
            restart: 'on-error',
            restart_count: 5
          }
        )
      );
      
      this.addMessage = function( message_name ) {      
        this.defineMessage( message_name, 
          function() {
            var args = arguments.length ? arguments : undefined;
            this.message_sender.START( this.portal, definition.url, message_name, args );
          }
        );
      };
      
      if( definition.messages ) {
        definition.messages.forEach( this.addMessage, this );
      }
      
      if( definition.message ) {
        this.addMessage( defintion.message );
      }
      
      this.addMessage( 'EXIT' );
      this.addMessage( 'MONITOR_ADD' );
      this.addMessage( 'MONITOR_REMOVE' );
      
      this.message_sender.START( 
        this.portal, 
        definition.url, 
        'MONITOR_ADD', 
        [ this.__PROXY_EXIT__ ]
      );

    },
    
    __ADD_PROXY_MESSAGE__: function( message_name, MSG ) {
      if( !this[ message_name ] ) {
        this.addMessage( message_name );
      }
      MSG();
    },
    
    __PROXY_EXIT__: function( reason, data ) {
      this.exit( reason, data );
    }
      
  }
);

toddick( 'MessageSender', module,
  {
    
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
    
    PROCESS_ARGS: function( args ) {
      
      for( var name in args ) {
        var value = args[ name ];
        if( typeof value === 'object' ) {
          if( value.is_toddick ) {
            
            if( value.proxy_definition ) {
              
              args[ name ] = value.proxy_definition;
              
            } else {
              
              ++this.task_count;
              this.portal.PUBLISH( 
                '/arg/' + value.id, 
                value, 
                this.SET_TODDICK_ARG.withArgs( args, name, value )
              );
              
            }
            
          } else if( value.is_toddick_dispatcher ) {
            
            if( value.proxy_definition ) {
              
              args[ name ] = value.proxy_definition;
              
            } else {
              
              if( value.self.proxy_definition ) {
                
                ++this.task_count;
                this.SET_MESSAGE_ARG( args, name, value );
                
              } else {
                
                ++this.task_count;
                this.portal.PUBLISH(
                  '/arg/' + value.self.id,
                  value.self,
                  this.SET_MESSAGE_ARG.withArgs( args, name, value )
                );
                
              }
              
            }
            
          } else {
            ++this.task_count;
            this.PROCESS_ARGS( value );
          }
        }
      }
      
      if( --this.task_count ) {
        this.SEND_MESSAGE();
      }
      
    },
    
    SET_TODDICK_ARG: function( args, arg_name, instance ) {
      
      args[ arg_name ] = instance.proxy_definition;
      
      if( --this.task_count ) {
        this.SEND_MESSAGE();
      }
      
    },
    
    SET_MESSAGE_ARG: function( args, arg_name, msg ) {
      
      msg.proxy_definition = {
        is_toddick_proxy: true,
        url: msg.toddick.proxy_definition.url,
        message: msg.name
      };
      
      args[ arg_name ] = msg.proxy_definition;
      
      if( --this.task_count ) {
        this.SEND_MESSAGE();
      }
      
    },
    
    SEND_MESSAGE: function() {
      this.link( new remote.Client( this.url, this.msg, undefined ) );
    }
    
  }
);

toddick( 'ProxyDefinitionRequest', module,
  {
    INIT: function(url, MSG) {
      this.link( new remote.Client( url, undefined, MSG ) );
    }
  }
);

toddick( 'Client', module,
  {
    
    INIT: function(url, content, MSG) {
      
      this.MSG = MSG;
      
      var parsed = url.parse(url);
      
      var options = {
        host:    parsed.hostname,
        port:    parsed.port,
        path:    parsed.pathname + parsed.search,
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
        this.req.end( JSON.stringify( content ) );
      } else {
        this.req.end();
      }
      
      this.link( new timer.Timeout( 5000, this.TIMEOUT ) );
      
    },
    
    TIMEOUT: function() {
      this.req.abort();
      this.exit( 'timeout' );
    },
    
    ERROR: function(error) {
      this.exit( 'http', {error: error} );
    },
    
    RESPONSE: function(res) {
        
      this.content = '';
      
      res.on('data', this.DATA.sync);
      res.on('end', this.END.sync);
      
    },
    
    DATA: function(chunk) {
      this.content += chunk;
    },
    
    END: function() {
      
      if(res.statusCode !== 200 && res.statusCode !== 204) {
        this.exit('response-status', 
          { 
            statusCode: res.statusCode, 
            headers:    res.headers,
            content:    this.content
          }
        );
      }
      
      if( res.statusCode === 200 && res.headers['content-type'] !== 'application/json' ) {
        this.exit('response-content-type',
          { 
            statusCode: res.statusCode, 
            headers:    res.headers,
            content:    this.content
          }
        );
      }
  
      try {
        var result = this.content ? JSON.parse(this.content) : undefined;
      } catch( exception ) {
        this.exit('content-parse',
          {
            content:   this.content
            exception: exception
          }
        );
      }
      
      if( MSG ) {
        MSG( result );
      }
      
      this.exit();
      
    }
    
  }
);

