// Isolated loopback regression service. This is not a production backend.
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
const showcaseRoot = path.dirname(fileURLToPath(import.meta.url))
const publicRoot = path.resolve(showcaseRoot, '..', 'mail-vue', 'public')
const accounts = [{accountId:1,name:'Yuki · 工作邮箱',email:'yuki@example.test',allReceive:0,sort:1}, {accountId:2,name:'私人来信',email:'letters@example.test',allReceive:0,sort:2},{accountId:3,name:'订阅与记录',email:'notes@example.test',allReceive:1,sort:3}]
const role = {roleId:1,name:'本地回归管理员',sendType:'day',sendCount:40,accountCount:7}
const user = {userId:1,email:accounts[0].email,name:'Yuki',account:accounts[0],role,sendCount:12,permKeys:['*'],status:0,type:0}
const settings = {title:'Yuki Mail',domainList:['@example.test','@post.example.test'],manyEmail:0,addEmail:0,send:0,loginDomain:1,minEmailPrefix:3,addEmailVerify:1,register:1,regVerify:1,regKey:1,autoRefresh:0,notice:1,loginOpacity:1,background:'',r2Domain:'http://127.0.0.1:8788/assets',siteKey:''}
const samples = [
 ['Mori Studio','关于周末的小聚：时间与路线','早上好，周六我们在熟悉的街角见面。把路线和时间放在这封信里。',0,''],
 ['Example Account','你的登录验证码','本次登录的验证码为 482 731。请不要将验证码分享给其他人。',0,'482731'],
 ['林岚','下周的文字与图片整理，以及我们想保留的几个小细节','收到上一封信了。关于版式，我把要调整的地方和保留的细节逐项写下。',0,''],
 ['Paper Notes','October notes · a slower morning','A short note, a warm desk, and a few things worth keeping. The next issue arrives on Monday.',1,''],
 ['阿青','','到了以后给我发一封信就好。附件里是今天要用的文件。',1,''],
 ['Cloud Letter','我们收到了你的来信','来信已经收好。这是一个拥有自己的字体和颜色的 HTML 邮件示例。',1,''],
 ['Local Delivery','邮件投递报告','对方服务器暂时拒绝接收。请检查收件地址，然后重新发送。',1,'']
]
let mails = Array.from({length:126},(_,i)=>{
 const sample=samples[i%samples.length], id=1000-i
 return {emailId:id,accountId:1,name:sample[0],sendEmail:`sender${i%7}@example.test`,toEmail:accounts[0].email,recipient:JSON.stringify([{address:accounts[0].email,name:'Yuki'}]),subject:i<7?sample[1]:`${sample[1] || '一封简短的信'} · ${i+1}`,text:sample[2]+'\n\n这封信只存在于本地回归环境。\n\n我们会把需要的文件放在信的最后，并保留足够的阅读空间。\n\n祝一天顺利。\nMori',listText:sample[2],content:i===5?'<div style="font-family:Georgia,serif;background:#fff;color:#292a2c;padding:36px;max-width:640px;border-top:4px solid #415f48"><h2 style="font-size:28px;color:#415f48">A letter, in its own voice.</h2><p style="font-size:17px;line-height:1.8;margin-top:24px">This HTML message keeps the sender’s typography and colors. The mail client only supplies the surrounding reading space.</p></div>':'',unread:sample[3],code:sample[4],isStar:i===3?1:0,status:i===6?3:0,type:0,isDel:0,message:i===6?JSON.stringify({message:'Local fixture: delivery refused'}):'',attList:i===0||i===4?[{attId:1,filename:'readme.txt',size:2048,key:'readme.txt'},{attId:2,filename:'mail.png',size:1175,key:'mail.png'}]:[],createTime:new Date(Date.now()-i*3600000).toISOString().replace('T',' ').slice(0,19)}
})
// Explicit HTML background fixtures, all synthetic and independent of production mail.
const htmlFixtures = [
 [993,'HTML · no background','<h2>一封简单的 HTML 来信</h2><p>没有指定背景或文字颜色，应使用当前主题的纸面和文字。</p>'],
 [992,'HTML · body inherits theme',"<!doctype html><html><body class='letter-body' style='font-family:Georgia,serif;line-height:1.9'><h2>Body keeps its typography</h2><p>No background or color declaration.</p></body></html>"],
 [991,'HTML · sender stylesheet','<!doctype html><html><head><style>body.sender{background:#fff;color:#292a2c;font-family:Georgia,serif;padding:28px}body.sender h2{color:#415f48}</style></head><body class="sender"><h2>Sender stylesheet</h2><p>This white surface and dark ink belong to the author.</p></body></html>'],
 [990,'HTML · sender inline',"<body style='background:#fff;color:#292a2c;padding:28px;font-family:Georgia,serif'><h2>Sender inline formatting</h2><p>Single-quoted body attributes remain intact.</p></body>"],
 [989,'HTML · quoted reply','<p>谢谢你的来信。以下是原信，保留发件人原来的样式。</p><blockquote style="margin:24px 0;padding:24px;background:#fff;color:#292a2c;border-left:3px solid #92543e"><h2>Original quoted letter</h2><p>This light quote is deliberate author formatting.</p></blockquote>'],
 [988,'HTML · white body without ink','<html><body style="background-color:#fff;padding:28px"><h2>White body, unspecified ink</h2><p>The sender specified only a light background. Default text must stay readable.</p></body></html>'],
]
for (const [id,subject,content] of htmlFixtures) Object.assign(mails.find(mail=>mail.emailId===id),{subject,content,listText:'HTML surface regression fixture. No private data.',name:'Local HTML Review',sendEmail:'html@example.test'})
let failNextList=false
let delay=0
const events=[]
const respond=(res,data,code=200,message='OK')=>{res.writeHead(200,{'Content-Type':'application/json','Access-Control-Allow-Origin':'*'});res.end(JSON.stringify({code,data,message}))}
const server=http.createServer(async(req,res)=>{
 const url=new URL(req.url,'http://127.0.0.1:8788');const p=url.pathname.replace(/^\/api/,'');
 if(req.method==='OPTIONS'){res.writeHead(204,{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization,content-type,accept-language','Access-Control-Allow-Methods':'GET,POST,PUT,DELETE,OPTIONS'});res.end();return}
 if(url.pathname==='/assets/mail.png'){res.writeHead(200,{'Content-Type':'image/png','Access-Control-Allow-Origin':'*'});fs.createReadStream(path.join(publicRoot,'mail.png')).pipe(res);return}
 if(url.pathname==='/assets/readme.txt'){res.writeHead(200,{'Content-Type':'text/plain','Access-Control-Allow-Origin':'*','Content-Disposition':'attachment; filename="readme.txt"'});res.end('Local attachment fixture. No private data.');return}
 let raw='';for await(const chunk of req)raw+=chunk;let body={};try{body=JSON.parse(raw||'{}')}catch{}
 if(p==='/review/events'){respond(res,events);return}
 if(p==='/review/fail-list'){failNextList=true;respond(res,true);return}
 if(p==='/review/delay'){delay=Number(url.searchParams.get('ms'))||0;respond(res,true);return}
 if(p==='/review/verification'){settings.addEmailVerify=Number(url.searchParams.get('mode')||0);respond(res,true);return}
 const event={time:new Date().toISOString(),method:req.method,path:p,query:Object.fromEntries(url.searchParams)};events.push(event)
 if(p==='/setting/websiteConfig'){respond(res,settings);return}
 if(p==='/login'){if(body.password!=='review')respond(res,null,403,'Use local fixture password: review');else respond(res,{token:body.email.startsWith('reader')?'local-reader-fixture':'local-admin-fixture'});return}
 if(p==='/my/loginUserInfo'){respond(res,req.headers.authorization==='local-reader-fixture'?{...user,permKeys:['email:query'],role:{...role,name:'只读回归用户'}}:user);return}
 if(p==='/logout'){respond(res,true);return}
 if(p==='/email/list'||p==='/star/list'||p==='/allEmail/list'){
  if(failNextList){failNextList=false;respond(res,null,503,'Local fixture: list unavailable');return}
  if(delay)await new Promise(r=>setTimeout(r,delay))
  const accountId=Number(url.searchParams.get('accountId')||1),type=Number(url.searchParams.get('type')||0),cursor=Number(url.searchParams.get('emailId')||0),size=Number(url.searchParams.get('size')||50)
  let filtered=mails.filter(m=>p==='/allEmail/list'||p==='/star/list'?p==='/allEmail/list'||m.isStar:m.type===type&&m.accountId===accountId)
  if(url.searchParams.get('timeSort')==='1')filtered=[...filtered].reverse()
  const index=cursor?filtered.findIndex(m=>m.emailId===cursor)+1:0
  const list=filtered.slice(index,index+size).map(m=>({...m,userEmail:user.email}))
  respond(res,{list,total:filtered.length,latestEmail:{emailId:filtered[0]?.emailId||0}});return
 }
 if(p==='/email/latest'||p==='/allEmail/latest'){respond(res,[]);return}
 if(p==='/email/detail'){respond(res,mails.find(m=>m.emailId===Number(url.searchParams.get('emailId'))));return}
 if(p==='/email/read'){mails.forEach(m=>{if(body.emailIds.includes(m.emailId))m.unread=1});respond(res,true);return}
 if(p==='/email/delete'||p==='/allEmail/delete'){const ids=(url.searchParams.get('emailIds')||'').split(',').map(Number);mails=mails.filter(m=>!ids.includes(m.emailId));respond(res,true);return}
 if(p==='/star/add'||p==='/star/cancel'){const m=mails.find(m=>m.emailId===Number(body.emailId||url.searchParams.get('emailId')));if(m)m.isStar=p.endsWith('add')?1:0;respond(res,true);return}
 if(p==='/email/send'){
  await new Promise(r=>setTimeout(r,800))
  if(body.subject.includes('[fail]')){respond(res,null,503,'本地回归：发送失败，正文保留，可重试。');return}
  const sent={...mails[0],...body,receiveEmail:undefined,emailId:2000+mails.length,type:1,status:1,recipient:JSON.stringify(body.receiveEmail.map(address=>({address,name:''}))),attList:[],createTime:new Date().toISOString().replace('T',' ').slice(0,19)};mails.unshift(sent);user.sendCount++;respond(res,[sent]);return
 }
 if(p==='/account/list'){respond(res,Number(url.searchParams.get('accountId'))?[]:accounts);return}
 if(p==='/account/add'){
  if(delay)await new Promise(r=>setTimeout(r,delay))
  if(accounts.some(a=>a.email===body.email)){respond(res,null,409,'这个邮箱地址已经存在。');return}
  const account={accountId:accounts.length+1,email:body.email,name:body.email.split('@')[0],allReceive:0,sort:accounts.length+1,addVerifyOpen:false};accounts.push(account);respond(res,account);return
 }
 if(p.startsWith('/account/')){
  const id=Number(body.accountId||url.searchParams.get('accountId')),account=accounts.find(a=>a.accountId===id)
  if(p.endsWith('setName')&&account){account.name=body.name;if(id===1)user.name=body.name}
  if(p.endsWith('setAllReceive')&&account){const value=1-account.allReceive;accounts.forEach(a=>a.allReceive=0);account.allReceive=value}
  if(p.endsWith('delete')){const i=accounts.findIndex(a=>a.accountId===id);if(i>=0)accounts.splice(i,1)}
  respond(res,true);return
 }
 if(p==='/analysis/echarts'){respond(res,{numberCount:{receiveTotal:1284,sendTotal:496,accountTotal:6,userTotal:8,normalReceiveTotal:1260,normalSendTotal:488,normalAccountTotal:6,normalUserTotal:8,delReceiveTotal:24,delSendTotal:8,delAccountTotal:0,delUserTotal:0},receiveRatio:{nameRatio:[{name:'Studio',total:412},{name:'Notes',total:286},{name:'System',total:215},{name:'Friends',total:188},{name:'Newsletters',total:183}]},userDayCount:[{date:'2026-09-19',count:1},{date:'2026-09-22',count:2},{date:'2026-09-25',count:3},{date:'2026-09-28',count:4},{date:'2026-10-01',count:6},{date:'2026-10-04',count:8}],emailDayCount:{receiveDayCount:[{date:'2026-09-19',count:42},{date:'2026-09-22',count:58},{date:'2026-09-25',count:74},{date:'2026-09-28',count:91},{date:'2026-10-01',count:118},{date:'2026-10-04',count:146}],sendDayCount:[{date:'2026-09-19',count:12},{date:'2026-09-22',count:18},{date:'2026-09-25',count:24},{date:'2026-09-28',count:31},{date:'2026-10-01',count:39},{date:'2026-10-04',count:46}]},daySendTotal:18});return}
 if(p==='/user/list'){respond(res,{list:[user],total:1});return}
 if(p==='/role/list'||p==='/role/selectUse'){respond(res,[role]);return}
 if(p==='/role/tree'){respond(res,[]);return}
 if(p==='/regKey/list'){respond(res,[]);return}
 if(p==='/setting/query'){respond(res,{...settings,resendTokens:{},emailPrefixFilter:[],oauth:{}});return}
 respond(res,null,404,'Unimplemented local regression endpoint')
})
server.listen(8788,'127.0.0.1',()=>console.log('LOCAL FIXTURE API only: http://127.0.0.1:8788/api · yuki@example.test / review'))
