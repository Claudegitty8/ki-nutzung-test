// Rückfrage beim ersten Start: Spielstand aus einem alten Spiel gefunden. Übernehmen oder neu beginnen?
// Eine Frage pro gefundenem Stand, nacheinander (gestaltung/ABLAEUFE.md, B). Jede Antwort wird sofort gespeichert,
// damit nach einem Neuladen nichts doppelt gefragt wird. Der alte Stand bleibt unverändert (E-008).
import { el, fuelle, knopf, figurBild } from './bausteine.js';
import { uebernimm, lehneAb, startTeil } from '../logik/uebernahme.js';

const gross = (id) => id.charAt(0).toUpperCase() + id.slice(1);

// Text je nach Anzahl erledigter Aufträge: keiner, einer, mehrere.
function fundText(g, teilId, anzahl) {
  const n = gross(teilId);
  if (anzahl === 0) return g[`uebernahme${n}TextNull`];
  if (anzahl === 1) return g[`uebernahme${n}TextEins`];
  return fuelle(g[`uebernahme${n}Text`], { auftraege: anzahl });
}

// Nach der letzten Frage: in den Teil, der jetzt dran ist, sonst zur Teilwahl.
function weiter(app, nav) {
  const ziel = startTeil(app.gesamt, app.teile);
  // Ein Teil wurde übernommen: dorthin wechseln (wechsle merkt ihn als gespielt und lädt seine Inhalte).
  if (ziel) app.wechsle(ziel);
  else nav.zu('teilwahl');
}

export function zeigeUebernahme(wurzel, app, nav, { offene, stelle = 0 }) {
  const g = app.gemeinsam;
  const frage = offene[stelle];
  if (!frage) {
    weiter(app, nav);
    return;
  }
  const teil = app.teile.find((t) => t.id === frage.teil);
  const anzahl = frage.stand.erledigt.filter((id) => teil.auftraege.includes(id)).length;
  const heute = new Date().toISOString().slice(0, 10);
  // tabindex: Nach der Antwort sind beide Knöpfe gesperrt; der Fokus geht auf die Meldung (Befund Barrierefreiheit).
  const status = el('p', { klasse: 'klein', role: 'status', tabindex: '-1' });

  function antworte(neu, text) {
    ja.disabled = true;
    nein.disabled = true;
    app.setzeGesamt(neu);
    status.textContent = text;
    status.focus();
    // Kurz zeigen, was passiert ist, dann zur nächsten Frage.
    setTimeout(() => nav.zu('uebernahme', { offene, stelle: stelle + 1 }), 900);
  }
  const ja = knopf(g.uebernahmeJa, () => antworte(uebernimm(app.gesamt, teil.id, frage.stand, heute), g.uebernahmeFertig), 'los');
  const nein = knopf(g.uebernahmeNein, () => antworte(lehneAb(app.gesamt, teil.id, heute), g.uebernahmeAbgelehnt), 'knopf-zweit');

  wurzel.append(
    el('header', { klasse: 'kopf start-kopf' },
      el('h1', { text: g.startTitel }),
      el('p', { klasse: 'untertitel', text: g.startUntertitel })),
    el('section', { klasse: 'karte teil-karte', 'data-teil': teil.id, 'aria-labelledby': 'fund-titel' },
      offene.length > 1 ? el('p', { klasse: 'etikett', text: `${stelle + 1} / ${offene.length}` }) : null,
      el('div', { klasse: 'teil-kopf' },
        figurBild(g[`teil${gross(teil.id)}Name`], false),
        el('h2', { id: 'fund-titel', text: g[`uebernahme${gross(teil.id)}Titel`] })),
      el('p', { text: fundText(g, teil.id, anzahl) }),
      el('p', { klasse: 'hinweis gut', text: g.uebernahmeSicher }),
      el('div', { klasse: 'knopf-reihe' }, ja, nein),
      status),
  );
}
