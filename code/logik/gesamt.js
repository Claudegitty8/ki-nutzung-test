// Der gemeinsame Spielstand für beide Teile (E-007, REGELN.md R-1). Reine Logik, ohne Browser.
// Jedes Fach ist ein Spielstand im Format der alten Spiele (Version 2) und wird mit wandleUm geprüft.
import { neuerStand } from './ablauf.js';
import { wandleUm } from './extras.js';

export const GESAMT_FORMAT = 'ki-studio-neu';
export const GESAMT_VERSION = 1;

const istObjekt = (wert) => Boolean(wert) && typeof wert === 'object' && !Array.isArray(wert);
const SCHRIFTEN = ['normal', 'gross', 'sehrgross'];

// Nur bekannte Einstellungen mit erlaubten Werten (Befund Tester und Sicherheit: früher ungeprüft).
export function pruefeEinstellungen(wert, erlaubt = SCHRIFTEN) {
  const schrift = istObjekt(wert) && erlaubt.includes(wert.schrift) ? wert.schrift : 'normal';
  return { schrift };
}

export function neuerGesamtstand(teilIds) {
  return {
    format: GESAMT_FORMAT,
    version: GESAMT_VERSION,
    aktiv: null,           // zuletzt gespielter Teil oder null (noch nie gespielt)
    teile: Object.fromEntries(teilIds.map((id) => [id, null])), // null = in diesem Teil noch nichts gespielt
    uebernahme: {},        // pro Teil: { wann, wie: 'uebernommen' | 'abgelehnt' }
    einstellungen: { schrift: 'normal' },
  };
}

// Macht aus einem gespeicherten Wert einen gültigen Gesamtstand. Unbrauchbares wird durch Standardwerte ersetzt.
export function wandleGesamtUm(wert, teilIds) {
  const leer = neuerGesamtstand(teilIds);
  if (!istObjekt(wert) || wert.format !== GESAMT_FORMAT) return null;
  const teile = {};
  for (const id of teilIds) teile[id] = wert.teile?.[id] == null ? null : wandleUm(wert.teile[id]);
  const uebernahme = {};
  for (const id of teilIds) {
    const eintrag = wert.uebernahme?.[id];
    if (istObjekt(eintrag) && ['uebernommen', 'abgelehnt'].includes(eintrag.wie)) {
      uebernahme[id] = { wie: eintrag.wie, wann: typeof eintrag.wann === 'string' ? eintrag.wann.slice(0, 40) : '' };
    }
  }
  return {
    ...leer,
    aktiv: teilIds.includes(wert.aktiv) ? wert.aktiv : null,
    teile,
    uebernahme,
    einstellungen: pruefeEinstellungen(wert.einstellungen),
  };
}

// Der Spielstand eines Teils, so wie ihn der Motor kennt. Die Einstellungen gelten für beide Teile.
export function fachVon(gesamt, teilId) {
  const fach = gesamt.teile[teilId] ?? neuerStand();
  return { ...fach, einstellungen: { ...fach.einstellungen, ...gesamt.einstellungen } };
}

// Legt den Spielstand eines Teils zurück. Welcher Teil gespielt wird (aktiv), ändert sich dabei nicht:
// Den Teil wählt nur der Spieler (Teilwahl, Übernahme, Datei). Sonst würde schon das Ansehen einer Abkürzung
// auf dem Startbildschirm den ersten Teil als gewählt speichern.
export function mitFach(gesamt, teilId, fach) {
  return {
    ...gesamt,
    teile: { ...gesamt.teile, [teilId]: fach },
    einstellungen: pruefeEinstellungen(fach.einstellungen),
  };
}

// Den gespielten Teil wählen.
export function mitAktiv(gesamt, teilId) {
  return { ...gesamt, aktiv: teilId };
}

// Wurde in einem Teil schon etwas gespielt?
export function hatGespielt(gesamt, teilId) {
  const fach = gesamt.teile[teilId];
  return Boolean(fach) && (fach.erledigt.length > 0 || Boolean(fach.lauf) || Object.keys(fach.fortschritt).length > 0);
}

// Übergang (E-011, REGELN.md R-4): Sind alle Aufträge eines Teils erledigt, ist der nächste Teil dran.
// Gibt die Kennung des nächsten Teils zurück, sonst null.
export function uebergangZu(teile, teilId, fach) {
  const stelle = teile.findIndex((teil) => teil.id === teilId);
  const teil = teile[stelle];
  const naechster = teile[stelle + 1];
  if (!teil || !naechster || fach?.lauf) return null;
  return teil.auftraege.every((id) => fach?.erledigt?.includes(id)) ? naechster.id : null;
}
