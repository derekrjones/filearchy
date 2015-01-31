var fs = require('fs');
var path = require('path');

module.exports = function(filename, dat){
  var src;
  var fPath = pathToFixture(filename);
  try {
    src = loadFile(fPath);
  } catch(err){
    if(err.code === "ENOENT" && err.errno === 34){
      var out = createFile(fPath, dat)
      src = loadContents(fPath, out)
    }
    else throw err
  }
  return src;
}

function defaultCompare(src,dat){
  return src === dat;
}

function createFile(fPath, dat){
  console.log('create fixture', fPath);
  dat = (typeof dat === 'string') ? dat : JSON.stringify(dat, null, 2);
  fs.writeFileSync(fPath, dat);
  return dat;
}

function loadFile(fPath){
  var contents = fs.readFileSync(fPath).toString();
  return loadContents(fPath, contents);
}

function loadContents(fPath, contents){
  if(!path.extname(fPath) === '.json'){
    contents = JSON.parse(contents);
  }
  return contents;
}

function pathToFixture(name){
  if(!path.extname(name)){
    name += '.json'
  }
  return path.join(__dirname, name);
}