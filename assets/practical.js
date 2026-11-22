/* Préparation d'un atelier pratique : l'unité demandée est l'exercice, pas la
 * diapositive. Durées indicatives : essai, méthode et échanges compris. */
(function () {
  'use strict';
  WL.Practical = {
    plan: function (o) {
      var steps = o.feedback ? 3 : 2;
      var max = Math.floor((o.limit - o.existing - 1) / steps);
      if (max < 1) return { error: 'Il ne reste pas assez de place pour un exercice et sa méthode. Créez un nouvel atelier.' };
      if (!o.byDuration) {
        if (!Number.isInteger(o.count) || o.count < 1 || o.count > max) return { error: 'Nombre d’exercices : de 1 à ' + max + ' avec ces options et la place disponible.' };
        return { mode: 'count', count: o.count, steps: o.count * steps, max: max };
      }
      if (!Number.isInteger(o.duration) || o.duration < 15 || o.duration > 180) return { error: 'Durée de l’atelier : de 15 à 180 minutes, en minutes entières.' };
      var estimate = Math.floor((o.duration - 10) / o.per);
      if (estimate < 1) return { error: 'Prévoyez au moins ' + (10 + o.per) + ' minutes avec ce niveau.' };
      var count = Math.min(max, estimate);
      return { mode: 'duration', count: count, duration: o.duration, perQuestion: o.per,
        steps: count * steps, max: max, defi: 0, margin: o.duration - 10 - count * o.per, capped: estimate > max };
    },
    // Les voisins seuls forment un exercice ; ne jamais sauter un élément
    // invalide pour associer une tâche à une méthode située plus loin.
    blocks: function (items) {
      var blocks = [];
      for (var i = 0; i < items.length; i++) {
        var q = items[i], block = { indices: [i], feedback: null, kind: 'invalid', error: '' };
        if (q.error) block.kind = 'error';
        else if (q.conclusion !== undefined) block.kind = 'conclusion';
        else if (q.type === 'yesno' && !(q.correct || []).length) {
          var method = items[i + 1];
          if (method && !method.error && method.conclusion === undefined && method.type === 'info') {
            block.kind = 'exercise';
            block.indices.push(++i);
            var feedback = items[i + 1];
            if (feedback && !feedback.error && feedback.conclusion === undefined && feedback.type === 'text') block.feedback = ++i;
          } else block.error = 'Exercice incomplet : sa méthode doit le suivre immédiatement.';
        } else block.error = q.type === 'info' ? 'Méthode isolée : aucune tâche Oui/Non juste avant.'
          : q.type === 'text' ? 'Retour libre isolé : aucun exercice complet juste avant.'
          : 'Type incompatible ou Oui/Non avec correction : faites corriger cet élément.';
        blocks.push(block);
      }
      return blocks;
    },
    // Les valeurs des cases restent les indices de la réponse source. Le retour
    // peut rester coché quand son exercice est retiré, sans être importé seul.
    selection: function (blocks, checked) {
      var keep = [], invalid = 0;
      blocks.forEach(function (block) {
        if (block.kind === 'error' || checked.indexOf(block.indices[0]) === -1) return;
        keep = keep.concat(block.indices);
        if (block.feedback !== null && checked.indexOf(block.feedback) !== -1) keep.push(block.feedback);
        if (block.error) invalid++;
      });
      return { keep: keep, invalid: invalid };
    },
    counts: function (items) {
      var c = { exercises: 0, methods: 0, feedback: 0, conclusions: 0, invalid: 0 };
      items.forEach(function (q) {
        if (q.error) return;
        if (q.conclusion !== undefined) c.conclusions++;
        else if (q.type === 'yesno' && !(q.correct || []).length) c.exercises++;
        else if (q.type === 'info') c.methods++;
        else if (q.type === 'text') c.feedback++;
        else c.invalid++;
      });
      return c;
    }
  };
}());
