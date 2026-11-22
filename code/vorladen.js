// Schneller Start (E-055): Diese kleine Datei läuft sofort, noch bevor die Programmteile geladen sind.
// Sie liest im Spielstand nur, welcher Teil zuletzt gespielt wurde, und lässt den Browser dessen Inhalte schon
// jetzt holen, gleichzeitig mit den Programmteilen. Sonst kämen sie erst danach an die Reihe.
// Ohne Spielstand (erster Start) oder bei einem Fehler macht sie nichts; das Spiel lädt dann wie gewohnt.
// Die Liste muss zu spiel/inhalte/teile.json und zum Lader passen. Das prüft tests/gemeinsam/nachladen.test.js.
(function vorladen() {
  var GRUND = ['regeln.json', 'lehrplan.json', 'einrichtung.json', 'de/texte.json', 'de/lexikon.json', 'de/umfrage.json', 'de/geruest.json'];
  var ZUSATZ = { studio: ['de/abkuerzungen.json'], buero: ['de/schirme.json', 'de/wahlhilfe.json'] };
  try {
    var roh = window.localStorage.getItem('ki-studio-neu-stand');
    // Gleiche Grenze wie beim Lesen des Spielstands (speicher.js): sehr grosse Werte gar nicht erst lesen.
    if (typeof roh !== 'string' || roh.length > 1000000) return;
    var stand = JSON.parse(roh);
    var teil = stand && stand.aktiv;
    if (!Object.prototype.hasOwnProperty.call(ZUSATZ, teil)) return;
    GRUND.concat(ZUSATZ[teil]).forEach(function (datei) {
      var link = document.createElement('link');
      link.rel = 'preload';
      link.as = 'fetch';
      link.crossOrigin = 'anonymous';
      link.href = 'inhalte/' + teil + '/' + datei;
      document.head.appendChild(link);
    });
  } catch (fehler) {
    // Kein Zugriff auf den Gerätespeicher oder kaputter Stand: nichts vorladen.
  }
}());
