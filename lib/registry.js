var registry = exports;

var map = {};

registry.register = function(name, target) {
  
  if(map[name]) {
    throw new Error("A toddick with the name " + name + " is already registered.");
  }
  
  map[name] = target;
  
}

registry.unregister = function(name) {
  return delete map[name];
}

registry.find = function(name) {
  var found = map[name];
  if (!found) {
    throw new Error("No toddick with the name " + name + " has been registered.");
  }
  return found;
}

registry.tryFind = function(name) {
  return map[name];
}

