var archy = require('archy')
  , chalk = require('chalk')
  , path = require('path')
  , sorter = require('path-sort').standalone()
  , _ = require('lodash')
  , hasMagic = require('glob').hasMagic
  , glob = require('glob-all')

var DEFAULTS = {
  cwd: process.cwd(),
  depth: 5,
  resolve: true,
  relative: null, // '../'
  delimiter: '/',
  colors: 'green magenta cyan yellow red'.split(' '),
  extension: true,
  merge: true,
  basename: 'gray',
  folder: 'bgBlue',
  color: 'extension', // or fn(filePath){return 'red'}
  extension_colors: {
    '.html': 'blue',
    '.js': 'yellow',
    '.json': 'green',
    '.md': 'magenta',
    '.css': 'cyan',
    '.png': 'red',
    '.gif': 'red',
    '.jpg': 'red'
  },
  compact: false,
  noCase: true
};

module.exports = function(arr, opts){
  opts = _.defaults(opts || {}, DEFAULTS);
  arr = resolveGlob(arr, opts.cwd, opts.nocase);
  arr = formatInput(arr);
  return treeify(arr, opts);
}

function resolveGlob(pattern, cwd, nocase){
  pattern = pattern || [];
  var opts = {cwd: cwd, nocase: nocase};

  var isGlob = _.isString(pattern)
    || (_.isArray(pattern) && _.some(pattern, function(g){
      return _.isString(g) && hasMagic(g)
    }))

  if(!isGlob){
    return pattern;
  }

  return glob.sync(pattern, opts);
}

function formatInput(arr){
  if(isPlainObject(arr)){
    // {} -> [{...}]
    arr = [arr];
  } else if(Array.isArray(arr) && arr.length && isString(arr[0])){
    // [s1,s2] -> [[s1,s2]]
    arr = [arr];
  } else if(!Array.isArray(arr)){
    throw "expected flat array or nested object (or arrays of those)"
  }
  return arr;
}

/* arr = [[..],...] */
function treeify(arr, opts){

  var root;

  arr = prepare(arr, opts);
  //console.log('prepare', stringify(arr))

  root = fileTree(arr, opts);
  //console.log('fileTree', stringify(root))

  root = compactTree(root, '', opts);
  //console.log('compactTree', stringify(root))

  try {
    verify(root);

    limit(root, opts.depth);

    var res = archy(root);

    // TODO colors, should not be added in first place
    if(!opts.color){
      res = stripColors(res);
    }
    return res;

  } catch(err){
    console.log(err.stack);
    //console.error('DEBUG: PREPARED', stringify(arr))
    console.log('DEBUG: FINAL', stringify(root))
  }
}

function verify(n){
  if(isString(n)) return true;

  if(isString(n.label)){
    if(n.nodes && Array.isArray(n.nodes)){
      return n.nodes.every(verify);
    }
    throw new Error('bad nodes ' + stringify(n.nodes));
  }

  throw new Error('bad node/label ' + typeof n.label + stringify(n));
  return false;
}

function limit(n, depth){
  if(isString(n))return n;

  //if(JSON.stringify(n.label).indexOf("@@") == 0){
  if(n.label.indexOf("@@") == 0){
    depth--;
    if(!depth)return false;
  }

  if(Array.isArray(n.nodes)){
    n.nodes = n.nodes.filter(function(x){
      return limit(x, depth);
    })
  }
  return n;
}

/**
 * PREPARE
 * - paths resolve/relative
 * - sort
 */
function prepare(arr, opts){

  opts = opts || {};
  function alterPath(file){
    if(opts.relative){
      file = normalizePath(path.resolve(file), opts.relative);
    }
    else if(opts.resolve){
      file = path.resolve(file);
    }
    return file.replace(/\\/g, '/');
  }

  return arr.map(function(files){
    if(isPlainObject(files)){

      files = rekey(files, function(file){
        return alterPath(file);
      }, true);

      files = sortObjectKeys(files, sorter);
      renest(files);

    } else if(Array.isArray(files)){
      files = files.map(alterPath);
      files.sort(sorter);
    } else {
      throw new Error("expected flat array or nested object from " + files)
    }

    return files;
  })
}

/**
 * fileTree object
 * - properties are file names
 * - values are
 *  - an object (of children)
 *  - a string (color)
 *  - ? an object containing details
 */
  // nested objects representing a file tree
function fileTree(arr, opts){
  var root = {};

  arr.forEach(function(files, ind){

    if(isPlainObject(files)){
      //objectLength(files);
      Object.keys(files).forEach(function(file){
        var val = files[file];
        if(isPlainObject(val) && !objectLength(val)){
          files[file] = colorizer(file, ind, opts)
        }
      });
      renest(files);

      //console.error('circular?', files);

      files = JSON.parse(JSON.stringify(files));
      files = flattenNest(files);

      //console.log('flattenNest', stringify(files));
    }

    files.forEach(function(file){
      var parts = file.split(opts.delimiter);
      var last = parts.pop();
      var cur = root;
      while(parts.length){
        var part = parts.shift();

        var forceSplit = part.split('&&');
        part = forceSplit.shift();
        if(forceSplit.length){
          forceSplit.unshift('**')
          parts = forceSplit.concat(parts);
        }

        var label = part + opts.delimiter;
        cur[label] = cur[label] || {};
        cur = cur[label];
      }
      cur[last] = colorizer(file, ind, opts);
    });

  });

  return root;
}

/**
 * Compact the deep tree and replace structure with archy's label and nodes
 */

function compactTree(nodes, label, opts, _prev){

  var forceBreak = (label === '**/');

  if(forceBreak){

    var prev = null;
    nodes = _.map(nodes, function(node, nodeid){
      return prev = compactTree(node, nodeid, opts, prev);
    });
    nodes = compact(nodes);

    return {
      label: '@@',
      nodes: nodes
    };
  }

  if(isPlainObject(nodes)){

    var tmp = [];
    for(var i in nodes){
      var prev = tmp[tmp.length - 1];
      tmp.push(compactTree(nodes[i], i, opts, prev));
    }
    nodes = compact(tmp);

    while(opts.merge && nodes && nodes.length == 1 && !nodes._flattened){
      var append = (nodes[0].label || nodes[0]);
      if(append == '@@'){
        //console.log('_prev',_prev);
        if(!isString(_prev)){
          _prev = _prev.label
        }

        label = _prev;
        nodes = nodes[0].nodes;
        if(Array.isArray(nodes)){
          nodes = nodes.map(function(n){
            if(isString(n)){
              n = '@@' + colorLabel(n, null, opts);
            }
            else {
              n.label = '@@' + colorLabel(n.label, n.nodes, opts);
            }
            return n;
          })
        }
        break;
      } else if(append.indexOf('@@') == 0){
        //console.log('&&&APPEND',label,append);
        break;
      }

      label += append;
      nodes = nodes[0].nodes;
    }

    var flatten = opts.compact && nodes && nodes.filter(isPlainFile);

    if(flatten && flatten.length){
      var nonFlattened = reject(nodes, isPlainFile);
      nodes = [flatten.join("  ")].concat(nonFlattened);
      nodes._flattened = true;
    }
  }

  if(!nodes){
    return label;
  } else if(label == _prev){
    return {
      label: label,
      nodes: nodes
    };
  } else if(Array.isArray(nodes)){
    return {
      label: color(label, opts.folder),
      nodes: nodes
    };
  } else {
    return colorLabel(label, nodes, opts)
  }

}

function sortObjectKeys(src, sorter){
  var obj = {};
  Object.keys(src).sort(sorter).forEach(function(key){
    obj[key] = src[key];
  });
  return obj;
}

function renest(obj){
  for(var i in obj){
    var o = obj[i];
    for(var k in o){
      if(obj[k]) o[k] = obj[k];
    }
  }
}

function flattenNest(src, name){
  if(!isPlainObject(src))return src;

  var root = [];
  for(var parent in src){
    var flat = flattenNest(src[parent]);

    root.push(parent)
    if(Array.isArray(flat)){
      flat.forEach(function(child){

        // shorten path
        child = normalizePath(child, path.dirname(parent), true)

        root.push(parent + '&&' + child);
      })
    }
    //else root.push(parent)

  }
  return root;
}

function colorizer(file, ind, opts){
  opts._color = opts.color;

  if(opts.color === 'extension'){
    opts._color = colorByExt.bind(null, opts.extension_colors)
  }

  return (isFunction(opts._color) && opts._color(file)) || opts.colors[ ind%opts.colors.length]
}

function colorByExt(colors, file, defaultColor){
  var ext = path.extname(file);
  colors = colors || [];
  return colors[ext] || defaultColor;
}

function compact(src){
  var prev = null;
  return src.reduceRight(function(acc, cur){
    if(!prev || !prev.label || cur !== prev.label){
      acc.unshift(cur);
    }
    prev = cur;
    return acc;
  }, [])
}

function colorLabel(label, nodes, opts){
  // a color
  var ind = label.lastIndexOf('/');

  if(ind != -1){
    return color(label.substr(0, ind + 1), opts.basename)
      + color(label.substr(ind + 1), nodes, opts.extension)
  }

  return color(label, nodes, opts.extension);
}

/**
 * HELPERS
 */

function normalizePath(fpath, base, alwaysLeadingDir){
  if(base)fpath = path.relative(base, fpath);
  fpath = fpath.replace(/\\/g, '/');
  if(alwaysLeadingDir && fpath[0] !== '.')fpath = './' + fpath;
  return fpath;
}

function color(str, clr, extension){
  if(chalk[clr]){
    var ind;
    if(extension && (ind = str.lastIndexOf('.')) != -1){
      return str.substr(0, ind) + chalk[clr](str.substr(ind))
    }
    return chalk[clr](str);
  }
  return str;
}

function stringify(obj){
  return JSON.stringify(obj, null, 2).replace(/\\u.{4}\[\d{2}m/g, '')
}

/*function stripColor(s){
  return s.replace(/\u001b\[\d{2}m/gi,"")
}*/

function stripColors(s){
  return chalk.stripColor(s);
}

function reject(arr, fn){
  return arr.filter(function(){
    return !fn.apply(null, arguments);
  });
}

function isPlainObject(x){
  return typeof x === 'object' && !Array.isArray(x);
}

function isString(x){
  return typeof x === 'string';
}

function isFunction(x){
  return typeof x === 'function';
}

function isPlainFile(node){
  return isString(node) && node.indexOf('/') == -1 // && node.indexOf('@@') == -1
}

function objectLength(o){
  return Object.keys(o).length;
}

// scan and modify keys of nested objects;
function rekey(src, fn, deep){
  if(!isPlainObject(src))return src;

  var obj = {};
  for(var i in src){
    var k = fn(i);
    obj[k] = deep ? rekey(src[i], fn, deep) : src[i];
  }
  return obj;
}