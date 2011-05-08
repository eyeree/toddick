
var log = exports;

//
// A writable stream to which toddick log output is be written.
//
log.stream = process.stdout;


//
// String used to seperate the log output fields. Default is a tab character.
//
log.seperator = "\t";


//
// String used at the end of a log line. Default is a newline character.
//
log.eol = "\n";


//
// Serializes an object to a string for log output. Default uses JSON.stringify.
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


//
// Creates the date/time string used in log output. Default uses
// Date.toUTCString.
//
log.makeTimeString = function() {
  var date = new Date();
  return date.toUTCString();
}


//
// Writes log output. The output concists of the following fields:
//
//   time     - the time the log output was created
//   type     - indicates the type of log output, e.g. trace, info or error.
//   entity   - a string identifing the entity that is doing the logging
//   activity - a string identifing the activity being logged
//   data     - an object containing data to be included in the log output
//
// The entity and activity values should be short strings. The details of the
// log output should be included in the data object. For example:
//
//   log.write("info", "my-module", "initializing", { param: some_param });
//
// The time field is created using toddick.makeLogTimeString.
//
// The data object is converted to a string using log.makeDataString.
//
// Fields are seperated by the log.seperator string. The output is
// terminated by the log.eol string.
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


//
// Writes trace level log output. Calls toddick.log with "trace" for the type
// parameter.
//
log.trace = function(entity, activity, data) {
  log.write("trace", entity, activity, data);
}


//
// Writes information level log output. Calls toddick.log with "info" for the
// type parameter.
//
log.info = function(entity, activity, data) {
  log.write("info", entity, activity, data);
}


//
// Writes error level log output. Calls toddick.log with "error" for the type
// parameter.
//
log.error = function(entity, activity, data) {
  log.write("error", entity, activity, data);
}



