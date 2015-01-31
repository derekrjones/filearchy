var expect = require("chai").expect

var path = require('path')
var _ = require('lodash')

var filearchy = require('../')

var HOME = path.join(__dirname, '../')

var glob = require('glob-all');

var fixtures = require('./fixtures');

describe("array", function(){
  var opts;
  before(function(){
    opts = {resolve: false, color: false};
  })
  it("should print a single array", function(){
    var arr = ['a/b/c', 'a/b/c', 'a/b/c2/d'];
    var res = filearchy(arr, opts);

    var comp = compareFixture('arr-single.out', res);
    //expect(res, [res,comp.src].join("\n\n")).to.satisfy(comp,comp.src);
    expect(res).to.satisfy(comp,compareMessage(comp,res));
  })
  it("should print multiple arrays", function(){
    var arr = [
      ['a/b/c', 'a/b/c2', 'a/b/c3/d'],
      ['x/y/z', 'x/y2'],
      ['w/w/w']
    ];
    var res = filearchy(arr, opts);

    var comp = compareFixture('arr-multiple.out', res);
    expect(res, res).to.satisfy(comp);
  })
  it.skip("should print trees", function(){
    var tree = {
      "a/": {
        "b/": {
          "c": "green",
          "c2": "green",
          "c3/": {
            "d": "green"
          }
        }
      },
      "x/": {
        "y2": "magenta",
        "y/": {
          "z": "magenta"
        }
      },
      "w/": {
        "w2/": {
          "w3": "cyan"
        }
      }
    }
    var res = filearchy(tree, opts);
    var comp = compareFixture('tree.out', res);
    expect(res, res).to.satisfy(comp);
  })
})

describe("glob", function(){
  var opts;
  before(function(){
    opts = {cwd: HOME, nocase: true, color: false};
  })
  it("should handle string glob", function(){
    var pattern = '**/node_modules/*/*.md';
    var globs = glob.sync(pattern, opts);

    var globRes = filearchy(globs, opts);
    var res = filearchy(pattern, opts);

    expect(res).to.be.equal(globRes);

    expect(res).to.contain('lodash')

    var comp = compareFixture('markdown.out', res, globComparer);
    expect(res, res).to.satisfy(comp);
  })
  it("should handle array of globs", function(){
    var pattern = ['**/node_modules/*/*.md', '!**/lodash/*.md', '!**/README.md'];
    var globs = glob.sync(pattern.slice(), opts);

    var globRes = filearchy(globs, opts);
    var res = filearchy(pattern, opts);

    expect(res).to.be.equal(globRes);

    expect(res).to.not.contain('lodash')

    var comp = compareFixture('non-readmes.out', res, globComparer);
    expect(res, res).to.satisfy(comp);
  })
})

function compareMessage(comp,res){
  var out = ['','EXPECTED',comp.src,'','ACTUAL',res,'']
  out = out
    .map(JSON.stringify)
    .join("\n");
  return out;
}

function compareFixture(name, src, compareFn){
  compareFn = compareFn || stringComparer;
  var fix = fixtures(name, src);
  var comp = compareFn(fix)
  comp.src = fix;
  return comp;
}

function stringComparer(src){
  return function(out){
    return src === out;
  }
}

function globComparer(src){
  var s = removeFirstLine(src);
  return function(out){
    var o = removeFirstLine(out);
    return o.length && o === s;
  }
}

function removeFirstLine(log){
  return log.split("\n").slice(1).join("\n");
}