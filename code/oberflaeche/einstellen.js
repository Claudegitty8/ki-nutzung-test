// Die Übungsform «Einstellen im Bild»: In einem nachgezeichneten Bildschirm stellt der Spieler Schalter und Rechte ein,
// zum Beispiel welche Werkzeuge eines Konnektors Claude ohne Nachfrage benutzen darf.
// Jede Zeile hat genau eine gewählte Option. Bewertet wird mit den Prüfungen der Aufgabe (wie beim Zusammenstecken).
// Bietet dieselben Funktionen wie die Werkbank, damit der Rundenablauf alle Formen gleich behandelt.
import { el } from './bausteine.js';
import { baueSchirm } from './schirm.js';
import { loeseSchirm } from '../logik/schirme.js';

// nurBild: nur der eingestellte Bildschirm, ohne Frage und Hilfe (für die Anleitungen im Lexikon).
export function baueEinstellen({ aufgabe, t, schirme, vorgabe = [], auswahl = [], gesperrt = false, nurBild = false }) {
  let zu = gesperrt;
  let markiert = null;
  const fest = new Set(vorgabe);
  // Startzustand wie in der echten App, dann Vorgabe (Lücke) und frühere Auswahl darüber.
  const wahl = new Map(aufgabe.zeilen.map((zeile) => [zeile.id, zeile.start]));
  const zeileVon = (optionId) => aufgabe.zeilen.find((zeile) => zeile.optionen.some((o) => o.id === optionId));
  const setze = (ids) => { for (const id of ids) { const zeile = zeileVon(id); if (zeile) wahl.set(zeile.id, id); } };
  setze([...auswahl, ...vorgabe]);

  const buehne = el('div', { klasse: 'klick-buehne' });
  const meldung = el('p', { klasse: 'teil-hinweis', role: 'status' });
  const knoepfe = new Map();

  // Die Zeilen werden einmal gebaut. Beim Wählen ändern sich nur die Zustände, damit der Fokus bleibt.
  const zeilen = aufgabe.zeilen.map((zeile) => el('div', { klasse: 'einstell-zeile', role: 'group', 'aria-label': zeile.text },
    el('p', { klasse: 'einstell-name' }, el('strong', { text: zeile.text }), zeile.unter ? el('small', { text: zeile.unter }) : null),
    el('div', { klasse: 'einstell-optionen' }, zeile.optionen.map((option) => {
      const knopf = el('button', {
        type: 'button',
        klasse: 'einstell-option',
        'data-teil': option.id,
        onclick: () => {
          wahl.set(zeile.id, option.id);
          markiert = null;
          meldung.textContent = '';
          zeichne();
        },
      }, el('span', { text: option.text }));
      knoepfe.set(option.id, { knopf, zeile });
      return knopf;
    }))));

  function zeichne() {
    for (const [id, { knopf, zeile }] of knoepfe) {
      knopf.setAttribute('aria-pressed', String(wahl.get(zeile.id) === id));
      knopf.classList.toggle('markiert', id === markiert);
      knopf.disabled = zu || zeile.optionen.some((o) => fest.has(o.id));
    }
  }

  // Der Bildschirm bekommt einen Platz für die Zeilen. Fehlt er in den Daten, kommen sie ans Ende.
  // Fehlt der Bildschirm in den Daten, kein Absturz: dann nur die Zeilen (Befund Code-Prüfer).
  const schirm = loeseSchirm(schirme, aufgabe.schirm) ?? { inhalt: [] };
  const mitPlatz = schirm.inhalt?.some((b) => b.art === 'einstellungen')
    ? schirm
    : { ...schirm, inhalt: [...(schirm.inhalt ?? []), { art: 'einstellungen' }] };
  buehne.append(baueSchirm(mitPlatz, t, { einstellungen: zeilen }));

  const knoten = nurBild
    ? el('div', { klasse: 'einstellen' }, buehne)
    : el('section', { klasse: 'karte werkbank einstellen' },
      el('p', { klasse: 'etikett', text: t.einstellenEtikett }),
      el('p', { klasse: 'frage', text: aufgabe.frage }),
      el('p', { klasse: 'klein', text: t.einstellenHilfe }),
      buehne,
      meldung);

  zeichne();

  return {
    knoten,
    losText: t.einstellenPruefen,
    auswahl: () => [...wahl.values()],
    setze(ids) {
      setze(ids);
      markiert = null;
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
  };
}
