var toddick = require('toddick');

var common = exports;

toddick( 'Proxy', module,
  {
    
    INIT: function( portal, definition ) {

      this.addMessage = function( message_name ) {      
        this.defineMessage( message_name, 
          function() {
            portal.SEND( definition.url, message_name, arguments );
          }
        );
      };
      
      definition.messages.forEach(this.addMessage, this);

    },
    
    ADD_MESSAGE: function( message_name, MSG ) {
      if( !this[ message_name ] ) {
        this.addMessage( message_name );
      }
      MSG();
    }
    
);

toddick( 'ArgsInProcessor', module,
  {
    
    INIT: function(args, CREATE_PROXY, DONE) {
      
      this.args = args;
      this.count = 0;
      this.DONE = DONE;
      
      for( var name in args ) {
        var value = args[name];
        if( typeof value === 'object' ) {
          this.count++;
          if( value.is_toddick_definition ) {
            CREATE_PROXY( this.SET.withArgs(name) );
          } else {
            new common.ArgsInProcessor(value, CREATE_PROXY, this.SET.withArgs(name));
          }
        }
      }
      
      if(this.count === 0) {
        this.DONE(this.args);
      }
      
    },
    
    SET: function(name, value) {
      this.args[name] = value;
      this.count--;
      
      if(this.count === 0) {
        this.DONE(this.args);
      }
    }
      
  }
);

toddick( 'ArgProcessor', module,
  {
    
    INIT: function( portal ) {
      this.portal = portal;
      this.proxies = {};
    },
    
    PROCESS_ARGS_IN: function( args, MSG ) {
      
      var proxies = this.proxies;
      var portal = this.portal;
      
      var async_tasks = undefined;
      
      var processObject = function( obj ) {
        for( var name in obj ) {
          var value = obj[name];
          if( typeof value === 'object' ) {
            if( value.is_toddick_proxy ) {
              
              var definition = value;
              
              var proxy = proxies[ definition.url ];
              
              if( !proxy ) {
                proxy = new common.Proxy( 
                  portal, 
                  definition
                );
                proxies[ definition.url ] = proxy;
              }
              
              if (definition.is_message) {
                var message_name = definition.messages[ 0 ];
                if( !proxy[ message_name ] ) {
                  if( !async_tasks ) {
                    async_tasks = this.linkError( new when.Zero(MSG) );
                  }
                  async_tasks.INC();
                  proxy.ADD_MESSAGE( 
                    message_name, 
                    this.MESSAGE_ADDED.withArgs( obj, name, message_name, proxy, async_tasks.DEC ) 
                  );
                } else {
                  obj[ name ] = proxy[ message_name ];
                }
              } else {
                obj[ name ] proxy;
              }
              
            } else {
              processObject( value );
            }
          } 
        }
      };
      
      processObject( args );
      
      if( !async_tasks ) {
        MSG();
      }
      
    },
    
    MESSAGE_ADDED: function( obj, name, message_name, proxy, MSG ) {
      obj[ name ] = proxy[ message_name ];
      MSG();
    },
    
    PROCESS_ARGS_OUT: function(url_base, args, MSG) {
      
      var processObject = function( obj ) {
        for( var name in obj ) {
          var value = obj[name];
          if( typeof value === 'object' ) {
            if( value.is_toddick ) {
              
              if( !value.proxy_definition ) {
                
                var messages = [];
                for( var message_name in value ) {
                  var message = value[message_name];
                  if( typeof value === 'function' && message.is_toddick_dispatcher ) {
                    if( 
                      message_name != 'INIT' && 
                      message_name != 'EXIT' && 
                      message_name != 'MONITOR_ADD' && 
                      message_name != 'MONITOR_REMOVE'
                    ) {
                      messages.push(message_name); 
                    }
                  }
                }
                
                value.proxy_definition = {
                  is_toddick_proxy: true,
                  url: url_base + value.id,
                  messsages: messages;
                };
                
              }
              
              obj[ name ] = value.proxy_definition;
              
              var proxy = proxies[ value.url ];
              
              if( !proxy ) {
                proxy = new common.Proxy( portal, value );
                proxies[ value.url ] = proxy;
              } else {
                proxy.EXTEND_PROXY_DEFINITION( value );
              }
              
              if( value.message_name ) {
                obj[ name ] = proxy[ value.message_name ];
              } else {
                obj[ name ] = proxy;
              }
              
            } else {
              processObject( value );
            }
          } 
        }
      };
      
      
    }
    
  }
);
