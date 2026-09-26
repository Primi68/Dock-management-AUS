const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../app/src/main/assets');
http.createServer((req,res)=>{
  const name=req.url==='/'?'index.html':req.url.slice(1);
  if(!/^[a-zA-Z0-9._-]+$/.test(name)){res.writeHead(404);res.end();return;}
  fs.readFile(path.join(root,name),(err,data)=>{
    if(err){res.writeHead(404);res.end();return;}
    res.setHeader('Content-Type',name.endsWith('.js')?'application/javascript':name.endsWith('.css')?'text/css':'text/html');res.end(data);
  });
}).listen(4173,'127.0.0.1');
