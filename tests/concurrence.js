// Régressions de concurrence : vrais écrans, HTTP retardé et données fictives.
'use strict';
const {chromium}=require('playwright'),assert=require('assert/strict');
const base=process.env.WL_BASE;
let ok=0,ko=0;
const check=(value,message)=>{if(value){ok++;}else{ko++;console.error('ÉCHEC concurrence : '+message);}return !!value;};
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return{promise,resolve,reject};};
(async()=>{
 const browser=await chromium.launch(process.env.WL_CHROMIUM?{executablePath:process.env.WL_CHROMIUM}:{});
 const errors=[];
 const watch=page=>page.on('pageerror',error=>errors.push(error.message));
 async function login(){
  const context=await browser.newContext(),page=await context.newPage();watch(page);page.setDefaultTimeout(10000);
  await page.goto(base+'admin.php');await page.locator('#password').fill(process.env.WL_PASSWORD);await page.locator('#login-form button').click();await page.locator('#sessions:not([hidden])').waitFor();
  const me=await(await context.request.get(base+'api.php?action=me')).json();assert(me.csrf);
  const headers={'X-WL':'1','X-CSRF-Token':me.csrf,'X-WL-Features':'info-v1, rich-v1'};
  const post=async(action,body)=>{const r=await context.request.post(base+'api.php?action='+action,{headers,data:body});const data=await r.json();assert(r.ok(),action+' '+r.status()+' '+JSON.stringify(data));return data;};
  const read=async(action,query='')=>{const r=await context.request.get(base+'api.php?action='+action+(query?'&'+query:''),{headers});assert(r.ok());return r.json();};
  return{context,page,post,read,headers,csrf:me.csrf};
 }
 async function workshop(admin,title,questions){
  const made=await admin.post('session_create',{title});
  for(const question of questions)await admin.post('question_save',{s:made.code,question});
  const state=await admin.read('admin_state','s='+made.code);return{code:made.code,questions:state.questions};
 }
 async function participant(code,selector='.btn-choice'){
  const context=await browser.newContext(),page=await context.newPage();watch(page);page.setDefaultTimeout(10000);
  await page.goto(base);await page.locator('#code').fill(code);await page.locator('#join-form button').click();await page.locator('#question:not([hidden]) '+selector).first().waitFor();
  const keys=await page.evaluate(()=>({token:localStorage.getItem('wl_token'),csrf:localStorage.getItem('wl_csrf')}));
  const read=async()=>{const r=await context.request.get(base+'api.php?action=state&s='+code,{headers:{'X-WL-Token':keys.token,'X-WL-Features':'info-v1, rich-v1'}});assert(r.ok());return r.json();};
  return{context,page,read,keys};
 }
 try{
  const admin=await login(),ctx={browser,base,login,workshop,participant,post:admin.post,check,assert,delay,deferred};
  const selected=(process.env.WL_CONCURRENCE_ONLY||'pending,poller,control').split(',');
  for(const name of selected){const before=ok,failed=ko;try{await require('./concurrence/'+name)(ctx);}catch(error){ko++;console.error('ÉCHEC harnais '+name+' : '+(error.stack||error));}console.log('Concurrence '+name+' : '+(ok-before)+' OK, '+(ko-failed)+' échec(s)');}
  check(errors.length===0,'aucune erreur JavaScript : '+errors.join('; '));
 }finally{await browser.close();}
 console.log('Concurrence : '+ok+' OK, '+ko+' échec(s)');process.exitCode=ko?1:0;
})().catch(error=>{console.error(error);process.exitCode=1;});
