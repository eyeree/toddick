//
// Core toddick functionality
//

// Node modules we use.
var path = require('path');

// Toddick modules we use.
var log = require('./log');
var registry = require('./registry');

// Every toddick instance gets an id that includes an unique number.
var next_toddick_ordinal = 1;

// ## Function: appendArgs
// 
// Internal helper function that concatinates two arguments objects into an array of arguments, or
// returns one of the arguments objects itself if the other contains no arguments.
//
//      var args = appendArgs(saved_arguments, arguments);
//
function appendArgs(a1, a2) {
  if(a1.length === 0) return a2;
  if(a2.length === 0) return a1;
  var args = Array.prototype.slice.call(a1);
  return args.concat(Array.prototype.slice.call(a2));
}

// ## Function: cleanTraceData
//
// Internal helper function that replaces toddick and dispatcher objects in trace output
// with just their id.
//
function cleanTraceData( data_in ) {
  
  var data_out = { };
  
  for( var name in data_in ) {
    
    var value = data_in[ name ];
    
    if( typeof value === 'object' ) {
      if( value.is_toddick ) {
        data_out[ name ] = value.id;
      } else {
        data_out[ name ] = cleanTraceData( value );
      }
    } else if( typeof value === 'function' ) {
      if( value.is_toddick_message ) {
        data_out[ name ] = value.id;
      }
    } else {
      data_out[ name ] = value;
    }
    
  }
  
  return data_out;
  
}

// ## Function: toddick 
//
// Creates a toddick constructor.
//
//     var constructor = toddick( [export_name [, export_module ] , ] handlers )
//
// *export_name* - name used for exported toddick class and in trace output
//
// *export_module* - module that is exporting the toddick class
//
// *handlers* - an object whose properties are message handler functions
//
// *constructor* - returns the constructor function.
//
// If export_module is provided, the constructor is added to the module exports.
//
// This function is available as the value returned by require('toddick');
//
var toddick = function (export_name, export_module, handlers ) {

  // The export_module parameter is optional.
  if(typeof handlers === 'undefined') {
    handlers = export_module;
    export_module = undefined;
  }
  
  // The export_name parameter is optional.
  if(typeof handlers === 'undefined') {
    handlers = export_name;
    export_name = undefined;
  }

  // Name used in trace output.
  var type_name = export_name || 'toddick';
  
  // Override the default type_name if we can.
  if(export_name && export_module) {
    type_name = toddick.makeTypeName(export_name, export_module);
  }
  
  // ### Toddick Constructor
  //
  // Constructor returned by the toddick function.
  //
  //     var instance = new constructor( [ args... ] )
  //
  // *args* - passed to init message handler
  //
  // *instance* - the toddick object.
  //
  var constructor = function() {
    
    // #### external\_this and internal\_this
    //
    // A toddick is represented by two different objects in two distinct contexts. 
    //
    // The "external" object is returned by the constructor. It's properties include all the 
    // message dispatch functions (the ones that use process.nextTick to call the handler functions
    // async) and a few other things.
    // 
    // The "internal" object is passed to the handler functions. It's properties include functions
    // that allow the toddick to interact with the framework as well as the toddick's message 
    // dispatch functions.
    //
    var external_this = this;             
    var internal_this = {};

    // #### private data
    //
    // The private data maintained by the framework for the toddick is kept in the constructor
    // function's closure as local variables.
    
    // The toddick's unique id.
    var toddick_id = type_name + '/' + next_toddick_ordinal++;  
    
    // Tracks the toddicks monitoring this toddick.
    var monitors = {};
    
    // Tracks the toddicks this toddick is monitoring.
    var monitoring = {};
    
    // Indicates if this toddick is active or if it has exited.
    var is_active = true;
    
    // The values passed to this.exit will be saved here.
    var exit_reason = undefined;
    var exit_data = undefined;
    
    // Tracks the global names assigned to this toddick.
    var registrations = {};    
    
    // thrown by this.exit to signal toddick exit.
    var exit_exception = {};   
    
    // #### Property: is_toddick
    //
    // Exists and is true for all toddick objects.
    //
    //   instance.is_toddick
    //
    // This property is available as *instance*.is_toddick on a toddick instance object as returned
    // by a toddick constructor.
    //
    external_this.__defineGetter__('is_toddick',
      function() {
        return true;
      }
    );
     
    // #### Property: is_active
    //
    // Indicates if the toddick is active or if it has exited. This property is available as 
    // *instance*.is_active on a toddick instance object as returned by a toddick constructor.
    //
    //      var active = instance.is_active;
    //      var active = this.is_active.
    //
    external_this.__defineGetter__('is_active',
      function () {
        return is_active;
      }
    );
    internal_this.__defineGetter__('is_active',
      function() {
        return is_active;
      }
    );
    
    // #### Property: exit_reason
    //
    // After the toddick has exited, this property contains the value passed to the exit function.
    // This property is available as *instance*.exit_reason on a toddick instance object as
    // returned by a toddick constructor.
    //
    //      var reason = instance.exit_reason;
    //
    external_this.__defineGetter__('exit_reason',
      function () {
        return exit_reason;
      }
    );
    
    // #### Property: exit_data
    //
    // After the toddick has exited, this property contains the value passed to the exit function.
    // This property is available as *instance*.exit_data on a toddick instance object as
    // returned by a toddick constructor.
    //
    //      var data = instance.exit_data;
    //
    external_this.__defineGetter__('exit_data',
      function () {
        return exit_data;
      }
    );
    
    // #### Property: self
    //
    // An alias for the toddick's instance object (the one returned by the constructor). This 
    // property is available as this.self inside message handler functions.
    //
    //      var self = this.self;
    //
    internal_this.self = external_this;

    // #### Function: trace
    //    
    // Writes a trace message to the toddick log. This function is available as this.trace inside 
    // message handler functions.
    //
    //     this.trace( action [, data ] )
    // 
    // *action* - A string describing the activity being logged.
    //
    // *data* - An optional object that is written to the log as a JSON string.
    //
    internal_this.trace = function (action, data) {
      if (toddick.trace_enabled || constructor.trace_enabled || internal_this.trace_enabled) {
        if( data ) {
          data = cleanTraceData( data );
        }
        log.trace(toddick_id, action, data);
      }
    }
    
    // #### Function: info
    //
    // Writes an informational message to the toddick log. This function is available as this.info
    // inside message handler functions.
    //
    //     this.info( action [, data ] )
    //
    // *action* - A string describing the activity being logged.
    //
    // *data* - An optional object that is written to the log as a JSON string.
    //
    internal_this.info = function(action, data) {
      log.info(toddick_id, action, data);
    }
    
    // #### Function: error
    //
    // Writes an error message to the toddick log. This function is available as this.error inside 
    // message handler functions.
    //
    //     this.error( action [, data ] )
    //
    // *action* - A string describing the activity being logged.
    //
    // *data* - An optional object that is written to the log as a JSON string.
    //
    internal_this.error = function(action, data) {
      log.error(toddick_id, action, data);
    }
    
    // ### Function: exit
    //
    // Makes the toddick inactive. This function is available as this.exit inside message handler 
    // functions.
    //
    //     this.exit( [ reason [, data ] ] )
    //
    // *reason* - An optional value indicating why the toddick is exiting. It will be used
    // as an *action* parameter value in a call to this.error and will be available via
    // *instance*.exit_reason.
    // 
    // *data* - An optional object that contains any data associated with the exit reason.
    // It will be used as an *data* parameter value in a call to this.error and will be available
    // via *instance*.exit_data.
    //
    internal_this.exit = function (reason, data) {
      
      internal_this.trace('exit', {reason: reason, data: data});
      
      is_active = false;
      exit_reason = reason;
      exit_data = data;
      
      // Log reason and data as error.
      if(reason) {
        internal_this.error(reason, data);
      }

      // Unregister registered names.
      for(var key in registrations) {
        registry.unregister(key);
      }
      registrations = undefined;
      
      // Tell toddicks being monitoring they are no longer being monitoring.
      for(var key in monitoring) {
        var value = monitoring[key];
        value.target.MONITOR_REMOVE(value.MSG);
      }
      monitoring = undefined;
      
      // Tell monitoring toddicks their message.
      for(var msgid in monitors) {
        var MSG = monitors[msgid];
        MSG(reason, data);
      }
      monitors = undefined;
      
      // Signal toddick exit. The handlerWrapper function will ignore this exception.
      throw exit_exception;
      
    }
    
    // #### Function: link
    //
    // Causes both toddicks to exit when either exits. This function is available as this.link 
    // inside message handler functions.
    //
    //     instance = this.link( target )
    //
    // *target* - The toddick that will be linked to this toddick. Can be an toddick instance 
    // object, a registered toddick name, or a handlers object that will be used to create an
    // anonymous toddick.  
    //
    // *instance* - Returns the linked toddick instance.
    //
    internal_this.link = function(target) {
      
      if(typeof target === 'string') {
        target = registry.find(target);
      }
      
      if(typeof target !== 'object') {
        throw new Error('link target not an object');
      }
      
      if(!target.is_toddick) {
        var constructor = toddick(type_name + '/anonymous', target);
        target = new constructor();
      }
      
      internal_this.trace('link', {target: target.id});
      
      external_this.EXIT.monitoringAdd(target);
      internal_this.MONITOR_ADD.sync(target.EXIT);
      
      return target;
      
    }
    
    // #### Function: monitor
    //
    // Causes a message to be sent when the target toddick exits. This function is available as 
    // this.monitor inside message handler functions.
    //
    //     instance = this.monitor( target [, MSG ] )
    // 
    // *target* - the toddick that will be linked to this toddick. Can be a toddick instance object
    // or a registered toddick name.
    //
    // *MSG* - the message to send. Default is EXIT.
    //
    // *instance* - Returns the monitoring toddick instance.
    // 
    internal_this.monitor = function(target, MSG) {

      if(typeof target === 'string') {
        target = registry.find(target);
      }
      
      if (!MSG) {
        MSG = external_this.EXIT;
      }
      
      internal_this.trace('monitor', {target: target.id, msg: MSG.id});
      
      MSG.monitoringAdd(target);
      
      return target;
      
    }
    
    
    // #### Function: unmonitor
    //
    // Stops monitoring previously started using this.monitor. This function is available as 
    // this.unmonitor inside message handler functions.
    //
    //     this.unmonitor( target [, MSG ] )
    //
    // *target* - the toddick to stop monitoring. Can be a registered toddick name or a toddick 
    // instance object.
    //
    // *MSG* - the monitor message to remove. Default is external_this.EXIT.
    //
    internal_this.unmonitor = function(target, MSG) {
      
      if(typeof target === 'string') {
        target = registry.find(target);
      }
      
      if (!MSG) {
        MSG = external_this.EXIT;
      }
      
      internal_this.trace('unmonitor', {target: target.id, msg: MSG.id});
      
      MSG.monitoringRemove(target);
      
    }
    
    // #### Function: register
    //
    // Registers toddick by name. Throws if name already taken. This function is available and as
    // *instance*.register on a toddick instance object as returned by a toddick constructor and as
    // this.register inside message handler functions.
    //
    //     instance.register( name )
    //
    //     this.register( name )
    //
    // *name* - String that identifies the toddick.
    //
    internal_this.register = function(name) {
      registry.register(name, external_this); 
      registrations[name] = true;
      internal_this.trace('registered', {name: name});
    }
    external_this.register =  internal_this.register;
    
    // #### Function: unregister
    //
    // Unregisters a toddick. Throws if not registered. This function is available and as 
    // *instance*.unregister on a toddick instance object as returned by a toddick constructor and
    // as this.unregister inside message handler functions.
    //
    //     instance.unregister( name )
    //
    //     this.unregister( name )
    // 
    // *name* - String that identifies the toddick.
    //
    internal_this.unregister = function(name) {
      if(!registrations[name]) {
        throw new Error('Toddick ' + toddick_id + ' is not registered using name "' + name + '".');
      }
      registry.unregister(name);
      delete registrations[name];
      internal_this.trace('unregistered', {name: name});
    }
    external_this.unregister = internal_this.unregister;
    
    // #### Property: id
    //
    // The toddick's unique id. This property is available as *instance*.id on a toddick instance 
    // object as returned by a toddick constructor and as this.id inside message handler functions.
    //
    //     var id = instance.id
    //
    //     var id = this.id
    //
    internal_this.__defineGetter__('id',
      function () {
        return toddick_id;
      }
    );
    external_this.id = internal_this.id;
    
    // #### Property: trace_enabled
    // 
    // Enables tracing for a toddick. This property is available as *instance*.trace_enabled on a 
    // toddick object as returned by a toddick constructor and as this.trace_enabled inside message
    // handler functions.
    //
    //   instance.trace_enabled = true | false;
    //
    //   this.trace_enabled = true | false;
    // 
    internal_this.trace_enabled = false;
    external_this.__defineSetter__('trace_enabled',
      function (value) {
        internal_this.trace_enabled = value;
      }
    );
    external_this.__defineGetter__('trace_enabled',
      function () {
        return internal_this.trace_enabled;
      }
    );
    
    // #### Function: defineMessage
    //
    // Adds a message handler to the toddick. This function is available as this.defineMessage 
    // inside message handler functions.
    //
    //     defineMessage( handler_name, handler [, inactive_handler ] )
    //
    // *message_name* - the name of the message that will be dispatched.
    //
    // *handler* - the message handler function to be called async by the dispatcher.
    //
    // *inactive_handler* - the handler that is called if the toddick is inactive. This parameter
    // is intended to be used only by the framework itself in order to implement the MONITOR_ADD
    // message.
    //
    internal_this.defineMessage = function(message_name, handler, inactive_handler) {

      var dispatcher = internal_this.createDispatcher(message_name, handler, inactive_handler);
      
      internal_this[message_name] = dispatcher;
      external_this[message_name] = dispatcher;

    }
    
    // #### Function: createDispatcher
    //
    // Creates a message dispatch function. This function is intended for internal use by the 
    // framework.
    //
    //     createDispatcher( message_name, handler [, inactive_handler ] )
    //
    // *message_name* - the name of the message that will be dispatched.
    //
    // *handler* - the message handler function to be called async by the dispatcher.
    //
    // *inactive_handler* - the handler that is called if the toddick is inactive.
    //
    internal_this.createDispatcher = function (message_name, handler, inactive_handler) {
      
      // ##### Function: handlerWrapper
      //
      // Wraps a message handler callback with error handling code.
      //
      //     handlerWrapper( args )
      //
      // *args* - An array of arguments that will be passed to the handler.
      //
      // This is an internal framework function.
      //
      var handlerWrapper = function(args) {
        
        if (is_active) {
          try {
            
            // Call the handler.
            handler.apply(internal_this, args);
            
          } catch(exception) {
            
            // Handle exception thrown by handler. this.exit always throws exit_exception to
            // unwind the stack, so that one is ignored.
            if( exception !== exit_exception ) {
              
              internal_this.trace('handler-exception', 
                {
                  msg:  dispatcher,
                  args: args,
                  exception: exception
                }
              );
              
              // Exceptions are passed to the EXIT handler. If the exception was thrown by the EXIT
              // handler this.exit is called to force an exit instead.
              if(message_name !== 'EXIT') {
                external_this.EXIT.sync('handler-exception', { exception: exception } );
              } else {
                try {
                  internal_this.exit('EXIT-exception', { exception: exception });
                } catch( expected_exit_exception ) {
                  if( expected_exit_exception !== exit_exception ) {
                    log.error('toddick', 'unexpected-exception', { exception: expected_exit_exception } );
                  }
                }
              }
              
            }
          }
        } else {
          if(inactive_handler) {
            inactive_handler.apply(internal_this, args);
          }
        }
        
      }

      // ##### Function: dispatcher
      //
      // The dispatcher function that will be returned.
      //
      //     instance.dispatcher( [ args... ] )
      //
      // *args* -- arguments passed to handler function.
      //
      // This function is available as *instance*.*message_name* on a toddick instance object as
      // returned by a toddick constructor.
      //
      var dispatcher;
      
      dispatcher = function() {
        var saved_arguments = arguments;
        process.nextTick(
          function () {
            internal_this.trace('received', 
              {
                msg: message_name,
                args: saved_arguments, 
                is_active: is_active
              }
            );
            handlerWrapper(saved_arguments);
          }
        );
      };
      
      // ##### Property: is_toddick_message
      //
      // Exists and is true for all toddick dispatchers. This property is available as 
      // *dispatcher*.is_toddick_message on a message dispatch function.
      //
      //      var is_dispatcher = dispatcher.is_toddick_message;
      //
      dispatcher.is_toddick_message = true;
    
      // ##### Property: id
      //
      // An unique id for the dispatcher instance. This property is available as *dispatcher*.id on
      // a message dispatch function.
      //
      //      var id = dispatcher.id;
      //
      // The id is unique even among toddicks of the same type.
      //
      dispatcher.id = toddick_id + '/' + message_name;
      
      // ##### Property: toddick
      // 
      // An the toddick that will receive messages sent via the dispatcher. This property is
      // available  as *dispatcher*.toddick on a message dispatch function.
      //
      dispatcher.toddick = external_this;
      
      // ##### Function: sync
      //
      // Calls the message handler synchronously with error handling. This function is available
      // as *dispatcher*.sync on a message dispatch function.
      //
      //     dispatcher.sync( [ args... ] )
      //
      // *args* - The arguments that will be passed to the handler.
      //
      dispatcher.sync = function() {
        handlerWrapper(arguments);
      };

      // ##### Function: preproc      
      //
      // Returns a new dispatcher function that calls a provided function before calling the 
      // origional message handler function. This function is available as *dispatcher*.preproc
      // on a message dispatch function.
      //
      //      var dispatcher = dispatcher.preproc( name, 
      //        function( args_in ) { 
      //          ...
      //          return args_out;
      //        } 
      //      );
      //
      // *dispatcher* - A toddick message dispatch function.
      //
      // *name* - A name that will show up in trace output.
      //
      // *args_in* - The function provided is called with the arguments object passed to the 
      // dispatcher.
      //
      // *args_out* - The function provided should return the arguments that will be passed to the
      // message handler. If the function returns undefined the hander function is not called.
      //
      // *dispatcher* - The message dispatcher that will call the preproc function.
      //
      dispatcher.preproc = function (name, f) {
        return internal_this.createDispatcher(
          message_name,  // new dispatcher will have same id
          function() {
            var args = f(arguments);
            internal_this.trace(name, 
              {
                msg: message_name,
                args: args
              }
            );
            if(args) {
              handlerWrapper(args);
            }
          }
        );
      }
      
      // ##### Function: withArgs
      //
      // Creates a message dispatcher with bound arguments. This function is available as 
      // *dispatcher*.withArgs on a message dispatch function.
      //
      //     var bound_msg = dispatcher.withArgs( [ args... ] );
      //
      // When the resulting message is sent, the arguments to this function provided will be passed
      // to the handler function followed by any additional arguments provided when the message
      // dispatch function was called.
      //
      dispatcher.withArgs = function() {
        var saved_args = arguments;
        return this.preproc( 'with-args', 
          function(args) {
            return appendArgs(saved_args, args);
          }
        );
      }
      
      // ##### Function: monitoringAdd
      //
      // Adds a toddick to the monitoring property. This function is intended for framework
      // internal use only.
      //
      dispatcher.monitoringAdd = function(target) {
        
        var key = dispatcher.id + ':' + target.id;
        if(monitoring[key]) {
          throw new Error(
            'Alread monitoring toddick ' + target.id + ' using message ' + dispatcher.id
          );
        }
        
        var MSG = dispatcher.preproc( 'monitoring-exit',
          function (args) {
            if(monitoring[key]) {
              delete monitoring[key];
              return args;
            } else {
              return undefined;
            }
          }
        );
        
        MSG.target = target;
        
        monitoring[key] = MSG;
        
        target.MONITOR_ADD(MSG);
        
      }
      
      // ##### Function: monitoringRemove
      //
      // Removes a toddick from the monitoring proeprty. This function is intended for 
      // framework internal use only.
      //
      dispatcher.monitoringRemove = function(target) {
        
        var key = dispatcher.id + ':' + target.id;
        if(!monitoring[key]) {
          throw new Error(
            'Not monitoring toddick ' + target.id + ' using message ' + dispatcher.id
          );
        }
        
        delete monitoring[key];
        
        target.MONITOR_REMOVE(dispatcher.id);
        
      }
      
      return dispatcher;
      
    }
    
    // Create default MONITOR_ADD mesage dispatcher and handler.
    internal_this.defineMessage('MONITOR_ADD',
      function (MSG) { // when active
        monitors[MSG.id] = MSG;
      },
      function (MSG) { // when inactive
        MSG('already-exited', {});
      }
    );

    // Create MONITOR_REMOVE mesage dispatcher and handler
    internal_this.defineMessage('MONITOR_REMOVE',
      function (msgid) {
        delete monitors[msgid];
      }
    );
    
    // Create the default exit message dispatcher. Toddick can override.
    internal_this.defineMessage('EXIT', 
      function (reason, data) {
        this.exit(reason, data);
      }
    );

    
    // #### Constructor Body
  
    // Create Dispatcher Functions
    for(var handler_name in handlers) {
      internal_this.defineMessage(handler_name, handlers[handler_name]);
    }

    // Send INIT message
    if(external_this.INIT) {
      external_this.INIT.apply(external_this, arguments);
    }
    
    internal_this.trace('created');
    
    // Constructor returns this to allow for uses like:
    //
    //      var instance = constructor.apply(null, args);
    return this;
    
  }

  // ### Property: constructor.trace_enabled
  //
  // Enables/disables tracing for all toddicks of this type.
  //  
  constructor.trace_enabled = false;
  
  // ### Property: constructor.is\_toddick\_constructor
  //
  // Exists and is true on all toddick constructor functions.
  //
  constructor.is_toddick_constructor = true;
  
  // Export the toddick type if we can
  if(export_name && export_module) {
    export_module.exports[export_name] = constructor;
  }
  
  return constructor;

}

// ## Property: toddick.trace_enabled 
//
// Enables/disables tracing for all toddicks.
//
toddick.trace_enabled = (process.env['TODDICK_TRACE'] === 'enabled');

// ## Function: toddick.find
//
// Returns a registered toddick. Throws if not found.
//
//     instance = toddick.find( name )
//
// *name* - String that identifies the toddick.
//
// *instance* - Returns the toddick instance object found.
//
toddick.find = function(name) {
  var found = registry.find(name);
  if(toddick.trace_enabled) {
    log.trace('toddick', 'found', {name: name, found: found.id});
  }
  return found;
}

// ## Function: toddick.tryFind
// 
// Returns a registered toddick or undefined if not found.
//
//     instance = toddick.tryFind( name )
// 
// *name* - String that identifies the toddick.
//
// *instance* - Returns the toddick instance object found.
//
toddick.tryFind = function(name) {
  var found = registry.tryFind(name);
  if(toddick.trace_enabled) {
    log.trace('toddick', 'found', {name: name, found: found ? found.id : undefined});
  }
  return found;
}

// ## Function: toddick.makeTypeName
//
// Construct the name used in trace output for toddick of a given type.
// 
//      name = toddick.makeTypeName( export_name, export_module )
//
// *export_module* - The module in which the toddick type is defined.
//
// *export_name* - The name used to export the toddick type.
//
// Assign a new function to toddick.makeTypeName to change how trace names are generated.
//
toddick.makeTypeName = function(export_name, export_module) {
  var module_name = path.basename(export_module.filename, path.extname(export_module.filename));
  return module_name + '/' + export_name;
}
  
// Export toddick function/object
module.exports = toddick;
