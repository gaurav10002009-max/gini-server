const http=require('http');
const https=require('https');
const cache={};

function get(url,headers){
return new Promise((resolve,reject)=>{
const req=https.get(url,{headers:headers||{},timeout:20000},res=>{
let data='';
res.on('data',d=>data+=d);
res.on('end',()=>resolve(data));
});
req.on('error',reject);
req.on('timeout',()=>{req.destroy();reject(new Error('timeout'));});
});
}

async function getPipedUrl(ytId){
const instances=[
'https://pipedapi.kavin.rocks',
'https://pipedapi.tokhmi.xyz',
'https://pipedapi.moomoo.me',
'https://watchapi.whatever.social',
'https://api.piped.projectsegfau.lt',
'https://piped-api.garudalinux.org',
];
for(const inst of instances){
try{
const data=await get(inst+'/streams/'+ytId,{'Accept':'application/json'});
const d=JSON.parse(data);
const streams=(d.audioStreams||[]).sort((a,b)=>(b.bitrate||0)-(a.bitrate||0));
if(streams[0]?.url){return streams[0].url;}
}catch(e){continue;}
}
return null;
}

async function searchPiped(q){
const instances=[
'https://pipedapi.kavin.rocks',
'https://pipedapi.tokhmi.xyz',
'https://pipedapi.moomoo.me',
'https://watchapi.whatever.social',
'https://api.piped.projectsegfau.lt',
];
for(const inst of instances){
try{
const data=await get(inst+'/search?q='+encodeURIComponent(q)+'&filter=videos',{'Accept':'application/json'});
const d=JSON.parse(data);
const id=d.items?.[0]?.url?.replace('/watch?v=','');
if(id)return id;
}catch(e){continue;}
}
return null;
}

const server=http.createServer(async(req,res)=>{
res.setHeader('Access-Control-Allow-Origin','*');
res.setHeader('Content-Type','application/json');
const url=new URL(req.url,'http://localhost:3000');
const id=(url.searchParams.get('id')||'').replace(/[^a-zA-Z0-9_-]/g,'').slice(0,15);
const q=(url.searchParams.get('q')||'').replace(/[^a-zA-Z0-9\s\-_\.]/g,'').slice(0,100);
if(req.url==='/ping'){res.end(JSON.stringify({ok:true}));return;}
if(id){
if(cache[id]){res.end(JSON.stringify({url:cache[id]}));return;}
try{
const u=await getPipedUrl(id);
if(u){cache[id]=u;res.end(JSON.stringify({url:u}));}
else res.end(JSON.stringify({error:'failed'}));
}catch(e){res.end(JSON.stringify({error:'failed'}));}
}else if(q){
const ck='q_'+q;
if(cache[ck]){res.end(JSON.stringify(cache[ck]));return;}
try{
const vid=await searchPiped(q);
if(!vid){res.end(JSON.stringify({error:'not found'}));return;}
const u=await getPipedUrl(vid);
if(u){const result={url:u,id:vid};cache[ck]=result;res.end(JSON.stringify(result));}
else res.end(JSON.stringify({error:'failed'}));
}catch(e){res.end(JSON.stringify({error:'failed'}));}
}else{
res.end(JSON.stringify({error:'no params'}));
}
});
const PORT=process.env.PORT||3000;
server.listen(PORT,()=>console.log('Gini server ready on port '+PORT));
