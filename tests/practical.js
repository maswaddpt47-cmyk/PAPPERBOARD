'use strict';
const fs=require('fs'),vm=require('vm');
const sandbox={WL:{}};
vm.runInNewContext(fs.readFileSync(require('path').join(__dirname,'../assets/practical.js'),'utf8'),sandbox);
const practical=sandbox.WL.Practical;
let ok=0,ko=0;
function check(value,name){if(value)ok++;else{ko++;console.error('ÉCHEC pratique : '+name);}}
const options={count:8,duration:45,byDuration:false,feedback:false,limit:50,existing:0,per:4};
let plan=practical.plan(options);
check(plan.count===8&&plan.steps===16,'8 exercices, 16 étapes : la méthode ne divise pas le nombre par deux');
plan=practical.plan({...options,feedback:true});
check(plan.count===8&&plan.steps===24,'les retours libres ajoutent 8 étapes sans enlever de tâches');
plan=practical.plan({...options,byDuration:true});
check(plan.count===8&&plan.margin===3,'45 minutes débutant : 8 exercices et 3 minutes de marge');
check(practical.plan({...options,byDuration:true,feedback:true}).count===8,'en durée aussi, les retours restent dans le budget d’échange');
check(practical.plan({...options,byDuration:true,per:5}).count===7&&practical.plan({...options,byDuration:true,duration:90}).count===20,'niveau et durée changent le nombre, sans valeur 8 figée');
plan=practical.plan({...options,byDuration:true,duration:180});
check(plan.count===24&&plan.steps===48&&plan.capped,'plafond brut respecté avec méthodes et conclusion');
check(practical.plan({...options,count:25}).error&&practical.plan({...options,count:17,feedback:true}).error&&practical.plan({...options,count:1.5}).error,'limites refusées sans arrondir ni réduire silencieusement');
check(practical.plan({...options,existing:30,count:9}).count===9&&practical.plan({...options,existing:48,count:1}).error,'capacité restante de l’atelier prise en compte');
const raw=Array.from({length:8},(_,i)=>[{type:'yesno',text:'Geste fictif '+(i+1)+' : avez-vous réussi ?'},{type:'info',text:'Méthode fictive '+(i+1),content:'Un geste de démonstration, sans donnée personnelle.'}]).flat();
const preview=[...raw,{conclusion:'À retenir : un geste à la fois.'}];
const counts=practical.counts(preview);
check(counts.exercises===8&&counts.methods===8&&counts.conclusions===1,'recomptage des vrais types, conclusion distincte');
check(practical.counts([{type:'yesno',correct:[0]},{type:'poll'},...preview]).invalid===2,'quiz noté et autres types distingués des autoévaluations');
if(process.argv.includes('--plan-only')){console.log('Plan pratique : '+ok+' OK, '+ko+' échec(s)');process.exit(ko?1:0);}
(async()=>{
 const {chromium}=require('playwright');const browser=await chromium.launch(process.env.WL_CHROMIUM?{executablePath:process.env.WL_CHROMIUM}:{});
 try{
  const context=await browser.newContext({viewport:{width:1280,height:720}}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));const base=process.env.WL_BASE;
  await page.goto(base+'admin.php');await page.fill('#password',process.env.WL_PASSWORD);await page.click('#login-form button');
  await page.click('#create-btn');await page.fill('#new-title','Pratique fictif');await page.check('#create-json');await page.click('#create-ok');await page.waitForSelector('#gen-dialog[open]');
  check(await page.inputValue('#gen-format')==='varied','ancien mode conservé par défaut');
  await page.selectOption('#gen-format','practical');await page.fill('#gen-count','8');
  check(await page.isVisible('#gen-practical')&&!await page.isVisible('#gen-qcm-box')&&!await page.isChecked('#gen-feedback'),'mode dédié visible, quiz masqué, retour libre facultatif');
  await page.selectOption('#gen-public','seniors');await page.selectOption('#gen-level','beginner');await page.selectOption('#gen-devices','iPhone');
  await page.fill('#gen-special','Prévoir des pauses.');await page.click('#gen-copy');let prompt=await page.inputValue('#gen-prompt');
  check(prompt.includes('8 exercices, soit 16 étapes')&&prompt.includes('iPhone')&&prompt.includes('Public : seniors')&&prompt.includes('Prévoir des pauses.')&&prompt.includes('Aucun retour libre'),'prompt rempli avec les paramètres réels, 8 tâches et aucun retour imposé');
  await page.check('#gen-mode-duration');await page.fill('#gen-duration','90');
  check((await page.textContent('#gen-estimate')).includes('20 exercices'),'90 minutes : 20 exercices estimés');
  await page.fill('#gen-duration','45');await page.check('#gen-feedback');await page.click('#gen-copy');prompt=await page.inputValue('#gen-prompt');
  check(prompt.includes('8 exercices, soit 24 étapes')&&prompt.includes('Durée totale : 45 minutes'),'45 minutes et retours : même nombre d’exercices, étapes supplémentaires');
  await page.uncheck('#gen-feedback');await page.check('#gen-mode-count');await page.fill('#gen-count','8');
  for(const width of [390,1280]){await page.setViewportSize({width,height:720});await page.locator('#gen-format').scrollIntoViewIfNeeded();check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth&&document.querySelector('#gen-practical').getBoundingClientRect().right<=document.querySelector('#gen-dialog').getBoundingClientRect().right+1),'rendu sans débordement à '+width+' px');}
  const upload=async(items)=>{const response=page.waitForResponse(r=>r.url().includes('action=questions_import')&&r.request().method()==='POST');await page.setInputFiles('#gen-file',{name:'pratique-fictif.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(items))});await response;await page.waitForFunction(n=>document.querySelectorAll('#gen-list > li').length===n,items.length);};
  await upload([...raw.slice(0,8),{type:'conclusion',text:'Conclusion fictive.'}]);
  check((await page.textContent('#gen-practical-summary')).includes('8 exercices demandés · 4 exercices reçus')&&(await page.textContent('#gen-save')).includes('4 exercices'),'vrai fichier incomplet : 4 tâches visibles, jamais annoncées comme 8');
  const feedback=raw.flatMap(q=>q.type==='info'?[q,{type:'text',text:'Si vous n’avez pas réussi, qu’est-ce qui vous a bloqué ?'}]:[q]);
  await upload([...feedback,{type:'conclusion',text:'Un geste à la fois.'}]);
  check(await page.locator('#gen-list input:checked').count()===17&&(await page.textContent('#gen-practical-summary')).includes('8 exercices, 8 méthodes, 0 retours libres'),'8 exercices complets conservés, retours non demandés décochés');
  await page.check('#gen-feedback');check(await page.locator('#gen-list input:checked').count()===25&&(await page.textContent('#gen-save')).includes('8 exercices'),'activer les retours ajoute des étapes sans changer les exercices');await page.uncheck('#gen-feedback');
  await page.click('#gen-review');prompt=await page.inputValue('#gen-prompt');check(prompt.includes('8 exercices')&&prompt.includes('Aucun retour libre')&&prompt.includes('iPhone'),'relecture conserve la même unité, les appareils et le choix des retours');
  await upload([{type:'yesno',text:'Quiz fictif ?',correct:'Oui'},{type:'info',text:'Méthode',content:'Fictif.'}]);
  check(await page.isDisabled('#gen-save')&&(await page.textContent('#gen-practical-summary')).includes('correction'),'une autoévaluation notée est signalée et bloque la création');
  await upload([...raw,{type:'conclusion',text:'Un geste à la fois.'}]);await page.click('#gen-save');await page.waitForSelector('#editor:not([hidden])');
  const code=(await page.textContent('#ed-code')).trim(),state=await(await context.request.get(base+'api.php?action=admin_state&s='+code,{headers:{'X-WL-Features':'info-v1, rich-v1'}})).json();
  check(state.questions.filter(q=>q.type==='yesno').length===8&&state.questions.filter(q=>q.type==='info').length===8&&state.questions.every(q=>q.type!=='text')&&state.conclusion==='Un geste à la fois.','parcours complet : 8 tâches sauvegardées, 8 méthodes et conclusion, sans réponse libre');
  check(errors.length===0,'aucune erreur JavaScript : '+errors.join('; '));
 }finally{await browser.close();}
 console.log('Atelier pratique : '+ok+' contrôles OK, '+ko+' échec(s)');process.exit(ko?1:0);
})().catch(e=>{console.error(e);process.exit(1);});
