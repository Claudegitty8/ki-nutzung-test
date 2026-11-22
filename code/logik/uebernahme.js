// Übernahme alter Spielstände aus KI-Studio und Agentenbüro (E-008, E-009, REGELN.md R-2 und R-3).
// Reine Logik: Jede Funktion bekommt einen Gesamtstand und gibt einen neuen zurück.
// Die alten Stände selbst werden hier nie verändert.
import { wandleUm } from './extras.js';
import { wandleGesamtUm, GESAMT_FORMAT, hatGespielt } from './gesamt.js';

const istObjekt = (wert) => Boolean(wert) && typeof wert === 'object' && !Array.isArray(wert);

// Für welche Teile wartet eine Frage zur Übernahme? Nur wenn ein alter Stand da ist,
// im Teil noch nichts gespielt wurde und für den Teil noch nicht entschieden ist.
// alteStaende: { teilId: Spielstand (schon mit wandleUm geprüft) oder null }
export function offeneUebernahmen(gesamt, teile, alteStaende) {
  return teile
    .filter((teil) => alteStaende[teil.id] && !gesamt.uebernahme?.[teil.id] && !hatGespielt(gesamt, teil.id))
    .map((teil) => ({ teil: teil.id, stand: alteStaende[teil.id] }));
}

// «Übernehmen»: Das Fach bekommt den alten Stand. Welcher Teil danach startet, entscheidet erst
// startTeil nach der letzten Frage (der weiter fortgeschrittene Teil, Befund Code-Prüfer).
export function uebernimm(gesamt, teilId, alterStand, wann) {
  const stand = wandleUm(alterStand);
  if (!stand) return gesamt;
  return {
    ...gesamt,
    teile: { ...gesamt.teile, [teilId]: stand },
    uebernahme: { ...gesamt.uebernahme, [teilId]: { wie: 'uebernommen', wann } },
  };
}

// «Neu beginnen»: Es wird nicht mehr gefragt.
export function lehneAb(gesamt, teilId, wann) {
  return { ...gesamt, uebernahme: { ...gesamt.uebernahme, [teilId]: { wie: 'abgelehnt', wann } } };
}

// Wenn zwei Stände übernommen wurden, startet der weiter fortgeschrittene Teil (gestaltung/ABLAEUFE.md, Annahme).
export function startTeil(gesamt, teile) {
  if (gesamt.aktiv) return gesamt.aktiv;
  const anteil = (teil) => (gesamt.teile[teil.id]?.erledigt?.filter((id) => teil.auftraege.includes(id)).length ?? 0) / teil.auftraege.length;
  const gespielt = teile.filter((teil) => hatGespielt(gesamt, teil.id));
  if (gespielt.length === 0) return null;
  return gespielt.reduce((best, teil) => (anteil(teil) > anteil(best) ? teil : best)).id;
}

// --- Spielstand aus einer Datei (R-3) ---

// Zu welchem Teil gehört ein alter Spielstand? Zuerst nach Konzepten (die Kennungen sind in beiden Teilen
// verschieden), sonst nach erledigten Aufträgen, die es nur in einem Teil gibt («dorffest» gibt es in beiden).
// teile: [{ id, auftraege, konzepte }]
export function teilVon(stand, teile) {
  const konzepte = new Set([...Object.keys(stand.fortschritt ?? {}), ...(stand.lexikon ?? [])]);
  const nachKonzept = teile.filter((teil) => teil.konzepte.some((id) => konzepte.has(id)));
  if (nachKonzept.length === 1) return nachKonzept[0].id;
  if (nachKonzept.length > 1) return null;
  const nurHier = (teil, id) => teil.auftraege.includes(id) && teile.every((anderer) => anderer === teil || !anderer.auftraege.includes(id));
  const nachAuftrag = teile.filter((teil) => [...(stand.erledigt ?? []), stand.lauf?.auftrag].some((id) => nurHier(teil, id)));
  return nachAuftrag.length === 1 ? nachAuftrag[0].id : null;
}

// Erkennt, was eine Datei enthält.
// { art: 'gesamt', gesamt } | { art: 'teil', teil, stand } | { art: 'unklar', stand } | { art: 'kein' }
export function erkenneDatei(wert, teile) {
  if (istObjekt(wert) && wert.format === GESAMT_FORMAT) {
    const gesamt = wandleGesamtUm(wert, teile.map((teil) => teil.id));
    return gesamt ? { art: 'gesamt', gesamt } : { art: 'kein' };
  }
  const stand = wandleUm(wert);
  if (!stand) return { art: 'kein' };
  const teil = teilVon(stand, teile);
  return teil ? { art: 'teil', teil, stand } : { art: 'unklar', stand };
}

// Legt einen Teil-Stand aus einer Datei in sein Fach. Der Vermerk zur Übernahme bleibt, wie er ist.
export function mitDateiStand(gesamt, teilId, stand) {
  return { ...gesamt, aktiv: teilId, teile: { ...gesamt.teile, [teilId]: stand } };
}
