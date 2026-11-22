// Kleine Karten fürs Heim: freiwillige Fragen und Heim einrichten (Studio oder Zentrale).
// Eigene Datei, damit das Heim ohne die Übungsformen auskommt und schnell startet (E-055).
// Die Regeln dazu stehen in logik/extras.js.
import { el, fuelle, knopf } from './bausteine.js';
import { guthaben, kaufe } from '../logik/extras.js';

function umfrageText(t, stand) {
  const { vorher, nachher } = stand.umfrage ?? {};
  if (!nachher) return '';
  return vorher
    ? fuelle(t.umfrageErgebnis, { vorher: vorher.richtig, nachher: nachher.richtig, anzahl: nachher.von })
    : fuelle(t.umfrageNurNachher, { nachher: nachher.richtig, anzahl: nachher.von });
}

// Karte im Heim: vor dem ersten Auftrag und nach dem letzten. Immer freiwillig.
export function umfrageKarte(app, nav) {
  const t = app.inhalte.texte.app;
  const { stand } = app;
  const umfrage = stand.umfrage ?? {};
  const amAnfang = stand.erledigt.length === 0 && !stand.lauf && !umfrage.vorher;
  const amEnde = !app.auftrag() && !umfrage.nachher;
  if (amAnfang || amEnde) {
    const wann = amAnfang ? 'vorher' : 'nachher';
    return el('section', { klasse: 'karte' },
      el('p', { klasse: 'etikett', text: amAnfang ? t.umfrageVorherTitel : t.umfrageNachherTitel }),
      el('p', { text: amAnfang ? t.umfrageVorherText : t.umfrageNachherText }),
      knopf(t.umfrageStart, () => nav.zu('umfrage', { wann }), 'knopf-zweit'));
  }
  if (umfrage.nachher) {
    return el('section', { klasse: 'karte' },
      el('p', { klasse: 'etikett', text: t.umfrageNachherTitel }),
      el('p', { text: umfrageText(t, stand) }));
  }
  return null;
}

// --- Heim einrichten ---

export function einrichtungKarte(app, nav) {
  const { texte, einrichtung } = app.inhalte;
  const t = texte.app;
  const besitz = app.stand.einrichtung ?? [];
  const konto = guthaben(app.stand, einrichtung);
  // Erst zeigen, wenn es etwas zu holen gibt.
  if (konto <= 0 && besitz.length === 0) return null;
  const offen = einrichtung.filter((ding) => !besitz.includes(ding.id));
  return el('section', { klasse: 'karte' },
    el('p', { klasse: 'etikett', text: t.einrichtungEtikett }),
    besitz.length > 0 ? el('p', {}, el('span', { text: `${t.einrichtungDa} ` }),
      el('span', { text: besitz.map((id) => t.einrichtung[id]).join(', ') })) : null,
    el('p', { text: fuelle(t.einrichtungGuthaben, { anzahl: konto }) }),
    el('div', { klasse: 'bausteine' }, offen.map((ding) => el('button', {
      type: 'button',
      klasse: 'baustein',
      disabled: ding.preis > konto,
      text: fuelle(t.einrichtungKaufen, { name: t.einrichtung[ding.id], preis: ding.preis }),
      onclick: () => {
        app.setze(kaufe(app.stand, ding.id, einrichtung));
        nav.zu('heim');
      },
    }))),
    el('p', { klasse: 'klein', text: t.einrichtungInfo }));
}
