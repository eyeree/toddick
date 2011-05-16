//
// Tracing and logging support functions.
//

var log = exports;

// ## Property: log.stream
//
// A writable stream to which toddick log output is be written. Set to a different
// writable stream to direct log output to a file.
//
log.stream = process.stdout;

// ## Property: log.seperator
//
// String used to seperate the log output fields. Default is a tab character. Assign a different
// string to change the field seperator.
//
log.seperator = "\t";

// ## Property: log.eol
//
// String used at the end of a log line. Default is a newline character. Assign a different string
// to change the end of line marker.
//
log.eol = "\n";

// ## Function: log.makeDataString
//
// Serializes an object to a string for log output. Default uses JSON.stringify. Assign a different
// function to change the data output format.
//
log.makeDataString = function(data) {

  var data_string;

  if(typeof data === "undefined") {
    data_string = "{}";
  } else {
    try {
      data_string = JSON.stringify(data);
    } catch(e) {
      data_string = "(JSON.strigify failed: " + e + ")";
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



