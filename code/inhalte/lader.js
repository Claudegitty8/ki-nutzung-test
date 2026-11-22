// Lädt die Lerninhalte. Inhalte sind Daten (JSON), kein Programmcode.
// Geladen wird nur der Teil, der gespielt wird (E-013), und von seinen Aufträgen zuerst nur das Gerüst
// ohne Aufgaben (E-054). Die Aufgaben eines Auftrags kommen erst, wenn eine Ansicht sie braucht.
import { bereiteVor } from './aufbereiten.js';

const BASIS = new URL('../../inhalte/', import.meta.url);

async function ladeJson(pfad, signal) {
  const antwort = await fetch(new URL(pfad, BASIS), signal ? { signal } : undefined);
  if (!antwort.ok) throw new Error(`Inhalt fehlt: ${pfad}`);
  return antwort.json();
}

// Das Verzeichnis aller Teile (spiel/inhalte/teile.json).
export async function ladeTeile() {
  return (await ladeJson('teile.json')).teile;
}

export async function ladeInhalte(teil, sprache = 'de') {
  const o = teil.ordner;
  const zusatzNamen = Object.keys(teil.zusatz ?? {});
  const [regeln, lehrplan, einrichtung, texte, lexikon, umfrage, zusatzListe, geruest] = await Promise.all([
    ladeJson(`${o}regeln.json`),
    ladeJson(`${o}lehrplan.json`),
    ladeJson(`${o}einrichtung.json`),
    ladeJson(`${o}${sprache}/texte.json`),
    ladeJson(`${o}${sprache}/lexikon.json`),
    ladeJson(`${o}${sprache}/umfrage.json`),
    Promise.all(zusatzNamen.map((name) => ladeJson(`${o}${teil.zusatz[name]}`))),
    ladeJson(`${o}${sprache}/geruest.json`),
  ]);
  const zusatz = Object.fromEntries(zusatzNamen.map((name, i) => [name, zusatzListe[i]]));
  // Das Gerüst hat die Reihenfolge aus teile.json. Fehlt ein Auftrag darin, ist das Gerüst veraltet.
  const auftraege = teil.auftraege.map((id) => {
    const auftrag = geruest.auftraege.find((a) => a.id === id);
    if (!auftrag) throw new Error(`Auftrag fehlt im Gerüst: ${id}`);
    return { ...auftrag };
  });
  return bereiteVor(teil, { regeln, lehrplan, einrichtung, texte, lexikon, umfrage, auftraege, zusatz });
}

// Holt die Aufgaben der genannten Aufträge und hängt sie an den Auftrag im Gerüst an (Feld «aufgaben»).
// Jede Datei wird nur einmal geholt, auch wenn mehrere Ansichten gleichzeitig fragen. Scheitert das Holen
// (zum Beispiel ohne Internet) oder wird es abgebrochen, kann es später nochmals versucht werden.
export function erstelleNachlader(teil, auftraege, sprache = 'de') {
  const unterwegs = new Map(); // id → { versprechen, abbruch }
  const hole = (id) => {
    const auftrag = auftraege.find((a) => a.id === id);
    if (!auftrag || auftrag.aufgaben) return Promise.resolve();
    if (!unterwegs.has(id)) {
      const abbruch = typeof AbortController === 'function' ? new AbortController() : null;
      const eintrag = { abbruch };
      eintrag.versprechen = ladeJson(`${teil.ordner}${sprache}/auftraege/${id}.json`, abbruch?.signal)
        .then((voll) => { auftrag.aufgaben = voll.aufgaben ?? {}; })
        .finally(() => { if (unterwegs.get(id) === eintrag) unterwegs.delete(id); });
      unterwegs.set(id, eintrag);
    }
    return unterwegs.get(id).versprechen;
  };
  // Der Auszug (de/auszug.json): nur die Aufgaben für Lexikon und Schrank, im Feld «auszug» jedes Auftrags.
  let auszugUnterwegs = null; // { versprechen, abbruch }
  const ladeAuszug = () => {
    if (!auszugUnterwegs) {
      const abbruch = typeof AbortController === 'function' ? new AbortController() : null;
      const eintrag = { abbruch };
      eintrag.versprechen = ladeJson(`${teil.ordner}${sprache}/auszug.json`, abbruch?.signal)
        .then((datei) => {
          for (const auftrag of auftraege) auftrag.auszug = datei.auftraege?.[auftrag.id] ?? {};
        })
        .finally(() => { if (auszugUnterwegs === eintrag) auszugUnterwegs = null; });
      auszugUnterwegs = eintrag;
    }
    return auszugUnterwegs.versprechen;
  };
  const ohneAufgaben = (id) => auftraege.some((a) => a.id === id && !a.aufgaben);
  return {
    fehlen: (ids) => ids.filter(ohneAufgaben),
    lade: (ids) => Promise.all(ids.map(hole)),
    // Für Lexikon und Schrank reicht der Auszug, wenn die ganzen Aufgaben nicht schon da sind.
    fehltAuszug: (ids) => ids.some((id) => ohneAufgaben(id) && !auftraege.find((a) => a.id === id).auszug),
    ladeAuszug,
    // Bricht alle laufenden Anfragen ab (Abbrechen, Zeitlimit). Der nächste Versuch holt neu.
    brichAb() {
      for (const { abbruch } of unterwegs.values()) abbruch?.abort();
      unterwegs.clear();
      auszugUnterwegs?.abbruch?.abort();
      auszugUnterwegs = null;
    },
  };
}

// Texte, die zu keinem Teil gehören: Startbildschirm, Übernahme, Übergang, gemeinsame Einstellungen.
export async function ladeGemeinsam(sprache = 'de') {
  return ladeJson(`gemeinsam/${sprache}/texte.json`);
}

// Für das Erkennen einer Spielstand-Datei: die Konzept-Kennungen jedes Teils (klein, nur lehrplan.json).
export async function ladeTeilKennungen(teile) {
  return Promise.all(teile.map(async (teil) => ({
    id: teil.id,
    auftraege: teil.auftraege,
    konzepte: (await ladeJson(`${teil.ordner}lehrplan.json`)).konzepte.map((konzept) => konzept.id),
  })));
}
