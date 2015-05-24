let fs = require('fs')
let url = require('url')
let path = require('path')
let http2 = require('http2')
let browserifyInc = require('browserify-incremental')
let devnull = require('dev-null')
let through = require('through2')
let concatStream = require('concat-stream')

const SERVER_CONFIG = {
  key: fs.readFileSync('./localhost.key'),
  cert: fs.readFileSync('./localhost.crt'),
}

let modulesPath = __dirname + '/example/modules'
let publicPath = __dirname + '/example/public'

let moduleCache = {}
let browserifyOpts = () => ({
  basedir: modulesPath,
  cache: moduleCache,
  packageCache: {},
  fullPaths: true,
  debug: true,
})

let values = (obj) => Object.keys(obj).map((key) => obj[key])

function makeBrowserify(entrypoint, done) {
  let b = browserifyInc(browserifyOpts())
  b.transform(require('babelify'), {stage: 0})
  b.add(entrypoint)

  return b
}

function wrapModule(src, depUrls, requireName) {
  return `${requireName}.ensure(${JSON.stringify(depUrls)}, function(require) {${src}});`
}

function renderModule(requestUrl, req, res) {
  let jsFilepath = path.join(modulesPath, requestUrl.path)
  let b = makeBrowserify(jsFilepath)

  let onError = (err) => {
    console.error(err.toString())
    res.statusCode = 404
    res.end(err.toString())
  }

  function renderModuleFromCache(jsFilepath, requireName) {    
    if (!moduleCache[jsFilepath]) {
      return onError(new Error('module not found in cache: '+jsFilepath))
    }
    let module = moduleCache[jsFilepath]
    let depUrls = values(module.deps)
    return wrapModule(module.source, depUrls, requireName)
  }

  if (false && jsFilepath.includes('node_modules')) {
    // bundle npm deps
    b.bundle()
      .on('error', onError)
      .pipe(concatStream((bundle) => {
        res.end(bundle)
      }))
  } else if (requestUrl.query.require) {
    res.end(renderModuleFromCache(jsFilepath, requestUrl.query.require))
  } else {
    // let depsStream = through()
    //   .on('error', onError)
    //   .pipe(concatStream((deps) => {
    //     res.end(JSON.stringify(deps, null, 2))
    //   }))

    // b.pipeline.splice('pack', 2, depsStream)
    b.bundle(() => {
      res.end(renderModuleFromCache(jsFilepath, 'require'))
    })
      .on('error', onError)
      .pipe(devnull())
  }
}

http2.createServer(SERVER_CONFIG, (req, res) => {
  let requestUrl = url.parse(req.url, true)
  if (req.headers['accept'].includes('javascript') || requestUrl.path.endsWith('.js')) {
    renderModule(requestUrl, req, res)
  } else {
    let 
    let filepath = path.join(publicPath, requestUrl.path)
    fs.readFile(filepath, {encoding: 'utf8'}, (err, data) => {
      if (err) {
        console.error(err.toString())
        res.statusCode = 404
        res.end(err.toString())
      } else {
        res.end(data)
      }
    })
  }
}).listen(8080)
