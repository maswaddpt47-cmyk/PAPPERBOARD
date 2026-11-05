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
