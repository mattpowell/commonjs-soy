var Esprima = require('esprima'),
    Escodegen = require('escodegen'),
    Path = require('path'),
    Java = require('java');

Java.asyncOptions = { syncSuffix: '' };
Java.classpath.push(__dirname + '/java/build/ExtendedSoyToJsSrcCompiler.jar');

var SoyJsSrcOptions =  Java.import('com.google.template.soy.jssrc.SoyJsSrcOptions');
var SoyFileSet = Java.import('com.google.template.soy.SoyFileSet');
var InMemCharSource = Java.import('commonjssoy.InMemCharSource');

var jsSrcOptions = new SoyJsSrcOptions();
jsSrcOptions.setShouldGenerateJsdoc(false);
jsSrcOptions.setShouldProvideRequireSoyNamespaces(true);
jsSrcOptions.setShouldProvideBothSoyNamespacesAndJsFunctions(true);
//jsSrcOptions.setShouldDeclareTopLevelNamespaces(false);
//jsSrcOptions.setShouldGenerateGoogModules(true);
jsSrcOptions.setShouldGenerateGoogMsgDefs(false);
jsSrcOptions.setGoogMsgsAreExternal(false);
jsSrcOptions.setBidiGlobalDir(0);
jsSrcOptions.setUseGoogIsRtlForBidiGlobalDir(false);


function traverse(ast, onMemberExpression) {
  (function t(o) {
    for (var prop in o) {
      var val = o[prop];

      if (val && val.type === 'MemberExpression') {
        onMemberExpression(val, o);
      }

      if (Array.isArray(val)) {
        val.forEach(function(v) { t(v); });
      }else if (val && typeof val === 'object') {
        t(val);
      }
    }

  }(ast))
}

function toExpressionSrc(expression) {
  return Escodegen.generate(expression)
}

function replaceWithSrc(node, src) {
  var parts = Esprima.parse(src).body[0],
      p;

  parts = parts.expression || parts;

  for (p in parts) {
    node[p] = parts[p];
  }
}

function createNamespaceSrc(namespaces, val) {
  var root = namespaces[0],
      full = namespaces.join('.');

  return 'var ' + root + ' = (function(' + root + ') {' +
    (namespaces.slice(0, -1).reduce(function(src, part, idx, o) {
      var ns = o.slice(0, idx + 1).join('.'); 
      return src + ns + ' = ' + ns + ' || {};\n'
    }, '')) +
    '  ' + full + ' = ' + (val || 'null') + ';' +
    '  return ' + root +
    '}(' + root + '));';
}

var api = module.exports = {

  transpile: function(opts, callback) {

    if (typeof opts === 'string') {
      opts = {
        content: opts
      };
    }

    var file = opts.content,
        filePath = opts.path || '<<unknown path>>',
        resolver = opts.resolver || function(filePath, modulePath) { return modulePath; };

    api.compileSoy(file, {
      path: filePath
    }, function(compileErr, soy) {
      if (compileErr) {
        callback(compileErr);
      }else {
        api.transformToCommonJs(soy, resolver.bind(this, filePath), function(transformErr, es6) {
          callback(transformErr, es6);
        });
      }
    });
  },


  // TODO: add setters to change SoyJsSrcOptions (and Builder options)
  compileSoy: function(soyContent, opts, callback) {
    var jsContent, err = null;

    if (typeof opts === 'function') {
      callback = opts;
      opts = {};
    }

    if (typeof opts.path === 'undefined') {
      opts.path = '<<unknown path>>';
    }

    var sfsBuilder = SoyFileSet.builder();
    sfsBuilder.add(InMemCharSource.create(soyContent.toString()), opts.path);
    sfsBuilder.setAllowExternalCalls(true);

    try {
      jsContent = sfsBuilder.build().compileToJsSrc(jsSrcOptions, null).get(0);
    }catch(e) {
      err = e; // TODO: better handle!! Grab actual output and parse
    }

    callback(err, jsContent);
  },

  // TODO: need to fix double semicolon issue (although, should be moot when output is passed through a minifier :)
  transformToCommonJs: function(contents, modulePathResolver, callback) {
    var ast = Esprima.parse(contents);

    if (typeof modulePathResolver === 'function' && typeof callback === 'undefined') {
      callback = modulePathResolver;
      modulePathResolver = null;
    }

    modulePathResolver = modulePathResolver || function() { return arguments[0]; };

    traverse(ast, function onMemberExpression(node, parentNode) {
      var replacementSrc = null,
          replacementNode = parentNode,
          expressionSrc = toExpressionSrc(node);

      // TODO: hold off on ALL transforms until we confirm goog.module/goog.provide is equal to `_`
      // ... requiring `_` indicates we've opted in to periods in namespaces to meaning file paths
      switch (expressionSrc) {

        case 'goog.provide':
          replacementSrc = ';';

        case 'goog.module':
        case 'goog.provide':
          var args = parentNode.arguments[0];
          if (expressionSrc === 'goog.provide' && args.value !== '_') break;
          replacementSrc = 'var ' + args.value + ' = exports = module.exports = {}';
          //replacementSrc = createNamespaceSrc(args.value.split('.'), '{}');
          break;

        case 'goog.require':
          var args = parentNode.arguments[0],
              moduleId = args.value,
              path = moduleId.replace(/\./g, Path.sep),
              resolvedPath = modulePathResolver(path, moduleId);

          replacementSrc = createNamespaceSrc(path.split(Path.sep), 'require(\'' + resolvedPath  + '\')');

          break;

        case 'goog.DEBUG':
          replacementSrc = 'true';
          replacementNode = node;
          break;

        case 'goog.getCssName':
        case 'goog.isBoolean':
        case 'goog.isString':
        case 'goog.isNumber':
        case 'goog.isArray':
        case 'goog.isObject':
        case 'goog.isObject':
        case 'goog.isObject':
          // TODO: pass through for right now.
          break;
      }

      if (replacementSrc !== null) {
        replaceWithSrc(replacementNode, replacementSrc);
      }

    });

    callback(null, Escodegen.generate(ast));
  }
}