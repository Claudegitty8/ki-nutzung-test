import { zaehleTokens } from './prompt.js';

// Bewertet eine gebaute Lösung anhand der Prüfungen einer Aufgabe.
// Reine Logik ohne Oberfläche, damit sie automatisch testbar ist.
//
// Eine Prüfung trifft zu, wenn
//   gewaehlt:   mindestens eines dieser Teile angesteckt ist (z. B. ein vages Teil),
//   fehlt:      mindestens eines dieser Teile nicht angesteckt ist,
//   aus + hoechstens: höchstens so viele Teile aus der Liste angesteckt sind,
//   tokensUeber: der Prompt mehr Spiel-Tokens hat als die Zahl.
// Die erste zutreffende Prüfung bestimmt das Fehlbild. Trifft keine zu, ist die Lösung gut.

function trifftZu(wenn, gewaehlt, aufgabe) {
  // tokensUeber: Der gebaute Prompt ist grösser als erlaubt (Budget oder Kontextfenster).
  if (Number.isInteger(wenn.tokensUeber)) return zaehleTokens(aufgabe, [...gewaehlt]) > wenn.tokensUeber;
  if (wenn.gewaehlt?.some((id) => gewaehlt.has(id))) return true;
  if (wenn.fehlt?.some((id) => !gewaehlt.has(id))) return true;
  if (wenn.aus && Number.isInteger(wenn.hoechstens)) {
    return wenn.aus.filter((id) => gewaehlt.has(id)).length <= wenn.hoechstens;
  }
  return false;
}

// Übungsform «Vorhersagen»: genau eine Antwort ist richtig.
function bewerteWahl(aufgabe, auswahl) {
  const option = aufgabe.optionen.find((o) => o.id === auswahl[0]) ?? null;
  return { ok: Boolean(option?.richtig), fehlbild: option?.richtig ? null : option?.id ?? 'leer', pruefung: null, option };
}

// Übungsform «Sortieren»: Die Schritte müssen genau in der richtigen Reihenfolge stehen.
function bewerteReihe(aufgabe, auswahl) {
  const ok = auswahl.length === aufgabe.loesung.length && aufgabe.loesung.every((id, stelle) => auswahl[stelle] === id);
  return { ok, fehlbild: ok ? null : 'daneben', pruefung: null };
}

// Auswahl bei «Verbinden» und «Schleife»: Paare in der Form «teil=ziel» bzw. «station=antwort».
export function paare(auswahl = []) {
  return new Map(auswahl.map((eintrag) => eintrag.split('=')).filter((paar) => paar.length === 2));
}

// Übungsform «Verbinden»: Jedes Teil muss beim richtigen Ziel stecken. Das erste falsche bestimmt die Folge.
function bewerteZuordnen(aufgabe, auswahl) {
  const gesteckt = paare(auswahl);
  const falsch = aufgabe.teile.find((teil) => gesteckt.get(teil.id) !== teil.ziel) ?? null;
  return { ok: !falsch, fehlbild: falsch?.id ?? null, pruefung: null, teil: falsch, ziel: falsch ? gesteckt.get(falsch.id) ?? null : null };
}

// Übungsform «Schleife steuern»: Kiwi läuft die Stationen der Reihe nach ab und stolpert an der ersten falschen Wahl.
function bewerteSchleife(aufgabe, auswahl) {
  const gewaehlt = paare(auswahl);
  for (const station of aufgabe.stationen) {
    const option = station.optionen.find((o) => o.id === gewaehlt.get(station.id)) ?? null;
    if (!option?.richtig) return { ok: false, fehlbild: station.id, pruefung: null, station, option };
  }
  return { ok: true, fehlbild: null, pruefung: null };
}

// Übungsform «Durchklicken»: Der Spieler tippt in gezeichneten Bildschirmen nacheinander die richtigen Stellen.
// auswahl = die getippten Stellen in Reihenfolge. Richtig ist nur der ganze Weg ohne Fehltipp.
// Beim ersten falschen Tipp bestimmt der Schritt das Fehlbild: zuerst «falsch» für genau diese Stelle, sonst «sonst».
function bewerteKlick(aufgabe, auswahl) {
  const loesung = loesungVon(aufgabe);
  const stelle = loesung.findIndex((id, index) => auswahl[index] !== id);
  if (stelle < 0) {
    if (auswahl.length === loesung.length) return { ok: true, fehlbild: null, pruefung: null };
    // Mehr Tipps als Schritte: Das Spiel lässt das nicht zu. Falls doch, zählt es als Fehltipp im letzten Schritt.
    return { ok: false, fehlbild: aufgabe.schritte.at(-1).sonst, pruefung: null, stelle: loesung.length - 1 };
  }
  const schritt = aufgabe.schritte[stelle];
  // Noch nicht fertig getippt (zum Beispiel zu früh abgegeben): gilt wie ein Fehltipp in diesem Schritt.
  const getippt = auswahl[stelle];
  return { ok: false, fehlbild: schritt.falsch?.[getippt] ?? schritt.sonst, pruefung: null, stelle };
}

// Die richtige Auswahl einer Aufgabe. Beim Durchklicken steht sie nur einmal in den Daten: als Ziel jedes Schritts.
export function loesungVon(aufgabe) {
  return aufgabe.typ === 'klick' ? aufgabe.schritte.map((schritt) => schritt.ziel) : aufgabe.loesung;
}

export function bewerte(aufgabe, auswahl = []) {
  if (aufgabe.typ === 'wahl') return bewerteWahl(aufgabe, auswahl);
  if (aufgabe.typ === 'reihe') return bewerteReihe(aufgabe, auswahl);
  if (aufgabe.typ === 'zuordnen') return bewerteZuordnen(aufgabe, auswahl);
  if (aufgabe.typ === 'schleife') return bewerteSchleife(aufgabe, auswahl);
  if (aufgabe.typ === 'klick') return bewerteKlick(aufgabe, auswahl);
  // «Einstellen im Bild» (typ einstellen) wird wie Zusammenstecken mit Prüfungen bewertet.
  const gewaehlt = new Set(auswahl);
  const treffer = aufgabe.pruefungen.find((pruefung) => trifftZu(pruefung.wenn, gewaehlt, aufgabe)) ?? null;
  return { ok: !treffer, fehlbild: treffer?.fehlbild ?? null, pruefung: treffer };
}

// Für Hilfestufe 2: auf welches Teil soll der Spieler schauen?
// Zuerst ein angestecktes Teil, das schadet. Sonst ein Teil der Lösung, das fehlt.
export function hilfeTeil(aufgabe, auswahl = []) {
  if (aufgabe.typ === 'wahl') {
    // Bei einer Wahl: eine falsche Antwort ausschliessen, am liebsten die gerade gewählte.
    const falsche = aufgabe.optionen.filter((o) => !o.richtig);
    const ziel = falsche.find((o) => o.id === auswahl[0]) ?? falsche[0];
    return ziel ? { id: ziel.id, grund: 'falsch' } : null;
  }
  if (aufgabe.typ === 'zuordnen') {
    // Beim Verbinden: das erste Teil, das nicht am richtigen Ort steckt.
    const urteil = bewerteZuordnen(aufgabe, auswahl);
    return urteil.ok ? null : { id: urteil.teil.id, grund: 'zuordnung' };
  }
  if (aufgabe.typ === 'schleife') {
    // Bei der Schleife: die erste Station mit einer falschen oder fehlenden Wahl.
    const urteil = bewerteSchleife(aufgabe, auswahl);
    return urteil.ok ? null : { id: urteil.station.id, grund: 'station' };
  }
  if (aufgabe.typ === 'reihe') {
    // Beim Sortieren: der erste Platz, der nicht stimmt. Der richtige Schritt dafür steht noch zu weit hinten.
    const stelle = aufgabe.loesung.findIndex((id, index) => auswahl[index] !== id);
    return stelle < 0 ? null : { id: aufgabe.loesung[stelle], grund: 'platz' };
  }
  if (aufgabe.typ === 'klick') {
    // Beim Durchklicken: die Stelle, die im aktuellen Bildschirm richtig wäre.
    const loesung = loesungVon(aufgabe);
    const stelle = loesung.findIndex((id, index) => auswahl[index] !== id);
    return stelle < 0 ? null : { id: loesung[stelle], grund: 'tippen' };
  }
  const gewaehlt = new Set(auswahl);
  if (aufgabe.typ === 'einstellen') {
    // Beim Einstellen: in der Zeile, die gerade nicht passt, die Einstellung der Lösung zeigen.
    const pruefung = bewerte(aufgabe, auswahl).pruefung;
    if (!pruefung) return null;
    const betroffen = pruefung.wenn.gewaehlt?.find((id) => gewaehlt.has(id)) ?? pruefung.wenn.fehlt?.find((id) => !gewaehlt.has(id));
    const zeile = aufgabe.zeilen.find((z) => z.optionen.some((option) => option.id === betroffen));
    const ziel = zeile?.optionen.find((option) => aufgabe.loesung.includes(option.id));
    return ziel ? { id: ziel.id, grund: 'einstellen' } : null;
  }
  const schaedlich = new Set(aufgabe.pruefungen.flatMap((pruefung) => pruefung.wenn.gewaehlt ?? []));
  const zuviel = auswahl.find((id) => schaedlich.has(id));
  if (zuviel) return { id: zuviel, grund: 'zuviel' };
  // Ist der Koffer zu voll, zeigt die Hilfe auf das schwerste Teil, das nicht zur Lösung gehört.
  // Ohne diese Regel zeigte «Zeig mir, wo» bei einem vollen Koffer gar nichts an.
  if (Number.isInteger(bewerte(aufgabe, auswahl).pruefung?.wenn.tokensUeber)) {
    const schwer = aufgabe.teile
      .filter((teil) => gewaehlt.has(teil.id) && !aufgabe.loesung.includes(teil.id))
      .sort((erstes, zweites) => (zweites.tokens ?? 0) - (erstes.tokens ?? 0))[0];
    if (schwer) return { id: schwer.id, grund: 'zuviel' };
  }
  const fehlt = aufgabe.loesung.find((id) => !gewaehlt.has(id));
  return fehlt ? { id: fehlt, grund: 'fehlt' } : null;
}
