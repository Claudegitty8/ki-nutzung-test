// Einsatzschrank: gebaute Bauteile ansehen und für echtes Claude kopieren («In Claude ausprobieren»).
// Das Spiel schickt dabei nichts weg. Der Spieler fügt den Text selbst bei Claude ein.
import { el, fuelle, knopf, leiste } from './bausteine.js';
import { hakeAb, schrankInhalt } from '../logik/schrank.js';
import { baueStrecke } from './klick.js';

// Probefahrt (E-029): den Weg in der echten App nachlesen und abhaken, was man selbst gemacht hat.
// Freiwillig. Die Haken stehen im Spielstand, damit sie nach dem Neuladen noch da sind.
function probefahrt(app, eintrag, t) {
  const { aufgabe, punkte } = eintrag.probefahrt;
  const liste = el('ul', { klasse: 'probefahrt-liste' }, punkte.map((punkt) => {
    const feldId = `probe-${eintrag.auftrag}-${punkt.id}`;
    const feld = el('input', {
      type: 'checkbox',
      id: feldId,
      checked: punkt.erledigt,
      onchange: () => app.setze(hakeAb(app.stand, eintrag.auftrag, punkt.id, feld.checked)),
    });
    return el('li', {}, feld, el('label', { for: feldId, text: punkt.text }));
  }));
  return el('div', { klasse: 'probefahrt' },
    el('h3', { text: t.schrankProbefahrt }),
    el('p', { klasse: 'klein', text: t.schrankProbefahrtInfo }),
    aufgabe ? el('details', { klasse: 'probefahrt-weg' },
      el('summary', { text: t.schrankWegZeigen }),
      baueStrecke(aufgabe, app.inhalte.schirme, t)) : null,
    liste);
}

export function zeigeSchrank(wurzel, app, nav) {
  const t = app.inhalte.texte.app;
  const eintraege = schrankInhalt(app.stand, app.inhalte.auftraege);

  wurzel.append(
    leiste(t, nav, t.schrankTitel),
    el('p', { klasse: 'karte', text: t.schrankInfo }),
  );
  if (eintraege.length === 0) {
    wurzel.append(el('p', { klasse: 'karte', text: t.schrankLeer }));
    return;
  }

  for (const eintrag of eintraege) {
    const feldId = `schrank-${eintrag.auftrag}`;
    const feld = el('textarea', { id: feldId, klasse: 'schrank-text', readonly: true, rows: 9 });
    feld.value = eintrag.vorlage;
    // Meldet laut für Vorlesehilfen, ob das Kopieren geklappt hat.
    const status = el('p', { klasse: 'status', role: 'status', 'aria-live': 'polite' });

    const kopieren = knopf(t.schrankKopieren, async () => {
      try {
        // Die Zwischenablage gibt es nur auf sicheren Adressen und mit Erlaubnis des Browsers.
        await navigator.clipboard.writeText(eintrag.vorlage);
        status.textContent = t.schrankKopiert;
      } catch {
        // Ersatz: Text markieren, damit man ihn von Hand kopieren kann.
        feld.focus();
        feld.select();
        status.textContent = t.schrankKopierenNicht;
      }
    }, 'los');

    wurzel.append(el('section', { klasse: 'karte' },
      el('h2', { text: eintrag.titel }),
      el('label', { for: feldId, klasse: 'etikett', text: t.schrankVorlage }),
      feld,
      el('p', {}, el('strong', { text: `${t.schrankWo} ` }), el('span', { text: eintrag.wo })),
      kopieren,
      status,
      eintrag.probefahrt ? probefahrt(app, eintrag, t) : null,
    ));
  }
}

// Kurze Zeile für das Ende eines Auftrags: Was ist neu im Einsatzschrank?
export function schrankNeuText(t, auftrag) {
  return auftrag?.schrank ? fuelle(t.schrankNeu, { titel: auftrag.schrank.titel }) : null;
}
