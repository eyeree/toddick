//
// Implements the toddick registry.
//

var registry = exports;

// Maps toddick name to registered toddick.
var map = {};

// ## Function: registry.register
//
// Registers a toddick.
//
//     registry.register( name, target )
//
// *name* - The name under which the target is registered.
//
// *target* - The toddick to register.
//
// This is an internal framework function. Use *instance*.register on a toddick instance object
// or this.register inside a message handler function to register a toddick.
//
registry.register = function(name, target) {
  
  if(map[name]) {
    throw new Error("A toddick with the name " + name + " is already registered.");
  }
  
  map[name] = target;
  
}

// ## Function: registry.unregister
//
// Unregisters a toddick.
//
//     registry.register( name )
//
// *name* - The name under which the target is registered.
//
// This is an internal framework function. Use *instance*.unregister on a toddick instance object
// or this.unregister inside a message handler function to unregister a toddick.
//
registry.unregister = function(name) {
  delete map[name];
}

// ## Function: registry.find
// 
// Finds a registered toddick. Throws if no toddick is registered using the specified name.
//
//     instance = registry.find( name )
//
// *name* - The name of the toddick to find.
//
// *instance* - The toddick that was found.
//
registry.find = function(name) {
  var found = map[name];
  if (!found) {
    throw new Error("No toddick with the name " + name + " has been registered.");
  }
  return found;
}

// ## Function: registry.tryFind
// 
// Finds a registered toddick.
//
//     instance = registry.find( name )
//
// *name* - The name of the toddick to find.
//
// *instance* - The toddick that was found or undefined if no toddick is registered with the 
// specified name.
//
registry.tryFind = function(name) {
  return map[name];
}

