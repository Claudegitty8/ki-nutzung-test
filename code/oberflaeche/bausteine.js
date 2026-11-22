// Kleine Helfer, aus denen alle Ansichten gebaut sind.

export function el(tag, eigenschaften = {}, ...kinder) {
  const knoten = document.createElement(tag);
  for (const [name, wert] of Object.entries(eigenschaften)) {
    if (wert == null || wert === false) continue;
    if (name === 'klasse') knoten.className = wert;
    else if (name === 'text') knoten.textContent = wert;
    else if (name.startsWith('on')) knoten.addEventListener(name.slice(2), wert);
    else knoten.setAttribute(name, wert === true ? '' : wert);
  }
  knoten.append(...kinder.flat().filter(Boolean));
  return knoten;
}

// Ersetzt Platzhalter wie {anzahl} in einem Text.
export function fuelle(text, werte) {
  return text.replace(/\{(\w+)\}/g, (_, name) => String(werte[name] ?? ''));
}

// Wie viele Spiel-Tokens ein Auftrag gespart hat (Heim und Zwischenbild).
export function gespartText(t, anzahl) {
  return anzahl > 0 ? fuelle(t.gespart, { anzahl }) : t.nichtGespart;
}

export function knopf(text, beiKlick, klasse = 'knopf') {
  return el('button', { type: 'button', klasse, text, onclick: beiKlick });
}

export function figurBild(name, froh = false) {
  // Wie die Figur aussieht (Kiwi oder Echo), bestimmt das Aussehen des Teils (data-teil am body).
  return el('div', { klasse: froh ? 'figur froh' : 'figur', role: 'img', 'aria-label': name },
    el('span', { klasse: 'auge' }), el('span', { klasse: 'auge' }));
}

// Meisterschaftsanzeige: gefüllte und leere Punkte, mit Text für Vorlesehilfen.
export function punkte(erfolge, noetig, beschriftung) {
  const reihe = el('span', { klasse: 'punkte', role: 'img', 'aria-label': fuelle(beschriftung, { erfolge, noetig }) });
  for (let i = 0; i < noetig; i += 1) {
    reihe.append(el('span', { klasse: i < erfolge ? 'punkt voll' : 'punkt' }));
  }
  return reihe;
}

export function leiste(t, nav, titel) {
  return el('nav', { klasse: 'leiste' },
    knopf(t.zurueck, () => nav.zu('heim'), 'knopf-leise'),
    // Der Titel ist die Hauptüberschrift der Seite (Befund Barrierefreiheit 1.3.1, 2.4.6).
    el('h1', { klasse: 'leiste-titel', text: titel }));
}

// Eine Rückfrage im Bildschirm statt eines Browser-Fensters (Befund Barrierefreiheit):
// benannte Gruppe für Vorlesehilfen, Fokus zuerst auf «Abbrechen» (das Harmlose), Escape bricht ab,
// danach geht der Fokus zurück zum Knopf, der die Rückfrage geöffnet hat.
let rueckfrageNummer = 0;
export function baueRueckfrage(abbrechenText) {
  rueckfrageNummer += 1;
  const textId = `rueckfrage-${rueckfrageNummer}`;
  const text = el('div', { id: textId });
  const reihe = el('div', { klasse: 'knopf-reihe' });
  let ausloeser = null;
  const knoten = el('div', {
    klasse: 'rueckfrage', role: 'group', 'aria-labelledby': textId, hidden: true,
    onkeydown: (ereignis) => { if (ereignis.key === 'Escape') schliesse(); },
  }, text, reihe);
  function schliesse() {
    knoten.hidden = true;
    ausloeser?.focus();
  }
  const abbrechen = knopf(abbrechenText, schliesse, 'knopf-zweit');
  return {
    knoten,
    schliesse,
    // saetze: Texte der Frage; knoepfe: die Handlungen (zum Beispiel «Ja, löschen»). Abbrechen kommt dazu.
    oeffne(saetze, knoepfe) {
      ausloeser = document.activeElement;
      text.replaceChildren(...saetze.map((satz, i) => el('p', { klasse: i > 0 ? 'klein' : null, text: satz })));
      reihe.replaceChildren(...knoepfe, abbrechen);
      knoten.hidden = false;
      abbrechen.focus();
    },
  };
}
