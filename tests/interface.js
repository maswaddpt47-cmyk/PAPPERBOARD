'use strict';
const {chromium} = require('playwright');
const assert = require('assert/strict');
const base = process.env.WL_BASE;
let checks = 0;
function check(value, message) { checks++; assert(value, message); }
(async function () {
  const browser = await chromium.launch(process.env.WL_CHROMIUM ? {executablePath: process.env.WL_CHROMIUM} : {});
  try {
    const context = await browser.newContext();
    const admin = await context.newPage(), reference = await context.newPage();
    const errors = [];
    admin.on('pageerror', error => errors.push(error.message));
    await admin.goto(base + 'admin.php');
    await admin.locator('#password').fill(process.env.WL_PASSWORD);
    await admin.locator('#login-form button').click();
    await admin.locator('#sessions:not([hidden])').waitFor();
    await admin.locator('#create-btn').click();
    await admin.locator('#create-demo').check();
    await admin.locator('#create-ok').click();
    await admin.locator('#editor:not([hidden])').waitFor();
    await admin.locator('#ed-title').filter({hasText: 'Démo'}).waitFor();
    await reference.goto(base + 'tests/reference/interface.html');
    await reference.addStyleTag({content: '.simulation-notice{display:none!important}'});
    await reference.locator('[data-action="tab"][data-tab="live"]').click();
    await admin.locator('#t-live').click();
    const metrics = [
      ['.sidebar','.sidebar',['width','padding-left','padding-top']],
      ['.workspace','#main',['max-width','padding-left','padding-top']],
      ['.topbar','.shell-topbar',['min-height','padding-left','padding-top']],
      ['.workbench','#tab-live .workbench',['grid-template-columns','column-gap']],
      ['.question-title','#live-text',['font-family','font-size','line-height','font-weight']],
      ['.metric-card','#tab-live .metric-card',['padding-left','border-radius']],
      ['[data-action="toggle-vote"]','#open-btn',['min-height','font-size','padding-left','padding-top','border-radius']],
      ['.live-toolbar','#live .live-toolbar',['padding-top','padding-left','padding-bottom']],
      ['.breadcrumb','.shell-topbar .breadcrumb',['font-size','color']],
      ['.page-subtitle','#editor .page-subtitle',['font-size']],
      ['.live-session-summary > div','#live-summary',['font-size','display','column-gap']],
      ['.panel-head .panel-title','.question-rail .panel-head h2',['font-size','font-weight','line-height']],
      ['.question-meta','.rail-item .question-meta',['font-size','line-height']],
      ['.question-number','.rail-item .question-number',['width','height','font-size']],
      ['.metric-card .panel-title','.metric-card .panel-head h2',['font-size']],
      ['.metric-caption','#metric-caption',['font-size','margin-bottom']]
    ];
    const differences = [];
    for (const [width,height] of [[1920,1080],[1280,720],[1024,768],[390,844]]) {
      await admin.setViewportSize({width,height}); await reference.setViewportSize({width,height});
      await admin.waitForTimeout(100);
      for (const [refSelector,phpSelector,properties] of metrics) {
        const read = (selector, page) => page.locator(selector).first().evaluate((node,properties) => {
          const style = getComputedStyle(node); return Object.fromEntries(properties.map(key => [key,style.getPropertyValue(key)]));
        }, properties);
        const expected = await read(refSelector,reference), actual = await read(phpSelector,admin);
        for (const property of properties) { checks++; if (expected[property] !== actual[property]) differences.push(width + 'px ' + phpSelector + ' ' + property + ': ' + actual[property] + ' au lieu de ' + expected[property]); }
      }
      check(await admin.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), width + 'px: débordement horizontal');
      check(await admin.locator('.shell-topbar .shell-brand').isHidden(), width + 'px : marque en double dans la barre du haut');
      const headings = await Promise.all([reference, admin].map(page => page.locator('.page-heading:visible').first().evaluate(node => node.getBoundingClientRect().height)));
      // Mobile seulement : au-delà, la hauteur suit le nombre de boutons d'en-tête, différent du prototype.
      if (width < 640) check(Math.abs(headings[0] - headings[1]) <= 40, width + 'px : en-tête de ' + Math.round(headings[1]) + ' px au lieu d\'environ ' + Math.round(headings[0]));
      if (process.env.WL_UI_ARTIFACTS) {
        await require('fs/promises').mkdir(process.env.WL_UI_ARTIFACTS,{recursive:true});
        for (const [label,page] of [['php',admin],['reference',reference]]) await page.screenshot({path:process.env.WL_UI_ARTIFACTS+'/'+label+'-'+width+'.png',fullPage:true});
      }
    }
    check(differences.length === 0, 'Écarts visuels :\n' + differences.join('\n'));
    const me = await (await context.request.get(base+'api.php?action=me')).json();
    const sessionCode = await admin.locator('#ed-code').textContent();
    const state = await (await context.request.get(base+'api.php?action=admin_state&s='+sessionCode)).json();
    const post = async (action,body) => {
      const response = await context.request.post(base+'api.php?action='+action,{headers:{'X-WL':'1','X-CSRF-Token':me.csrf},data:body});
      check(response.ok(), 'Écriture de vérification refusée : '+action); return response.json();
    };
    const projection = await context.newPage();
    projection.on('pageerror', error => errors.push(error.message));
    await projection.goto(base+'screen.php?s='+sessionCode);
    for (const question of state.questions) {
      await post('control',{s:sessionCode,op:'goto',qid:question.id});
      await post('control',{s:sessionCode,op:'show'});
      await projection.waitForFunction(text => document.getElementById('s-text').textContent===text && document.body.classList.contains('s-live'), question.text);
      for (const [width,height] of [[1920,1080],[1280,720],[1024,768],[390,844]]) {
        await projection.setViewportSize({width,height}); await projection.waitForTimeout(80);
        const fits = await projection.evaluate(() => {
          const results = document.getElementById('s-results').getBoundingClientRect();
          const canvas = document.getElementById('projection-canvas').getBoundingClientRect();
          const main = document.querySelector('.screen-main').getBoundingClientRect();
          return results.bottom <= innerHeight+1 && canvas.bottom <= innerHeight+1 && canvas.top >= main.top-1
            && document.documentElement.scrollWidth <= innerWidth && document.documentElement.scrollHeight <= innerHeight;
        });
        check(fits, question.type+' : résultat tronqué à '+width+'×'+height);
      }
    }
    await projection.close();
    await admin.setViewportSize({width:1280,height:720});
    await admin.locator('#t-control').click();
    check(await admin.locator('#end-control-btn').isVisible(), 'Terminer absent dans Pilotage');
    await admin.locator('#end-control-btn').hover();
    await admin.getByRole('tooltip').waitFor();
    check((await admin.locator('#end-control-btn').getAttribute('aria-describedby') || '').includes('action-tooltip'), 'Info-bulle non associée');
    await admin.keyboard.press('Escape');
    admin.once('dialog', dialog => dialog.dismiss());
    await admin.locator('#end-control-btn').click();
    check((await admin.locator('#end-control-btn').textContent()).includes('Terminer'), 'Annuler termine la session');
    admin.once('dialog', dialog => dialog.accept());
    await admin.locator('#end-control-btn').click();
    await admin.locator('#end-control-btn').filter({hasText:'Rouvrir'}).waitFor();
    await admin.locator('#end-control-btn').click();
    await admin.locator('#end-control-btn').filter({hasText:'Terminer'}).waitFor();
    await admin.locator('#t-settings').click();
    check((await admin.locator('#cron-state').textContent()).length > 0, 'Indicateur réel de purge perdu');
    await admin.locator('#back-btn').click();
    const row = admin.locator('#session-list .workshop-row').filter({hasText:'Démo'}).first();
    await row.getByRole('button',{name:'Renommer',exact:true}).click();
    await admin.locator('#rename-title-input').fill('  Atelier renommé  ');
    await admin.locator('#rename-save').click();
    await admin.locator('#session-list h3').filter({hasText:'Atelier renommé'}).waitFor();
    check(await admin.locator('#demo-delete').isVisible(), 'Supprimer la démo perdu');
    await admin.locator('[data-nav="overview"]').click();
    await admin.locator('#create-btn').click();
    await reference.setViewportSize({width:1280,height:720});
    await reference.locator('[data-nav="overview"]').click();
    await reference.locator('#workspace [data-action="create-workshop"]').first().click();
    const modalDifferences = [];
    for (const [width,height] of [[1280,720],[390,844]]) {
      await admin.setViewportSize({width,height}); await reference.setViewportSize({width,height});
      for (const [expectedSelector,actualSelector,properties] of [
        ['dialog[open]','#create-dialog',['width','padding-left','border-radius']],
        ['dialog[open] .modal-head','#create-dialog .modal-head',['padding-top','padding-left']],
        ['#workshop-title','#new-title',['font-size','min-height','padding-top','border-radius']]
      ]) {
        const read = (page,selector) => page.locator(selector).evaluate((node,properties) => {
          const style = getComputedStyle(node); return Object.fromEntries(properties.map(key=>[key,style.getPropertyValue(key)]));
        }, properties);
        const actual = await read(admin,actualSelector), expected = await read(reference,expectedSelector);
        for (const property of properties) { checks++; if (actual[property]!==expected[property]) modalDifferences.push(width+'px '+actualSelector+' '+property+': '+actual[property]+' au lieu de '+expected[property]); }
      }
      check(await admin.locator('#create-ok').isVisible(),'Création : pied de fenêtre inaccessible');
    }
    check(modalDifferences.length===0,'Écarts de formulaire :\n'+modalDifferences.join('\n'));
    await admin.locator('#create-cancel').click();
    // Mon espace : Vue d'ensemble, Bibliothèque de modèles et Mes ateliers reprennent les vues de la référence.
    const spaceDifferences = [];
    const spaces = {
      overview: [['.session-summary','.session-summary',['padding-left','border-radius']],['.session-summary h2','#ov-name',['font-size','font-family']],
        ['.content-card .metric-number','#space-overview .metric-number',['font-size','font-weight']],['.section-heading .panel-title','#space-overview .section-heading .panel-title',['font-size']]],
      library: [['.library-grid','#library-grid',['grid-template-columns','column-gap']],['.library-grid article h2','#library-grid h2',['font-size']]],
      history: [['.workshop-group','.workshop-group',['padding-left','border-radius']],['.workshop-group .panel-head','.workshop-group .panel-head',['padding-top','padding-left']],
        ['.workshop-row','#session-list .workshop-row',['padding-left','border-radius']],['.workshop-row h3','#session-list h3',['font-size']],
        ['.workshop-row-actions .btn','#session-list .workshop-row-actions .btn',['min-height','font-size']],['.demo-controls h2','.demo-controls h2',['font-size']]]
    };
    for (const [name, pairs] of Object.entries(spaces)) {
      await admin.locator('.nav-item[data-nav="'+name+'"]').evaluate(node => node.click());
      await reference.locator('[data-nav="'+name+'"]').evaluate(node => node.click());
      for (const [width,height] of [[1280,720],[390,844]]) {
        await admin.setViewportSize({width,height}); await reference.setViewportSize({width,height}); await admin.waitForTimeout(100);
        for (const [expectedSelector,actualSelector,properties] of pairs) {
          const read = (page,selector) => page.locator(selector).first().evaluate((node,properties) => {
            const style = getComputedStyle(node); return Object.fromEntries(properties.map(key=>[key,style.getPropertyValue(key)]));
          }, properties);
          const actual = await read(admin,actualSelector), expected = await read(reference,expectedSelector);
          for (const property of properties) { checks++; if (actual[property]!==expected[property]) spaceDifferences.push(name+' '+width+'px '+actualSelector+' '+property+': '+actual[property]+' au lieu de '+expected[property]); }
        }
        check(await admin.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), name+' '+width+'px : débordement horizontal');
      }
    }
    check(spaceDifferences.length===0,'Écarts de Mon espace :\n'+spaceDifferences.join('\n'));
    // Ligne d'atelier archivé : Voir le bilan, Réutiliser les questions, Supprimer (décision du 19/10/2026).
    const created = await post('session_create',{title:'Archive de contrôle'});
    await post('question_save',{s:created.code,question:{type:'poll',text:'Question archivée ?',options:['Oui','Non']}});
    await post('session_archive',{s:created.code});
    await admin.setViewportSize({width:1280,height:720});
    await admin.reload(); await admin.locator('#sessions:not([hidden])').waitFor();
    await admin.locator('.nav-item[data-nav="history"]').click();
    const archived = admin.locator('#archive-list .workshop-row').filter({hasText:'Archive de contrôle'});
    await archived.waitFor();
    for (const name of ['Voir le bilan','Réutiliser les questions','Supprimer']) check(await archived.getByRole('button',{name,exact:true}).isVisible(), 'Archive : bouton « '+name+' » absent');
    await archived.getByRole('button',{name:'Réutiliser les questions',exact:true}).click();
    await admin.locator('#editor:not([hidden])').waitFor();
    check((await admin.locator('#ed-title').textContent()).includes('Archive de contrôle'), 'Archive : réutilisation sans nouvel atelier');
    await admin.locator('#back-btn').click();
    admin.once('dialog', dialog => dialog.accept());
    await admin.locator('#archive-list .workshop-row').filter({hasText:'Archive de contrôle'}).getByRole('button',{name:'Supprimer',exact:true}).click();
    await admin.locator('#archive-list .workshop-row').filter({hasText:'Archive de contrôle'}).waitFor({state:'detached'});
    check(errors.length === 0, 'Erreurs JS : '+errors.join(' ; '));
    console.log('Interface PHP : '+checks+' contrôles réussis, comparaison avec la référence et actions réelles.');
  } finally { await browser.close(); }
}()).catch(error => { console.error(error); process.exitCode = 1; });
