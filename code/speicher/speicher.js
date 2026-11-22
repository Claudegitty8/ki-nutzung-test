// Spielstand: bleibt nur auf dem Gerät. Fällt der Gerätespeicher aus,
// läuft das Spiel mit einem Stand im Arbeitsspeicher weiter.
// Ein Gesamtstand für beide Teile (E-007). Die Stände der alten Spiele werden hier nie geschrieben (E-008).
import { neuerGesamtstand, wandleGesamtUm, GESAMT_VERSION } from '../logik/gesamt.js';
import { wandleUm } from '../logik/extras.js';

export const SCHLUESSEL = 'ki-studio-neu-stand';
// Unveränderte Kopie eines Stands aus einer anderen Version oder eines kaputten Werts, bevor er ersetzt wird.
export const ALT = 'ki-studio-neu-stand-alt';
// Kopie des Teil-Stands vor dem letzten Sprung, damit sich der Sprung rückgängig machen lässt.
const vorSprungSchluessel = (teilId) => `ki-studio-neu-${teilId}-vor-sprung`;
// Grösser ist kein echter Spielstand (Befund Sicherheit).
export const GROESSTE_LAENGE = 1_000_000;

function holeLager() {
  try {
    const lager = globalThis.localStorage;
    // Eigener Name: Der Gerätespeicher wird mit den alten Spielen geteilt (Befund Datenschutz).
    lager.setItem('ki-studio-neu-probe', '1');
    lager.removeItem('ki-studio-neu-probe');
    return lager;
  } catch {
    return null;
  }
}

export function erstelleSpeicher(teilIds, lager = holeLager()) {
  let imKopf = null;
  const vorSprungImKopf = {};

  function schreibe(schluessel, wert) {
    try {
      lager?.setItem(schluessel, wert);
      return Boolean(lager);
    } catch {
      return false;
    }
  }

  function lies(schluessel) {
    try {
      const roh = lager?.getItem(schluessel) ?? null;
      return roh != null && roh.length <= GROESSTE_LAENGE ? roh : null;
    } catch {
      return null;
    }
  }

  function entferne(schluessel) {
    try {
      lager?.removeItem(schluessel);
    } catch {
      // Nichts zu tun: Was im Arbeitsspeicher liegt, wird ohnehin zurückgesetzt.
    }
  }

  return {
    dauerhaft: Boolean(lager),
    laden() {
      if (imKopf) return structuredClone(imKopf);
      const roh = lies(SCHLUESSEL);
      if (roh == null) return neuerGesamtstand(teilIds);
      let gelesen = null;
      try {
        gelesen = JSON.parse(roh);
      } catch {
        gelesen = null;
      }
      const stand = wandleGesamtUm(gelesen, teilIds);
      // Kaputt, aus einer anderen Version oder ein Fach verworfen: das Original bleibt als Kopie liegen
      // (Befunde Tester und Code-Prüfer).
      const fachVerworfen = Boolean(stand) && teilIds.some((id) => gelesen.teile?.[id] != null && stand.teile[id] == null);
      if (!stand || gelesen.version !== GESAMT_VERSION || fachVerworfen) schreibe(ALT, roh);
      return stand ?? neuerGesamtstand(teilIds);
    },
    speichern(gesamt) {
      imKopf = structuredClone(gesamt);
      return schreibe(SCHLUESSEL, JSON.stringify(gesamt));
    },
    // Löscht nur den Stand dieses Programms samt Kopien, nie die Stände der alten Spiele (E-008).
    loeschen() {
      imKopf = null;
      entferne(SCHLUESSEL);
      entferne(ALT);
      for (const id of teilIds) {
        delete vorSprungImKopf[id];
        entferne(vorSprungSchluessel(id));
      }
      return neuerGesamtstand(teilIds);
    },
    // Liest einen Stand eines alten Spiels, ohne ihn zu verändern (E-008, REGELN.md R-2).
    liesAlt(schluessel) {
      const roh = lies(schluessel);
      if (roh == null) return null;
      try {
        return wandleUm(JSON.parse(roh));
      } catch {
        return null;
      }
    },
    // --- Sprung rückgängig machen, pro Teil ---
    merkeVorSprung(teilId, stand) {
      vorSprungImKopf[teilId] = structuredClone(stand);
      schreibe(vorSprungSchluessel(teilId), JSON.stringify(stand));
    },
    vorSprung(teilId) {
      if (vorSprungImKopf[teilId]) return structuredClone(vorSprungImKopf[teilId]);
      const roh = lies(vorSprungSchluessel(teilId));
      try {
        return roh == null ? null : wandleUm(JSON.parse(roh));
      } catch {
        return null;
      }
    },
    vergissVorSprung(teilId) {
      delete vorSprungImKopf[teilId];
      entferne(vorSprungSchluessel(teilId));
    },
  };
}
