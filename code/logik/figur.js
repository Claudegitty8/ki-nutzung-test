// Die Figur des Teils (Kiwi im KI-Studio, Echo im Agentenbüro). Reine Logik.

// Was die Figur in einer Aufgabe sagt: früher im Feld «kiwi» (KI-Studio) oder «echo» (Agentenbüro).
export function figurText(aufgabe) {
  return aufgabe?.figur ?? aufgabe?.kiwi ?? aufgabe?.echo;
}
