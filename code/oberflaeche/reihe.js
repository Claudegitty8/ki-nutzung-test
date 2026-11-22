// Die Übungsform «Sortieren»: Der Spieler bringt Schritte in die richtige Reihenfolge.
// Bietet dieselben Funktionen wie die Werkbank, damit der Rundenablauf alle Formen gleich behandelt.
import { el, fuelle } from './bausteine.js';
import { baueSchirm } from './schirm.js';
import { loeseSchirm } from '../logik/schirme.js';

export function baueReihe({ aufgabe, t, schirme = {}, gesperrt = false }) {
  let ordnung = aufgabe.schritte.map((schritt) => schritt.id);
  let zu = gesperrt;
  let markiert = null;
  const texte = new Map(aufgabe.schritte.map((schritt) => [schritt.id, schritt.text]));
  // Ein Schritt kann ein kleines Bild haben: so sieht der Bildschirm in diesem Schritt aus.
  const bilder = new Map(aufgabe.schritte.filter((schritt) => schritt.schirm).map((schritt) => [schritt.id, schritt]));
  const bildVon = (id) => {
    const schritt = bilder.get(id);
    return schritt ? baueSchirm(loeseSchirm(schirme, schritt.schirm), t, { klein: true, ausschnitt: schritt.ziel, markiert: schritt.ziel, markiertText: t.schirmHierAusschnitt ?? t.schirmHier }) : null;
  };
  const liste = el('ol', { klasse: 'reihe' });
  const hinweisZumTeil = el('p', { klasse: 'teil-hinweis', role: 'status' });

  function schiebe(id, richtung) {
    const von = ordnung.indexOf(id);
    const nach = von + richtung;
    if (nach < 0 || nach >= ordnung.length) return;
    ordnung = ordnung.with(von, ordnung[nach]).with(nach, id);
    markiert = null;
    hinweisZumTeil.textContent = '';
    zeichne(id, richtung);
  }

  // Nach dem Verschieben bleibt der Fokus auf demselben Knopf, damit man mehrmals drücken kann.
  function zeichne(fokusId = null, richtung = 0) {
    liste.replaceChildren(...ordnung.map((id, index) => {
      const text = texte.get(id);
      const hoch = el('button', {
        type: 'button', klasse: 'reihe-knopf', disabled: zu || index === 0,
        'aria-label': fuelle(t.reiheHoch, { text }), text: '▲', onclick: () => schiebe(id, -1),
      });
      const runter = el('button', {
        type: 'button', klasse: 'reihe-knopf', disabled: zu || index === ordnung.length - 1,
        'aria-label': fuelle(t.reiheRunter, { text }), text: '▼', onclick: () => schiebe(id, 1),
      });
      const zeile = el('li', { klasse: id === markiert ? 'reihe-zeile markiert' : 'reihe-zeile' },
        el('div', { klasse: 'reihe-text' }, el('span', { text })), el('span', { klasse: 'reihe-knoepfe' }, hoch, runter),
        // Das Bild bekommt eine eigene Zeile unter Text und Pfeilen, damit es auch bei grosser Schrift lesbar bleibt
        // (Befund Barrierefreiheit 0.6).
        bilder.has(id) ? el('div', { klasse: 'reihe-bild' }, bildVon(id)) : null);
      if (id === fokusId) queueMicrotask(() => [richtung < 0 ? hoch : runter, hoch, runter].find((k) => !k.disabled)?.focus());
      return zeile;
    }));
  }

  const knoten = el('section', { klasse: 'karte werkbank' },
    el('p', { klasse: 'etikett', text: t.frageEtikett }),
    el('p', { klasse: 'frage', text: aufgabe.frage }),
    el('p', { klasse: 'klein', text: t.reiheHilfe }),
    liste,
    hinweisZumTeil);

  zeichne();

  return {
    knoten,
    auswahl: () => [...ordnung],
    setze(ids) {
      ordnung = [...ids];
      zeichne();
    },
    sperre() {
      zu = true;
      zeichne();
    },
    markiere(id, text) {
      markiert = id;
      hinweisZumTeil.textContent = text;
      zeichne();
    },
  };
}
