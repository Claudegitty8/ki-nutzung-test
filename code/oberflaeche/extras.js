// Zusätze: Schnelltest, freiwillige Fragen, Daumen. Die Karten fürs Heim stehen in karten.js.
// Die Regeln dazu stehen in logik/extras.js.
import { el, fuelle, knopf, figurBild, leiste } from './bausteine.js';
import { baueUebung, istFrage } from './werkbank.js';
import {
  starteSchnelltest, laufenderSchnelltest, verbucheSchnelltest, verbucheUmfrage, verbucheDaumen,
} from '../logik/extras.js';

// --- Schnelltest: «Das kann ich schon» ---

export function zeigeSchnelltest(wurzel, app, nav, daten = {}) {
  const { texte, regeln } = app.inhalte;
  const t = texte.app;
  const auftrag = app.auftrag();
  if (!auftrag || app.stand.lauf) {
    nav.zu('heim');
    return;
  }
  const ergebnisse = daten.ergebnisse ?? [];
  wurzel.append(leiste(t, nav, t.schnelltestTitel));

  // Einstieg: erklären, was passiert.
  if (!daten.laeuft) {
    wurzel.append(
      el('section', { klasse: 'karte' },
        el('h2', { text: t.schnelltestKnopf }),
        el('p', { text: t.schnelltestInfo })),
      knopf(t.schnelltestStart, () => {
        // Jeder Start bringt andere Aufgaben als der letzte (E-048).
        app.setze(starteSchnelltest(app.stand, auftrag, regeln));
        nav.zu('schnelltest', { laeuft: true, ergebnisse: [] });
      }, 'los'));
    return;
  }
  const reihe = laufenderSchnelltest(app.stand, auftrag, regeln);

  // Schluss: gutschreiben und zeigen, was übersprungen wird.
  if (ergebnisse.length >= reihe.length) {
    const { stand, bestanden } = verbucheSchnelltest(app.stand, auftrag, regeln, ergebnisse);
    app.setze(stand);
    const konzepte = auftrag.runden.filter((runde) => runde.konzept).map((runde) => runde.konzept);
    wurzel.append(
      el('section', { klasse: 'karte' },
        el('h2', { text: t.schnelltestErgebnis }),
        el('ul', { klasse: 'ergebnis-liste' }, konzepte.map((konzept) => el('li', {},
          el('strong', { text: `${texte.konzepte[konzept].name} ` }),
          el('span', { text: bestanden.includes(konzept) ? t.schnelltestBestanden : t.schnelltestOffen }))))),
      knopf(t.zumHeim, () => nav.zu('heim'), 'los'));
    return;
  }

  const { konzept, aufgabe: aufgabeId } = reihe[ergebnisse.length];
  const aufgabe = auftrag.aufgaben[aufgabeId];
  const istWahl = istFrage(aufgabe);
  // Beim Durchklicken prüft ein Tipp selbst (falsch getippt oder am Ziel). Im Schnelltest zählt nur der erste Versuch.
  const werkbank = baueUebung({ aufgabe, t, schirme: app.inhalte.schirme, beiAbgabe: () => pruefe() });
  const figur = figurBild(t.figurName);
  const sprechblase = el('p', { klasse: 'sprechblase', text: t.figurBereit });
  const status = el('p', { klasse: 'status' });
  const aktionen = el('div', { klasse: 'aktionen' });

  let geprueft = false;
  async function pruefe() {
    if (geprueft) return;
    if (istWahl && werkbank.auswahl().length === 0) {
      status.textContent = t.waehleZuerst;
      return;
    }
    geprueft = true;
    let antwort;
    try {
      antwort = await app.ki.antworte({ aufgabe, auswahl: werkbank.auswahl(), versuch: 0 });
    } catch {
      // Ohne Internet und ohne abgelegte Datei: sagen, was los ist, und nochmals versuchen lassen (Befund Code-Prüfer).
      status.textContent = app.gemeinsam.ladeFehler;
      geprueft = false;
      return;
    }
    werkbank.sperre();
    pruefen.hidden = true;
    sprechblase.textContent = antwort.text;
    figur.classList.toggle('froh', antwort.ok);
    status.textContent = antwort.ok ? t.schnelltestRichtig : t.schnelltestFalsch;
    const neu = [...ergebnisse, { konzept, aufgabe: aufgabeId, richtig: antwort.ok }];
    aktionen.replaceChildren(knopf(t.weiter, () => nav.zu('schnelltest', { laeuft: true, ergebnisse: neu }), 'los'));
  }
  const pruefen = knopf(werkbank.losText ?? (istWahl ? t.antworten : t.los), pruefe, 'los');
  pruefen.hidden = Boolean(werkbank.selbstAbgabe);

  wurzel.append(
    el('p', { klasse: 'etikett', text: `${fuelle(t.schnelltestZaehler, { nr: ergebnisse.length + 1, anzahl: reihe.length })} · ${texte.konzepte[konzept].name}` }),
    el('section', { klasse: 'karte auftrag' },
      el('p', { klasse: 'etikett', text: auftrag.kunde }),
      el('p', { klasse: 'wunsch', text: `«${aufgabe.wunsch}»` })),
    werkbank.knoten,
    pruefen,
    el('section', { klasse: 'karte ergebnis', role: 'status' }, el('div', { klasse: 'figur-zeile' }, figur, sprechblase), status),
    aktionen);
}

// --- Freiwillige Fragen vor und nach dem Spiel ---

export function zeigeUmfrage(wurzel, app, nav, { wann, antworten = {} }) {
  const { texte, umfrage } = app.inhalte;
  const t = texte.app;
  const nr = Object.keys(antworten).length;
  wurzel.append(leiste(t, nav, wann === 'vorher' ? t.umfrageVorherTitel : t.umfrageNachherTitel));

  if (nr >= umfrage.length) {
    app.setze(verbucheUmfrage(app.stand, wann, antworten, umfrage));
    wurzel.append(
      el('section', { klasse: 'karte' }, el('p', { text: wann === 'vorher' ? t.umfrageDanke : umfrageText(t, app.stand) })),
      knopf(t.zumHeim, () => nav.zu('heim'), 'los'));
    return;
  }

  const frage = umfrage[nr];
  const waehle = (id) => nav.zu('umfrage', { wann, antworten: { ...antworten, [frage.id]: id } });
  wurzel.append(
    el('p', { klasse: 'etikett', text: fuelle(t.umfrageZaehler, { nr: nr + 1, anzahl: umfrage.length }) }),
    el('section', { klasse: 'karte' },
      el('h2', { text: frage.frage }),
      frage.optionen.map((option) => el('button', { type: 'button', klasse: 'baustein wahl', onclick: () => waehle(option.id) },
        el('span', { klasse: 'baustein-zeichen', 'aria-hidden': 'true' }), el('span', { text: option.text }))),
      knopf(t.umfrageWeissNicht, () => waehle('weissnicht'), 'knopf-zweit')));
}

// --- Daumen am Ende eines Auftrags ---

export function daumenKarte(app, auftrag) {
  const t = app.inhalte.texte.app;
  const dank = el('p', { klasse: 'klein', role: 'status' });
  const waehle = (hoch) => () => {
    app.setze(verbucheDaumen(app.stand, auftrag.id, hoch));
    reihe.hidden = true;
    dank.textContent = t.daumenDanke;
  };
  const reihe = el('div', { klasse: 'knopf-reihe' }, knopf(t.daumenHoch, waehle(true), 'knopf-zweit'), knopf(t.daumenRunter, waehle(false), 'knopf-zweit'));
  return el('section', { klasse: 'karte' }, el('p', { text: t.daumenFrage }), reihe, dank);
}
