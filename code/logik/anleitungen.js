// Anleitungen «So geht es in echt» im Lexikon (E-033): die Wege durch die echte Claude-App zum Nachschlagen.
// Reine Funktion: kennt weder Browser noch Oberfläche.
// Ein Auftrag kann das Feld «anleitungen» tragen: { konzept, wege: [{ aufgabe, titel }] }.
// Die Aufgabe zeigt den Weg (Durchklicken als Bilderstrecke, Einstellen als fertig eingestelltes Bild).
// Offen ist ein Thema, sobald der Spieler die Runde erreicht hat (Konzept im Lexikon, das geschieht beim Aha)
// oder den Auftrag erledigt hat. So bekommen auch Spielstände von vor Version 0.10 die Anleitungen.

export function anleitungenInhalt(stand, auftraege) {
  const erledigt = new Set(Array.isArray(stand?.erledigt) ? stand.erledigt : []);
  const lexikon = new Set(Array.isArray(stand?.lexikon) ? stand.lexikon : []);
  return (auftraege ?? [])
    .filter((auftrag) => (auftrag.anleitungen?.wege ?? []).length > 0)
    .map((auftrag) => ({
      auftrag: auftrag.id,
      titel: auftrag.titel,
      konzept: auftrag.anleitungen.konzept,
      offen: erledigt.has(auftrag.id) || lexikon.has(auftrag.anleitungen.konzept),
      // Die ganze Aufgabe, sonst die aus dem Auszug für Lexikon und Schrank (E-054).
      wege: auftrag.anleitungen.wege
        .map((weg) => ({ titel: weg.titel, aufgabe: auftrag.aufgaben?.[weg.aufgabe] ?? auftrag.auszug?.[weg.aufgabe] }))
        .filter((weg) => weg.aufgabe),
    }));
}

// Wahlhilfe «Was nehme ich wann?» (E-034): pro Bauteil wann, warum und Beispiele.
// Ein Eintrag ist offen, sobald sein Konzept im Lexikon steht. Die übrigen werden nur gezählt.
export function wahlhilfeInhalt(stand, eintraege) {
  const lexikon = new Set(Array.isArray(stand?.lexikon) ? stand.lexikon : []);
  const liste = Array.isArray(eintraege) ? eintraege : [];
  const offen = liste.filter((eintrag) => lexikon.has(eintrag.konzept));
  return { offen, verborgen: liste.length - offen.length };
}
