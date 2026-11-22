// Einsatzschrank: welche Bauteile der Spieler schon freigeschaltet hat (E-003, E-016).
// Reine Funktion: kennt weder Browser noch Oberfläche.
// Ein Bauteil gehört zu einem Auftrag (Feld «schrank») und ist frei, sobald der Auftrag erledigt ist.
// So braucht der Spielstand kein neues Feld, und alte Stände funktionieren unverändert.

export function schrankInhalt(stand, auftraege) {
  const erledigt = new Set(stand?.erledigt ?? []);
  return (auftraege ?? [])
    .filter((auftrag) => erledigt.has(auftrag.id) && auftrag.schrank)
    .map((auftrag) => ({
      auftrag: auftrag.id,
      titel: auftrag.schrank.titel,
      vorlage: auftrag.schrank.vorlage,
      wo: auftrag.schrank.wo,
      // Probefahrt (E-029): der Weg in der echten App als Bilderstrecke, dazu Punkte zum Abhaken.
      ...(auftrag.schrank.probefahrt ? { probefahrt: probefahrtVon(stand, auftrag) } : {}),
    }));
}

function probefahrtVon(stand, auftrag) {
  const { aufgabe, punkte } = auftrag.schrank.probefahrt;
  const abgehakt = new Set(Array.isArray(stand?.probefahrt?.[auftrag.id]) ? stand.probefahrt[auftrag.id] : []);
  return {
    // Die ganze Aufgabe, sonst die aus dem Auszug für Lexikon und Schrank (E-054).
    aufgabe: auftrag.aufgaben?.[aufgabe] ?? auftrag.auszug?.[aufgabe] ?? null,
    punkte: punkte.map((punkt) => ({ ...punkt, erledigt: abgehakt.has(punkt.id) })),
  };
}

// Hakt einen Punkt der Probefahrt ab oder nimmt den Haken weg. Gibt einen neuen Spielstand zurück.
export function hakeAb(stand, auftragId, punktId, erledigt) {
  const bisher = new Set(Array.isArray(stand.probefahrt?.[auftragId]) ? stand.probefahrt[auftragId] : []);
  if (erledigt) bisher.add(punktId);
  else bisher.delete(punktId);
  return { ...stand, probefahrt: { ...stand.probefahrt, [auftragId]: [...bisher] } };
}
