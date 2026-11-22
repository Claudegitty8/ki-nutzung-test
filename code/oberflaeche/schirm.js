// Gezeichnete Bildschirme: vereinfachte Nachzeichnungen echter Apps (Claude-App, Claude Code).
// Sie bestehen aus Textbausteinen statt aus Bildern. So bleiben sie scharf, klein, hell und dunkel lesbar,
// wachsen mit der Schriftgrösse mit und lassen sich vorlesen. Keine Spielregeln, keine festen Texte:
// Alles Sichtbare kommt aus spiel/inhalte/de/schirme.json oder aus der Aufgabe.
//
// Jeder Eintrag mit einer «id» wird ein echter Knopf, sobald der Aufrufer «beiTipp» mitgibt.
// Ohne beiTipp (zum Beispiel in der Bilderstrecke) ist alles nur zum Anschauen.
import { el, fuelle } from './bausteine.js';
import { istAktiv } from '../logik/schirme.js';

// Ein Eintrag zum Antippen oder nur zum Anschauen.
function stelle(eintrag, o, klasse, ...inhalt) {
  const klassen = [klasse];
  if (istAktiv(o.schirm, eintrag)) klassen.push('aktiv');
  if (eintrag.haupt) klassen.push('haupt');
  if (eintrag.leise) klassen.push('leise'); // Platzhalter wie «Deine Chats …»
  const markiert = eintrag.id && o.markiert === eintrag.id;
  if (markiert) klassen.push('markiert');
  if (eintrag.id && o.getroffen === eintrag.id) klassen.push('getroffen');
  // Vorlesehilfen erfahren, welche Stelle hervorgehoben ist (sonst sieht man es nur an der Farbe).
  const zusatz = markiert && o.markiertText ? el('span', { klasse: 'nur-vorlesen', text: ` (${o.markiertText})` }) : null;
  if (!eintrag.id || !o.beiTipp) return el('span', { klasse: `${klassen.join(' ')} still` }, ...inhalt, zusatz);
  return el('button', {
    type: 'button',
    klasse: [...klassen, 'stelle'].join(' '),
    'data-stelle': eintrag.id,
    disabled: o.aus,
    onclick: () => o.beiTipp(eintrag.id),
  }, ...inhalt, zusatz);
}

const text = (eintrag) => el('span', { text: eintrag.text });
const unter = (eintrag) => (eintrag.unter ? el('small', { text: eintrag.unter }) : null);

// Die einzelnen Bausteine eines Bildschirms. Jeder bekommt seine Daten (b) und die Optionen (o).
const BAUSTEINE = {
  titel: (b) => el('p', { klasse: 'schirm-titel', text: b.text }),
  text: (b) => el('p', { klasse: 'schirm-text', text: b.text }),
  reiter: (b, o) => el('div', { klasse: 'schirm-reiter' }, b.eintraege.map((e) => stelle(e, o, 'schirm-reiter-eintrag', text(e)))),
  knoepfe: (b, o) => el('div', { klasse: 'schirm-knoepfe' }, b.eintraege.map((e) => stelle(e, o, 'schirm-knopf', text(e)))),
  menue: (b, o) => el('div', { klasse: 'schirm-menue' },
    b.titel ? el('p', { klasse: 'schirm-klein', text: b.titel }) : null,
    b.eintraege.map((e) => stelle(e, o, 'schirm-menue-eintrag', text(e), unter(e)))),
  liste: (b, o) => el('div', { klasse: 'schirm-liste' }, b.eintraege.map((e) => el('div', { klasse: 'schirm-zeile' },
    stelle(e.knopf ? { text: e.text } : e, o, 'schirm-zeile-text', el('strong', { text: e.text }), unter(e)),
    e.knopf ? stelle(e.knopf, o, 'schirm-knopf klein', text(e.knopf)) : null))),
  schalter: (b, o) => stelle(b, o, 'schirm-schalter', el('span', { klasse: 'schalter-text' }, el('span', { text: b.text }), unter(b)),
    el('span', { klasse: b.an ? 'schalter an' : 'schalter', 'aria-hidden': 'true' }),
    el('span', { klasse: 'nur-vorlesen', text: b.an ? ` (${o.t.schirmAn})` : ` (${o.t.schirmAus})` })),
  feld: (b, o) => stelle(b, o, 'schirm-feld', el('small', { text: b.text }), el('span', { klasse: 'feld-wert', text: b.wert ?? '' })),
  chat: (b) => el('div', { klasse: 'schirm-chat' }, b.nachrichten.map((n) => el('p', { klasse: `blase von-${n.von}`, text: n.text }))),
  eingabe: (b, o) => el('div', { klasse: 'schirm-eingabe-zeile' },
    (b.knoepfe ?? []).map((k) => stelle(k, o, 'schirm-knopf rund', text(k))),
    stelle(b, o, 'schirm-eingabe', text(b))),
  code: (b) => el('pre', { klasse: 'schirm-code', text: b.text }),
  dateien: (b, o) => el('div', { klasse: 'schirm-dateien' }, b.eintraege.map((e) => stelle(e, o, `schirm-datei ebene-${e.ebene ?? 0}`, text(e)))),
  frage: (b, o) => el('div', { klasse: 'schirm-frage' },
    el('p', { text: b.text }),
    b.code ? el('pre', { klasse: 'schirm-code', text: b.code }) : null,
    el('div', { klasse: 'schirm-knoepfe' }, b.knoepfe.map((e) => stelle(e, o, 'schirm-knopf', text(e))))),
  karten: (b, o) => el('div', { klasse: 'schirm-karten' }, b.eintraege.map((e) => el('div', { klasse: 'schirm-karte' },
    el('strong', { text: e.titel }),
    e.text ? el('small', { text: e.text }) : null,
    el('div', { klasse: 'schirm-knoepfe' }, (e.knoepfe ?? []).map((k) => stelle(k, o, 'schirm-knopf klein', text(k))))))),
  // Platz für die Zeilen einer Übung «Einstellen im Bild». Der Aufrufer liefert sie fertig gebaut.
  einstellungen: (b, o) => el('div', { klasse: 'schirm-einstellungen' }, o.einstellungen ?? []),
};

// Ausschnitt um eine Stelle (zum Beispiel für die kleinen Bilder beim Sortieren): nur das Fenster und der Teil,
// in dem die Stelle liegt. Aus der Seitenleiste nur die Stelle und ihre Nachbarn, aus der Kopfleiste nur die Stelle. So bleibt das Bild auch am Handy
// lesbar, und die gezeigte Stelle wird bei 320 px nicht abgeschnitten (Befund Barrierefreiheit 0.6).
function ausschnittVon(schirm, id) {
  const nur = { ...schirm, kopfleiste: [], seitenleiste: null, inhalt: [] };
  const kopf = (schirm.kopfleiste ?? []).findIndex((e) => e.id === id);
  if (kopf >= 0) return { ...nur, kopfleiste: [schirm.kopfleiste[kopf]] };
  const seite = schirm.seitenleiste ?? [];
  const stelle = seite.findIndex((e) => e.id === id);
  if (stelle >= 0) return { ...nur, inhalt: [{ art: 'menue', eintraege: seite.slice(Math.max(0, stelle - 2), stelle + 3) }] };
  const baustein = (schirm.inhalt ?? []).find((b) => b.id === id || JSON.stringify(b).includes(`"id":"${id}"`));
  return baustein ? { ...nur, inhalt: [baustein] } : schirm;
}

// Die Bausteinarten, die gezeichnet werden können (ein Test vergleicht sie mit SCHIRM_ARTEN der Logik).
export const BAUSTEIN_ARTEN = Object.keys(BAUSTEINE);

// Baut einen Bildschirm.
// optionen: beiTipp(id), markiert (id), markiertText, getroffen (id), aus (alles gesperrt),
//           einstellungen (fertige Zeilen), klein (Vorschau, zum Beispiel in der Bilderstrecke).
export function baueSchirm(schirm, t, optionen = {}) {
  if (optionen.ausschnitt) return baueSchirm(ausschnittVon(schirm, optionen.ausschnitt), t, { ...optionen, ausschnitt: null, eng: true });
  const o = { ...optionen, schirm, t, beiTipp: optionen.klein ? null : optionen.beiTipp ?? null };
  const kopf = el('div', { klasse: 'schirm-fenster' },
    el('span', { klasse: 'schirm-punkte', 'aria-hidden': 'true' }),
    el('span', { klasse: 'schirm-name', text: schirm.fenster ?? '' }),
    (schirm.kopfleiste ?? []).map((e) => stelle(e, o, 'schirm-kopf-eintrag', text(e))));
  const seite = schirm.seitenleiste
    ? el('div', { klasse: 'schirm-seite' }, schirm.seitenleiste.map((e) => stelle(e, o, 'schirm-seite-eintrag', text(e))))
    : null;
  const inhalt = el('div', { klasse: 'schirm-inhalt' }, (schirm.inhalt ?? []).map((b) => BAUSTEINE[b.art]?.(b, o) ?? null));
  const klassen = ['schirm'];
  if (seite) klassen.push('mit-seite');
  if (optionen.klein) klassen.push('klein');
  if (optionen.eng) klassen.push('ausschnitt');
  if (schirm.dunkel) klassen.push('dunkel');
  return el('figure', {
    klasse: klassen.join(' '),
    role: 'group',
    tabindex: '-1',
    'aria-label': fuelle(t.schirmLabel, { name: schirm.fenster ?? '' }),
  }, kopf, el('div', { klasse: 'schirm-koerper' }, seite, inhalt),
  // Jeder Bildschirm sagt, dass er ein Nachbau zum Üben ist (Entscheid des Kunden, E-052).
  // Im kleinen Ausschnitt (Sortieren) die kurze Form, damit der Hinweis auch dort sichtbar bleibt (Befund Recht).
  el('figcaption', {
    klasse: 'schirm-stand',
    text: optionen.eng ? t.schirmNachbauKurz : schirm.stand ? fuelle(t.schirmStand, { datum: schirm.stand }) : t.schirmNachbau,
  }));
}
