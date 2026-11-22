// Einstieg: holt das Verzeichnis der Teile, den Gesamtstand, die Inhalte des gespielten Teils und die KI,
// und schaltet zwischen den Ansichten um.
import { ladeTeile, ladeInhalte, ladeGemeinsam, ladeTeilKennungen, erstelleNachlader } from './inhalte/lader.js';
import { erstelleSpeicher } from './speicher/speicher.js';
import { zeigeHeim } from './oberflaeche/heim.js';
import { zeigeTeilwahl } from './oberflaeche/teilwahl.js';
import { zeigeUebernahme } from './oberflaeche/uebernahme.js';
import { zeigeUebergang } from './oberflaeche/uebergang.js';
import { wendeSchriftAn } from './oberflaeche/schrift.js';
import { richteAbkuerzungenEin } from './oberflaeche/abkuerzungen.js';
import { pruefeLauf } from './logik/extras.js';
import { fachVon, mitFach, mitAktiv, hatGespielt } from './logik/gesamt.js';
import { offeneUebernahmen } from './logik/uebernahme.js';
import {
  aktuellerAuftrag, auftraegeFuerLauf, auftraegeFuerAnsicht, auftraegeVorab, NUR_AUSZUG,
} from './logik/nachladen.js';
import { el, knopf } from './oberflaeche/bausteine.js';

// Ansichten des ersten Bildschirms sind sofort da. Die übrigen (mit allen Übungsformen) holt das Spiel erst nach
// dem ersten Bildschirm im Hintergrund, damit der Start auf langsamem Netz schnell bleibt (E-055).
const SOFORT = {
  heim: zeigeHeim,
  teilwahl: zeigeTeilwahl,
  uebernahme: zeigeUebernahme,
  uebergang: zeigeUebergang,
};
const SPAETER_GELADEN = {
  runde: ['./oberflaeche/runde.js', 'zeigeRunde'],
  zwischen: ['./oberflaeche/runde.js', 'zeigeZwischen'],
  lexikon: ['./oberflaeche/lexikon.js', 'zeigeLexikon'],
  einstellungen: ['./oberflaeche/lexikon.js', 'zeigeEinstellungen'],
  schnelltest: ['./oberflaeche/extras.js', 'zeigeSchnelltest'],
  umfrage: ['./oberflaeche/extras.js', 'zeigeUmfrage'],
  schrank: ['./oberflaeche/schrank.js', 'zeigeSchrank'],
};
const ANSICHTEN = { ...SOFORT };
async function ladeAnsicht(name) {
  if (!ANSICHTEN[name]) {
    const [datei, funktion] = SPAETER_GELADEN[name];
    ANSICHTEN[name] = (await import(datei))[funktion];
  }
  return ANSICHTEN[name];
}
// Alle späteren Ansichten im Hintergrund holen. Scheitert das (ohne Internet), wird beim Öffnen nochmals versucht.
// Die simulierte KI gehört dazu, damit sie auch ohne Internet bereitliegt (Befund Code-Prüfer).
const ladeAlleAnsichten = () => Promise.all([...Object.keys(SPAETER_GELADEN).map(ladeAnsicht), import('./ki/schnittstelle.js')]);

// Die simulierte KI wird erst bei der ersten Antwort gebraucht und darum auch erst dann geladen.
function spaeteKi() {
  let ki = null;
  return {
    modus: 'simuliert',
    async antworte(anfrage) {
      if (!ki) ki = (await import('./ki/schnittstelle.js')).erstelleKi('simuliert');
      return ki.antworte(anfrage);
    },
  };
}

// Ohne Internet spielen: Ein kleiner Helfer im Browser (Service Worker) legt alle Dateien auf dem Gerät ab.
// Abgelegt werden die geladenen Dateien und die Inhalte ALLER Teile, damit auch der Wechsel ohne Internet geht.
// Jede Datei einzeln, nur was noch fehlt. Sofort nur die Grunddateien des gespielten Teils; alle Aufträge und
// die anderen Teile erst etwas später, damit der Start nicht gebremst wird (Befunde Performance und Code-Prüfer,
// E-054). Wo das nicht erlaubt ist, läuft das Spiel normal weiter.
const ABLAGE = 'ki-studio-neu-ablage-v2'; // gleich wie in sw.js
const SPAETER = 10_000;
// Dauert das Nachladen eines Auftrags länger, erscheint ein Hinweis «wird geladen».
const LADEHINWEIS_NACH = 300;
// Antwortet das Netz so lange nicht, gilt das Laden als gescheitert (Befund Barrierefreiheit: kein endloses Warten).
const LADEN_HOECHSTENS = 15_000;

const inhaltAdresse = (teil, datei) => new URL(`${teil.ordner}${datei}`, new URL('../inhalte/', import.meta.url)).href;

function grunddateienVon(teil) {
  return [
    'regeln.json', 'lehrplan.json', 'einrichtung.json', 'de/texte.json', 'de/lexikon.json', 'de/umfrage.json',
    'de/geruest.json', ...Object.values(teil.zusatz ?? {}),
  ].map((datei) => inhaltAdresse(teil, datei));
}

function dateienVon(teil) {
  return [
    ...grunddateienVon(teil),
    ...(teil.auszug ? [inhaltAdresse(teil, 'de/auszug.json')] : []),
    ...teil.auftraege.map((id) => inhaltAdresse(teil, `de/auftraege/${id}.json`)),
  ];
}

// ausZwischenspeicher: Dateien, die diese Seite gerade geladen hat, aus dem Zwischenspeicher des Browsers nehmen,
// statt sie nochmals übers Netz zu holen (Befund Performance: beim ersten Besuch kamen sonst rund 350 KB doppelt).
// Für alle übrigen nicht: Dort könnte eine alte Fassung von vor einem Update liegen (Befund Code-Prüfer).
async function legeAb(adressen, { ausZwischenspeicher = false } = {}) {
  const ablage = await caches.open(ABLAGE);
  await Promise.allSettled([...new Set(adressen)].map(async (adresse) => {
    if (await ablage.match(adresse)) return;
    const antwort = await fetch(adresse, ausZwischenspeicher ? { cache: 'force-cache' } : { cache: 'no-cache' });
    if (antwort.ok) await ablage.put(adresse, antwort);
  }));
}

// «spaeter»: die im Hintergrund geladenen Ansichten. Erst wenn sie da sind, wird die Liste der geladenen Dateien
// gelesen, damit auch sie sicher abgelegt werden (Befund Code-Prüfer).
async function richteOfflineEin(teile, gespielt, spaeter) {
  try {
    if (!('serviceWorker' in navigator) || !('caches' in globalThis)) return;
    await navigator.serviceWorker.register(new URL('../sw.js', import.meta.url));
    const geladen = () => performance.getEntriesByType('resource')
      .map((eintrag) => eintrag.name)
      .filter((adresse) => adresse.startsWith(location.origin));
    const jetzt = teile.filter((teil) => teil.id === gespielt);
    // Zuerst sofort die Seite und alles bisher Geladene, dann die Ansichten, die im Hintergrund kommen.
    await legeAb([location.href.split('#')[0], ...geladen(), ...jetzt.flatMap(grunddateienVon)], { ausZwischenspeicher: true });
    await spaeter.catch(() => {});
    // Die späten Programmteile stehen nicht sicher in der Liste der geladenen Dateien (Befund Tester: ohne
    // Internet fehlten sie manchmal). Darum alle Programmteile aus einer festen Liste.
    const { PROGRAMMTEILE } = await import('./programmteile.js');
    await legeAb(geladen(), { ausZwischenspeicher: true });
    await legeAb(PROGRAMMTEILE.map((datei) => new URL(`../${datei}`, import.meta.url).href));
    setTimeout(() => legeAb(teile.flatMap(dateienVon)).catch(() => {}), SPAETER);
  } catch {
    // Kein Offline-Betrieb auf diesem Gerät oder an diesem Ort. Das Spiel selbst ist davon nicht betroffen.
  }
}

async function start() {
  const wurzel = document.getElementById('app');
  try {
    const [teile, gemeinsam] = await Promise.all([ladeTeile(), ladeGemeinsam('de')]);
    const speicher = erstelleSpeicher(teile.map((teil) => teil.id));
    let gesamt = speicher.laden();
    // Ohne gewählten Teil (erster Start) zeigt der Startbildschirm beide Teile. Dafür braucht es keine Inhalte
    // eines Teils; sie werden erst nach der Wahl geladen (Befund Performance: spart rund 360 KB beim ersten Start).
    const teil = teile.find((t) => t.id === gesamt.aktiv) ?? null;
    const inhalte = teil ? await ladeInhalte(teil, 'de') : null;
    const nachlader = inhalte ? erstelleNachlader(teil, inhalte.auftraege, 'de') : null;
    if (teil) document.body.dataset.teil = teil.id;
    // Passt ein angefangener Auftrag nach einem Update nicht mehr zu den Inhalten, beginnt er neu (pruefeLauf).
    // Dafür braucht es seine Aufgaben. Geprüft wird darum vor der ersten Ansicht (bereite), ebenso nach dem
    // Laden einer Datei oder einer Übernahme (setzeGesamt). Das betrifft nur Spieler mitten in einem Auftrag;
    // sie haben die Datei meist schon auf dem Gerät.
    let ungeprueft = Boolean(teil && fachVon(gesamt, teil.id).lauf);
    const app = {
      teile,
      teil,
      gemeinsam: gemeinsam.app,
      inhalte,
      ki: spaeteKi(),
      get gesamt() { return gesamt; },
      stand: fachVon(gesamt, teil?.id ?? teile[0].id),
      // Jede Änderung am Spielstand wird sofort gespeichert, im Fach des gespielten Teils.
      setze(stand) {
        this.stand = stand;
        if (!teil) return; // Ohne gewählten Teil gibt es nichts zu speichern.
        gesamt = mitFach(gesamt, teil.id, stand);
        speicher.speichern(gesamt);
        // Kommt als Nächstes eine Wiederholung aus einem anderen Auftrag, schon jetzt im Hintergrund holen.
        nachlader.lade(auftraegeFuerLauf(stand)).catch(() => {});
      },
      // Den ganzen Gesamtstand ersetzen (zum Beispiel nach dem Laden einer Datei).
      // Geprüft wird der Lauf vor der nächsten Ansicht, sobald seine Aufgaben geladen sind (nav.zu).
      setzeGesamt(neu) {
        gesamt = neu;
        speicher.speichern(gesamt);
        if (teil) {
          this.stand = fachVon(gesamt, teil.id);
          ungeprueft = true;
        }
      },
      // In den anderen Teil wechseln: Der Stand bleibt in beiden Fächern. Neu laden, damit Inhalte, Farben
      // und Abkürzungen sauber zum Teil passen.
      // Vorher werden die Grunddateien des neuen Teils geholt (aus der Ablage oder dem Netz). Fehlen sie ohne
      // Internet, bleibt der bisherige Teil gewählt, und das Spiel sagt es (Befund Tester: sonst startete das
      // Spiel ohne Internet gar nicht mehr).
      async wechsle(teilId) {
        const neuerTeil = teile.find((t) => t.id === teilId);
        if (neuerTeil && neuerTeil.id !== teil?.id) {
          const nr = ++ansichtNr;
          const hinweis = setTimeout(() => zeigeLadehinweis(nr, 'wechsel'), LADEHINWEIS_NACH);
          try {
            await mitZeitlimit(Promise.all(grunddateienVon(neuerTeil).map(async (adresse) => {
              if (!(await fetch(adresse)).ok) throw new Error(`Inhalt fehlt: ${adresse}`);
            })));
          } catch {
            clearTimeout(hinweis);
            if (nr === ansichtNr) {
              tasteWeg();
              zeigeLadefehler('wechsel', null, () => app.wechsle(teilId));
            }
            return;
          }
          clearTimeout(hinweis);
          tasteWeg();
          if (nr !== ansichtNr) return; // Inzwischen abgebrochen.
        }
        gesamt = mitAktiv(gesamt, teilId);
        speicher.speichern(gesamt);
        location.reload();
      },
      // Neu beginnen, zum Beispiel nach «Alles löschen»: Startbildschirm und Fragen kommen wieder.
      neuStarten() {
        location.reload();
      },
      // Kennungen aller Teile, um eine Spielstand-Datei einem Teil zuzuordnen (REGELN.md R-3).
      ladeKennungen: () => ladeTeilKennungen(teile),
      // Einen Stand setzen, dessen Lauf erst vor der nächsten Ansicht geprüft wird, wenn seine Aufgaben da sind
      // (zum Beispiel «Sprung rückgängig»). So geht ein angefangener Auftrag nicht verloren (Befund Code-Prüfer).
      setzeUngeprueft(stand) {
        this.setze(stand);
        if (teil) ungeprueft = true;
      },
      // Holt die Aufgaben der genannten Aufträge, falls sie noch fehlen (E-054).
      ladeAufgaben: (ids) => (nachlader ? nachlader.lade(ids) : Promise.resolve()),
      // Der laufende Auftrag, sonst der nächste offene. Sind alle erledigt: null.
      auftrag() {
        return inhalte ? aktuellerAuftrag(this.stand, inhalte.auftraege) : null;
      },
      // Der Speicher, wie ihn die Ansichten kennen: immer für den gespielten Teil.
      speicher: {
        dauerhaft: speicher.dauerhaft,
        loeschen() {
          gesamt = speicher.loeschen();
          return fachVon(gesamt, teil?.id ?? teile[0].id);
        },
        merkeVorSprung: (stand) => speicher.merkeVorSprung(teil.id, stand),
        vorSprung: () => speicher.vorSprung(teil.id),
        // Ohne Angabe der gespielte Teil; beim Laden einer Datei auch ein anderer.
        vergissVorSprung: (teilId = teil?.id) => speicher.vergissVorSprung(teilId),
        liesAlt: (schluessel) => speicher.liesAlt(schluessel),
      },
    };
    // Abkürzungen werden überall antippbar und beim ersten Mal ausgeschrieben (nur im Teil mit Abkürzungsliste).
    const abkuerzungen = inhalte?.abkuerzungen ? richteAbkuerzungenEin(wurzel, app) : { neuGezeichnet() {} };
    // Vor jeder Ansicht: fehlende Aufgaben holen und einen ungeprüften Lauf prüfen. Kommt in der Zwischenzeit
    // schon die nächste Ansicht (Doppelklick), gilt nur die letzte.
    let ansichtNr = 0;
    async function bereite(name) {
      await ladeAnsicht(name);
      if (!nachlader) return;
      // Geprüft wird nur vor Ansichten mit Aufgaben. Die übrigen prüfen im Hintergrund (pruefeImHintergrund).
      if (ungeprueft && !NUR_AUSZUG.includes(name) && auftraegeFuerAnsicht(name, app.stand, inhalte.auftraege).length > 0) {
        await nachlader.lade(auftraegeFuerLauf(app.stand));
        const geprueft = pruefeLauf(app.stand, inhalte.auftraege);
        // Passt der Lauf nicht mehr, wird das auch gespeichert, damit «Stand sichern» denselben Stand sichert
        // (Befund Code-Prüfer).
        if (geprueft !== app.stand) app.setze(geprueft);
        ungeprueft = false;
      }
      const ids = auftraegeFuerAnsicht(name, app.stand, inhalte.auftraege);
      if (NUR_AUSZUG.includes(name)) {
        if (nachlader.fehltAuszug(ids)) await nachlader.ladeAuszug();
      } else {
        await nachlader.lade(ids);
      }
    }
    // Ansagen für Vorlesehilfen: ein fester Bereich ausserhalb der Ansicht, nur sein Text ändert sich
    // (Befund Barrierefreiheit, WCAG 4.1.3).
    const ansage = document.getElementById('ansage');
    const sage = (text) => { if (ansage) ansage.textContent = text; };
    // Wohin «Abbrechen» und der Zurück-Knopf führen: ins Heim des Teils, ohne Teil zur Teilwahl.
    const ziel = teil ? 'heim' : 'teilwahl';
    const zielText = () => (inhalte ? inhalte.texte.app.zumHeim : gemeinsam.app.zurueckZuStart);
    let fehlversuche = 0;
    // nochmals: was «Nochmals versuchen» tut (sonst dieselbe Ansicht nochmals öffnen).
    function zeigeLadefehler(name, daten, nochmals = () => nav.zu(name, daten)) {
      const g = gemeinsam.app;
      fehlversuche += 1;
      const titel = el('h1', { text: g.ladeFehlerTitel, tabindex: '-1' });
      wurzel.replaceChildren(el('section', { klasse: 'karte' },
        titel,
        el('p', { role: 'alert', text: fehlversuche > 1 ? `${g.ladeFehlerWieder} ${g.ladeFehler}` : g.ladeFehler }),
        el('div', { klasse: 'aktionen' },
          knopf(g.ladeNochmals, nochmals, 'los'),
          name === ziel ? null : knopf(zielText(), () => nav.zu(ziel), 'knopf-zweit'))));
      document.title = `${g.ladeFehlerTitel} · ${g.startTitel}`;
      sage('');
      titel.focus({ preventScroll: true });
    }
    // Die Escape-Taste des Ladehinweises gilt nur, solange er zu sehen ist (Befund Code-Prüfer: sonst sprang Escape
    // später in der Runde oder in einer Rückfrage ins Heim).
    let tasteWeg = () => {};
    function zeigeLadehinweis(nr, name) {
      if (nr !== ansichtNr) return;
      const g = gemeinsam.app;
      // Den Fokus zuerst sicher ablegen, damit er nicht mit dem angetippten Knopf verschwindet (WCAG 2.4.3).
      wurzel.focus({ preventScroll: true });
      const abbrechen = () => {
        nachlader?.brichAb();
        nav.zu(ziel, undefined, { ohneWarten: true });
      };
      wurzel.replaceChildren(el('div', { klasse: 'laden-hinweis' },
        el('p', { klasse: 'laden', text: g.ladeLaeuft }),
        name === ziel ? null : knopf(g.ladeAbbrechen, abbrechen, 'knopf-zweit')));
      sage(g.ladeLaeuft);
      tasteWeg();
      const beiTaste = (ereignis) => {
        if (ereignis.key === 'Escape' && name !== ziel && nr === ansichtNr) abbrechen();
      };
      document.addEventListener('keydown', beiTaste);
      tasteWeg = () => {
        document.removeEventListener('keydown', beiTaste);
        tasteWeg = () => {};
      };
    }
    const mitZeitlimit = (versprechen) => Promise.race([versprechen, new Promise((_, nein) => {
      setTimeout(() => nein(new Error('Zeitlimit')), LADEN_HOECHSTENS);
    })]);
    const nav = {
      // optionen.ohneWarten: nach «Abbrechen» das Heim sofort zeigen, auch wenn der Lauf noch ungeprüft ist.
      async zu(name, daten, optionen = {}) {
        const nr = ++ansichtNr;
        tasteWeg();
        // Eine Ansicht ohne Aufgaben (Heim, Teilwahl …) wartet nie auf die Prüfung des Laufs; die läuft dann im
        // Hintergrund (Befund Tester: bei hängendem Netz kam das Heim sonst nie).
        const noetig = nachlader ? auftraegeFuerAnsicht(name, app.stand, inhalte.auftraege) : [];
        const aufgabenFehlen = NUR_AUSZUG.includes(name) ? nachlader?.fehltAuszug(noetig) : nachlader?.fehlen(noetig).length > 0;
        const fehlt = !ANSICHTEN[name] || (!optionen.ohneWarten
          && nachlader && (aufgabenFehlen || (ungeprueft && !NUR_AUSZUG.includes(name) && noetig.length > 0)));
        if (fehlt) {
          const hinweis = setTimeout(() => zeigeLadehinweis(nr, name), LADEHINWEIS_NACH);
          try {
            await mitZeitlimit(bereite(name));
          } catch {
            clearTimeout(hinweis);
            if (nr === ansichtNr) tasteWeg();
            if (nr === ansichtNr) {
              // Hängt eine Anfrage noch (Zeitlimit), wird sie beendet, damit «Nochmals versuchen» neu holt.
              nachlader?.brichAb();
              zeigeLadefehler(name, daten);
            }
            return;
          }
          clearTimeout(hinweis);
          if (nr !== ansichtNr) return;
          tasteWeg();
        }
        fehlversuche = 0;
        // Eine alte Ansage («Wird geladen …», auch nach Abbrechen) gilt nicht mehr (Befund Barrierefreiheit 0.6).
        sage('');
        abkuerzungen.neuGezeichnet();
        wurzel.replaceChildren();
        ANSICHTEN[name](wurzel, app, nav, daten);
        // Der Seitentitel nennt die Ansicht, damit Vorlesehilfen und Tabs zeigen, wo man ist (Befund Barrierefreiheit).
        const titel = wurzel.querySelector('h1')?.textContent;
        document.title = titel && titel !== gemeinsam.app.startTitel ? `${titel} · ${gemeinsam.app.startTitel}` : gemeinsam.app.startTitel;
        window.scrollTo(0, 0);
        wurzel.focus({ preventScroll: true });
        // Nach «Abbrechen» nicht gleich wieder holen: Die Anfragen hingen eben noch, und der nächste Versuch würde auf
        // sie warten (Befund Tester, Nachprüfung 0.6). Geprüft wird dann vor der nächsten Ansicht mit Aufgaben.
        if (ungeprueft && nachlader && !optionen.ohneWarten) pruefeImHintergrund(nr, name, daten);
      },
    };
    // Prüft einen ungeprüften Lauf, ohne die Ansicht warten zu lassen. Ändert sich dabei etwas und ist die Ansicht
    // noch zu sehen, wird sie neu gezeichnet. Scheitert es (ohne Internet), wird vor der Runde nochmals geprüft.
    // Hat sich der Stand inzwischen geändert (Datei geladen, Sprung), wird nichts entschieden; geprüft wird dann
    // vor der nächsten Ansicht mit Aufgaben (Befund Code-Prüfer: sonst konnte ein neuer Lauf verloren gehen).
    // Neu gezeichnet wird nur das Heim, damit offene Rückfragen anderer Ansichten bleiben.
    function pruefeImHintergrund(nr, name, daten) {
      const stand = app.stand;
      nachlader.lade(auftraegeFuerLauf(stand)).then(() => {
        if (!ungeprueft || app.stand !== stand) return;
        const geprueft = pruefeLauf(stand, inhalte.auftraege);
        ungeprueft = false;
        if (geprueft === stand) return;
        app.setze(geprueft);
        if (nr === ansichtNr && name === 'heim') nav.zu(name, daten);
      }).catch(() => {});
    }
    wendeSchriftAn(app.stand.einstellungen.schrift);
    // Alte Spielstände auf diesem Gerät? Zuerst fragen (E-008, REGELN.md R-2). Gelesen wird ein alter Stand nur,
    // solange für seinen Teil noch eine Frage offen sein kann (Befund Datenschutz: nicht mehr lesen als nötig).
    const fragenOffen = (t) => t.alterSchluessel && !gesamt.uebernahme?.[t.id] && !hatGespielt(gesamt, t.id);
    const alte = Object.fromEntries(teile.map((t) => [t.id, fragenOffen(t) ? speicher.liesAlt(t.alterSchluessel) : null]));
    const offene = offeneUebernahmen(gesamt, teile, alte);
    // Wiederkehrender Start: direkt ins Heim des zuletzt gespielten Teils (E-019).
    if (offene.length > 0) nav.zu('uebernahme', { offene });
    else nav.zu(gesamt.aktiv ? 'heim' : 'teilwahl');
    // Den nächsten Auftrag schon holen, solange der Spieler das Heim ansieht. Scheitert das, wird beim Öffnen
    // nochmals versucht.
    // Zuerst, was «Los» braucht (Runde, KI, der nächste Auftrag), danach die übrigen Ansichten. So konkurriert das
    // erste Tippen auf langsamem Netz nicht mit Lexikon und Schrank (Befund Performance).
    const zuerst = Promise.all([
      nachlader ? nachlader.lade(auftraegeVorab(app.stand, inhalte.auftraege)) : null,
      teil ? ladeAnsicht('runde') : null,
      teil ? import('./ki/schnittstelle.js') : null,
    ]);
    const spaeter = zuerst.catch(() => {}).then(ladeAlleAnsichten);
    spaeter.catch(() => {});
    richteOfflineEin(teile, teil?.id, spaeter);
  } catch (fehler) {
    wurzel.replaceChildren();
    const meldung = document.createElement('p');
    meldung.className = 'fehler';
    // Fester Text als Rückfall: Wenn das Spiel nicht startet, sind vielleicht auch die Textdateien nicht da.
    meldung.textContent = `Das Spiel konnte nicht starten: ${fehler.message}`;
    // Ein Weg weiter, zum Beispiel sobald wieder Internet da ist (Befund Tester).
    const nochmals = document.createElement('button');
    nochmals.type = 'button';
    nochmals.className = 'los';
    nochmals.textContent = 'Nochmals versuchen';
    nochmals.addEventListener('click', () => location.reload());
    wurzel.append(meldung, nochmals);
  }
}

start();
