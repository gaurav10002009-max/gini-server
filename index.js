const http=require('http');
const{exec}=require('child_process');
const cache={};
const rateMap={};
const RATE_LIMIT=30;
const RATE_WINDOW=60000;

function isClean(str){
return /^[a-zA-Z0-9\s\-_\.\']+$/.test(str);
}
function checkRate(ip){
const now=Date.now();
if(!rateMap[ip])rateMap[ip]=[];
rateMap[ip]=rateMap[ip].filter(t=>now-t<RATE_WINDOW);
if(rateMap[ip].length>=RATE_LIMIT)return false;
rateMap[ip].push(now);
return true;
}
function sanitizeId(id){
return id.replace(/[^a-zA-Z0-9_\-]/g,'');
}
function sanitizeQuery(q){
return q.replace(/[^a-zA-Z0-9\s\-_\.\']/g,'').slice(0,100);
}

const server=http.createServer((req,res)=>{
res.setHeader('Access-Control-Allow-Origin','*');
res.setHeader('Content-Type','application/json');
const ip=req.socket.remoteAddress||'unknown';
if(!checkRate(ip)){res.statusCode=429;res.end(JSON.stringify({error:'rate limited'}));return;}
const url=new URL(req.url,'http://localhost:3000');
const rawId=url.searchParams.get('id')||'';
const rawQ=url.searchParams.get('q')||'';
if(req.url==='/ping'){res.end(JSON.stringify({ok:true}));return;}
if(rawId){
const id=sanitizeId(rawId);
if(!id||id.length<5||id.length>15){res.end(JSON.stringify({error:'invalid id'}));return;}
if(cache[id]){res.end(JSON.stringify({url:cache[id]}));return;}
exec('yt-dlp -x --audio-format best --get-url "https://www.youtube.com/watch?v='+id+'"',{timeout:30000},(err,stdout)=>{
if(err||!stdout.trim()){res.end(JSON.stringify({error:'failed'}));return;}
const u=stdout.trim().split('\n')[0];
cache[id]=u;
res.end(JSON.stringify({url:u}));
});
}else if(rawQ){
const q=sanitizeQuery(rawQ);
if(!q||q.length<2){res.end(JSON.stringify({error:'invalid query'}));return;}
exec('yt-dlp --get-id "ytsearch1:'+q+'"',{timeout:20000},(err,stdout)=>{
if(err||!stdout.trim()){res.end(JSON.stringify({error:'failed'}));return;}
const vid=sanitizeId(stdout.trim().split('\n')[0]);
if(!vid){res.end(JSON.stringify({error:'no result'}));return;}
if(cache[vid]){res.end(JSON.stringify({url:cache[vid],id:vid}));return;}
exec('yt-dlp -x --audio-format best --get-url "https://www.youtube.com/watch?v='+vid+'"',{timeout:30000},(err2,stdout2)=>{
if(err2||!stdout2.trim()){res.end(JSON.stringify({error:'failed'}));return;}
const u=stdout2.trim().split('\n')[0];
cache[vid]=u;
res.end(JSON.stringify({url:u,id:vid}));
});
});
}else{
res.end(JSON.stringify({error:'no params'}));
}
});
server.listen(3000,()=>console.log('Gini secure server ready on port 3000'));
