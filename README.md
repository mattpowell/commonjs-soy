[![Build Status](https://travis-ci.org/mattpowell/commonjs-soy.svg?branch=master)](https://travis-ci.org/mattpowell/commonjs-soy) [![codecov.io](https://codecov.io/github/mattpowell/commonjs-soy/coverage.svg?branch=master)](https://codecov.io/github/mattpowell/commonjs-soy?branch=master)
#commonjs-soy
commonjs-soy is a tool for compiling Soy/Closure Templates and converting them to CommonJs modules.

This is done by using the latest SoyToJsSrcCompiler.jar (from the [closure-templates](https://www.npmjs.com/package/closure-templates) package) to compile your templates and then parsing the resulting js (using [Esprima](esprima.org)) and removing and/or replacing calls to goog.(require|provide|module|DEBUG).

Features
===
- Current implementation uses [`node-java`](https://github.com/joeferner/node-java) to call SoyToJsSrcCompiler so no temporary directories/files are needed!
- Additionally, when combined with a build tool like Grunt or Gulp, the compiler stays in memory so build times are lightning fast (as opposed to tools that spin up a new instance of the jar each time).
- [`{call ...}`s](https://developers.google.com/closure/templates/docs/commands#call) to external templates are converted to `require`s (e.g., `{call my.other.template data="all"/}` => `require('./my/other').template(opt_data)`) ... super helpful for static analysis and/or browserify-ing.

Installation
===
`npm install commonjs-soy --save`

Usage
===
Requiring:
```js
var soy = require('commonjs-soy');
```
Api:

**.compileSoy(soy[, opts], callback)**
> Compiles a Soy template and returns as JavaScript source (same as running `java -jar SoyToJsSrcCompiler.jar ...`).

`soy` should be a string/Buffer of a raw, uncompiled Soy template.

`opts` is an optional object where you can define `opts.path` to be used as a reference in error messaging (NOTE: nothing is loaded from disk using this property).

`callback(err, js)` should be a function which accepts two parameters, `err` and `js`. `err` will exist if there was an error during compilation (usually, directly from `SoyToJsSrcCompiler.jar`). `js` will be the compiled Soy template as a string.
```js
var fs = require('fs');
soy.compileSoy(fs.readFileSync('template.soy'), {
  path: 'template.soy' // this doesn't actually load the template from this path... it' just used as a reference in error messages
}, function(err, js) {
  if (err) throw err;
  fs.writeFileSync('template.soy.js', js);
});
```

**.transformToCommonJs(contents[, modulePathResolver], callback)**
> Transform `contents` (which is the js source of a compiled Soy template -- presumably the output of `compileSoy`) to be a CommonJs module.

`modulePathResolver(path, moduleId)` should be used to return a valid path that can be used in the generated `require` statement. For example, you might return a path that's relative to the final output directory (instead of the current directory). `path` is the value after converting the namespace to a filesystem path (using the convention of periods are equal to slashes). `moduleId` is the original, unconverted value.

`callback(err, js)` is called after all transforms have been done. `err` is an `Error` object and `js` is a string with references to `goog.(provide|module|require|DEBUG)` either replaced or removed to be CommonJs compatible.
```js
var fs = require('fs');
var template = '...'; // compiled soy template
soy.transformToCommonJs(template, function(path, moduleId) {
  return './public/js/templates/' + path; // ... this is just an example
}, function(err, js) {
  if (err) throw err;
  fs.writeFileSync('template.soy.js', js);
});
```

**.transpile(opts, callback)**

> Runs both `compileSoy` and `transformToCommonJs` as a single function to transpile a Soy template to a CommonJs module.

`opts` can be a string (the equivalent to defining `opts.content` below), or an object with these properties:
* `opts.content` should be a string which is the raw source of a Soy template.
* `opts.path` should be the path to the passed in template. NOTE: nothing is read from this path, it's simply used as a reference in error messaging.
* `opts.resolver` is a function that's passed as the `modulePathResolver` arg in `transformToCommonJs` (see documentation above).

`callback(err, js)` is called after all transforms have been done. `err` is an `Error` object if either `compileSoy` or `transformToCommonJs` failed and `js` is a string with references to `goog.(provide|module|require|DEBUG)` either removed or replaced to be CommonJs compatible.
```js
var fs = require('fs');
soy.transpile({
  content: fs.readFileSync('template.soy'),
  path: '',
  resolver: function(path, moduleId) {
    return './public/js/templates/' + path; // ... this is just an example
  }
}, function(err, js) {
  if (err) throw err;
  fs.writeFileSync('template.soy.js', js);
});
```
Caveats/TODOs
===
* In order to actually export your templates to `module.exports` the namespace must be set to an underscore, like this: `{namespace _}`. (Although, this will likely change in the future).
* While `node-java` is well tested, it can be difficult to build in some environments and as such, you should be aware of that when using in production. Note: I'm open to moving off of `node-java` if the right PR comes along ;)
* Errors (from invalid templates, etc) are not gracefully handled at the moment.
* Bidi/i18n isn't supported yet.
* css (via `goog.getCssName`) isn't supported yet either.
