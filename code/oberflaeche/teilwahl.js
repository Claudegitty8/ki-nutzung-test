// Startbildschirm mit Teilwahl: beim ersten Start und über «Teil wechseln» (gestaltung/ABLAEUFE.md, A und D).
// Jede Karte trägt die Farbe ihres Teils (data-teil). Ein Knopf trägt die Farbe des Teils, in den er führt.
import { el, fuelle, knopf, figurBild } from './bausteine.js';
import { hatGespielt } from '../logik/gesamt.js';

// Texte pro Teil im gemeinsamen Textfile: teilStudioName, teilBueroName usw.
const gross = (id) => id.charAt(0).toUpperCase() + id.slice(1);

export function zeigeTeilwahl(wurzel, app, nav) {
  const g = app.gemeinsam;
  const gesamt = app.gesamt;
  const zurueck = gesamt.aktiv
    ? knopf(g[`zurueckZu${gross(gesamt.aktiv)}`] ?? g.zurueckZuStart, () => nav.zu('heim'), 'knopf-leise')
    : null;

  const karten = app.teile.map((teil, stelle) => {
    const n = gross(teil.id);
    const fach = gesamt.teile[teil.id];
    const erledigt = fach?.erledigt?.filter((id) => teil.auftraege.includes(id)).length ?? 0;
    const gespielt = hatGespielt(gesamt, teil.id);
    const hier = gesamt.aktiv === teil.id;
    // Erster Teil: «Beginnen». Späterer Teil beim ersten Start: «Direkt ins …» (E-012).
    let knopfText = gespielt ? g.teilWeiterspielen : g.teilBeginnen;
    if (!gespielt && stelle > 0 && g[`direkt${n}`]) knopfText = g[`direkt${n}`];
    const stand = erledigt >= teil.auftraege.length
      ? g.teilFertig
      : fuelle(g.teilStand, { auftraege: erledigt, anzahl: teil.auftraege.length });
    return el('section', { klasse: 'karte teil-karte', 'data-teil': teil.id, 'aria-labelledby': `teil-${teil.id}` },
      el('div', { klasse: 'teil-kopf' },
        figurBild(g[`teil${n}Name`], false),
        el('div', {},
          el('p', { klasse: 'etikett', text: fuelle(g.startTeilEtikett, { nr: stelle + 1 }) }),
          el('h2', { id: `teil-${teil.id}`, text: g[`teil${n}Name`] }),
          el('p', { klasse: 'klein', text: g[`teil${n}Ort`] }))),
      el('p', { text: g[`teil${n}FuerWen`] }),
      el('p', { text: g[`teil${n}Lernen`] }),
      el('p', { klasse: 'klein', text: stand }),
      stelle > 0 && !gespielt && g[`direkt${n}Hinweis`] ? el('p', { klasse: 'klein', text: g[`direkt${n}Hinweis`] }) : null,
      hier
        ? knopf(g[`zurueckZu${n}`] ?? g.teilWeiterspielen, () => nav.zu('heim'), 'knopf-zweit')
        : knopf(knopfText, () => app.wechsle(teil.id), 'los'));
  });

  wurzel.append(...[
    zurueck ? el('nav', { klasse: 'leiste' }, zurueck) : null,
    el('header', { klasse: 'kopf start-kopf' },
      el('h1', { text: g.startTitel }),
      el('p', { klasse: 'untertitel', text: g.startUntertitel })),
    el('p', { text: gesamt.aktiv ? g.wechselHinweis : g.startFrage }),
    ...karten,
    // «inoffiziell» gleich auf dem Startbildschirm, mit «Mehr dazu» zum Aufklappen (Befund Recht).
    el('details', { klasse: 'klein start-inoffiziell' },
      el('summary', { text: `${g.startInoffiziell} ${g.startInoffiziellMehr}` }),
      el('p', { text: g.ueberInoffiziell }),
      el('p', { text: g.ueberDaten }),
      el('p', { text: g.ueberDatenAlt })),
  ].filter(Boolean));
}
