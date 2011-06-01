var toddick = require( 'toddick' );
var timer = require('toddick/lib/timer');

var activity = exports;

// ## Toddick: Supervisor
//
// Monitors a toddick and restarts the toddick when it exits. 
//
//     var supervisor = new activity.Supervisor( [ config ] );
//
//     var config = {
//       [ toddick:         (toddick constructor)                 ]
//       [ restart:         activity.Supervisor.restart.*         ]
//       [ restart_limit:   (number)                              ]
//       [ restart_backoff: activity.Supervisor.restart_backoff.* ]
//       [ restart_delay:   (number)                              ]
//       [ restart_factor:  (number)                              ]
//       [ restart_period:  (number)                              ]
//     };
//
// *config* - An object that tells the supervisor how to behave. 
//
// *toddick* - The type of toddick started by the supervisor. Default is undefined. If undefined,
// restart must be 'never' (or not specified) and you send the supervisor a SUPERVISE message to
// give it toddick instances to supervise.
//
// *restart* - One of the activity.Supervisor.restart property values. The default is never.
//
//   * never - The supervisor never restarts a supervised toddick. If the toddick exits with an
//   error, the supervisor exits with an activity.Supervisor.reason.restart_limit error Otherwise
//   the supervisor does not exit.
//
//   * on_error - The supervisor will restart toddics that exit with an error. If the toddick's
//   restart limit has been reached, the supervisor exits with an 
//   activity.Supervisor.reason.restart_limit error. Otherwise the toddick does not exit.
//
//   * always - The supervisor will restart toddicks that exit with or without an error. If the
//   toddick's restart limit has been reached, the supervisor exits with an 
//   activity.Supervisor.reason.restart_limit error. Otherwise the toddick does not exit.
//
// *restart_limit* - The number of times a toddick can be restarted before the supervisor exits
// with a activity.Supervisor.reason.restart_limit error. The default is 0 meaning that the 
// toddick will never be restarted.
//
// *restart_backoff* - One of the activity.Supervisor.restart_backoff property values:
//
//   * exponential - An exponential backoff algorithm is used. Before restarting a toddick, there is
//   delay of (*restart_delay* * (*restart_factor* ^ n)) milliseconds, where n is the number of times 
//   the toddick has been restarted. With default values, this results in the following delay 
//   values:
//
//     10 * 4 ^ 0 =    10
//     10 * 4 ^ 1 =    40
//     10 * 4 ^ 2 =   160
//     10 * 4 ^ 3 =   640
//     10 * 4 ^ 4 =  2560
//     10 * 4 ^ 5 = 10240
//     10 * 4 ^ 6 = 40960
//
// *restart_delay* - The delay value used by the restart_backoff algorithm. The default is 10. Set
// to 0 to prevent any delay between restart attempts.
//
// *restart_factor* - The factor used by the exponential backoff algorithm. The default is 4.
//
// *restart_period* - The number of milliseconds after starting a toddick that the toddick's restart
// count will be reset. The effect is that the supervisor will exit with a restart_limit error only
// if the toddick has to be restarted more that *restart_limit* times within this time period.
//
toddick( 'Supervisor', module,
  {
    
    // ### Message: INIT
    //
    INIT: function( config ) {
      
      if( typeof config === 'undefined' ) {
        config = {};
      }
      
      if( typeof config !== 'object' ) {
        this.exit( 
          activity.Supervisor.reason.bad_config, 
          { error: 'config is not an object' } 
        );
      }
      
      if( !config.restart ) {
        config.restart = activity.Supervisor.restart.never;
      }
    
      if( !config.restart_limit ) {
        config.restart_limit = 0;
      }
      
      if( !config.restart_backoff ) {
        config.restart_backoff = activity.Supervisor.restart_backoff.exponential;
      }
      
      if( !config.restart_delay ) {
        config.restart_delay = 10;
      }
      
      if( !config.restart_factor ) {
        config.restart_factor = 4;
      }
      
      if( !config.restart_period ) {
        config.restart_period = undefined;
      }
      
      switch( config.restart ) {
        case activity.Supervisor.restart.never:
        case activity.Supervisor.restart.always:
        case activity.Supervisor.restart.on_error:
          break;
          
        default:
          this.exit( 
            activity.Supervisor.reason.bad_config, 
            { error: 'invalid restart setting: ' + config.restart } 
          );
          break;
      }
      
      if( config.toddick ) {
        if( typeof config.toddick !== 'function' || !config.toddick.is_toddick_constructor ) {
          this.exit(
            activity.Supervisor.reason.bad_config, 
            { error: 'toddick property not a toddick constructor' } 
          );
        }
      } else {
        if( config.restart !== activity.Supervisor.restart.never ) {
          this.exit(
            activity.Supervisor.reason.bad_config, 
            { error: 'restart is not never but no toddick constructor was provided' } 
          );
        }
      }
  
      this.trace( 'config', config );
      
      this.config = config;
      this.activities = {};
      this.next_activity_id = 1;
      
    },
    
    // ### Message: START
    //
    // Creates a toddick, monitors it, and takes the configured restart action when it exits.
    //
    //     supervisor.START( [ args... ] );
    //
    // *args* - arguments that will be passed to the toddick's constructor.
    //
    START: function() {
      
      var act = { 
        id:            this.next_activity_id++,
        args:          arguments,
        restart_count: 0,
      };
      
      act.instance = this.monitor( 
        this.config.toddick.construct( act.args ), 
        this.EXITED.withArgs( act.id ) 
      );
      
      if( this.config.restart_period ) {
        this.self.enable_trace = true;
        activity.restart_period_timeout = new timer.Timeout( 
          this.config.restart_period, 
          this.RESET_RESTART_PERIOD.withArgs( act.id )
        );
      }
      
      this.activities[ act.id ] = act;
      
    },
    
    // ### Message: SUPERVISE
    //
    // Monitors the a provided toddick and takes the configured restart action when it exits. Can
    // only be used when config.restart is never, as the supervisor does not have the arguments
    // needed to restart the toddick.
    //
    //     supervisor.SUPERVISE( instance );
    //
    // *instance* - the toddick to supervise.
    //
    SUPERVISE: function( instance ) {
      
      var act = {
        id:       this.next_activity_id++,
        instance: instance
      };
      
      this.monitor( act.instance, this.EXITED.withArgs( act.id ) );
      
      this.activities[ act.id ] = act;
      
    },
    
    // ### Message: EXITED
    //
    // Sent via a monitor when a supervised toddick exits.
    //
    EXITED: function( act_id ) {
      
      var act = this.activities[ act_id ];
      var instance = act.instance;
      
      act.instance = undefined;
      
      var restart = false;
      
      switch( this.config.restart ) {
        
        case activity.Supervisor.restart.always:
          restart = true;
          break;
          
        case activity.Supervisor.restart.on_error:
          if( instance.exit_reason ) {
            restart = true;
          }
          break;
      
        case activity.Supervisor.restart.never:
          if( instance.exit_reason ) {
            this.exit( 
              activity.Supervisor.reason.restart_limit, 
              { 
                instance: instance,
                reason:   instance.exit_reason,
                data:     instance.exit_data
              } 
            );
          }
          break;
          
      }
        
      if( restart ) {
        
        if( 
          this.config.restart_limit !== -1 
          && act.restart_count >= this.config.restart_limit
        ) {
          this.exit( 
            activity.Supervisor.reason.restart_limit, 
            { 
              instance: instance,
              reason:   instance.exit_reason,
              data:     instance.exit_data
            } 
          );
        }
      
        var delay = 
          this.config.restart_delay 
          * Math.pow( this.config.restart_factor, act.restart_count );
          
        this.info( 'activity-restart', 
          { 
            instance:      instance.id, 
            reason:        instance.exit_reason,
            data:          instance.exit_data,
            restart_count: act.restart_count,
            delay:         delay
          }
        );
        
        act.restart_timeout = new timer.Timeout( delay, this.RESTART.withArgs( act.id ) );
        
        if( this.config.restart_period && !act.restart_period_timeout ) {
          this.self.enable_trace = true;
          act.restart_period_timeout = new timer.Timeout( 
            this.config.restart_period, 
            this.RESET_RESTART_PERIOD.withArgs( act.id )
          );
        }
        
      } else {
        
        if( act.restart_period_timeout ) {
          act.restart_period_timeout.EXIT();
          act.restart_period_timeout = null;
        }
        
        delete this.activities[ act.id ];
        
      }
      
    },
    
    // ### Message: RESTART
    //
    // Sent after a delay to restart a toddick that has exited.
    //
    RESTART: function( act_id ) {
      
      var act = this.activities[ act_id ];
      
      act.instance = this.monitor( 
        this.config.toddick.construct( act.args ), 
        this.EXITED.withArgs( act.id ) 
      );
      
      act.restart_count++;
      
      act.restart_timeout.EXIT();
      act.restart_timeout = null;
      
    },
    
    // ### Message: RESET_RESTART_PERIOD
    //
    // If config.restart_period was specified, is sent after a delay to reset the toddick's restart
    // count.
    //
    RESET_RESTART_PERIOD: function( act_id ) {
      
      var act = this.activities[ act_id ];
      
      if( act && act.restart_period_timeout ) {
        
        act.restart_count = 0;
        
        act.restart_period_timeout.EXIT();
        act.restart_period_timeout = null;
        
      }
        
    },
    
    // ### Message: EXIT
    //
    // The supervisor sends EXIT to all supervised toddicks when it exits.
    //
    EXIT: function( reason, data ) {
      
      for( var id in this.activities ) {
        
        var act = this.activities[ id ];
        
        if( act.instance ) {
          act.instance.EXIT( reason, data );
        }
        
      }
    
      this.exit( reason, data );
      
    }
    
  }
);
    
// ### Constants: restart
//
// Allowed values for the config.restart property.
//   
activity.Supervisor.restart = {
  on_error: 'on-error',
  always:   'always',
  never:    'never'
};

// ### Constants: restart_backoff
//
// Allowed values for the config.restart_backoff property.
//
activity.Supervisor.restart_backoff = {
  exponential: 'exponential'
};

// ### Constants: reason
//
// Exit errors that may be used when a Supervisor exits.
//
activity.Supervisor.reason = {
  restart_limit: 'restart-limit',
  bad_config:    'bad-config'
};
