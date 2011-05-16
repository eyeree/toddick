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

// ## Function: toddick 
//
// Creates a toddick constructor.
//
//     constructor = toddick( [export_name [, export_module ] , ] handlers )
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
  var trace_name = export_name || 'toddick';
  
  // Override the default trace_name if we can.
  if(export_name && export_module) {
    trace_name = toddick.makeTraceName(export_name, export_module);
  }
  
  // ### Function: Toddick Constructor
  //
  // Constructor returned by toddick function.
  //
  //     instance = new constructor( [ args ] )
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
    // that allow the toddick to interact with the framework.
    //
    var external_this = this;             
    var internal_this = {};

    // #### private data
    //
    // The private data maintained by the framework for the toddick is kept in the constructor
    // function's closure as local variables.
    
    // The toddick's unique id.
    var toddick_id = trace_name + ':' + next_toddick_ordinal++;  
    
    // A place for the toddick to store it's state.
    var state = {};
    
    // Tracks the toddicks monitoring this toddick.
    var monitors = {};
    
    // Tracks the toddicks this toddick is monitoring.
    var monitoring = {};
    
    // Indicates if this toddick is active or if it has exited.
    var is_active = true;
    
    // The value passed to this.exit will be saved here.
    var exit_reason = undefined;
    
    // Tracks the global names assigned to this toddick.
    var registrations = {};       
    
    // #### Property: self
    //
    // An alias for the toddick's external object.
    //
    // This property is available as this.self inside message handler functions.
    //
    internal_this.self = external_this;

    // #### Function: this.trace
    //    
    // Writes a trace message to the toddick log.
    //
    //     this.trace( action [, data ] )
    // 
    // *action* - A string describing the activity being logged.
    //
    // *data* - An optional object that is written to the log as a JSON string.
    //
    // This function is available as this.trace inside message handler functions.
    //
    internal_this.trace = function (action, data) {
      if (toddick.trace_enabled || constructor.trace_enabled || external_this.trace_enabled) {
        log.trace(toddick_id, action, data);
      }
    }
    
    // #### Function: this.info
    //
    // Writes an informational message to the toddick log.
    //
    //     this.info( action [, data ] )
    //
    // *action* - A string describing the activity being logged.
    //
    // *data* - An optional object that is written to the log as a JSON string.
    //
    //  This function is available as this.info inside message handler functions.
    //
    internal_this.info = function(action, data) {
      log.info(toddick_id, action, data);
    }
    
    // #### Function: this.error
    //
    // Writes an error message to the toddick log.
    //
    //     this.error( action [, data ] )
    //
    // *action* - A string describing the activity being logged.
    //
    // *data* - An optional object that is written to the log as a JSON string.
    //
    // This function is available as this.error inside message handler functions.
    //
    internal_this.error = function(action, data) {
      log.error(toddick_id, action, data);
    }
    
    // ### Function: this.exit
    //
    // Makes the toddick inactive.
    //
    //     this.exit( [ reason ] )
    //
    // *reason* - An optional value indicating why the toddick is exiting.
    //
    // This function is available as this.exit inside message handler functions.
    //
    internal_this.exit = function (reason) {
      
      internal_this.trace('exiting', {reason: reason,  monitoring: monitoring, monitors: monitors});
      
      is_active = false;
      exit_reason = reason;
      
      var key, value;

      // Unregister registered names.
      for(key in registrations) {
        registry.unregister(key);
      }
      
      // Tell toddicks being monitored they are no longer being monitored.
      for(key in monitoring) {
        value = monitoring[key];
        value.target.removeMonitor(value.msg);
      }
      
      // Tell monitoring toddicks this toddick is exiting.
      for(key in monitors) {
        value = monitors[key];
        value.msg.self.exitedMonitor(external_this, value.msg, value.args);
      }
      
    }
    
    // #### Function: this.link
    //
    // Causes both toddicks to exit when either exits.
    //
    //     instance = this.link( target )
    //
    // *target* - The toddick that will be linked to this toddick. Can be an object or a registered
    // name.
    //
    // *instance* - Returns the linked toddick instance. Useful when target is a name.
    //
    // This function is available as this.link inside message handler functions.
    //
    internal_this.link = function(target) {
      
      // Find toddick with name.
      if(typeof target === 'string') {
        target = registry.find(target);
      }
      
      internal_this.trace('link', {target: target.id});
      
      // Set bi-directional monitors.
      internal_this.monitor(target);
      external_this.addMonitor(target.exit);
      
      return target;
      
    }
    
    // #### Function: this.monitor
    //
    // Causes a message to be sent when the target toddick exits.
    //
    //     instance = this.monitor( target [, msg [, args ] ] )
    // 
    // *target* - the toddick that will be linked to this toddick. Can be a registered name.
    //
    // *msg* - the message to send. Default is external_this.exit.
    //
    // *args* - an array of arguments to send with the message.
    //
    // *instance* - Returns the monitored toddick instance. Useful when target is a name.
    // 
    // This function is available as this.monitor inside message handler functions.
    //
    internal_this.monitor = function(target, msg, args) {

      // Find toddick with name.      
      if(typeof target === 'string') {
        target = registry.find(target);
      }
      
      // Use external_this.exit as default message.
      if (!msg) {
        msg = external_this.exit;
        args = [target.id + ' exited'];
      }
      
      internal_this.trace('monitor', {target: target.id, msg: msg.id, args: args});
      
      // Remember the toddicks we are monitoring.
      var key = target.id + '-' + msg.id;
      monitoring[key] = {target: target, msg: msg, args: args};
      
      // Tell the toddick to inform us when it exits.
      target.addMonitor(msg, args);
      
      return target;
      
    }
    
    // #### Function: this.unmonitor
    //
    // Stops monitoring previously started using this.monitor.
    //
    //     this.unmonitor( target [, msg ] )
    //
    // *target* - the toddick to stop monitoring. Can be a registered name.
    //
    // *msg* - the monitor message to remove. Default is external_this.exit.
    //
    // This function is available as this.unmonitor inside message handler functions.
    //
    internal_this.unmonitor = function(target, msg) {
      
      // Find toddick with name.
      if(typeof target === 'string') {
        target = registry.find(target);
      }
      
      // Use external_this.exit as default message.
      if (!msg) {
        msg = external_this.exit;
      }
      
      internal_this.trace('unmonitor', {target: target.id, msg: msg.id});
      
      // No longer monitoring the toddick.
      var key = target.id + '-' + msg.id;
      var deleted = delete monitoring[key];
      
      // Tell toddick it is no longer being monitored.
      if(deleted) {
        target.removeMonitor(msg);
      }
      
    }
    
    // #### Function: this.register
    //
    // Registers toddick by name. Throws if name already taken.
    //
    //     this.register( name )
    //
    // *name* - String that identifies the toddick.
    //
    // This function is available as this.register inside message handler functions.
    //
    internal_this.register = function(name) {
      registry.register(name, external_this); 
      registrations[name] = true;
      internal_this.trace('registered', {name: name});
    }
    
    // #### Function: this.unregister
    // 
    // Unregisters a toddick. Throws if not registered.
    //
    //     this.unregister( name )
    // 
    // *name* - String that identifies the toddick.
    //
    // This function is available as this.unregister inside message handler functions.
    //
    internal_this.unregister = function(name) {
      if(!registrations[name]) {
        throw new Error('Toddick ' + toddick_id + ' is not registered using name "' + name + '".');
      }
      registry.unregister(name);
      delete registrations[name];
      internal_this.trace('unregistered', {name: name});
    }
    
    // #### Function this.find
    //
    // Returns a registered toddick. Throws if not found. 
    //
    //     instance = this.find( name )
    //
    // *name* - String that identifies the toddick.
    //
    // *instance* - Returns the registered toddick instance. 
    //
    // This function is available as this.find inside message handler functions.
    //
    internal_this.find = function(name) {
      var found = registry.find(name);
      internal_this.trace('found', {name: name, found: found.id});
      return found;
    }

    // #### Function: this.tryFind
    // 
    // Returns a registered toddick or undefined if not found.
    //
    //     instance = this.tryFind( name )
    // 
    // *name* - String that identifies the toddick.
    //
    // This function is available as this.tryFind inside message handler functions.
    //
    internal_this.tryFind = function(name) {
      var found = registry.tryFind(name);
      internal_this.trace('found', {name: name, found: found.id});
      return found;
    }
    
    // #### Property: this.state 
    //
    // An object where the toddick can store it's state.
    //
    // This property is available as this.state inside message handler functions.
    //
    internal_this.__defineGetter__('state',
      function () {
        return state;
      }
    );
    
    // #### Function: *instance*.register
    //
    // Registers toddick by name. Throws if name already taken.
    //
    //     instance.register( name )
    //
    // *name* - String that identifies the toddick.
    //
    // This function is available and as *instance*.register on a toddick instance object as 
    // returned by a toddick constructor.
    //
    external_this.register = internal_this.register;
    
    // #### Function: *instance*.unregister
    //
    // Unregisters a toddick. Throws if not registered.
    //
    //     this.unregister( name )
    // 
    // *name* - String that identifies the toddick.
    //
    // This function is available and as *instance*.unregister on a toddick instance object as 
    // returned by a toddick constructor.
    //
    external_this.unregister = internal_this.unregister;
    
    // #### Property: *instance*.is_toddick
    //
    // Exists and is true for all toddick objects.
    //
    // This property is available as *instance*.is_toddick on a toddick instance object as returned
    // by a toddick constructor.
    //
    external_this.__defineGetter__('is_toddick',
      function() {
        return true;
      }
    );
     
    // #### Property: *instance*.id
    //
    // The toddick's unique id.
    //
    // This property is available as *instance*.id on a toddick instance object as returned by a
    // toddick constructor.
    //
    external_this.__defineGetter__('id',
      function () {
        return toddick_id;
      }
    );
    
    // #### Property: *instance*.is_active
    //
    // Indicates if the toddick is active or if it has exited.
    //
    // This property is available as *instance*.is_active on a toddick instance object as returned
    // by a toddick constructor.
    //
    external_this.__defineGetter__('is_active',
      function () {
        return is_active;
      }
    );
    
    // #### Property: *instance*.exit_reason
    //
    // After the toddick has exited, this property contains the value passed to the exit function.
    //
    // This property is available as *instance*.exit_reason on a toddick instance object as
    // returned by a toddick constructor.
    //
    external_this.__defineGetter__('exit_reason',
      function () {
        return exit_reason;
      }
    );
    
    // #### Property: *instance*.trace_enabled
    // 
    // Enables tracing for a toddick.
    //
    // This property is available as *instance*.trace_enabled on a toddick object as returned by
    // a toddick constructor.
    // 
    external_this.trace_enabled = false;
    
    // #### Function: createDispatcher
    //
    // Builds a dispatch function.
    //
    //     createDispatcher( handler_name, handler [, inactive_handler ] )
    //
    // *message_name* - the name of the message that will be dispatched.
    //
    // *handler* - the message handler function to be called async by the dispatcher.
    //
    // *inactive_handler* - the handler that is called if the toddick is incative. 
    //
    // This is an internal framework function.
    //
    var createDispatcher = function(message_name, handler, inactive_handler) {
      
      // ##### Function: handler_wrapper
      //
      // Wraps a message handler callback with error handling code.
      //
      //     handler_wrapper( args )
      //
      // *args* - An array of arguments that will be passed to the handler.
      //
      // This is an internal framework function.
      //
      var handler_wrapper = function(args) {
        
        internal_this.trace('received', 
          {
            message: message_name,
            arguments: args, 
            is_active: is_active
          }
        );
        
        if (is_active) {
          try {
            handler.apply(internal_this, args);
          } catch(exception) {
            internal_this.error('handler-error', 
              {
                message: message_name,
                arguments: args,
                exception: exception
              }
            );
            if(message_name === 'exit') {
              internal_this.exit('Error occured in exit handler. ' + exception.stack);
            } else {
              external_this.exit.handler.apply(internal_this, [[exception]]);
            }
          }
        } else {
          if(inactive_handler) {
            inactive_handler.apply(internal_this, args);
          }
        }
        
      }

      // ##### Function: *instance*.*dispatcher*
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
      var dispatcher = function() {
        var saved_arguments = arguments;
        process.nextTick(
          function () {
            handler_wrapper(saved_arguments);
          }
        );
      };
    
      // ##### Property: *instance*.*dispatcher*.id
      //
      // An unique id for the dispatcher instance. The id is unique even among toddicks of the same
      // type.
      //
      // This property is available  as *instance*.*message_name*.id on a toddick object.
      //
      dispatcher.id = toddick_id + ':' + handler_name;
      
      // ##### Property: *instance*.*dispatcher*.self
      // 
      // An the toddick that will receive messages sent via the dispatcher.
      //
      // This property is available  as *instance*.*message_name*.self on a toddick object.
      //
      dispatcher.self = external_this;
      
      // ##### Function: *instance*.*dispatcher*.handler
      //
      // Calls the handler synchronously with error handling.
      //
      //     instance.dispatcher.handler( [ args ] )
      //
      // *args* - An array of arguments that will be passed to the handler.
      //
      // This is an internal framework function.
      //
      dispatcher.handler = handler_wrapper;
      
      return dispatcher;
      
    }
    
    // #### Constructor Body
  
    // Create Dispatcher Functions
    var handler_name;
    for(handler_name in handlers) {
      external_this[handler_name] = createDispatcher(handler_name, handlers[handler_name]);
    }
    
    // Create the default exit message dispatcher. Toddick can override.
    if(!external_this.exit) {
      external_this.exit = createDispatcher('exit', 
        function (reason) {
          this.exit(reason);
        }
      );
    }
    
    // Create addMonitor dispatcher. Toddick cannot override.
    external_this.addMonitor = createDispatcher('addMonitor',
      function (msg, args) { // when active
        monitors[msg.id] = {msg: msg, args: args};
      },
      function (msg, args) { // when inactive
        msg.self.exitedMonitor(external_this, msg, args);
      }
    );

    // Create removeMonitor dispatcher. Toddick cannot override.
    external_this.removeMonitor = createDispatcher('removeMonitor',
      function (msg) {
        delete monitors[msg.id];
      }
    );
    
    // Create exitedMonitor dispatcher. Toddick cannot override.
    external_this.exitedMonitor = createDispatcher('exitedMonitor',
      function (target, msg, args) {
        var key = target.id + '-' + msg.id;
        delete monitoring[key];
        msg.handler.apply(null, [args]);
      }
    );
    
    // Send init message
    if(external_this.init) {
      external_this.init.apply(external_this, arguments);
    }
    
    internal_this.trace('created');
    
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
    log.trace('toddick', 'found', {name: name, found: found.id});
  }
  return found;
}

// ## Function: toddick.makeTraceName
//
// Construct the name used in trace output for toddick of a given type.
// 
//      name = toddick.makeTraceName( export_name, export_module )
//
// *export_module* - The module in which the toddick type is defined.
//
// *export_name* - The name used to export the toddick type.
//
// Assign a new function to toddick.makeTraceName to change how trace names are generated.
//
toddick.makeTraceName = function(export_name, export_module) {
  var module_name = path.basename(export_module.filename, path.extname(export_module.filename));
  return module_name + '.' + export_name;
}
  
// Export toddick function/object
module.exports = toddick;
