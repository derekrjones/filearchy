# filearchy

Pretty print file trees with a compact readable structure and coloring

```javascript
filearchy([file1,file2,...],opts)
filearchy([[fileA1,fileA2],[fileB1,fileB2]],opts)

// Glob-all
filearchy("**/node_modules/*")
filearchy(["**/node_modules/*","!**/node_modules/lodash"])

// CWD
filearchy("**/node_modules/*/REAMDE.md",{cwd: 'c/projects/myprj'})
```

see index.js for opts

