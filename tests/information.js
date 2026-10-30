// Import réel PDF et image, puis lecture synchronisée, sans réponse ni score.
'use strict';
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs'), os = require('os'), zlib = require('zlib');
const BASE = process.env.WL_BASE;
let n = 0;
function check(v, label) { if (!v) throw new Error(label); n++; }
function zipEntries(bytes) {
 let end=bytes.length-22; while(end>=0&&bytes.readUInt32LE(end)!==0x06054b50)end--;
 const entries={};let p=bytes.readUInt32LE(end+16), count=bytes.readUInt16LE(end+10);
 for(let i=0;i<count;i++){
  const method=bytes.readUInt16LE(p+10),size=bytes.readUInt32LE(p+20),nameLen=bytes.readUInt16LE(p+28),extra=bytes.readUInt16LE(p+30),comment=bytes.readUInt16LE(p+32),offset=bytes.readUInt32LE(p+42);
  const name=bytes.toString('utf8',p+46,p+46+nameLen),start=offset+30+bytes.readUInt16LE(offset+26)+bytes.readUInt16LE(offset+28);
  const data=bytes.subarray(start,start+size);entries[name]=method===8?zlib.inflateRawSync(data):data;p+=46+nameLen+extra+comment;
 }
 return entries;
}
(async () => {
 const browser = await chromium.launch(process.env.WL_CHROMIUM ? {executablePath:process.env.WL_CHROMIUM} : {});
 try {
  const context = await browser.newContext({viewport:{width:1280,height:720}});
  const admin = await context.newPage(), errors=[];
  for (const page of [admin]) page.on('pageerror',e=>errors.push(e.message));
  await admin.goto(BASE+'admin.php'); await admin.fill('#password',process.env.WL_PASSWORD); await admin.click('#login-form button');
  await admin.waitForSelector('#sessions:not([hidden])');
  const request=admin.context().request, csrf=(await(await request.get(BASE+'api.php?action=me')).json()).csrf;
  const headers={'X-WL':'1','X-CSRF-Token':csrf,'X-WL-Features':'info-v1'};
  const post=async(action,data)=>(await request.post(BASE+'api.php?action='+action,{headers,data}));
  await admin.click('#create-btn'); await admin.fill('#new-title','Informations fictives'); await admin.check('#create-mentimeter'); await admin.click('#create-ok');
  await admin.setInputFiles('#menti-file',path.join(__dirname,'fixtures/questionnaire.pdf'));
  await admin.waitForFunction(()=>!document.querySelector('#menti-fields').disabled&&document.querySelector('#menti-status').textContent.includes('Page 1 sur'),null,{timeout:120000});
  await admin.selectOption('#menti-type','skip'); await admin.selectOption('#menti-page','2');
  await admin.waitForFunction(()=>!document.querySelector('#menti-fields').disabled&&document.querySelector('#menti-status').textContent.includes('Page 3 sur'),null,{timeout:120000});
  check(await admin.inputValue('#menti-type')==='info','le PDF propose une information, distincte d’un vote');
  const png=await admin.evaluate(()=>{const c=document.createElement('canvas');c.width=640;c.height=480;const x=c.getContext('2d');x.fillStyle='#F7F0E4';x.fillRect(0,0,640,480);x.fillStyle='#B74322';x.fillRect(120,90,400,300);return c.toDataURL('image/png').split(',')[1];});
  await admin.setInputFiles('#menti-image',{name:'illustration.png',mimeType:'image/png',buffer:Buffer.from(png,'base64')});
  await admin.waitForSelector('#menti-image-preview:not([hidden])');
  check(!await admin.isChecked('#menti-reviewed'),'ajouter une illustration exige une nouvelle relecture');
  let illustration=await admin.getAttribute('#menti-image-preview','src');
  check(illustration.startsWith('data:image/jpeg;base64,')&&Buffer.from(illustration.split(',')[1],'base64').length<=30000,'image réencodée en JPEG borné');
  await admin.setInputFiles('#menti-image',{name:'actif.svg',mimeType:'image/svg+xml',buffer:Buffer.from('<svg onload="alert(1)"></svg>')});
  await admin.waitForFunction(()=>document.querySelector('#menti-error').textContent.length>0);
  check(await admin.getAttribute('#menti-image-preview','src')===illustration,'SVG refusé sans remplacer l’illustration');
  await admin.fill('#menti-text','Conseils à retenir'); await admin.fill('#menti-content','Faire une pause.\n\nChoisir une activité sans écran.'); await admin.check('#menti-reviewed');
  admin.once('dialog',d=>d.accept()); await admin.click('#menti-continue');
  await admin.waitForSelector('#gen-preview:not([hidden])'); await admin.click('#gen-save'); await admin.waitForSelector('#editor:not([hidden])');
  const code=(await admin.textContent('#ed-code')).trim();
  const state=async()=>(await(await request.get(BASE+'api.php?action=admin_state&s='+code,{headers})).json());
  let data=await state(), q=data.questions[0];
  check(data.questions.length===1&&q.type==='info'&&q.content.includes('\n\n')&&q.illustration.startsWith('data:image/jpeg;base64,'),
   'création PDF : contenu, paragraphes et illustration conservés : '+JSON.stringify({count:data.questions.length,type:q.type,content:q.content,image:!!q.illustration}));
  illustration=q.illustration; // métadonnées retirées par le serveur, pixels JPEG conservés
  check(q.results.total===0&&!q.correct.length&&q.duration===0,'pas de réponse, correction ou minuterie sur une information');
  const meta=(await(await request.get(BASE+'api.php?action=sessions')).json()).sessions.find(s=>s.code===code);
  check(meta.hasInfo&&meta.questions===1&&meta.votingQuestions===0,'une information est une étape, pas une question dans la progression des réponses');
  const legacy=await request.get(BASE+'api.php?action=admin_state&s='+code);
  check(legacy.status()===409&&(await legacy.json()).error.includes('Actualisez'),'ancien animateur invité à recharger');
  const oldWrite=await request.post(BASE+'api.php?action=question_save',{headers:{'X-WL':'1','X-CSRF-Token':csrf},data:{s:code,question:{type:'info',text:'Ancien client',content:'Un contenu'}}});
  check(oldWrite.status()===409,'ancien client refusé pour le nouveau format');
  await admin.click('#import-pdf-btn');await admin.setInputFiles('#menti-file',path.join(__dirname,'fixtures/questionnaire.pdf'));
  await admin.waitForFunction(()=>!document.querySelector('#menti-fields').disabled&&document.querySelector('#menti-status').textContent.includes('Page 1 sur'),null,{timeout:120000});
  await admin.selectOption('#menti-type','yesno');
  check(await admin.locator('#menti-question option:checked').textContent()==='Étape 2 — À relire','ajout PDF : la numérotation commence après les étapes déjà présentes dans l’atelier');
  await admin.check('#menti-reviewed');admin.once('dialog',d=>d.accept());await admin.click('#menti-continue');
  await admin.waitForSelector('#gen-preview:not([hidden])');await admin.click('#gen-save');await admin.waitForSelector('#gen-dialog:not([open])',{state:'attached'});
  check((await state()).questions.length===2,'ajout depuis un PDF dans l’atelier existant');
  await admin.click('#t-live'); await post('control',{s:code,op:'next'});
  await admin.waitForSelector('#live-results .information-slide');
  check(await admin.isHidden('#show-btn')&&await admin.isHidden('#reopen-btn'),'Animer : aucune commande de vote ou de résultats pour la diapositive');
  const projection=await admin.context().newPage();projection.on('pageerror',e=>errors.push(e.message));
  await projection.goto(BASE+'screen.php?s='+code); await projection.waitForSelector('.information-slide');
  check((await projection.textContent('#s-results')).includes('Faire une pause.')&&await projection.isHidden('#p-hide'),'projection : contenu visible, aucun résultat à afficher');
  await projection.waitForFunction(()=>{const im=document.querySelector('#s-results .info-illustration');return im&&im.complete&&im.naturalWidth===640&&im.naturalHeight===480;});
  check(true,'JPEG sans métadonnées effectivement décodé sur la projection');
  const phone=await(await browser.newContext({viewport:{width:390,height:844}})).newPage();phone.on('pageerror',e=>errors.push(e.message));
  await phone.goto(BASE); await phone.fill('#code',code); const joinedResponse=phone.waitForResponse(r=>r.url().includes('action=join')&&r.request().method()==='POST');
  await phone.click('#join-form button'); const joined=await(await joinedResponse).json(); await phone.waitForSelector('#answer-form .information-slide');
  check(await phone.locator('#answer-form input,#answer-form button').count()===0&&await phone.isHidden('#my-result'),'participant : lecture sans champ de réponse ni ancien résultat');
  const refused=await phone.request.post(BASE+'api.php?action=vote',{headers:{'X-WL':'1','X-CSRF-Token':joined.csrf,'X-WL-Token':joined.token},data:{s:code,qid:q.id,value:0}});
  check(refused.status()===409&&(await refused.json()).error.includes('diapositive')&&(await state()).questions[0].results.total===0,'un vote forcé sur l’information est refusé au bon endroit');
  const oldPublic=await(await phone.request.get(BASE+'api.php?action=state&s='+code)).json();
  check(oldPublic.question.type==='text'&&oldPublic.question.state==='closed'&&oldPublic.question.text.includes('Actualisez'),'ancien participant : invitation à recharger sans type inconnu');
  for(const size of [{width:1280,height:720},{width:390,height:844}]){
   await projection.setViewportSize(size); await projection.bringToFront(); await projection.waitForTimeout(100);
   check(await projection.evaluate(()=>{const r=document.querySelector('#s-results').getBoundingClientRect();return document.documentElement.scrollWidth<=innerWidth+1&&r.bottom<=innerHeight+1;}),'information projetée sans débordement à '+size.width+' px');
  }
  await post('control',{s:code,op:'next'}); await projection.waitForFunction(()=>!document.querySelector('.information-slide'));
  await phone.bringToFront(); await phone.waitForSelector('#answer-form .btn-choice');
  await post('control',{s:code,op:'prev'}); await projection.bringToFront(); await projection.waitForSelector('.information-slide');
  check((await projection.textContent('#s-results')).includes('Faire une pause.'),'retour depuis une question : contenu d’information réaffiché');
  await admin.bringToFront();await admin.click('#t-prep');await admin.locator('#q-list .list-item').first().getByRole('button',{name:'Modifier',exact:true}).click();
  check(await admin.isVisible('#qf-content')&&await admin.isHidden('#qf-reveal'),'édition : champs de contenu et d’illustration, aucune correction de vote');
  await admin.fill('#qf-content','Une information corrigée.');await admin.click('#qf-save'); await admin.waitForSelector('#q-dialog:not([open])',{state:'attached'});
  q=(await state()).questions[0];check(q.content==='Une information corrigée.'&&q.illustration===illustration,'modifier le texte conserve l’illustration');
  const attack=await post('question_save',{s:code,question:{...q,illustration:'data:image/svg+xml;base64,PHN2Zy8+'}});
  check(attack.status()===400&&(await state()).questions[0].illustration===illustration,'validation serveur : autre format refusé, atelier intact');
  const exported=await(await request.get(BASE+'api.php?action=export&format=questions&s='+code)).json();
  check(exported[0].content===q.content&&exported[0].illustration===illustration,'export JSON : texte et illustration portables');
  const print=await(await request.get(BASE+'api.php?action=export&format=print&s='+code)).text();
  check(print.includes(q.content)&&print.includes(illustration),'version imprimable : contenu et image inclus');
  const memo=await(await request.get(BASE+'api.php?action=export&format=memo&s='+code)).text();check(memo.includes(q.content),'fiche mémo : information conservée');
  await admin.click('#t-bilan');const dl=admin.waitForEvent('download');await admin.click('#bilan-pptx');
  const download=await dl, output=path.join(os.tmpdir(),'wooclight-information-'+code+'.pptx');await download.saveAs(output);
  const zip=zipEntries(fs.readFileSync(output));fs.unlinkSync(output);
  check(Object.keys(zip).some(k=>k.startsWith('ppt/media/')&&zip[k][0]===0xff&&zip[k][1]===0xd8),'PowerPoint : illustration JPEG intégrée');
  check(zip['ppt/slides/slide2.xml'].toString().includes(q.content)&&zip['ppt/slides/slide2.xml'].toString().includes('aucune réponse demandée'),'PowerPoint : texte de l’information sans faux compteur de réponses');
  const rawNoise=await admin.evaluate(async()=>{
   const c=document.createElement('canvas');c.width=640;c.height=480;const x=c.getContext('2d'),d=x.createImageData(640,480);let seed=17;
   for(let i=0;i<d.data.length;i+=4){for(let k=0;k<3;k++){seed=(seed*1664525+1013904223)>>>0;d.data[i+k]=seed>>>24;}d.data[i+3]=255;}x.putImageData(d,0,0);
   const blob=await new Promise(r=>c.toBlob(r,'image/png'));return await WL.Mentimeter.prepareImage(new File([blob],'bruit.png',{type:'image/png'}));
  });
  const sample={type:'info',text:'Illustration de charge',content:'Contenu fictif.',illustration:rawNoise};
  const preview=await(await post('questions_import',{raw:JSON.stringify([sample]),preview:true})).json();
  const normalized=preview.items[0].illustration,bytes=Buffer.from(normalized.split(',')[1],'base64').length;
  const remaining=200000-Buffer.from(illustration.split(',')[1],'base64').length,count=Math.floor(remaining/bytes)+1;
  const overload=Array.from({length:count},()=>({...sample,illustration:normalized}));
  const over=await post('questions_import',{s:code,raw:JSON.stringify(overload),keep:overload.map((_,i)=>i)});
  check(over.status()===400&&(await over.json()).error.includes('200')&&(await state()).questions.length===2,'quota global d’illustrations : refus atomique sans perte de l’atelier');
  overload.pop();const good=await post('questions_import',{s:code,raw:JSON.stringify(overload),keep:overload.map((_,i)=>i)});
  check(good.ok(),'atelier avec illustrations proche du budget maximal accepté');
  const condition={'X-WL-Features':'info-v1','X-WL-Token':joined.token},stateUrl=BASE+'api.php?action=state&s='+code;
  const initial=await phone.request.get(stateUrl,{headers:condition});condition['If-None-Match']=initial.headers().etag;
  const start=Date.now(),polls=await Promise.all(Array.from({length:30},()=>phone.request.get(stateUrl,{headers:condition})));
  const bodyLengths=await Promise.all(polls.map(r=>r.body().then(b=>b.length)));
  check(polls.every(r=>r.status()===304)&&bodyLengths.every(x=>x===0),'illustrations présentes : 30 rafraîchissements sans corps quand rien ne change');
  console.log('Coût illustrations : '+(overload.length*bytes+200000-remaining)+' octets JPEG dans l’atelier, 30 × 304 en '+(Date.now()-start)+' ms (local).');
  const archived=await(await post('session_archive',{s:code})).json();
  const archives=(await(await request.get(BASE+'api.php?action=archives')).json()).archives;
  const ar=archives.find(a=>a.id===archived.id);
  check(!!ar,'atelier archivé');
  const arc=(await(await request.get(BASE+'api.php?action=archive&id='+ar.id,{headers})).json());
  check(JSON.stringify(arc).includes(q.content)&&JSON.stringify(arc).includes(illustration),'archive : information et illustration conservées');
  await post('archive_delete',{id:ar.id});
  check(errors.length===0,'aucune erreur JavaScript : '+errors.join('; '));
  console.log('✅ Informations et illustrations : '+n+' contrôles');
 }finally{await browser.close();}
})().catch(e=>{console.error('ÉCHEC information : '+e.stack);process.exitCode=1;});
