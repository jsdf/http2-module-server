;(function(opts) {
  opts = opts || {};

  var prevRequire = window[opts.prevRequireName || 'require'];
  window[opts.requireName || 'require'] = require;

  var modules = {};
  var pendingModules = {};

  function loadModule(depUrl) {
    if (!pendingModules[depUrl]) {
      pendingModules[depUrl] = new Promise(function(resolve, reject) {
        var depModuleUrl = depUrl+'?require='+opts.requireName || 'require';
        getScript(depModuleUrl, function(err, data) {
          if (err) reject(err);
          else resolve(data);
        })
      });
    }

    return pendingModules[depUrl];
  }

  function require(id) {
    if (modules[id]) return modules[id];
    if (typeof prevRequire == 'function') prevRequire(id);
    throw new Error('tried to require module before it was loaded: '+id);
  }

  require.ensure = ensure;
  function ensure(dependencies, callback) {
    return Promise.all(dependencies.map(loadModule)).then(function() {
      callback(require);
    });
  }

  function getScript(uri, cb) {
    if (!uri) throw 'missing uri';
    var head = document.head ||
      document.head.getElementsByTagName('head')[0];
    var el = document.createElement('script');
    el.type = 'text\/javascript';
    if ('function' === typeof cb) {
      el.onerror = getScriptOnError.bind(null, uri, cb);
      el.onload = getScriptOnLoad.bind(null, uri, cb);
    }
    head.appendChild(el);
    el.src = uri;
  };

  function getScriptOnError(uri, cb, e) {
    cb(new URIError(e.target.src + ' could not be loaded'), e);
  }

  function getScriptOnLoad(uri, cb, e) {
    cb(null, {uri: uri, event: e});
  }
})();
