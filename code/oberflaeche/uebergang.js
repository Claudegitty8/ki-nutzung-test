// Übergang vom KI-Studio ins Agentenbüro (E-011, gestaltung/ABLAEUFE.md E): Geschichte, was du schon kannst,
// was neu kommt, Kiwi und Echo. Das Studio bleibt erreichbar; nichts geht verloren.
// Die Texte (uebergang…) sind für genau diesen Schritt geschrieben. Kommt einmal ein dritter Teil dazu,
// braucht er eigene Übergangstexte; die Figuren kommen schon jetzt aus teile.json.
import { el, knopf, figurBild } from './bausteine.js';
import { hatGespielt } from '../logik/gesamt.js';

export function zeigeUebergang(wurzel, app, nav, { ziel = 'buero' } = {}) {
  const g = app.gemeinsam;
  const herkunft = app.teil;
  const zielTeil = app.teile.find((teil) => teil.id === ziel);
  // Figuren tragen ihren eigenen Namen (Kiwi, Echo), damit Vorlesehilfen sagen, wer spricht (Befund Barrierefreiheit).
  const figurName = (teil) => g[`figur${teil.figur.charAt(0).toUpperCase()}${teil.figur.slice(1)}`];
  const schonDort = hatGespielt(app.gesamt, ziel);
  const los = () => knopf(schonDort ? g.uebergangWeiter : g.uebergangLos, () => app.wechsle(ziel), 'los');
  const abschnitt = (etikett, ...inhalt) => el('section', { klasse: 'karte' }, el('h2', { klasse: 'etikett', text: etikett }), ...inhalt);

  wurzel.append(
    el('nav', { klasse: 'leiste' }, knopf(g.uebergangZurueck, () => nav.zu('heim'), 'knopf-leise')),
    el('header', { klasse: 'kopf' }, el('h1', { text: g.uebergangTitel })),
    el('div', { klasse: 'uebergang-bild', 'aria-hidden': 'true' },
      el('span', { 'data-teil': herkunft.id }, figurBild('', true)),
      el('span', { klasse: 'uebergang-weg' }),
      el('span', { 'data-teil': ziel }, figurBild('', true))),
    el('section', { klasse: 'karte' }, ...g.uebergangGeschichte.map((satz) => el('p', { text: satz }))),
    el('div', { klasse: 'figur-zeile', 'data-teil': herkunft.id }, figurBild(figurName(herkunft), true), el('p', { klasse: 'sprechblase', text: g.uebergangKiwi })),
    el('div', { klasse: 'figur-zeile', 'data-teil': ziel }, figurBild(figurName(zielTeil), false), el('p', { klasse: 'sprechblase', text: g.uebergangEcho })),
    el('div', { 'data-teil': ziel }, los()),
    abschnitt(g.uebergangKannEtikett, el('ul', {}, Object.values(g.uebergangKann).map((text) => el('li', { text })))),
    abschnitt(g.uebergangNeuEtikett, el('p', { text: g.uebergangNeu })),
    abschnitt(g.uebergangUnterschiedEtikett,
      el('p', { text: g.uebergangUnterschiedKiwi }),
      el('p', { text: g.uebergangUnterschiedEcho })),
    el('div', { klasse: 'knopf-reihe', 'data-teil': ziel }, los(),
      el('span', { 'data-teil': herkunft.id }, knopf(g.uebergangBleiben, () => nav.zu('heim'), 'knopf-zweit'))),
    el('p', { klasse: 'klein', text: g.uebergangBleibenHinweis }),
  );
}
