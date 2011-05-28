var toddick = require('./toddick');
var http = require('http');
var url = require('url');

var remote = exports;

remote.createProxy = function(proxyData, PUBLISH, SEND) {
  // TODO
}

remote.proxyArgs = function(args, PROXY, DONE) {
  // TODO
}

remote.publishArgs = function(args, PUBLISH, DONE) {
  // TODO
}

toddick('HttpPortal', module,
  {
    
    INIT: function(port) {
      this.server = http.createServer(this.REQUEST.sync);
      this.server.listen(port);
      this.published = {};
      this.proxied = {};
    },
    
    PUBLISH: function(path, instance, MSG) {
      
      if(!this.published[path]) {
        this.published[path] = instance;
        this.monitor(instance, this.UNPUBLISH.withArgs(path));
      }
      
      if(MSG) {
        MSG(); // TODO Url
      }
      
    },
    
    UNPUBLISH: function(path) {
      delete this.published[path];
    },
    
    PROXY: function(url, MSG) {
      
      var proxy = proxied[url];
      if(proxy) {
        MSG(proxy);
        return;
      }
      
      var parsed = url.parse(url);
      
      var options = {
        host: parsed.hostname,
        port: parsed.port,
        path: parsed.pathname + parsed.search,
        headers: {
          'accept' : 'application/json'
        }
      };
      
      http.get(options, 
        function(res) {
          
          if(res.statusCode !== 200 || res.headers['content-type'] != 'application/json') {
            MSG(undefined);
            return;
          }
          
          var content = '';
          
          res.on('data', 
            function(chunk) {
              content += chunk;
            }
          );
          
          res.on('end',
            function() {
          
              try {
                var proxyData = JSON.parse();
              } catch(e) {
              }
              
              if(typeof proxyData != 'object') {
                MSG(undefined);
                return;
              }
              
              MSG(remote.createProxy(proxyData, this.PUBLISH, this.SEND))
              
            }
          );
          
        }
      );
    },
    
    SEND: function(name, args) {
      // TODO
    },
    
    REQUEST: function(req, res) {
      
      try {
      
        var instance = this.published[req.url];
        
        if(!instance) {
          res.statusCode = 404;
          res.end('No toddick has been published with the url ' + req.url, 'text/plain');
          return;
        }
        
        if(req.method === 'GET') {
          
          if(req.headers['Accept'] !== 'application/json') {
            res.statusCode = 406;
            res.end('Accept is not application/json', 'text/plain');
            return;
          }
          
          res.statusCode = 200;
          res.end(remote.getProxyData(instance), 'application/json');
          return;
          
        }
        
        if(req.method !== 'POST') {
          res.statusCode = 405;
          res.end('Method is not POST or GET', 'text/plain');
          return;
        }
        
        if(req.header['content-type'] !== 'application/json') {
          res.statusCode = 400;
          res.end('content-type is not application/json', 'text/plain');
          return;
        }
        
        var content = '';
        
        req.on('data', 
          function(chunk) {
            content += chunk;
          }
        );
        
        req.on('end', 
          function() {
            
            try {
              var msg = JSON.parse(content);
            } catch(e) {
            }
            
            if (typeof msg !== 'object' || !msg.name || !instance[msg.name]) {
              res.statusCode = 400;
              res.end('The posted message content is invalid', 'text/plain');
              return;
            }
            
            remote.proxyArgs(msg.args, this.PROXY, this.DISPATCH.withArgs(instance, msg));
            
          }
        );
        
      } catch(e) {
        res.statusCode = 500;
        res.end('Internal server error', 'text/plain');
        return;
      }
      
    },
    
    DISPATCH: function(instance, msg) {
      instance[msg.name].sync.apply(null, msg.args);
    }
    
  }
);
