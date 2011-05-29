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
      
      if( typeof config.toddick !== 'function' || !config.toddick.is_toddick_constructor ) {
        this.exit('bad-config', { error: 'toddick property not a toddick constructor' } );
      }
      
      if( !config.restart ) {
        config.restart = 'on-error';
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
      
      this.config = config;
      this.activities = {};
      this.next_activity_id = 1;
      
    },
    
    START: function() {
      
      var activity_id = this.next_activity_id++;
      var activity = { 
        restart_count: 0
      };
      
      activity.args = toddick.appendArgs( this.config.args, arguments );
      
      activity.instance = this.monitor( 
        this.config.toddick.apply( null, activity.args ), 
        this.EXITED.withArgs( activity ) 
      );
      
      if( this.config.restart_period ) {
        activity.restart_period_timeout = new timer.Timeout( 
          this.config.restart_period, 
          this.RESET_RESTART_PERIOD.withArgs( activity )
        );
      }
      
      if( this.config.STARTED ) {
        this.config.STARTED( activity.instance );
      }
      
      this.activities[ activity_id ] = activity;
      
    },
    
    EXITED: function( activity ) {
      
      var restart = this.config.restart === 'always';
      restart = restart || (this.config.restart === 'on-error' && activity.instance.exit_reason);
      if( this.config.restart_limit !== -1 ) {
        restart = restart && (activity.restart_count < this.config.restart_limit);
      }
      
      if( this.config.EXITED ) {
        this.config.EXITED( activity.instance );
      }
      
      if( restart ) {
        
        var delay = 
          this.config.restart_delay 
          * Math.pow( this.config.restart_factor, activity.restart_count );
          
        this.info( 'activity-restart', 
          { 
            instance:      activity.instance.id, 
            reason:        activity.instance.exit_reason,
            data:          activity.instance.exit_data,
            restart_count: activity.restart_count,
            delay:         delay
          }
        );
        
        activity.restart_timeout = new timer.Timeout( delay, this.RESTART.withArgs( activity ) );
        
        if( this.config.restart_period && !activity.restart_period_timeout ) {
          activity.restart_period_timeout = new timer.Timeout( 
            this.config.restart_period, 
            this.RESET_RESTART_PERIOD.withArgs( activity )
          );
        }
      
      } else {
        
        this.exit( 'restart-limit', 
          { 
            instance: activity.instance,
            reason:   activity.instance.exit_reason,
            data:     activity.instance.exit_data,
          } 
        );
        
      }
      
    },
    
    RESTART: function( activity ) {
      
      activity.instance = this.monitor( 
        this.config.toddick.apply( null, activity.args ), 
        this.EXITED.withArgs( activity ) 
      );
      
      activity.restart_count++;
      
      activity.restart_timeout.EXIT();
      activity.restart_timeout = null;
      
      if( this.config.STARTED ) {
        this.config.STARTED( activity.instance );
      }
      
    },
    
    RESET_RESTART_PERIOD: function( activity ) {
      
      activity.restart_count = 0;
      
      activity.restart_period_timeout.EXIT();
      activity.restart_period_timeout = null;
      
    },
    
    EXIT: function( reason, data ) {
      
      for( var id in this.activities ) {
        var activity = this.activities[ id ];
        if( activity.instance.is_active ) {
          activity.instance.EXIT( 'supervisor-exit', { reason: reason, data: data } );
        }
      }
      
      this.exit( reason, data );
      
    }
    
  }
);
    
   
activity.Supervisor.restart = {
  on_error: 'on-error',
  always:   'always'
};

