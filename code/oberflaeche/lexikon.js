// Lexikon und Einstellungen: zwei einfache Nebenansichten.
import { el, fuelle, knopf, punkte, leiste, baueRueckfrage } from './bausteine.js';
import { erfolge, neuerFortschritt } from '../logik/meisterschaft.js';
import { wendeSchriftAn } from './schrift.js';
import { sprungStatus, springeZuAuftrag } from '../logik/extras.js';
import { erkenneDatei, mitDateiStand } from '../logik/uebernahme.js';

// Grösser ist keine Spielstand-Datei (Befund Sicherheit).
const GROESSTE_DATEI = 1_000_000;
import { anleitungenInhalt, wahlhilfeInhalt } from '../logik/anleitungen.js';
import { baueStrecke } from './klick.js';
import { baueEinstellen } from './einstellen.js';
import { loesungVon } from '../logik/bewertung.js';

// «Was nehme ich wann?» (E-034): pro Bauteil zum Aufklappen, wann es passt, warum, Beispiele.
function wahlhilfe(app, t) {
  const { offen, verborgen } = wahlhilfeInhalt(app.stand, app.inhalte.wahlhilfe);
  if (offen.length === 0) return null;
  return el('section', { klasse: 'karte wahlhilfe' },
    el('h2', { text: t.wahlhilfeTitel }),
    el('p', { klasse: 'klein', text: t.wahlhilfeInfo }),
    offen.map((eintrag) => el('details', { klasse: 'anleitung' },
      el('summary', { text: eintrag.bauteil }),
      el('p', {}, el('strong', { text: `${t.wahlhilfeWann}: ` }), el('span', { text: eintrag.wann })),
      el('p', {}, el('strong', { text: `${t.wahlhilfeWarum}: ` }), el('span', { text: eintrag.warum })),
      el('p', {}, el('strong', { text: `${t.wahlhilfeBeispiele}:` })),
      el('ul', { klasse: 'wahlhilfe-beispiele' }, eintrag.beispiele.map((b) => el('li', { text: b }))))),
    verborgen > 0 ? el('p', { klasse: 'klein', text: fuelle(t.wahlhilfeMehr, { anzahl: verborgen }) }) : null);
}

// «So geht es in echt» (E-033): die Wege durch die echte Claude-App, jederzeit zum Nachschlagen.
// Durchklicken erscheint als Bilderstrecke, Einstellen als fertig eingestelltes Bild.
function anleitungen(app, t) {
  const { auftraege, schirme, texte } = app.inhalte;
  const themen = anleitungenInhalt(app.stand, auftraege);
  if (themen.length === 0) return null;
  const wegBild = (aufgabe) => (aufgabe.typ === 'einstellen'
    ? [el('p', { klasse: 'klein', text: t.anleitungEingestellt }),
      baueEinstellen({ aufgabe, t, schirme, auswahl: loesungVon(aufgabe), gesperrt: true, nurBild: true }).knoten]
    : [baueStrecke(aufgabe, schirme, t)]);
  return el('section', { klasse: 'karte anleitungen' },
    el('h2', { text: t.anleitungenTitel }),
    el('p', { klasse: 'klein', text: t.anleitungenInfo }),
    themen.map((thema) => el('div', { klasse: 'anleitung-thema' },
      el('h3', { text: texte.konzepte[thema.konzept]?.name ?? thema.titel }),
      thema.offen
        ? thema.wege.map((weg) => el('details', { klasse: 'anleitung' },
          el('summary', { text: weg.titel }),
          ...wegBild(weg.aufgabe)))
        : el('p', { klasse: 'klein', text: fuelle(t.anleitungZu, { auftrag: thema.titel }) }))));
}

export function zeigeLexikon(wurzel, app, nav) {
  const { texte, lexikon, lehrplan, regeln } = app.inhalte;
  const t = texte.app;
  const noetig = regeln.erfolgeFuerMeisterschaft;
  const offen = lehrplan.konzepte.filter((konzept) => !app.stand.lexikon.includes(konzept.id)).length;

  function zeile(etikett, text) {
    return text ? el('p', {}, el('strong', { text: `${etikett}: ` }), el('span', { text })) : null;
  }

  wurzel.append(
    leiste(t, nav, t.lexikonTitel),
    ...[wahlhilfe(app, t), anleitungen(app, t)].filter(Boolean),
    // Begriffe, die dieser Teil nicht kennt (zum Beispiel aus einer Datei des anderen Spiels), auslassen (Befund Tester).
    ...app.stand.lexikon.filter((id) => Object.hasOwn(lexikon, id)).map((id) => {
      const eintrag = lexikon[id];
      const kern = eintrag.kern ? texte.konzepte[eintrag.kern] : null;
      const anzahl = eintrag.kern
        ? Math.min(noetig, erfolge(app.stand.fortschritt[eintrag.kern] ?? neuerFortschritt()))
        : 0;
      return el('details', { klasse: 'karte eintrag' },
        el('summary', {}, el('span', { text: eintrag.begriff }), kern ? punkte(anzahl, noetig, t.punkteLabel) : null),
        el('p', { text: eintrag.erklaerung }),
        zeile(t.lexEnglisch, eintrag.englisch),
        zeile(t.lexAnalogie, kern?.analogie),
        zeile(t.lexQuatsch, eintrag.quatsch),
        zeile(t.lexGenauer, eintrag.genauer));
    }),
    el('p', { klasse: 'klein', text: fuelle(t.lexikonOffen, { anzahl: offen }) }),
  );
}

export function zeigeEinstellungen(wurzel, app, nav, daten) {
  const t = app.inhalte.texte.app;

  const schriftKnoepfe = Object.entries(t.schrift).map(([wert, name]) => el('button', {
    type: 'button',
    klasse: 'baustein',
    'aria-pressed': String(app.stand.einstellungen.schrift === wert),
    text: name,
    onclick: () => {
      app.setze({ ...app.stand, einstellungen: { ...app.stand.einstellungen, schrift: wert } });
      wendeSchriftAn(wert);
      nav.zu('einstellungen');
    },
  }));

  const g = app.gemeinsam;
  const teilName = (id) => g[`teil${id.charAt(0).toUpperCase()}${id.slice(1)}Name`];

  // «Alles löschen» löscht den Stand beider Teile, nie die Stände der alten Spiele (E-008, E-020).
  const loeschFrage = baueRueckfrage(g.loeschenNein);
  const loeschenJa = knopf(g.loeschenJa, () => {
    app.speicher.loeschen();
    app.neuStarten();
  }, 'knopf-warn');

  // Spielstand als Datei sichern und wieder laden: eine Datei für beide Teile (E-009, REGELN.md R-3).
  // Angenommen werden auch Dateien des alten KI-Studios und des alten Agentenbüros.
  const dateiStatus = el('p', { klasse: 'klein', role: 'status' });
  const sichern = knopf(g.standSichern, () => {
    try {
      const adresse = URL.createObjectURL(new Blob([JSON.stringify(app.gesamt, null, 2)], { type: 'application/json' }));
      const link = el('a', { href: adresse, download: g.standDateiname });
      link.click();
      setTimeout(() => URL.revokeObjectURL(adresse), 1000);
    } catch {
      dateiStatus.textContent = g.standSichernFehler;
    }
  }, 'knopf-zweit');

  // Rückfrage vor dem Laden: Der jetzige Stand wird ersetzt. Bei unklarer Datei zuerst die Wahl des Teils.
  const ladeFrage = baueRueckfrage(g.standLadenNein);
  const frageVorLaden = (text, knoepfe) => ladeFrage.oeffne([text], knoepfe);
  // Nach dem Laden gilt der alte «Sprung rückgängig» nicht mehr: Er würde den geladenen Stand überschreiben (Befund Code-Prüfer).
  function ersetzeTeil(teilId, stand, erkannt) {
    frageVorLaden(`${erkannt ? `${erkannt} ` : ''}${fuelle(g.standErsetzenFrage, { teil: teilName(teilId) })}`, [
      knopf(g.standLadenJa, () => {
        app.speicher.vergissVorSprung(teilId);
        app.setzeGesamt(mitDateiStand(app.gesamt, teilId, stand));
        app.wechsle(teilId);
      }, 'knopf-warn')]);
  }
  const dateiWahl = el('input', {
    type: 'file',
    accept: 'application/json,.json',
    hidden: true,
    onchange: async () => {
      const datei = dateiWahl.files[0];
      dateiWahl.value = '';
      if (!datei) return;
      if (datei.size > GROESSTE_DATEI) {
        dateiStatus.textContent = g.standFehlerZuGross;
        return;
      }
      let wert;
      try {
        wert = JSON.parse(await datei.text());
      } catch {
        dateiStatus.textContent = g.standFehlerKaputt;
        return;
      }
      try {
        const erkannt = erkenneDatei(wert, await app.ladeKennungen());
        if (erkannt.art === 'kein') {
          dateiStatus.textContent = g.standFehlerKeinStand;
        } else if (erkannt.art === 'gesamt') {
          frageVorLaden(`${g.standErkanntNeu} ${g.standErsetzenFrageAlles}`, [knopf(g.standLadenJa, () => {
            for (const teil of app.teile) app.speicher.vergissVorSprung(teil.id);
            app.setzeGesamt(erkannt.gesamt);
            // Ohne gespielten Teil in der Datei: neu starten, dann kommt die Teilwahl (Befund Code-Prüfer).
            if (erkannt.gesamt.aktiv) app.wechsle(erkannt.gesamt.aktiv);
            else app.neuStarten();
          }, 'knopf-warn')]);
        } else if (erkannt.art === 'teil') {
          const anzahl = erkannt.stand.erledigt.length;
          const schluessel = `standErkannt${erkannt.teil.charAt(0).toUpperCase()}${erkannt.teil.slice(1)}${anzahl === 1 ? 'Eins' : ''}`;
          const text = fuelle(g[schluessel], { auftraege: anzahl });
          ersetzeTeil(erkannt.teil, erkannt.stand, text);
        } else {
          frageVorLaden(`${g.standUnklarTitel} ${g.standUnklarText}`, app.teile.map((teil) => knopf(teilName(teil.id), () => ersetzeTeil(teil.id, erkannt.stand), 'knopf-zweit')));
        }
      } catch {
        dateiStatus.textContent = g.standFehlerLesen;
      }
    },
  });
  const laden = knopf(g.standLaden, () => dateiWahl.click(), 'knopf-zweit');

  // Auf iPhone und iPad löscht Safari den Stand nach einer Weile ohne Besuch. Als App auf dem Home-Bildschirm nicht.
  const apfelGeraet = /iPad|iPhone|iPod/.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const alsApp = navigator.standalone === true || globalThis.matchMedia?.('(display-mode: standalone)').matches;
  const iphoneHinweis = apfelGeraet && !alsApp ? el('p', { klasse: 'klein', text: t.iphoneInfo }) : null;

  wurzel.append(
    leiste(t, nav, t.einstellungenTitel),
    el('section', { klasse: 'karte' },
      el('p', { klasse: 'etikett', text: t.schriftEtikett }),
      el('div', { klasse: 'bausteine' }, schriftKnoepfe)),
    el('section', { klasse: 'karte' },
      el('p', { klasse: 'etikett', text: t.standEtikett }),
      el('p', { text: app.speicher.dauerhaft ? t.standInfo : t.standInfoAus }),
      el('p', { klasse: 'klein', text: t.offlineInfo }),
      iphoneHinweis,
      el('p', { klasse: 'klein', text: g.standSichernInfo }),
      el('p', { klasse: 'klein', text: g.standLadenInfo }),
      el('div', { klasse: 'knopf-reihe' }, sichern, laden),
      dateiWahl,
      ladeFrage.knoten,
      dateiStatus,
      el('p', { klasse: 'klein', text: g.loeschenInfo }),
      knopf(g.loeschen, () => loeschFrage.oeffne([g.loeschenFrage, g.loeschenAlteBleiben], [loeschenJa]), 'knopf-zweit'),
      loeschFrage.knoten),
    springen(app, nav, t, daten?.springen),
    el('section', { klasse: 'karte' },
      el('p', { klasse: 'etikett', text: t.kiEtikett }),
      el('p', { text: t.kiInfo })),
    ueberDasSpiel(t, app.gemeinsam),
  );
}

// Datenschutz, Hinweis «inoffiziell» und Kontakt (E-045).
// Der Kontakt erscheint erst, wenn in texte.json eine E-Mail-Adresse eingetragen ist.
// Einmal für beide Teile: Datenschutz und «inoffiziell» kommen aus den gemeinsamen Texten (Doppeltes zusammengelegt).
function ueberDasSpiel(t, g) {
  const absatz = (etikett, ...inhalt) => el('p', {}, el('strong', { text: `${etikett}: ` }), ...inhalt);
  const adresse = t.ueberKontaktAdresse?.trim();
  return el('section', { klasse: 'karte' },
    el('p', { klasse: 'etikett', text: t.ueberEtikett }),
    absatz(g.ueberDatenEtikett, el('span', { text: g.ueberDaten })),
    el('p', { text: g.ueberDatenAlt }),
    el('a', {
      klasse: 'link-zeile',
      href: t.ueberGithubAdresse,
      target: '_blank',
      rel: 'noopener noreferrer',
      text: t.ueberGithubLink,
    }),
    absatz(g.ueberInoffiziellEtikett, el('span', { text: g.ueberInoffiziell })),
    adresse
      ? absatz(t.ueberKontaktEtikett, el('span', { text: `${t.ueberKontakt} ` }),
        el('a', { href: `mailto:${adresse}`, text: adresse }))
      : null);
}

// Zu einem späteren Auftrag springen, zum Beispiel nach einem Gerätewechsel (E-043).
// Vor jedem Sprung kommt eine Rückfrage. Der letzte Sprung lässt sich rückgängig machen.
// offen: Die Auftragsliste ist gleich aufgeklappt und im Blick (kommt vom Hinweis im Heim).
function springen(app, nav, t, offen = false) {
  const { auftraege, regeln } = app.inhalte;
  const status = sprungStatus(app.stand, auftraege);
  const hatZiele = status.some((s) => s.status === 'ziel');
  const vorher = app.speicher.vorSprung();
  const zusatz = { erledigt: t.sprungErledigt, dran: t.sprungDran, offen: t.sprungOffen };

  // Eine einzige Rückfrage, deren Inhalt je nach Knopf wechselt.
  const frage = el('p', { id: 'sprung-frage' });
  const ja = knopf(t.sprungJa, null, 'knopf-warn');
  let aktion = null;
  ja.addEventListener('click', () => aktion?.());
  let ausloeser = null;
  const nein = knopf(t.sprungNein, () => schliesse(), 'knopf-zweit');
  // Abbrechen und Escape geben den Fokus an den Knopf zurück, der die Rückfrage geöffnet hat (Befund Barrierefreiheit).
  const schliesse = () => { rueckfrage.hidden = true; ausloeser?.focus(); };
  const rueckfrage = el('div', { klasse: 'rueckfrage', role: 'group', 'aria-labelledby': 'sprung-frage', hidden: true, 'aria-live': 'polite', onkeydown: (e) => { if (e.key === 'Escape') schliesse(); } },
    frage,
    el('div', { klasse: 'knopf-reihe' }, ja, nein));

  // Die Rückfrage erscheint direkt beim Knopf, der sie ausgelöst hat. So sieht man sie auch am Handy.
  function frageNach(ort, text, jaText, wennJa) {
    ausloeser = document.activeElement;
    ort.append(rueckfrage);
    frage.textContent = text;
    ja.textContent = jaText;
    aktion = wennJa;
    rueckfrage.hidden = false;
    // Zuerst das Harmlose im Fokus (Befund Barrierefreiheit).
    nein.focus();
  }

  const liste = el('ol', { klasse: 'sprung-liste' }, status.map(({ id, status: art }, stelle) => {
    const auftrag = auftraege[stelle];
    const name = fuelle(t.sprungZiel, { nr: stelle + 1, kunde: auftrag.kunde });
    if (art !== 'ziel') {
      return el('li', {}, el('span', { klasse: 'sprung-fertig', text: `${name} (${zusatz[art]})` }));
    }
    const eintrag = el('li', {});
    eintrag.append(knopf(name, () => frageNach(
      eintrag,
      fuelle(t.sprungFrage, { kunde: auftrag.kunde }),
      t.sprungJa,
      () => {
        app.speicher.merkeVorSprung(app.stand);
        app.setze(springeZuAuftrag(app.stand, id, auftraege, regeln));
        nav.zu('heim', { gruss: fuelle(t.sprungGemacht, { kunde: auftrag.kunde }) });
      },
    ), 'knopf-zweit sprung-knopf'));
    return eintrag;
  }));

  const zurueckOrt = el('div', { klasse: 'sprung-zurueck' });
  const zurueck = vorher ? knopf(t.sprungZurueck, () => frageNach(zurueckOrt, t.sprungZurueckFrage, t.sprungZurueckJa, () => {
    app.speicher.vergissVorSprung();
    // Geprüft wird der Lauf erst, wenn seine Aufgaben geladen sind (E-054, Befund Code-Prüfer).
    app.setzeUngeprueft(vorher);
    nav.zu('heim', { gruss: t.sprungZurueckGemacht });
  }), 'knopf-zweit') : null;
  if (zurueck) zurueckOrt.append(zurueck);

  const auswahl = hatZiele
    ? el('details', { klasse: 'eintrag sprung-auf', open: offen }, el('summary', { text: t.sprungWaehlen }), liste)
    : el('p', { klasse: 'klein', text: t.sprungNichts });
  const karte = el('section', { klasse: 'karte', id: 'springen' },
    el('p', { klasse: 'etikett', text: t.sprungEtikett }),
    el('p', { text: t.sprungInfo }),
    auswahl,
    zurueck ? zurueckOrt : null);
  if (offen) {
    // Erst nach dem Einfügen in die Seite lässt sich dorthin scrollen.
    requestAnimationFrame(() => {
      karte.scrollIntoView({ block: 'start' });
      (auswahl.querySelector('summary') ?? auswahl).focus?.({ preventScroll: true });
    });
  }
  return karte;
}
