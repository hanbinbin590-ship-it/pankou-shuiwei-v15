const express=require('express');
const cors=require('cors');
const fs=require('fs');
const path=require('path');
const crypto=require('crypto');

const app=express();
const PORT=process.env.PORT||8787;
const DB=path.join(__dirname,'cloud-db.json');
const SECRET=process.env.APP_SECRET||'change-this-secret-before-production';

app.use(cors());
app.use(express.json({limit:'10mb'}));
app.use(express.static(__dirname));

function read(){
  try{return JSON.parse(fs.readFileSync(DB,'utf8'))}
  catch(e){return {version:15,users:{}}}
}
function write(x){fs.writeFileSync(DB,JSON.stringify(x,null,2),'utf8')}
function hashPassword(password,salt){return crypto.scryptSync(password,salt,64).toString('hex')}
function sign(payload){
  const body=Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig=crypto.createHmac('sha256',SECRET).update(body).digest('base64url');
  return body+'.'+sig;
}
function verify(token){
  try{
    const [body,sig]=String(token||'').split('.');
    const expected=crypto.createHmac('sha256',SECRET).update(body).digest('base64url');
    if(!body||!sig||sig.length!==expected.length||!crypto.timingSafeEqual(Buffer.from(sig),Buffer.from(expected))) return null;
    const p=JSON.parse(Buffer.from(body,'base64url').toString());
    if(!p.user||!p.exp||Date.now()>p.exp) return null;
    return p;
  }catch(e){return null}
}
function auth(req,res,next){
  const p=verify((req.headers.authorization||'').replace(/^Bearer\s+/i,''));
  if(!p)return res.status(401).json({ok:false,error:'未登录或登录已过期'});
  req.user=p.user; next();
}
function validUser(u){return /^[a-zA-Z0-9_-]{3,32}$/.test(u)}
function userDb(db,u){
  if(!db.users[u])db.users[u]={salt:crypto.randomBytes(16).toString('hex'),passwordHash:'',data:{version:15,matches:[],events:[],bets:[],reviews:[],settings:{}}};
  return db.users[u]
}

app.get('/',(req,res)=>res.sendFile(path.join(__dirname,'index.html')));
app.get('/health',(req,res)=>res.json({ok:true,version:15,time:new Date().toISOString()}));

app.post('/api/auth/register',(req,res)=>{
  const username=String(req.body?.username||'').trim();
  const password=String(req.body?.password||'');
  if(!validUser(username))return res.status(400).json({ok:false,error:'用户名需为 3-32 位字母、数字、下划线或短横线'});
  if(password.length<8)return res.status(400).json({ok:false,error:'密码至少 8 位'});
  const db=read();
  if(db.users[username])return res.status(409).json({ok:false,error:'用户名已存在'});
  const u=userDb(db,username);
  u.passwordHash=hashPassword(password,u.salt);
  write(db);
  res.json({ok:true});
});

app.post('/api/auth/login',(req,res)=>{
  const username=String(req.body?.username||'').trim();
  const password=String(req.body?.password||'');
  const db=read(), u=db.users[username];
  if(!u)return res.status(401).json({ok:false,error:'账号或密码错误'});
  const got=hashPassword(password,u.salt);
  if(got.length!==u.passwordHash.length||!crypto.timingSafeEqual(Buffer.from(got),Buffer.from(u.passwordHash)))return res.status(401).json({ok:false,error:'账号或密码错误'});
  const token=sign({user:username,exp:Date.now()+7*24*3600*1000});
  res.json({ok:true,token,username});
});

app.get('/api/sync/pull',auth,(req,res)=>{
  const db=read(); const u=db.users[req.user];
  res.json({ok:true,db:u.data});
});

app.post('/api/sync/push',auth,(req,res)=>{
  if(!req.body||typeof req.body!=='object')return res.status(400).json({ok:false,error:'invalid body'});
  const db=read(); const u=db.users[req.user];
  u.data=req.body; u.data.version=15; write(db);
  res.json({ok:true,time:new Date().toISOString()});
});

app.get('/api/odds',(req,res)=>res.status(501).json({ok:false,error:'请配置你有权限使用的合法赔率数据源'}));

app.listen(PORT,'0.0.0.0',()=>console.log(`V15 cloud server listening on ${PORT}`));
