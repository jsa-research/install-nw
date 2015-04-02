#!/usr/bin/env node

var argv = require('minimist')(process.argv.slice(2));
var install = require('./');
var fs = require('fs');
var exec = require('child_process').exec;
var path = require('path');
var semver = require('semver');

var platform = process.platform === 'darwin' ? 'osx' : 
  process.platform === 'win3' ? 'win' : process.platform;

var homedir = (platform === 'win') ? 
  process.env.HOMEPATH : 
  process.env.HOME;

var cache = argv.cache || 
  process.env.npm_config_nwjs_cache || 
  process.env.NWJS_CACHE ||  
  path.join(homedir, '.nw-cache');

var pack = path.resolve(__dirname, '..', '..', 'package.json');
var isGlobal = isGlobalInstall();
var local = !isGlobal && fs.existsSync(pack);

if (!fs.existsSync(cache)) { 
  fs.mkdirSync(cache); 
}

if (argv._.length) {
  return init(argv._[0]);
}

if (local) {
  return init(require(pack).nw);
} 

exec('npm info nw --json', function (err, stdout) {
  var info = JSON.parse(stdout);
  init(info.version);
})

function init(version) { 
  version = down(version);

  var urlBase = argv.urlBase ||
    process.env.npm_config_nwjs_urlbase || 
    process.env.NWJS_URLBASE || 
    'http://dl.nwjs.io/v';

  var filename = [
    'nwjs-v', version, '-',
    platform, '-', process.arch, 
    '.zip'].join('');

  var url = [
    urlBase, version, '/', filename]
    .join('');

  var filePath = path.join(cache, filename);

  install({
    filePath: filePath, 
    url: url,
    version: version,
    isGlobal: isGlobal
  }, function (err) {
    if (err) { 
      console.log(err.message);
      return process.exit(err.code);
    }

    if (local) { 
      var nwpack = path.resolve(__dirname, '..', 'nw', 'package.json');
      var nwp = require(nwpack);

      if (nwp && nwp.scripts) { 
        nwp.scripts._postinstall = nwp.scripts.postinstall;
        nwp.scripts.postinstall = null;
      }
      fs.writeFileSync(nwpack, nwp);
    }

    process.exit();
  });

}

function isGlobalInstall() { 
  var conf = process.env.npm_config_argv;
  return conf && !!~(JSON
    .parse(conf)
    .cooked
    .indexOf('--global'));
}


function down(version) {
  var v = semver.parse(version);
  
  version = [v.major, v.minor, v.patch].join('.');
  if (v.prerelease && typeof v.prerelease[0] === 'string') {
    var prerelease = v.prerelease[0].split('-');
    if (prerelease.length > 1) {
      prerelease = prerelease.slice(0, -1);
    }
    version += '-' + prerelease.join('-');
  }

  return version;
}