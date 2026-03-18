const http=require('http');
const https=require('https');
const cache={};

function get(url){
return new Promise((resolve,reject)=>{
const req=https.get(url,{
headers:{
'User-Agent':'Mozilla/5.0 (Linux; Android 11) AppleWebKit/537.36 Chrome/91.0.4472.120 Mobile Safari/537.36',
'Accept-Language':'en-US,en;q=0.9',
},
timeout:15000,
},res=>{
let data='';
res.on('data',d=>data+=d);
res.on('end',()=>resolve({data,status:res.statusCode,headers:res.headers}));
});
req.on('error',reject);
req.on('timeout',()=>{req.destroy();reject(new Error('timeout'));});
});
}

async function getStreamUrl(ytId){
if(cache[ytId])return cache[ytId];
try{
const r=await get('https://www.youtube.com/watch?v='+ytId+'&hl=en');
const html=r.data;
const match=html.match(/"adaptiveFormats":\[(.*?)\],"approxDurationMs"/s);
if(!match)return null;
const formats=JSON.parse('['+match[1]+']');
const audio=formats.filter(f=>f.mimeType&&f.mimeType.startsWith('audio/')).sort((a,b)=>(b.bitrate||0)-(a.bitrate||0));
if(audio[0]?.url){
const u=decodeURIComponent(audio[0].url);
cache[ytId]=u;
return u;
}
}catch(e){}
return null;
}

async function searchYt(q){
const ckey='s_'+q;
if(cache[ckey])return cache[ckey];
try{
const r=await get('https://www.youtube.com/results?search_query='+encodeURIComponent(q)+'&hl=en');
const match=r.data.match(/"videoId":"([a-zA-Z0-9_-]{11})"/);
if(match){cache[ckey]=match[1];return match[1];}
}catch(e){}
return null;
}

const server=http.createServer(async(req,res)=>{
res.setHeader('Access-Control-Allow-Origin','*');
res.setHeader('Content-Type','application/json');
const url=new URL(req.url,'http://localhost:3000');
const id=url.searchParams.get('id');
const q=url.searchParams.get('q');
if(req.url==='/ping'){res.end(JSON.stringify({ok:true}));return;}
if(id){
const cleanId=id.replace(/[^a-zA-Z0-9_-]/g,'').slice(0,15);
try{
const u=await getStreamUrl(cleanId);
if(u)res.end(JSON.stringify({url:u}));
else res.end(JSON.stringify({error:'failed'}));
}catch(e){res.end(JSON.stringify({error:'failed'}));}
}else if(q){
const cleanQ=q.replace(/[^a-zA-Z0-9\s\-_\.]/g,'').slice(0,100);
try{
const vid=await searchYt(cleanQ);
if(!vid){res.end(JSON.stringify({error:'not found'}));return;}
const u=await getStreamUrl(vid);
if(u)res.end(JSON.stringify({url:u,id:vid}));
else res.end(JSON.stringify({error:'failed'}));
}catch(e){res.end(JSON.stringify({error:'failed'}));}
}else{
res.end(JSON.stringify({error:'no params'}));
}
});
const PORT=process.env.PORT||3000;
server.listen(PORT,()=>console.log('Gini server on port '+PORT));
