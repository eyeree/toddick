var toddick = require('toddick');
var timer = require('toddick/lib/timer');
var activity = require('toddick/lib/activity');

var http = require('http');
var url = require('url');
var os = require('os');

var remote = exports;

remote.hostname = os.hostname;
remote.default_port = 8090;

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
      
      this.url_base = 'http://' + remote.hostname() + ':' + port;
      
      this.info( 'initialized', { url : this.url_base } );
      
    },
    
    PUBLISH: function( path, instance, MSG ) {
      
      if( path.indexOf( '/' ) > 0 ) {
        path = '/' + path;
      }
      
      instance.proxy_def = {
        is_toddick_proxy: true,
        url: this.url_base + path,
        messages: []
      };
      
      for( var name in instance ) {
        if( name != 'EXIT' && name != 'MONITOR_ADD' && name != 'MONITOR_REMOVE' ) {
          var msg = instance[ name ];
          if( typeof msg === 'function' && msg.is_toddick_message ) {
            instance.proxy_def.messages.push( name );
          }
        }
      }
      
      this.published[path] = instance;
      
      if( MSG ) {
        MSG();
      }
      
    },
    
    UNPUBLISH: function( path ) {
      
      if( path.indexOf( '/' ) > 0 ) {
        path = '/' + path;
      }
      
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
    
    GET_PUBLISHED: function( path, MSG ) {
      
      if( path.indexOf( '/' ) > 0 ) {
        path = '/' + path;
      }
      
      MSG( this.published[ path ] );
      
    },

    PROXY: function( url, MSG ) {
      
      if( typeof url === 'object' ) {
        var def = url;
        url = def.url;
      }
      
      var proxy = this.proxied[ url ];
      if( proxy ) {
        
        MSG( proxy );
        
      } else {
        
        if( def ) {
          this.proxy_factory.PROXY_FROM_DEF( 
            this.PROXY_CREATED.withArgs( def.url, MSG ),
            def
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
      this.listener_supervisor = this.link(
        new activity.Supervisor(
          {
            toddick:        remote.Listener,
            args:           [ portal, port ],
            restart:        activity.Supervisor.restart.always,
            restart_limit:  5,
            restart_period: 5000
          }
        )
      );
      this.listener_supervisor.START();
    }
  }
);

toddick( 'Listener', module,
  {
    
    INIT: function( portal, port ) {
      
      this.server = http.createServer(this.REQUEST.sync);
      this.server.listen(port);
      
      this.portal = portal;
      
      this.request_handler_supervisor = this.link( new activity.Supervisor() );
      
    },
    
    REQUEST: function( req, res ) {
      
      var handler = new remote.RequestHandler( this.portal, req, res );
      
      req.on( 'data', 
        function( chunk ) { 
          handler.REQUEST_DATA( chunk.toString() ); 
        } 
      );
      req.on( 'end', handler.REQUEST_END );
      req.on( 'close', handler.REQUEST_CLOSE );
      
      this.trace( 'request', { method: req.method, url: req.url } );
      
      this.request_handler_supervisor.SUPERVISE( handler );
      
    }
    
  }
);

toddick( 'RequestHandler', module,
  {
    
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
    
    REQUEST_CLOSE: function( err ) {
      if( err ) {
        this.exit( 'closed', { err: err } );
      }
    },
    
    REQUEST_DATA: function( chunk ) {
      this.content += chunk;
    },
    
    REQUEST_END: function() {
      this.portal.GET_PUBLISHED( this.req.url, this.GOT_PUBLISHED );
    },
    
    GOT_PUBLISHED: function( instance ) {
      
      if(!instance) {
        this.errorResponse( 404, 'No toddick has been published with the url ' + this.req.url );
        this.exit();
      }
      
      switch( this.req.method ) {
        
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
        
        default:
          this.errorResponse( 405, 'Method is not POST or GET' );
          this.exit();
        
      }
      
    },
    
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
        this.errorResponse( 500, 'internal server error' );
      }
      this.info( "exiting", {reason: reason, data: data} );
      this.exit( reason, data );
    }
    
  }
);

toddick( 'ProxyFactory', module,
  {
    
    INIT: function( portal ) {
      
      this.portal = portal;
      
      this.proxy_def_request_supervisor = this.link(
        new activity.Supervisor(
          {
            toddick:       remote.ProxyDefRequest,
            restart:       activity.Supervisor.restart.on_error,
            restart_limit: 5
          }
        )
      );
      
    },
    
    PROXY_FROM_URL: function(url, MSG) {
      this.proxy_def_request_supervisor.START(
        url, 
        this.PROXY_FROM_DEF.withArgs( MSG ), 
        this.NO_DEF.withArgs( MSG ) 
      );
    },
    
    PROXY_FROM_DEF: function(MSG, def) {
      MSG( new remote.Proxy( this.portal, def ) );
    },
    
    NO_DEF: function(MSG, reason, data) {
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
    
    INIT: function(portal, def) {
      
      this.portal = portal;
      
      this.message_sender_supervisor = this.link(
        new activity.Supervisor(
          {
            toddick:       remote.MessageSender,
            restart:       'on-error',
            restart_count: 4
          }
        )
      );
      
      this.addMessage = function( message_name ) {    
        this.trace( 'add-message', { msg: message_name } );  
        this.defineMessage( message_name, 
          function() {
            var args = Array.prototype.slice.call( arguments );
            this.message_sender_supervisor.START( this.portal, def.url, message_name, args );
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
      this.addMessage( 'MONITOR_ADD' );
      this.addMessage( 'MONITOR_REMOVE' );
      
      /*
      this.message_sender_supervisor.START( 
        this.portal, 
        def.url, 
        'MONITOR_ADD', 
        [ this.__PROXY_EXIT__ ]
      );
      */

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
          
          console.log("is object");
          
          if( value.is_toddick ) {
            
            if( value.proxy_def ) {
              
              args[ name ] = value.proxy_def;
              
            } else {
              
              ++this.task_count;
              this.portal.PUBLISH( 
                '/arg/' + value.id, 
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
                  '/arg/' + value.toddick.id,
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
    
    SET_TODDICK_ARG: function( args, arg_name, instance ) {
      
      args[ arg_name ] = instance.proxy_def;
      
      if( --this.task_count === 0 ) {
        this.SEND_MESSAGE();
      }
      
    },
    
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
    
    SEND_MESSAGE: function() {
      this.link( new remote.Client( this.url, this.msg, undefined ) );
    }
    
  }
);

toddick( 'ProxyDefRequest', module,
  {
    INIT: function(url, MSG) {
      this.link( new remote.Client( url, undefined, MSG ) );
    }
  }
);

toddick( 'Client', module,
  {
    
    INIT: function(requrl, content, MSG) {
      
      this.MSG = MSG;
      
      var parsed = url.parse(requrl);
      
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
    
    TIMEOUT: function() {
      this.req.abort();
      this.exit( 'timeout' );
    },
    
    ERROR: function(error) {
      this.exit( 'http', {error: error} );
    },
    
    RESPONSE: function(res) {
        
      this.content = '';
      this.res = res;
      
      this.res.on('data', this.DATA.sync);
      this.res.on('end', this.END.sync);
      
    },
    
    DATA: function(chunk) {
      this.content += chunk;
    },
    
    END: function() {
      
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

