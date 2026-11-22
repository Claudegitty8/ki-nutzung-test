// Die Werkbank: Hier steckt der Spieler seinen Prompt aus Textteilen zusammen.
// Sie kennt keine Spielregeln. Sie zeigt nur an und meldet die Auswahl.
import { el, fuelle } from './bausteine.js';
import { baueWahl } from './wahl.js';
import { baueReihe } from './reihe.js';
import { baueZuordnen } from './zuordnen.js';
import { baueSchleife } from './schleife.js';
import { baueKlick } from './klick.js';
import { baueEinstellen } from './einstellen.js';
import { ARTEN, bauePrompt, baueSystemPrompt, hatSystemPrompt, hatZettel, zaehleTokens } from '../logik/prompt.js';

// Wählt zur Aufgabe die passende Übungsform: Zusammenstecken, Vorhersagen, Sortieren, Durchklicken oder Einstellen.
export function baueUebung(optionen) {
  const { typ } = optionen.aufgabe;
  if (typ === 'wahl') return baueWahl(optionen);
  if (typ === 'reihe') return baueReihe(optionen);
  if (typ === 'zuordnen') return baueZuordnen(optionen);
  if (typ === 'schleife') return baueSchleife(optionen);
  if (typ === 'klick') return baueKlick(optionen);
  if (typ === 'einstellen') return baueEinstellen(optionen);
  return baueWerkbank(optionen);
}

// Nur beim Zusammenstecken entsteht ein Prompt. Alle anderen Formen sind Fragen.
export function istFrage(aufgabe) {
  return Boolean(aufgabe.typ);
}

export function baueWerkbank({ aufgabe, t, sichtbar = null, vorgabe = [], auswahl = [], gesperrt = false, zeigeTokens = false }) {
  const gewaehlt = new Set([...vorgabe, ...auswahl]);
  const fest = new Set(vorgabe);
  const knoepfe = new Map();
  let allesGesperrt = gesperrt;

  const mitSystem = hatSystemPrompt(aufgabe);
  const mitZettel = hatZettel(aufgabe);
  const systemVorschau = el('p', { klasse: 'prompt system' });
  const vorschau = el('p', { klasse: 'prompt' });
  const hinweisZumTeil = el('p', { klasse: 'teil-hinweis', role: 'status' });

  // Token-Zähler und Echos Einsatzkoffer (Kontext). Beides erscheint nur bei Aufgaben mit Budget oder Koffer (fenster).
  const zaehler = el('p', { klasse: 'token-zeile', role: 'status' });
  const tischFuellung = el('span', { klasse: 'tisch-fuellung' });
  const tischText = el('p', { klasse: 'klein', role: 'status' });
  const tisch = aufgabe.fenster
    ? el('div', { klasse: 'tisch' }, el('p', { klasse: 'etikett', text: t.tischEtikett }), el('span', { klasse: 'tisch-bahn' }, tischFuellung), tischText)
    : null;

  function zeichneTokens() {
    const tokens = zaehleTokens(aufgabe, [...gewaehlt]);
    zaehler.textContent = aufgabe.budget
      ? fuelle(t.tokenZeileBudget, { anzahl: tokens, budget: aufgabe.budget })
      : fuelle(t.tokenZeile, { anzahl: tokens });
    zaehler.classList.toggle('zuviel', Boolean(aufgabe.budget) && tokens > aufgabe.budget);
    if (!tisch) return;
    const zustand = tokens > aufgabe.fenster ? 'voll' : tokens > (aufgabe.eng ?? aufgabe.fenster) ? 'eng' : 'frei';
    tisch.dataset.zustand = zustand;
    tischFuellung.className = `tisch-fuellung fuell-${Math.min(10, Math.ceil((tokens / aufgabe.fenster) * 10))}`;
    tischText.textContent = fuelle(t.tisch[zustand], { anzahl: tokens, platz: aufgabe.fenster });
  }

  function zeichne() {
    zeichneTokens();
    vorschau.textContent = bauePrompt(aufgabe, [...gewaehlt], t.beispielVorsatz);
    systemVorschau.textContent = baueSystemPrompt(aufgabe, [...gewaehlt]) || (mitZettel ? t.zettelLeer : t.systemLeer);
    for (const [id, knoten] of knoepfe) {
      knoten.setAttribute('aria-pressed', String(gewaehlt.has(id)));
      knoten.disabled = allesGesperrt || fest.has(id);
    }
  }

  const teile = aufgabe.teile.filter((teil) => !sichtbar || sichtbar.includes(teil.id) || fest.has(teil.id));
  const gruppen = ARTEN.map((art) => {
    const derArt = teile.filter((teil) => teil.art === art);
    if (derArt.length === 0) return null;
    // Eine Aufgabe kann ihre Gruppen selbst benennen (artNamen), zum Beispiel beim Deckblatt eines Skills.
    const gruppenName = aufgabe.artNamen?.[art] ?? t.art[art];
    // role=group mit Namen: Vorlesehilfen sagen dazu, in welche Gruppe ein Teil gehört.
    // Das zählt, wenn derselbe Satz in zwei Gruppen steht (zum Beispiel Fallakte oder Funkspruch).
    return el('div', { klasse: 'teil-gruppe', role: 'group', 'aria-label': gruppenName },
      el('p', { klasse: 'etikett', text: gruppenName, 'aria-hidden': 'true' }),
      derArt.map((teil) => {
        const knoten = el('button', {
          type: 'button',
          klasse: 'baustein',
          'data-teil': teil.id,
          onclick: () => {
            if (gewaehlt.has(teil.id)) gewaehlt.delete(teil.id);
            else gewaehlt.add(teil.id);
            knoten.classList.remove('markiert');
            hinweisZumTeil.textContent = '';
            zeichne();
          },
        }, el('span', { klasse: 'baustein-zeichen', 'aria-hidden': 'true', text: '+' }),
          teil.ampel ? el('span', { klasse: `ampel ampel-${teil.ampel}`, 'aria-hidden': 'true' }) : null,
          el('span', { text: teil.text }));
        knoepfe.set(teil.id, knoten);
        return knoten;
      }));
  });

  const knoten = el('section', { klasse: 'karte werkbank' },
    mitSystem ? el('p', { klasse: 'etikett', text: mitZettel ? t.zettelEtikett : t.systemEtikett }) : null,
    mitSystem ? systemVorschau : null,
    el('p', { klasse: 'etikett', text: aufgabe.nachrichtVon ?? t.promptEtikett }),
    vorschau,
    teile.length > 0 && !gesperrt ? el('p', { klasse: 'klein', text: t.teileHilfe }) : null,
    gruppen,
    zeigeTokens || aufgabe.budget || tisch ? zaehler : null,
    tisch,
    hinweisZumTeil);

  zeichne();

  return {
    knoten,
    auswahl: () => aufgabe.teile.filter((teil) => gewaehlt.has(teil.id)).map((teil) => teil.id),
    setze(ids) {
      gewaehlt.clear();
      for (const id of ids) gewaehlt.add(id);
      zeichne();
    },
    sperre() {
      allesGesperrt = true;
      zeichne();
    },
    markiere(id, text) {
      for (const k of knoepfe.values()) k.classList.remove('markiert');
      knoepfe.get(id)?.classList.add('markiert');
      hinweisZumTeil.textContent = text;
    },
  };
}
