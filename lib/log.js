//
// Tracing and logging support functions.
//

var log = exports;

// ## Property: log.stream
//
// A writable stream to which toddick log output is be written.
//
log.stream = process.stdout;

// ## Proxyer: log.prefix
//
// String used to prefix all log output.
//
log.prefix = "\t-----------------------------\n\t"

// ## Property: log.seperator
//
// String used to seperate the log output fields.
//
log.seperator = "\n\t";

// ## Property: log.eol
//
// String used at the end of a log line.
//
log.eol = "\n";

// ## Function: normalizeData
//
// Internal helper function that replaces toddick and dispatcher objects in trace output
// with just their id.
//
log.normalizeData = function( data_in ) {
  
  var data_out = { };
  
  for( var name in data_in ) {
    
    var value = data_in[ name ];
    
    if( typeof value === 'object' && value != null ) {
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


// ## Function: log.makeDataString
//
// Serializes an object to a string for log output.
//
log.makeDataString = function(data) {

  var data_string;
  
  if(typeof data === "undefined" || data === null) {
    data_string = "{}";
  } else {
    try {
      data = log.normalizeData(data);
      data_string = JSON.stringify(data);
    } catch(e) {
      data_string = "(JSON.strigify failed: " + e + ")";
      //console.error("\n", data_string, "\n\n", data, "\n");
    }
  }

  return data_string;

}

// ## Function: log.makeTimeString
//
// Creates the date/time string used in log output. Default uses Date.toUTCString. Assign a 
// different function to change the timestamp output format.
//
log.makeTimeString = function() {
  var date = new Date();
  return date.toUTCString();
}

// ## Function: log.write
//
// Writes log output. 
//
//     log.output( type, entity, activity [ , data ] )
//
// *type* - indicates the type of log output, e.g. trace, info or error.
//
// *entity* - a string identifing the entity that is doing the logging
//
// *activity* - a string identifing the activity being logged
//
// *data* - an object containing data to be included in the log output.
//
// The entity and activity values should be short strings. The details of the
// log output should be included in the data object. For example:
//
//     log.write(
//       "info", 
//       "my-module", 
//       "initializing", 
//       {
//         foo: some_param 
//         bar: some_other_param 
//       }
//     );
//
// A timestamp is included in the log output. It is generated using the log.makeLogTimeString 
// function.
//
// The data object is converted to a string using log.makeDataString.
//
// Fields are seperated by the log.seperator string. The output is terminated by the log.eol string.
//
// The log output is written to the log.stream stream.
//
log.write = function(type, entity, activity, data) {

  var data_string = log.makeDataString(data);
  var time_string = log.makeTimeString();

  var entry =
    log.prefix  + 
    time_string + log.seperator + 
    type        + log.seperator + 
    entity      + log.seperator + 
    activity    + log.seperator + 
    data_string + log.eol;

  log.stream.write(entry);

}

// ## Function: log.trace
//
// Writes trace level log output. Calls toddick.log with "trace" for the type
// parameter.
//
log.trace = function(entity, activity, data) {
  log.write("trace", entity, activity, data);
}

// ## Function: log.info
//
// Writes information level log output. Calls toddick.log with "info" for the
// type parameter.
//
log.info = function(entity, activity, data) {
  log.write("info", entity, activity, data);
}

// ## Function: log.error
//
// Writes error level log output. Calls toddick.log with "error" for the type
// parameter.
//
log.error = function(entity, activity, data) {
  log.write("error", entity, activity, data);
}


