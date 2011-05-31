var toddick = require( 'toddick' );
var timer = require('toddick/lib/timer');

var activity = exports;

toddick( 'Supervisor', module,
  {
    
    // default backoff
    // 
    // 10 * 4 ^ 0 =    10
    // 10 * 4 ^ 1 =    40
    // 10 * 4 ^ 2 =   160
    // 10 * 4 ^ 3 =   640
    // 10 * 4 ^ 4 =  2560
    // 10 * 4 ^ 5 = 10240
    // 10 * 4 ^ 6 = 40960
    
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
      
      if( config.toddick ) {
        
        if (typeof config.toddick !== 'function' || !config.toddick.is_toddick_constructor ) {
          this.exit(
            activity.Supervisor.reason.bad_config, 
            { error: 'toddick property not a toddick constructor' } 
          );
        }
        
        if( !config.restart ) {
          config.restart = activity.Supervisor.restart.on_error;
        }
      
        if( !config.restart_limit ) {
          config.restart_limit = 0;
        }
        
        if( !config.restart_backoff ) {
          config.restart_backoff = 'exponential'
        }
        
        if( !config.restart_delay ) {
          config.restart_delay = 10;
        }
        
        if( !config.restart_factor ) {
          config.restart_factor = 4;
        }
        
        if( !config.restart_period ) {
          config.restart_period = 0;
        }
        
      } else {
        
        config.restart = activity.Supervisor.restart.never;
        
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
      
      this.config = config;
      this.activities = {};
      this.next_activity_id = 1;
      
    },
    
    START: function() {
      
      var act = { 
        id: this.next_activity_id++,
        restart_count: 0,
      };
      
      act.args = toddick.appendArgs( this.config.args, arguments );
      
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
    
    SUPERVISE: function( instance ) {
      
      var act = {
        by: this.id,
        id: this.next_activity_id++,
        instance: instance
      };
      
      this.monitor( act.instance, this.EXITED.withArgs( act.id ) );
      
      this.activities[ act.id ] = act;
      
    },
    
    EXITED: function( act_id ) {
      
      var act = this.activities[ act_id ];
      
      var restart = false;
      
      switch( this.config.restart ) {
        
        case activity.Supervisor.restart.always:
          restart = true;
          break;
          
        case activity.Supervisor.restart.on_error:
          if( act.instance.exit_reason ) {
            restart = true;
          }
          break;
      
        case activity.Supervisor.restart.never:
          if( act.instance.exit_reason ) {
            this.exit( 
              activity.Supervisor.reason.restart_limit, 
              { 
                instance: act.instance,
                reason:   act.instance.exit_reason,
                data:     act.instance.exit_data,
              } 
            );
          }
          break;
          
      }
        
      if( restart ) {
        
        if( 
          this.config.restart_limit !== -1 
          && activity.restart_count < this.config.restart_limit
        ) {
          this.exit( 
            activity.Supervisor.reason.restart_limit, 
            { 
              instance: act.instance,
              reason:   act.instance.exit_reason,
              data:     act.instance.exit_data,
            } 
          );
        }
      
        var delay = 
          this.config.restart_delay 
          * Math.pow( this.config.restart_factor, act.restart_count );
          
        this.info( 'activity-restart', 
          { 
            instance:      act.instance.id, 
            reason:        act.instance.exit_reason,
            data:          act.instance.exit_data,
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
    
    RESET_RESTART_PERIOD: function( act_id ) {
      
      var act = this.activities[ act_id ];
      
      if( act && act.restart_period_timeout ) {
        
        act.restart_count = 0;
        
        act.restart_period_timeout.EXIT();
        act.restart_period_timeout = null;
        
      }
        
    },
    
    EXIT: function( reason, data ) {
      
      for( var id in this.activities ) {
        var act = this.activities[ id ];
        if( act.instance.is_active ) {
          act.instance.EXIT( reason, data );
        }
      }
      
      if( reason && this.config && this.config.ERROR_EXIT ) {
        
        this.config.ERROR_EXIT( reason, data );
        this.exit();
        
      } else {
      
        this.exit( reason, data );
        
      }
      
    }
    
  }
);
    
   
activity.Supervisor.restart = {
  on_error: 'on-error',
  always:   'always',
  never:    'never'
};

activity.Supervisor.reason = {
  restart_limit: 'restart-limit',
  bad_config:    'bad-config'
};
