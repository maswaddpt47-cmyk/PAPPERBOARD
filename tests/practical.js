'use strict';
const fs=require('fs'),vm=require('vm');
const sandbox={WL:{}};
vm.runInNewContext(fs.readFileSync(process.env.WL_PRACTICAL || require('path').join(__dirname,'../assets/practical.js'),'utf8'),sandbox);
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
const blockItems=[raw[0],raw[1],{type:'text',text:'Difficulté fictive ?'},raw[2],raw[3],{conclusion:'Conclusion fictive.'}];
const blocks=practical.blocks(blockItems);
check(blocks.length===3&&blocks[0].indices.join(',')==='0,1'&&blocks[0].feedback===2&&blocks[1].indices.join(',')==='3,4'
  &&blocks[2].kind==='conclusion'&&practical.selection(blocks,[0,2,3,5]).keep.join(',')==='0,1,2,3,4,5'
  &&practical.selection(blocks,[2,3,5]).keep.join(',')==='3,4,5'&&practical.selection(blocks,[0,3,5]).keep.join(',')==='0,1,3,4,5',
  'blocs complets : ordre et indices source conservés, retour facultatif exclu avec sa tâche');
const malformed=practical.blocks([raw[0],{error:'Élément fictif refusé'},raw[1],{type:'text'},
  {type:'yesno',correct:[0]},raw[1],raw[2],raw[3],{conclusion:'Fictif.'}]);
check(malformed[0].error&&malformed[1].kind==='error'&&malformed[2].error&&malformed[3].error&&malformed[4].error&&malformed[5].error
  &&practical.selection(malformed,[0,2,3,4,5,6,8]).invalid===5&&practical.selection(malformed,[6,8]).invalid===0
  &&practical.selection(malformed,[6,8]).keep.join(',')==='6,7,8',
  'bloc incomplet, méthode/retour isolés et quiz refusés si sélectionnés, sans franchir une erreur ni bloquer les blocs sains');
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
  const upload=async(items,rows)=>{const response=page.waitForResponse(r=>r.url().includes('action=questions_import')&&r.request().method()==='POST');await page.setInputFiles('#gen-file',{name:'pratique-fictif.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(items))});await response;await page.waitForFunction(n=>document.querySelectorAll('#gen-list > li').length===n,rows);};
  await upload([...raw.slice(0,8),{type:'conclusion',text:'Conclusion fictive.'}],5);
  check((await page.textContent('#gen-practical-summary')).includes('8 exercices demandés · 4 exercices reçus')&&(await page.textContent('#gen-save')).includes('4 exercices'),'vrai fichier incomplet : 4 tâches visibles, jamais annoncées comme 8');
  const feedback=raw.flatMap(q=>q.type==='info'?[q,{type:'text',text:'Si vous n’avez pas réussi, qu’est-ce qui vous a bloqué ?'}]:[q]);
  await upload([...feedback,{type:'conclusion',text:'Un geste à la fois.'}],9);
  for(const width of [390,1280]){await page.setViewportSize({width,height:720});await page.locator('#gen-list').scrollIntoViewIfNeeded();check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth&&document.querySelector('#gen-practical').getBoundingClientRect().right<=document.querySelector('#gen-dialog').getBoundingClientRect().right+1&&Array.from(document.querySelectorAll('#gen-list > li')).every(node=>node.getBoundingClientRect().right<=document.querySelector('#gen-dialog').getBoundingClientRect().right+1)),'aperçu groupé sans débordement à '+width+' px');}
  check(await page.locator('#gen-list input:checked').count()===9&&(await page.textContent('#gen-practical-summary')).includes('8 exercices, 8 méthodes, 0 retours libres'),'8 cases pour 8 exercices complets, retours non demandés décochés');
  await page.check('#gen-feedback');check(await page.locator('#gen-list input:checked').count()===17&&(await page.textContent('#gen-save')).includes('8 exercices'),'activer les retours ajoute des étapes sans changer les exercices');await page.uncheck('#gen-feedback');
  const firstExercise=page.locator('#gen-exercise-0'),firstFeedback=page.locator('[data-practical-feedback="0"]');
  await firstFeedback.check();await firstExercise.uncheck();
  check(await firstFeedback.isChecked()&&await firstFeedback.isDisabled()&&(await page.textContent('#gen-practical-summary')).includes('7 exercices, 7 méthodes, 0 retours libres'),'retirer un exercice retire sa méthode et son retour sans perdre le choix du retour');
  await firstExercise.check();check(await firstFeedback.isChecked()&&await firstFeedback.isEnabled()&&(await page.textContent('#gen-practical-summary')).includes('8 exercices, 8 méthodes, 1 retours libres'),'remettre un exercice restaure son retour facultatif');await firstFeedback.uncheck();
  await page.selectOption('#gen-format','varied');check(await page.locator('#gen-list > li').count()===25&&await page.locator('#gen-list input:checked').count()===17,'mode varié : sélection individuelle et indices conservés');
  await page.selectOption('#gen-format','practical');
  await page.click('#gen-review');prompt=await page.inputValue('#gen-prompt');check(prompt.includes('8 exercices')&&prompt.includes('Aucun retour libre')&&prompt.includes('iPhone'),'relecture conserve la même unité, les appareils et le choix des retours');
  await upload([{type:'yesno',text:'Quiz fictif ?',correct:'Oui'},{type:'info',text:'Méthode',content:'Fictif.'}],2);
  check(await page.isDisabled('#gen-save')&&(await page.textContent('#gen-practical-summary')).includes('correction'),'une autoévaluation notée est signalée et bloque la création');
  await upload([raw[0],{type:'text',text:'Retour fictif isolé'},raw[1],raw[2],raw[3],{type:'conclusion',text:'Fictif.'}],5);
  check(await page.isDisabled('#gen-save')&&(await page.textContent('#gen-list')).includes('Exercice incomplet')&&(await page.textContent('#gen-list')).includes('Méthode isolée'),'ordre incohérent signalé et bloqué malgré des nombres de tâches/méthodes égaux');
  await page.locator('#gen-list input[value="0"]').uncheck();await page.locator('#gen-list input[value="2"]').uncheck();
  check(await page.isEnabled('#gen-save')&&(await page.textContent('#gen-practical-summary')).includes('1 exercices, 1 méthodes'),'écarter les éléments incomplets permet de garder le seul exercice complet');
  await page.fill('#gen-count','4');
  await upload([...raw.slice(0,4),raw[4],...raw.slice(6,8),{type:'conclusion',text:'Conclusion fictive.'}],5);
  let incompleteSummary=await page.textContent('#gen-practical-summary');
  check(incompleteSummary.includes('4 exercices demandés · 3 exercices reçus, 1 incomplet')&&incompleteSummary.includes('Le nombre fourni par l’IA ne correspond pas')&&await page.isDisabled('#gen-save'),'une tâche sans méthode est distincte des trois exercices reçus et signale le manque pour quatre demandés');
  await page.locator('#gen-list input[value="4"]').uncheck();
  incompleteSummary=await page.textContent('#gen-practical-summary');
  check(incompleteSummary.includes('3 exercices reçus, 1 incomplet')&&incompleteSummary.includes('Sélection : 3 exercices, 3 méthodes')&&incompleteSummary.includes('Le nombre fourni par l’IA ne correspond pas')&&await page.isEnabled('#gen-save'),'écarter la tâche incomplète autorise les trois paires sans masquer l’écart à la demande');
  await page.fill('#gen-count','8');
  await upload([...raw,{type:'conclusion',text:'Un geste à la fois.'}],9);await page.locator('#gen-exercise-0').uncheck();await page.click('#gen-save');await page.waitForSelector('#editor:not([hidden])');
  const code=(await page.textContent('#ed-code')).trim(),state=await(await context.request.get(base+'api.php?action=admin_state&s='+code,{headers:{'X-WL-Features':'info-v1, rich-v1'}})).json();
  check(state.questions.filter(q=>q.type==='yesno').length===7&&state.questions.filter(q=>q.type==='info').length===7&&state.questions[0].text===raw[2].text&&state.questions[1].text===raw[3].text&&state.questions.every(q=>q.type!=='text')&&state.conclusion==='Un geste à la fois.','vraie sauvegarde : exercice retiré avec sa méthode, 7 paires dans l’ordre source et conclusion indépendante');
  check(errors.length===0,'aucune erreur JavaScript : '+errors.join('; '));
 }finally{await browser.close();}
 console.log('Atelier pratique : '+ok+' contrôles OK, '+ko+' échec(s)');process.exit(ko?1:0);
})().catch(e=>{console.error(e);process.exit(1);});
