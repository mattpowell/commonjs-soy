var Assert = require('assert'),
    compiler = require('../');

var fauxTemplate = [
  '{namespace _}',
  '/**',
  ' * @param name',
  '*/',
  '{template .test}',
  '  Test!',
  '  {call external.module.util data="all"/}',
  // '  {age|formatNum:\'decimal\'}',
  // '  {switch $name}',
  // '    {case \'Test\'}',
  // '      Got name',
  // '    {default}',
  // '      Got default',
  // '  {/switch}',
  '{/template}'
].join('\n');

var brokenTemplate = '{template}BROKEN{/template}';

var expectedTemplate = [
  'var _ = exports = module.exports = {};;',
  ';;',
  'var soy = function (soy) {',
  '    soy = require(\'soy\');',
  '    return soy;',
  '}(soy);;',
  'var soydata = function (soydata) {',
  '    soydata = require(\'soydata\');',
  '    return soydata;',
  '}(soydata);;',
  'var external = function (external) {',
  '    external = external || {};',
  '    external.module = require(\'external/module\');',
  '    return external;',
  '}(external);;',
  '_.test = function (opt_data, opt_ignored) {',
  '    return soydata.VERY_UNSAFE.ordainSanitizedHtml(\'Test!\' + soy.$$escapeHtml(external.module.util(opt_data)));',
  '};',
  'if (true) {',
  '    _.test.soyTemplateName = \'_.test\';',
  '}'
].join('\n');

compiler.transpile({
  content: fauxTemplate,
  path: '.'
}, function(err, generatedTemplate) {
  Assert.ifError(err);
  Assert.ok(generatedTemplate === expectedTemplate, 'Expect generatedTemplate to equal expectedTemplate, but, was: ' + generatedTemplate);

  compiler.transpile(brokenTemplate, function(err, generatedTemplate) {
    Assert.ok(err instanceof Error, 'Expect err to be an Error but was: ' + err);
    compiler.compileSoy(fauxTemplate, function(err, generatedSoyTemplate) {
      compiler.transformToCommonJs(generatedSoyTemplate, function(err, generatedTemplate) {
        Assert.ifError(err);
        Assert.ok(generatedTemplate === expectedTemplate, 'Expect generatedTemplate to equal expectedTemplate, but, was: ' + generatedTemplate);
        console.log('Tests passed!');
      });
    });
  });
});