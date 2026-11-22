// Gezeichnete Bildschirme als Daten: auflösen und auswerten, ohne Oberfläche.
// Ein Bildschirm kann auf einem anderen aufbauen («basis»): Er übernimmt Fenster, Kopfleiste und Seitenleiste
// und bringt nur seinen eigenen Inhalt mit. So steht die Seitenleiste der Claude-App nur einmal in den Daten.

// Die Bausteine, aus denen ein Bildschirm bestehen kann. Die Oberfläche (oberflaeche/schirm.js) zeichnet genau diese.
export const SCHIRM_ARTEN = ['titel', 'text', 'reiter', 'knoepfe', 'menue', 'liste', 'schalter', 'feld', 'chat', 'eingabe',
  'code', 'dateien', 'frage', 'karten', 'einstellungen'];

// Liefert den fertigen Bildschirm zu einer id oder null, wenn es ihn nicht gibt.
export function loeseSchirm(schirme, id, gesehen = new Set()) {
  const eigen = schirme?.[id];
  if (!eigen || gesehen.has(id)) return null; // unbekannt oder im Kreis verwiesen
  if (!eigen.basis) return { id, ...eigen };
  const basis = loeseSchirm(schirme, eigen.basis, new Set([...gesehen, id]));
  if (!basis) return null;
  const { basis: _, einschub, ...rest } = eigen;
  const inhalt = eigen.inhalt ?? basis.inhalt ?? [];
  return { ...basis, ...rest, id, inhalt: einschub ? schiebeEin(inhalt, einschub) : inhalt };
}

// Ein offenes Menü oder Fenster unter einer Stelle einfügen («einschub»: nach welcher Stelle, welche Bausteine).
// So bleibt der Rest des Bildschirms aus der Basis und steht nur einmal in den Daten.
function schiebeEin(inhalt, { nach, inhalt: neu }) {
  const stelle = inhalt.findIndex((baustein) => stellenVon({ inhalt: [baustein] }).includes(nach));
  if (stelle < 0) return [...inhalt, ...neu];
  return [...inhalt.slice(0, stelle + 1), ...neu, ...inhalt.slice(stelle + 1)];
}

// Alle Einträge eines Bildschirms, die man antippen kann (haben eine id).
export function eintraegeVon(schirm) {
  const liste = [];
  const sammle = (eintrag) => { if (eintrag?.id) liste.push(eintrag); };
  for (const eintrag of schirm?.kopfleiste ?? []) sammle(eintrag);
  for (const eintrag of schirm?.seitenleiste ?? []) sammle(eintrag);
  for (const baustein of schirm?.inhalt ?? []) {
    sammle(baustein);
    for (const eintrag of baustein.eintraege ?? []) {
      sammle(eintrag);
      sammle(eintrag.knopf);
      for (const k of eintrag.knoepfe ?? []) sammle(k);
    }
    for (const k of baustein.knoepfe ?? []) sammle(k);
  }
  return liste;
}

export function stellenVon(schirm) {
  return eintraegeVon(schirm).map((eintrag) => eintrag.id);
}

// Der Text eines Schritts beim Durchklicken. {ziel} steht für die Beschriftung der richtigen Stelle.
// So steht jede Beschriftung der App nur einmal in den Daten: im Bildschirm (Regel 11).
export function schrittText(schritt, schirme) {
  if (!schritt.text?.includes('{ziel}')) return schritt.text;
  const ziel = eintraegeVon(loeseSchirm(schirme, schritt.schirm)).find((e) => e.id === schritt.ziel);
  return schritt.text.replaceAll('{ziel}', beschriftung(ziel?.text ?? ''));
}

// Beschriftung einer Stelle ohne Pfeilzeichen (aus «+ Hinzufügen ▾» wird «+ Hinzufügen», aus «Skills ›» wird «Skills»).
export function beschriftung(text) {
  return text.replace(/\s*[▾›]$/, '');
}

// Ist ein Eintrag hervorgehoben (zum Beispiel der offene Reiter)? Der Bildschirm kann das für Einträge
// aus seiner Basis festlegen («aktiv»: Liste von ids oder Texten). Sonst gilt das Feld am Eintrag.
export function istAktiv(schirm, eintrag) {
  if (Array.isArray(schirm?.aktiv)) return schirm.aktiv.includes(eintrag.id ?? eintrag.text);
  return Boolean(eintrag.aktiv);
}
