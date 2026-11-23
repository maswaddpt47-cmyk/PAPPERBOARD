'use strict';
// Vraies interfaces et réponses complètes retenues : aucune donnée métier injectée.
module.exports = async function (ctx) {
  const {base,login,workshop,participant,check,assert,delay,deferred}=ctx;
  const action=url=>new URL(String(url)).searchParams.get('action');
  const stateShape=s=>JSON.stringify({current:s.current,show:s.show,board:s.board,questions:s.questions.map(q=>({id:q.id,state:q.state,show:q.showResults,total:q.results.total}))});
  const raw=async(admin,body)=>{const r=await admin.context.request.post(base+'api.php?action=control',{headers:admin.headers,data:body});return{status:r.status(),body:await r.json()};};
  const state=(admin,code)=>admin.read('admin_state','s='+code);
  const questions=name=>['A','B','C'].map(letter=>({type:'poll',text:letter+' fictive '+name,options:['Choix fictif 1','Choix fictif 2'],duration:0}));
  const getIds=made=>made.questions.map(q=>q.id);
  const api=await login();
  try {
    const made=await workshop(api,'Contrat commandes fictif',questions('contrat')),code=made.code,[a,b]=getIds(made);
    for(const op of ['open','close','show','hide','reset','next','prev']){
      await raw(api,{s:code,op:'goto',qid:a});await raw(api,{s:code,op:'show_asks'});
      const before=await state(api,code),missing=await raw(api,{s:code,op});
      check(missing.status===409&&/recharg/i.test(missing.body.error||'')&&stateShape(await state(api,code))===stateShape(before),'commande '+op+' sans expect : 409 explicite et aucune mutation');
      await raw(api,{s:code,op:'goto',qid:a});await raw(api,{s:code,op:'show_asks'});
      const fresh=await state(api,code),stale=await raw(api,{s:code,op,expect:b});
      check(stale.status===409&&/chang|actualis/i.test(stale.body.error||'')&&stateShape(await state(api,code))===stateShape(fresh),'commande '+op+' obsolète : précondition sous verrou avant toute mutation');
    }
    await raw(api,{s:code,op:'welcome'});
    const next=await raw(api,{s:code,op:'next',expect:'welcome'}),atA=await state(api,code);
    const prev=await raw(api,{s:code,op:'prev',expect:a}),atWelcome=await state(api,code);
    const wrong=await raw(api,{s:code,op:'next',expect:a});
    check(next.status===200&&atA.current===0&&prev.status===200&&atWelcome.current===-1&&wrong.status===409&&(await state(api,code)).current===-1,'accueil : expect welcome accepté, identifiant périmé refusé, retour précédent protégé');
    const absolute=await raw(api,{s:code,op:'goto',qid:b}),global=await raw(api,{s:code,op:'qr_hide'}),atB=await state(api,code);
    const welcome=await raw(api,{s:code,op:'welcome'}),end=await raw(api,{s:code,op:'end'}),ended=await state(api,code),reopen=await raw(api,{s:code,op:'reopen'}),reopened=await state(api,code);
    check(absolute.status===200&&global.status===200&&atB.current===1&&welcome.status===200&&end.status===200&&ended.ended&&reopen.status===200&&!reopened.ended&&reopened.current===-1,'goto, accueil, fin, réouverture et globales conservent leur contrat sans expect');
  } finally {await api.context.close();}

  for(const view of ['admin','projection']){
    const first=await login(),second=await login(),contexts=[first.context,second.context];
    const page=second.page,routeGates=[];
    try {
      first.page.on('dialog',d=>d.accept());page.on('dialog',d=>d.accept());
      const made=await workshop(first,'Deux commandes fictives '+view,questions(view)),code=made.code,[a,b]=getIds(made);
      await first.page.goto(base+'admin.php?s='+code);await first.page.locator('#editor:not([hidden])').waitFor();await first.page.locator('#t-live').click();
      await first.page.locator('#rail-list button').nth(0).click();
      await first.page.waitForFunction(text=>document.querySelector('#live-text').textContent===text,made.questions[0].text);
      const voter=await participant(code);contexts.push(voter.context);
      const voted=voter.page.waitForResponse(r=>action(r.url())==='vote'&&r.request().method()==='POST');
      await voter.page.locator('#answer-form .btn-choice').first().click();assert.equal((await voted).status(),200);
      await page.goto(base+(view==='admin'?'admin.php':'screen.php')+'?s='+code);
      if(view==='admin'){await page.locator('#editor:not([hidden])').waitFor();await page.locator('#t-live').click();}
      else await page.locator('#s-pilot:not([hidden])').waitFor();
      const textSelector=view==='admin'?'#live-text':'#s-text',closeSelector=view==='admin'?'#open-btn':'#p-step',errorSelector=view==='admin'?'#banner':'#screen-error';
      const rendered=async index=>page.waitForFunction(({selector,text})=>document.querySelector(selector).textContent===text,{selector:textSelector,text:made.questions[index].text});
      const waitClose=async()=>page.waitForFunction(selector=>document.querySelector(selector).textContent==='Clore les réponses',closeSelector);
      const command=async(op,click)=>{const pending=page.waitForResponse(r=>action(r.url())==='control'&&r.request().postDataJSON()?.op===op);await click();const r=await pending;return{status:r.status(),body:r.request().postDataJSON()};};
      const freeze=async()=>{
        const gate=deferred(),held=deferred(),matches=url=>action(url)===(view==='admin'?'admin_state':'screen');routeGates.push(gate);
        await page.route(matches,async route=>{held.resolve();await gate.promise;await route.continue().catch(()=>{});});
        await Promise.race([held.promise,delay(7000).then(()=>{throw Error('Poll réel absent : '+view);})]);
        return async()=>{gate.resolve();await page.unroute(matches);};
      };
      await rendered(0);await waitClose();
      const fresh=await command('close',()=>page.locator(closeSelector).click()),freshState=await state(first,code);
      check(fresh.status===200&&fresh.body.expect===a&&freshState.questions[0].state==='closed'&&freshState.questions[1].state==='draft',view+' frais : fermeture de la question affichée avec son expect');
      const reopenSelector=view==='admin'?'#reopen-btn':'#p-reopen';
      await raw(first,{s:code,op:'show',expect:a});await page.locator(reopenSelector).waitFor({state:'visible'});
      await page.waitForFunction(selector=>document.querySelector(selector).textContent.startsWith('Masquer'),view==='admin'?'#show-btn':'#p-hide');
      const hiddenFresh=page.waitForResponse(r=>action(r.url())==='control'&&r.request().postDataJSON()?.op==='hide'),openedFresh=page.waitForResponse(r=>action(r.url())==='control'&&r.request().postDataJSON()?.op==='open');
      await page.locator(reopenSelector).click();const hiddenOk=await hiddenFresh,openedOk=await openedFresh;
      check(hiddenOk.status()===200&&openedOk.status()===200&&hiddenOk.request().postDataJSON().expect===a&&openedOk.request().postDataJSON().expect===a&&(await state(first,code)).questions[0].state==='open',view+' rouvrir frais : hide/open 200/200 avec la même question attendue');
      for(const op of ['close','next','prev']){
        await raw(first,{s:code,op:'goto',qid:a});await raw(first,{s:code,op:'open',expect:a});
        await rendered(0);await waitClose();
        await first.page.waitForFunction(text=>document.querySelector('#live-text').textContent===text,made.questions[0].text);
        const release=await freeze();
        try {
          const moved=first.page.waitForResponse(r=>action(r.url())==='control'&&r.request().postDataJSON()?.op==='next');
          await first.page.locator('#live [data-op="next"]').click();await moved;
          await first.page.waitForFunction(text=>document.querySelector('#live-text').textContent===text,made.questions[1].text);
          const before=await state(first,code);
          const result=await command(op,()=>op==='close'?page.locator(closeSelector).click():view==='projection'&&op==='prev'?page.keyboard.press('ArrowLeft'):page.locator(view==='admin'?'#live [data-op="'+op+'"]':op==='next'?'#p-next':'#p-prev').click());
          const after=await state(first,code);
          check(result.status===409&&result.body.expect===a&&stateShape(after)===stateShape(before),view+' '+op+' obsolète : 409, question courante et réponses inchangées');
          await release();await rendered(after.current);await delay(100);
          check(/chang|actualis|recharg/i.test(await page.locator(errorSelector).textContent()),view+' '+op+' : actualisation après 409, message conservé, commande non rejouée');
        }finally{await release();}
      }
      // Première étape refusée : ne jamais poursuivre hide → open après le 409.
      await raw(first,{s:code,op:'goto',qid:a});await raw(first,{s:code,op:'close',expect:a});await raw(first,{s:code,op:'show',expect:a});
      await rendered(0);const reopen=view==='admin'?'#reopen-btn':'#p-reopen';await page.locator(reopen).waitFor({state:'visible'});
      await first.page.waitForFunction(text=>document.querySelector('#live-text').textContent===text,made.questions[0].text);
      let opens=0;const countOpen=request=>{if(action(request.url())==='control'&&request.postDataJSON()?.op==='open')opens++;};page.on('request',countOpen);
      const release=await freeze();
      try {
        const advanced=first.page.waitForResponse(r=>action(r.url())==='control'&&r.request().postDataJSON()?.op==='next');await first.page.locator('#live [data-op="next"]').click();await advanced;
        const refused=await command('hide',()=>page.locator(reopen).click());
        await release();await rendered(1);await delay(150);
        check(refused.status===409&&refused.body.expect===a&&opens===0,view+' rouvrir : hide refusé interrompt la séquence, aucun open envoyé');
      }finally{await release();page.off('request',countOpen);}

      // Un vrai 200 hide est retenu pendant que le second écran reçoit B.
      // La seconde commande doit garder A comme précondition et échouer sur B.
      await raw(first,{s:code,op:'goto',qid:b});await raw(first,{s:code,op:'close',expect:b});
      await raw(first,{s:code,op:'goto',qid:a});await raw(first,{s:code,op:'close',expect:a});await raw(first,{s:code,op:'show',expect:a});
      await rendered(0);await page.locator(reopen).waitFor({state:'visible'});
      await first.page.waitForFunction(text=>document.querySelector('#live-text').textContent===text,made.questions[0].text);
      const hideGate=deferred(),hidden=deferred();routeGates.push(hideGate);
      const hides=url=>action(url)==='control';
      await page.route(hides,async route=>{
        if(route.request().postDataJSON()?.op!=='hide'){await route.continue();return;}
        const actual=await route.fetch();hidden.resolve({status:actual.status(),body:route.request().postDataJSON()});
        await hideGate.promise;await route.fulfill({response:actual});
      });
      try{
        await page.locator(reopen).click();const hiddenResponse=await hidden.promise;assert.equal(hiddenResponse.status,200);
        const advanced=first.page.waitForResponse(r=>action(r.url())==='control'&&r.request().postDataJSON()?.op==='next');await first.page.locator('#live [data-op="next"]').click();await advanced;
        await rendered(1);const opened=page.waitForResponse(r=>action(r.url())==='control'&&r.request().postDataJSON()?.op==='open');
        hideGate.resolve();const response=await opened,after=await state(first,code);
        check(hiddenResponse.body.expect===a&&response.request().postDataJSON().expect===a&&response.status()===409&&after.current===1&&after.questions[1].state==='closed',view+' hide/open : même expect conservé malgré actualisation naturelle sur B, B ne rouvre pas');
      }finally{hideGate.resolve();await page.unroute(hides);}
    }finally{for(const gate of routeGates)gate.resolve();for(const context of contexts)await context.close();}
  }
};
