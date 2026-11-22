// Bereitet die geladenen Inhalte eines Teils für den gemeinsamen Motor auf. Reine Logik, ohne Browser.
// Die Inhaltsdateien bleiben unverändert (E-004): Was im KI-Studio «kiwi…» und im Agentenbüro «echo…» heisst,
// bekommt hier zusätzlich einen neutralen Namen («figur…», «heim…»).

// Textschlüssel: neutraler Name aus dem alten Namen des Teils, wenn er noch fehlt.
export function mitTextAlias(texte, alias = {}) {
  const app = { ...texte.app };
  for (const [neu, alt] of Object.entries(alias)) {
    if (app[neu] === undefined && app[alt] !== undefined) app[neu] = app[alt];
  }
  return { ...texte, app };
}

// Setzt aus den rohen Dateien eines Teils die Inhalte zusammen, wie sie der Motor braucht.
// roh: { regeln, lehrplan, einrichtung, texte, lexikon, umfrage, auftraege, zusatz: { abkuerzungen?, schirme?, wahlhilfe? } }
export function bereiteVor(teil, roh) {
  const zusatz = roh.zusatz ?? {};
  return {
    teil,
    regeln: roh.regeln,
    lehrplan: roh.lehrplan,
    texte: mitTextAlias(roh.texte, teil.textAlias),
    lexikon: roh.lexikon,
    auftraege: roh.auftraege,
    einrichtung: roh.einrichtung?.dinge ?? [],
    umfrage: roh.umfrage?.fragen ?? [],
    // Zusätze gibt es nur in einem Teil. Fehlen sie, bleibt die Funktion einfach aus.
    abkuerzungen: zusatz.abkuerzungen ?? null,
    schirme: zusatz.schirme?.schirme ?? [],
    wahlhilfe: zusatz.wahlhilfe?.eintraege ?? [],
  };
}
