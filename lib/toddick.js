var path = require('path');
var util = require('util');
var log = require('./log');

var next_toddick_id = 1;

//
// Create a toddick class.
//
var toddick = function(handlers) {
   
  var type_name    = 'toddick';

  var constructor = function() {
    
    var toddick_id = type_name + ':' + next_toddick_id++;
    var self = this;
    var handler_this = {};
    var state = {};
    var monitors = {};
    var monitoring = {};
    var is_active = true;
    var exit_reason = undefined;
    
    handler_this.self = self;
    
    handler_this.trace = function(action, data) {
      if (toddick.trace_enabled || constructor.trace_enabled || self.trace_enabled) {
        log.trace(toddick_id, action, data);
      }
    }
    
    handler_this.info = function(action, data) {
      log.info(toddick_id, action, data);
    }
    
    handler_this.error = function(action, data) {
      log.error(toddick_id, action, data);
    }
    
    handler_this.exit = function(reason) {
      
      handler_this.trace('exiting', {reason: reason,  monitoring: monitoring, monitors: monitors});
      
      is_active = false;
      exit_reason = reason;
      
      var key, value;
      
      for(key in monitoring) {
        value = monitoring[key];
        monitoring.target.removeMonitor(value.msg);
      }
      monitoring = undefined;
      
      for(key in monitors) {
        value = monitors[key];
        value.msg.self.internal.exitedMonitor(self, value.msg, value.args);
      }
      monitors = undefined;
      
    }
    
    handler_this.link = function(target) {
      handler_this.trace('link', {target: target});
      handler_this.monitor(target);
      self.internal.addMonitor(target.exit);
    }
    
    handler_this.monitor = function(target, msg, args) {
      
      if (!msg) {
        msg = self.exit;
        args = [target.id + ' exited'];
      }
      
      handler_this.trace('monitor', {target: target, msg: msg, args: args});
      
      var key = target.id + '-' + msg.id;
      monitoring[key] = {target: target, msg: msg, args: args};
      
      target.internal.addMonitor(msg, args);
      
    }
    
    handler_this.unmonitor = function(target, msg) {
      
      if (!msg) {
        msg = self.exit;
      }
      
      handler_this.trace('unmonitor', {target: target, msg: msg});
      
      var key = target.id + '-' + msg.id;
      var deleted = delete monitoring[key];
      
      if(deleted) {
        target.internal.removeMonitor(msg);
      }
      
    }
    
    handler_this.__defineGetter__('state',
      function () {
        return state;
      }
    );
    
    self.__defineGetter__('is_toddick',
      function() {
        return true;
      }
    );
     
    self.__defineGetter__('id',
      function () {
        return toddick_id;
      }
    );
    
    self.__defineGetter__('is_active',
      function () {
        return is_active;
      }
    );
    
    self.__defineGetter__('exit_reason',
      function () {
        return exit_reason;
      }
    );
    
    self.trace_enabled = false;
    
    var createDispatcher = function(handler_name, handler, inactive_handler) {
      
      var handler_wrapper = function(saved_arguments) {
        
        handler_this.trace('received', 
          {
            message: handler_name,
            arguments: saved_arguments, 
            is_active: is_active
          }
        );
        
        if (is_active) {
          try {
            handler.apply(handler_this, saved_arguments);
          } catch(exception) {
            if(handler_name === 'exit') {
              handler_this.exit('Error occured in exit handler. ' + exception.stack);
            } else {
              self.exit.handler.apply(handler_this, [[exception]]);
            }
          }
        } else {
          if(inactive_handler) {
            inactive_handler.apply(handler_this, saved_arguments);
          }
        }
        
      }

      var dispatcher = function() {
        var saved_arguments = arguments;
        process.nextTick(
          function () {
            handler_wrapper(saved_arguments);
          }
        );
      };
    
      dispatcher.id = toddick_id + ':' + handler_name;
      dispatcher.handler = handler_wrapper;
      dispatcher.self = self;
      
      return dispatcher;
      
    }
  
    var handler_name;
    for(handler_name in handlers) {
      self[handler_name] = createDispatcher(handler_name, handlers[handler_name]);
    }
    
    if(!self.exit) {
      self.exit = createDispatcher('exit', 
        function (reason) {
          this.exit(reason);
        }
      );
    }
    
    self.internal = {};
    
    self.internal.addMonitor = createDispatcher('addMonitor',
      // when active
      function (msg, args) { 
        monitors[msg.id] = {msg: msg, args: args};
      },
      // when inactive
      function (msg, args) { 
        msg.self.internal.exitedMonitor(self, msg, args);
      }
    );

    self.internal.removeMonitor = createDispatcher('removeMonitor',
      function (msg) {
        delete monitors[msg.id];
      }
    );
    
    self.internal.exitedMonitor = createDispatcher('exitedMonitor',
      function (target, msg, args) {
        var key = target.id + '-' + msg.id;
        delete monitoring[key];
        msg.handler.apply(null, [args]);
      }
    );
    
    if(self.init) {
      self.init.apply(self, arguments);
    }
    
    handler_this.trace('created');
    
  }
  
  constructor.setTypeName = function(value) {
    type_name = value;
  };
  
  constructor.__defineGetter__('is_toddick_constructor',
    function () {
      return true;
    }
  );
  
  constructor.trace_enabled = false;
  
  return constructor;

}

//
// When true all toddick instances will generate trace output. Defaults to true unless the NODE_ENV
// environment variable is "production". Production tracing can be enabled by default by setting the
// TODDICK_TRACE environment variable to "enabled".
//
toddick.trace_enabled = 
  (process.env['NODE_ENV'] !== 'production') || 
  (process.env['TODDICK_TRACE'] === 'enabled');


//
// Construct a type for a toddick. The default uses the module file name and the export name.
// The type name is part of the toddick's id and is used in log output.
//
toddick.makeTypeName = function(mod, export_name, constructor) {
  var mod_name = path.basename(mod.filename, path.extname(mod.filename));
  return mod_name + '.' + export_name;
}
  
//
// Registers a module that contains toddicks with the toddick framework. This
// allows the framework to use the module id and the exported Toddick names in
// toddick log output. A module should call toddick.register after toddicks
// have been exported. For example:
//
//   var toddick = require('toddick');
//
//   exports.MyToddick = toddick(...);
//
//   toddick.register( module );
//
toddick.register = function( mod ) {
  
  var export_name;
  for( export_name in mod.exports ) {

    var export_value = mod.exports[export_name];
    if( export_value.is_toddick_constructor ) {
      
      var type_name = toddick.makeTypeName(mod, export_name, export_value);
      export_value.setTypeName(type_name);
      
      if(toddick.trace_enabled) {
        log.trace('toddick', 'register', {file_name: mod.filename, type_name: type_name});
      }
      
    }

  }

}


// Export the toddick function/object we have built.
module.exports = toddick;
