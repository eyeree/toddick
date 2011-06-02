var toddick = require( 'toddick' );
var timer = require( 'toddick/lib/timer' );

var url = require( 'url' );
var node_http = require( 'http' );

var http = exports;

// ## Toddick: Client
//
// An HTTP client that sends and receives JSON format objects.
//
toddick( 'JsonClient', module,
  {
    
    // ### Message: INIT
    //
    INIT: function( method, req_url, content, MSG ) {
      
      if( method !== 'PUT' && method !== 'POST' ) {
        MSG = content;
        content = undefined;
      }
      
      this.MSG = MSG;
      
      var parsed = url.parse( req_url );
      
      var options = {
        method:  method,
        host:    parsed.hostname,
        port:    parsed.port,
        path:    parsed.pathname,
        headers: {
          'accept' : 'application/json'
        }
      };
      
      if( content ) {
        options.headers[ 'content-type' ] = 'application/json';
      }
      
      this.req = node_http.request( options, this.RESPONSE.sync );
      
      this.req.on( 'error', this.ERROR.sync );
      
      if( content ) {
        this.trace( 'sent', { content: content } );
        this.req.end( JSON.stringify( content ) );
      } else {
        this.req.end();
      }
      
      this.link( new timer.Timeout( 5000, this.TIMEOUT ) );
      
    },
    
    // ### Message: TIMEOUT
    //
    // Sent if HTTP request timesout.
    //
    TIMEOUT: function() {
      this.req.abort();
      this.exit( http.JsonClient.reason.timeout );
    },
    
    // ### Message: ERROR
    //
    // Sent if the HTTP request resulted in an error.
    //
    ERROR: function( error ) {
      this.exit( http.JsonClient.reason.http_error, { error: error } );
    },
    
    // ### Message: RESPONSE
    //
    // Sent when a response to the request is received.
    //
    RESPONSE: function(res) {
        
      this.content = '';
      this.res = res;
      
      this.res.on( 'data', this.RESPONSE_DATA.sync );
      this.res.on( 'end', this.RESPONSE_END.sync );
      
    },
    
    // ### Message: RESPONSE_DATA
    //
    // Sent when response data is received.
    //
    RESPONSE_DATA: function( chunk ) {
      this.content += chunk;
    },
    
    // ### Message: RESPONSE_END
    //
    // Sent when all response data has been received.
    //
    RESPONSE_END: function() {
      
      if( this.res.statusCode !== 200 && this.res.statusCode !== 204 ) {
        this.exit( http.JsonClient.reason.status_code, 
          { 
            statusCode: this.res.statusCode, 
            headers:    this.res.headers,
            content:    this.content
          }
        );
      }
      
      if( 
        this.res.statusCode === 200 
        && this.res.headers[ 'content-type' ] !== 'application/json' 
      ) {
        this.exit( http.JsonClient.reason.content_type,
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
          this.exit( http.JsonClient.reason.content_parse,
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


http.JsonClient.reason = {
  timeout:        'timeout',
  http_error:     'http-error',
  status_code:    'status-code',
  content_type:   'content-type',
  content_format: 'content-format'
};


