toddick( 'Zero', module,
  {
    INIT: function(MSG, initial_count) {
      this.MSG = MSG;
      this.count = initial_count ? initial_count : 0;
    },
    
    INC: function() {
      this.count += 1;
    },
    
    DEC: function() {
      
      this.count -= 1;
      
      if(this.count === 0) {
        MSG();
        exit();
      }
      
      if(this.count < 0) {
        exit('negative count');
      }
      
    }
  }
);

