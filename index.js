const http=require('http');
const https=require('https');
const cache={};
const rateMap={};

function checkRate(ip){
const now=Date.now();
if(!rateMap[ip])rateMap[ip]=[];
rateMap[ip]=rateMap[ip].filter(t=>now-t<60000);
if(rateMap[ip].length>=30)return false;
rateMap[ip].push(now);
return true;
}

function sanitize(s){return(s||'').replace(/[^a-zA-Z0-9\s\-_\.\']/g,'').slice(0,100);}

function fetchUrl(url){
return new Promise((resolve,reject)=>{
https.get(url,{headers:{'User-Agent':'Mozilla/5.0'}},res=>{
let data='';
res.on('data',d=>data+=d);
res.on('end',()=>resolve(data));
}).on('error',reject);
});
}

async function getInvidiousUrl(ytId){
const instances=[
'https://inv.nadeko.net',
'https://invidious.privacyredirect.com',
'https://iv.melmac.space',
'https://invidious.nerdvpn.de',
];
for(const inst of instances){
try{
const data=await fetchUrl(inst+'/api/v1/videos/'+ytId+'?fields=adaptiveFormats,formatStreams');
const d=JSON.parse(data);
const af=(d.adaptiveFormats||[]).filter(f=>f.type&&f.type.startsWith('audio/')).sort((a,b)=>(b.bitrate||0)-(a.bitrate||0));
const url=af[0]?.url||d.formatStreams?.[0]?.url;
if(url)return url;
}catch(e){continue;}
}
return null;
}

async function searchInvidious(q){
const instances=[
'https://inv.nadeko.net',
'https://invidious.privacyredirect.com',
'https://iv.melmac.space',
'https://invidious.nerdvpn.de',
];
for(const inst of instances){
try{
const data=await fetchUrl(inst+'/api/v1/search?q='+encodeURIComponent(q)+'&type=video&fields=videoId&page=1');
const d=JSON.parse(data);
if(d[0]?.videoId)return d[0].videoId;
}catch(e){continue;}
}
return null;
}

const server=http.createServer(async(req,res)=>{
res.setHeader('Access-Control-Allow-Origin','*');
res.setHeader('Content-Type','application/json');
const ip=req.socket.remoteAddress||'unknown';
if(!checkRate(ip)){res.statusCode=429;res.end(JSON.stringify({error:'rate limited'}));return;}
const url=new URL(req.url,'http://localhost:3000');
const rawId=url.searchParams.get('id')||'';
const rawQ=url.searchParams.get('q')||'';
if(req.url==='/ping'){res.end(JSON.stringify({ok:true}));return;}
if(rawId){
const id=rawId.replace(/[^a-zA-Z0-9_\-]/g,'').slice(0,15);
if(!id){res.end(JSON.stringify({error:'invalid'}));return;}
if(cache[id]){res.end(JSON.stringify({url:cache[id]}));return;}
try{
const u=await getInvidiousUrl(id);
if(u){cache[id]=u;res.end(JSON.stringify({url:u}));}
else res.end(JSON.stringify({error:'failed'}));
}catch(e){res.end(JSON.stringify({error:'failed'}));}
}else if(rawQ){
const q=sanitize(rawQ);
if(!q){res.end(JSON.stringify({error:'invalid'}));return;}
const ckey='q_'+q;
if(cache[ckey]){res.end(JSON.stringify(cache[ckey]));return;}
try{
const vid=await searchInvidious(q);
if(!vid){res.end(JSON.stringify({error:'not found'}));return;}
const u=await getInvidiousUrl(vid);
if(u){
const result={url:u,id:vid};
cache[ckey]=result;
res.end(JSON.stringify(result));
}else res.end(JSON.stringify({error:'failed'}));
}catch(e){res.end(JSON.stringify({error:'failed'}));}
}else{
res.end(JSON.stringify({error:'no params'}));
}
});

const PORT=process.env.PORT||3000;
server.listen(PORT,()=>console.log('Gini server ready on port '+PORT));

