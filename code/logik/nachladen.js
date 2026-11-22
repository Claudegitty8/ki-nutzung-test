// Nachladen pro Auftrag (E-054): Welche Aufträge brauchen ihre Aufgaben, bevor eine Ansicht gezeigt wird?
// Reine Logik, ohne Browser. Beim Start kennt das Spiel nur das Gerüst aller Aufträge (ohne Aufgaben).
// Die Aufgaben eines Auftrags werden erst geladen, wenn eine Ansicht sie zeigt.

const ohneDoppelte = (liste) => [...new Set(liste.filter(Boolean))];

// Der laufende Auftrag, sonst der nächste offene (wie app.auftrag()).
export function aktuellerAuftrag(stand, auftraege) {
  const lauf = stand?.lauf;
  if (lauf) return auftraege.find((a) => a.id === lauf.auftrag) ?? null;
  const erledigt = Array.isArray(stand?.erledigt) ? stand.erledigt : [];
  return auftraege.find((a) => !erledigt.includes(a.id)) ?? null;
}

// Aufträge, die ein laufender Auftrag braucht: er selbst und der Auftrag einer fälligen Wiederholung.
// Diese braucht auch die Prüfung, ob der Lauf noch zu den Inhalten passt (pruefeLauf).
export function auftraegeFuerLauf(stand) {
  const lauf = stand?.lauf;
  if (!lauf) return [];
  return ohneDoppelte([lauf.auftrag, lauf.wiederholung?.auftrag ?? lauf.auftrag]);
}

// Aufträge, deren Aufgaben die Ansicht «name» braucht.
export function auftraegeFuerAnsicht(name, stand, auftraege) {
  const erledigt = new Set(Array.isArray(stand?.erledigt) ? stand.erledigt : []);
  const lexikon = new Set(Array.isArray(stand?.lexikon) ? stand.lexikon : []);
  switch (name) {
    case 'runde':
    case 'schnelltest':
      return ohneDoppelte([...auftraegeFuerLauf(stand), aktuellerAuftrag(stand, auftraege)?.id]);
    case 'schrank':
      // Die Probefahrt zeigt eine Aufgabe des erledigten Auftrags.
      return auftraege.filter((a) => erledigt.has(a.id) && a.schrank?.probefahrt).map((a) => a.id);
    case 'lexikon':
      // «So geht es in echt»: nur Themen, die schon offen sind (wie in logik/anleitungen.js).
      return auftraege
        .filter((a) => (a.anleitungen?.wege ?? []).length > 0 && (erledigt.has(a.id) || lexikon.has(a.anleitungen.konzept)))
        .map((a) => a.id);
    default:
      return [];
  }
}

// Lexikon und Schrank zeigen nur einzelne Aufgaben. Dafür reicht der kleine Auszug (de/auszug.json) statt der ganzen
// Aufträge (Befund Performance 0.6).
export const NUR_AUSZUG = ['schrank', 'lexikon'];

// Was nach dem ersten Bildschirm im Hintergrund schon geholt wird, damit «Los» ohne Warten geht.
export function auftraegeVorab(stand, auftraege) {
  return auftraegeFuerAnsicht('runde', stand, auftraege);
}
