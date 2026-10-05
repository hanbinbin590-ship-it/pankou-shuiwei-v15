const express=require("express");
const cors=require("cors");
const fs=require("fs");
const path=require("path");
const crypto=require("crypto");

const app=express();
const PORT=process.env.PORT||3000;
const HOST="0.0.0.0";
const DB=path.join(__dirname,"cloud-db.json");
const SECRET=process.env.APP_SECRET||"please-change-this-secret";
const SM_TOKEN=process.env.SPORTMONKS_API_TOKEN||"";

app.use(cors());
app.use(express.json({limit:"20mb"}));
app.use(express.static(__dirname));

function readDB(){try{return JSON.parse(fs.readFileSync(DB,"utf8"))}catch{return {version:17,users:{}}}}
function writeDB(x){fs.writeFileSync(DB,JSON.stringify(x,null,2),"utf8")}
function hash(p,s){return crypto.scryptSync(p,s,64).toString("hex")}
function token(payload){const b=Buffer.from(JSON.stringify(payload)).toString("base64url");const s=crypto.createHmac("sha256",SECRET).update(b).digest("base64url");return b+"."+s}
function verify(t){try{const [b,s]=String(t||"").split(".");if(!b||!s)return null;const e=crypto.createHmac("sha256",SECRET).update(b).digest("base64url");if(!crypto.timingSafeEqual(Buffer.from(s),Buffer.from(e)))return null;const p=JSON.parse(Buffer.from(b,"base64url"));return p.exp>Date.now()?p:null}catch{return null}}
function auth(req,res,next){const p=verify((req.headers.authorization||"").replace(/^Bearer\s+/i,""));if(!p)return res.status(401).json({ok:false,error:"未登录或登录已过期"});req.user=p.user;next()}
function userData(db,u){if(!db.users[u])db.users[u]={salt:crypto.randomBytes(16).toString("hex"),passwordHash:"",data:{version:17,matches:[],events:[],bets:[],reviews:[],settings:{}}};return db.users[u]}
function sm(pathname,params={}){const u=new URL("https://api.sportmonks.com/v3/football"+pathname);u.searchParams.set("api_token",SM_TOKEN);for(const [k,v] of Object.entries(params))if(v!==undefined&&v!==null&&v!=="")u.searchParams.set(k,v);return fetch(u)}
async function smJSON(pathname,params={}){if(!SM_TOKEN)throw new Error("未配置 SPORTMONKS_API_TOKEN");const r=await sm(pathname,params);const j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(j.message||j.error||`Sportmonks HTTP ${r.status}`);return j}
function isoDate(s){return /^\d{4}-\d{2}-\d{2}$/.test(s)?s:new Date().toISOString().slice(0,10)}
function normFixture(x){
 const league=x.league||x.league_id||null, season=x.season||null;
 const teams=x.participants||x.teams||[];
 const home=teams.find(t=>t.meta?.location==="home"||t.location==="home")||teams[0]||{};
 const away=teams.find(t=>t.meta?.location==="away"||t.location==="away")||teams[1]||{};
 return {id:String(x.id),providerId:x.id,source:"sportmonks",leagueId:league?.id||league,leagueName:league?.name||"",seasonId:season?.id||season,date:x.starting_at||x.starting_at_timestamp||null,status:x.state?.name||x.status||"",home:{id:home.id,name:home.name||home.short_code||"主队"},away:{id:away.id,name:away.name||away.short_code||"客队"},venue:x.venue?.name||"",raw:x};
}
function normOdds(x){
 const out=[]; for(const o of (x.odds||x||[])){out.push({id:String(o.id||crypto.randomUUID()),marketId:o.market_id||o.market?.id||null,marketName:o.market?.name||o.market_name||"",bookmakerId:o.bookmaker_id||o.bookmaker?.id||null,bookmakerName:o.bookmaker?.name||"",label:o.label||o.name||o.selection||"",value:o.value??o.handicap??null,price:o.price??o.odds??null,createdAt:o.created_at||null,raw:o})} return out;
}
app.get("/",(req,res)=>res.sendFile(path.join(__dirname,"index.html")));
app.get("/health",(req,res)=>res.json({ok:true,version:17,service:"odds-workbench",sportmonksConfigured:Boolean(SM_TOKEN),time:new Date().toISOString()}));

app.post("/api/auth/register",(req,res)=>{const u=String(req.body?.username||"").trim(),p=String(req.body?.password||"");if(!/^[A-Za-z0-9_-]{3,32}$/.test(u))return res.status(400).json({ok:false,error:"用户名需3-32位字母、数字、下划线或短横线"});if(p.length<8)return res.status(400).json({ok:false,error:"密码至少8位"});const db=readDB();if(db.users[u])return res.status(409).json({ok:false,error:"用户名已存在"});const x=userData(db,u);x.passwordHash=hash(p,x.salt);writeDB(db);res.json({ok:true})});
app.post("/api/auth/login",(req,res)=>{const u=String(req.body?.username||"").trim(),p=String(req.body?.password||""),db=readDB(),x=db.users[u];if(!x)return res.status(401).json({ok:false,error:"账号或密码错误"});const got=hash(p,x.salt);if(!crypto.timingSafeEqual(Buffer.from(got),Buffer.from(x.passwordHash)))return res.status(401).json({ok:false,error:"账号或密码错误"});res.json({ok:true,token:token({user:u,exp:Date.now()+7*86400000}),username:u})});
app.get("/api/sync/pull",auth,(req,res)=>{const db=readDB();res.json({ok:true,db:db.users[req.user].data})});
app.post("/api/sync/push",auth,(req,res)=>{const db=readDB();db.users[req.user].data={...req.body,version:17};writeDB(db);res.json({ok:true,time:new Date().toISOString()})});

app.get("/api/global/status",async(req,res)=>{if(!SM_TOKEN)return res.json({ok:false,configured:false,error:"Railway 尚未配置 SPORTMONKS_API_TOKEN"});try{const j=await smJSON("/");res.json({ok:true,configured:true,message:"Sportmonks 数据源可访问"})}catch(e){res.status(502).json({ok:false,configured:true,error:e.message})}});
app.get("/api/global/fixtures",async(req,res)=>{try{const date=isoDate(req.query.date);const j=await smJSON(`/fixtures/date/${date}`,{include:"participants;league;season;state;venue"});res.json({ok:true,date,fixtures:(j.data||[]).map(normFixture)})}catch(e){res.status(502).json({ok:false,error:e.message})}});
app.get("/api/global/live",async(req,res)=>{try{const j=await smJSON("/livescores/inplay",{include:"participants;league;state;venue"});res.json({ok:true,fixtures:(j.data||[]).map(normFixture)})}catch(e){res.status(502).json({ok:false,error:e.message})}});
app.get("/api/global/fixture/:id",async(req,res)=>{try{const j=await smJSON(`/fixtures/${encodeURIComponent(req.params.id)}`,{include:"participants;league;season;state;venue;odds;bookmakers"});res.json({ok:true,fixture:normFixture(j.data||j),odds:normOdds(j.data||j)})}catch(e){res.status(502).json({ok:false,error:e.message})}});

app.listen(PORT,HOST,()=>console.log(`V17 listening on ${HOST}:${PORT}`));
