// Die Übungsform «Durchklicken»: Der Spieler tippt in nachgezeichneten Bildschirmen nacheinander die richtige Stelle.
// Ein falscher Tipp wird sofort geprüft (Echo erklärt, was passiert wäre). Danach darf man im selben Bild weitertippen.
// Bietet dieselben Funktionen wie die Werkbank, damit der Rundenablauf alle Formen gleich behandelt.
// Zusätzlich: selbstAbgabe (kein Knopf «Echo, los!» nötig) und beiAbgabe (meldet, wann geprüft werden soll).
import { el, fuelle } from './bausteine.js';
import { baueSchirm } from './schirm.js';
import { beschriftung, eintraegeVon, loeseSchirm, schrittText } from '../logik/schirme.js';
import { loesungVon } from '../logik/bewertung.js';

// Bilderstrecke: alle Schritte untereinander, die richtige Stelle jeweils hervorgehoben.
// Dient als Beispiel, als gezeigte Lösung und als Probefahrt im Einsatzschrank.
export function baueStrecke(aufgabe, schirme, t) {
  const schritte = aufgabe.schritte.map((schritt, index) => el('li', { klasse: 'strecke-schritt' },
    el('p', { klasse: 'strecke-text' },
      el('strong', { text: `${fuelle(t.streckeSchritt, { nr: index + 1 })} ` }),
      el('span', { text: schrittText(schritt, schirme) })),
    baueSchirm(loeseSchirm(schirme, schritt.schirm), t, { klein: true, markiert: schritt.ziel, markiertText: t.schirmHier })));
  const nachher = aufgabe.nachher ? loeseSchirm(schirme, aufgabe.nachher) : null;
  return el('ol', { klasse: 'strecke' }, schritte,
    nachher ? el('li', { klasse: 'strecke-schritt ende' },
      el('p', { klasse: 'strecke-text' }, el('strong', { text: t.streckeEnde })),
      baueSchirm(nachher, t, { klein: true })) : null);
}

export function baueKlick({ aufgabe, t, schirme, vorgabe = [], auswahl = [], gesperrt = false, beiAbgabe = null }) {
  const loesung = loesungVon(aufgabe);
  // Der bisher richtig getippte Weg. Eine Vorgabe (Lücke) ist der Anfang davon.
  const richtigerAnfang = (ids) => {
    const anfang = [];
    for (const [i, id] of ids.entries()) {
      if (id !== loesung[i]) break;
      anfang.push(id);
    }
    return anfang;
  };
  let pfad = richtigerAnfang([...vorgabe, ...auswahl.slice(vorgabe.length)]);
  let fehltipp = null; // gilt nur bis zur Prüfung
  let getroffen = null; // bleibt sichtbar, bis man wieder tippt
  let markiert = null;
  let zu = gesperrt;
  // Beispiel und gezeigte Lösung erscheinen als Bilderstrecke.
  let alsStrecke = gesperrt && pfad.length === loesung.length;

  const fortschritt = el('p', { klasse: 'klein klick-fortschritt' });
  const bisher = el('p', { klasse: 'klein klick-bisher' });
  // tabindex: Nach einem Tipp geht der Fokus auf den neuen Bildschirm statt an den Seitenanfang (Befund Barrierefreiheit).
  const buehne = el('div', { klasse: 'klick-buehne', tabindex: '-1' });
  const meldung = el('p', { klasse: 'teil-hinweis', role: 'status' });

  function tippe(id) {
    if (zu || (fehltipp && beiAbgabe)) return;
    markiert = null;
    getroffen = null;
    const schritt = aufgabe.schritte[pfad.length];
    if (id === schritt.ziel) {
      pfad = [...pfad, id];
      const fertig = pfad.length === loesung.length;
      meldung.textContent = fertig ? '' : fuelle(t.klickRichtig, { nr: pfad.length + 1, anzahl: loesung.length });
      zeichne(true);
      buehne.focus({ preventScroll: true });
      if (fertig) beiAbgabe?.();
      return;
    }
    fehltipp = id;
    getroffen = id;
    meldung.textContent = t.klickDaneben;
    zeichne();
    buehne.focus({ preventScroll: true });
    beiAbgabe?.();
  }

  function zeichne(neuesBild = false) {
    if (alsStrecke) {
      fortschritt.textContent = t.streckeHilfe;
      bisher.textContent = '';
      buehne.replaceChildren(baueStrecke(aufgabe, schirme, t));
      return;
    }
    const fertig = pfad.length === loesung.length;
    const schritt = aufgabe.schritte[Math.min(pfad.length, loesung.length - 1)];
    fortschritt.textContent = fertig
      ? t.klickGeschafft
      : fuelle(t.klickFortschritt, { nr: pfad.length + 1, anzahl: loesung.length });
    bisher.textContent = pfad.length > 0
      ? fuelle(t.klickBisher, { weg: pfad.map((id, i) => textVon(aufgabe.schritte[i], id)).join(' › ') })
      : '';
    // Nach dem letzten richtigen Tipp: das Bild danach (zum Beispiel «Skill ist eingeschaltet»), wenn es eines gibt.
    const schirm = fertig && aufgabe.nachher ? loeseSchirm(schirme, aufgabe.nachher) : loeseSchirm(schirme, schritt.schirm);
    const bild = baueSchirm(schirm, t, {
      beiTipp: fertig ? null : tippe,
      aus: zu,
      markiert,
      markiertText: t.schirmHier,
      getroffen,
    });
    buehne.replaceChildren(bild);
    // Der Fokus folgt dem neuen Bild, damit man mit Tastatur und Vorlesehilfe mitkommt.
    if (neuesBild) queueMicrotask(() => bild.focus({ preventScroll: true }));
  }

  // Der Text der getippten Stelle, für die Zeile «Bisher getippt».
  function textVon(schritt, id) {
    return beschriftung(eintraegeVon(loeseSchirm(schirme, schritt.schirm)).find((e) => e.id === id)?.text ?? id);
  }

  const knoten = el('section', { klasse: 'karte werkbank klick' },
    el('p', { klasse: 'etikett', text: t.klickEtikett }),
    el('p', { klasse: 'frage', text: aufgabe.frage }),
    fortschritt,
    bisher,
    buehne,
    meldung);

  zeichne();

  return {
    knoten,
    selbstAbgabe: true,
    losText: t.los, // nur im Beispiel zu sehen: Bilderstrecke lesen, dann «Echo, los!»
    auswahl: () => (fehltipp ? [...pfad, fehltipp] : [...pfad]),
    setze(ids) {
      pfad = richtigerAnfang(ids);
      fehltipp = null;
      getroffen = null;
      markiert = null;
      meldung.textContent = '';
      alsStrecke = pfad.length === loesung.length;
      zeichne();
    },
    sperre() {
      zu = true;
      zeichne();
    },
    markiere(id, text) {
      markiert = id;
      meldung.textContent = text;
      zeichne();
    },
    // Nach der Prüfung zählt der Fehltipp nicht mehr: Man tippt im selben Bild nochmals.
    nachTest() {
      fehltipp = null;
    },
  };
}
