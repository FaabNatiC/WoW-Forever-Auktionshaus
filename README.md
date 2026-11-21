# Forever AH · WoW Forever

Private Web-App (PWA) für WoW Forever: alle Auktionshaus-Preise mit Preisverlauf, dazu Gewinn pro Craft für Forever-Rezepte. Markt: **Normal (PvE), EU**, Allianz, Horde und Blackwater.

**App:** https://faabnatic.github.io/WoW-Forever-Auktionshaus/

## Funktionen

- **Auktionshaus (Start):** alle gehandelten Items mit Suche (deutsch/englisch/ID), Kategorien, Vergleich mit dem 7-Tage-Schnitt, Filter-Fenster (ab 5 Auktionen, Qualität, unter/über Ø, nur Items aus meinen Berufen)
- **Einheitlicher Aufbau** in Auktionshaus, Rezepten und Merkliste: Suche und Fraktion in einer Zeile, Chips, Filterzeile, Sortierung über der Liste
- **Rezepte:** alle Forever-Rezepte aller Berufe (Blizzard-API, wöchentlich), Gruppen (Veredeln, Rüstung, Waffen, Verbrauchbar, Taschen & Zubehör, Sonstiges), Filter-Fenster mit Beruf, Kategorie wie im Spiel, Fertigkeit, „im AH“, „profitabel“ und „ab 5 Auktionen“
- **Sortierung** direkt über jeder Liste (Rezepte: Gewinn, Marge, Angebot, Fertigkeit, Name · AH: Angebot, Preis, Abweichung vom Ø, Name), erneutes Tippen dreht die Richtung um, Händlerpreise für Materialien
- **Meine Berufe:** Berufe in den Einstellungen ein-/ausblenden, Fertigkeit je Beruf
- **Rezept-Rechner:** Gewinn und Marge pro Craft, Sortierung, „nur profitable“, Filter nach eigener Fertigkeit
- **Mengenrechner:** Gesamtkosten und Gewinn für X Crafts, Einkaufsliste zum Kopieren, Warnung bei zu wenig Material im AH
- **Tooltips wie im Spiel:** im Item-Detail Icon oder Namen antippen, in Listen lange aufs Icon drücken (Daten: Blizzard-API, `tips/` im Daten-Branch)
- **Bester Zeitpunkt:** Kaufen/Verkaufen nach Wochentag und Uhrzeit (4-Stunden-Blöcke, Serverzeit), Heatmap, Hinweis zur Belastbarkeit, Zeitfenster mit wenig Konkurrenz
- **Preisverlauf:** mit Preisachse, Datumsmarken, Schnittlinie und Antippen für Werte; 7 Tage stündlich, 30 Tage täglich (baut sich ab dem ersten Lauf auf)
- **Deutsche Forever-Namen und Icons** direkt aus der Blizzard-API (auch für neue Forever-Items)
- **Item-Detail:** Zurück-Knopf, Position („3 von 120“), Vorheriges/Nächstes, Wischen zum Blättern
- **Update-Hinweis:** Banner bei neuer App-Version, danach „Was ist neu“ (auch unter Einstellungen)
- **App-Logo** für den Home-Bildschirm (Teilen → Zum Home-Bildschirm), **Teilen-Knopf** in den Einstellungen
- **Offline-Start:** öffnet auch ohne Netz mit dem letzten Preisstand (`sw.js`)
- **Merkliste**, Hell/Dunkel, zweispaltig am PC, Item-Icons

## Aufbau

| Datei | Zweck |
|---|---|
| `index.html` | die App |
| `sw.js` | Offline-Start (erst Netz, sonst letzter gespeicherter Stand) |
| `chars.json` | Charaktere (Realm, Name) für den späteren Ausrüstungsvergleich – Ausrüstung landet im Daten-Branch |
| `version.json` | aktuelle App-Version – bei jedem Update erhöhen, sonst erscheint kein Hinweis |
| `manifest.json`, `icon.svg`, `icon-192.png`, `icon-512.png`, `apple-touch-icon.png` | App-Name und Logo |
| `classic.json` | Fertigkeitswerte und Händlerpreise aus Classic (wow-classic-items) als Ergänzung zu Blizzard |
| `items.json` | Grunddaten: englische Namen, Kategorien, Icon-Namen |
| `update.js` | holt Preise und Namen, schreibt den Verlauf |
| `package.json` | markiert `update.js` als ES-Modul |
| `.github/workflows/update.yml` | startet `update.js` 6-mal pro Stunde (GitHub lässt geplante Läufe oft aus); veröffentlicht nur, wenn Blizzard einen neuen AH-Stand hat (manueller Start: immer). Alle 40 Tage ein kleiner Commit (`.keepalive`), damit GitHub den Zeitplan nicht pausiert. Hängt der Job, holt die App aktuellere Preise direkt über forever-prices nach. |
| Branch `data` | Daten (`latest.json`, `h/` stündlich, `d/` täglich, `w/` Wochenmuster, `names.json` deutsche Namen/Icons, `recipes.json` alle Rezepte), wird bei jedem Lauf ersetzt |

Die Preisdaten liegen bewusst in einem eigenen Branch, der bei jedem Lauf überschrieben wird. So wächst das Repo nicht mit jeder Stunde.

## Einrichtung

1. **Settings → Actions → General → Workflow permissions:** „Read and write permissions“
2. **Settings → Pages:** „Deploy from a branch“, `main`, `/ (root)`
3. **Settings → Secrets and variables → Actions:** `BLIZZARD_CLIENT_ID` und `BLIZZARD_CLIENT_SECRET` (Client von develop.battle.net)
4. **Actions → „Preise aktualisieren“ → Run workflow** (erster Lauf von Hand)

Hinweis: GitHub pausiert geplante Workflows nach 60 Tagen ohne Aktivität im Repo und schickt dann eine E-Mail. Mit einem Klick unter „Actions“ läuft er wieder.

## Datenquellen

- **AH-Preise:** Blizzard-API (Forever, EU). Fällt sie aus, springt [forever-prices](https://github.com/mkborik-cloud/forever-prices) ein. Die genutzte Quelle steht in der App unter Einstellungen.
- **Item-Namen/Icons:** Blizzard-API (deutsch), je Lauf bis zu 3.000 Items, Rezept-Items und viel gehandelte Items zuerst
- **Auktionshaus (Start):** alle gehandelten Items mit Suche (deutsch/englisch/ID), Kategorien, Vergleich mit dem 7-Tage-Schnitt
- **Rezepte:** Blizzard-API (Forever, Berufe und Rezepte, deutsch), Fertigkeitswerte vorerst aus Classic – können in Forever abweichen
- **Grunddaten:** [wow-classic-items](https://github.com/nexus-devs/wow-classic-items) (MIT), Icon-Grafiken © Blizzard Entertainment
- Häuser-Zuordnung Normal = 111/114/117 ist eine Annahme

## Geplant

- Bester Verkaufszeitpunkt (nach Wochentag/Uhrzeit), sobald genug Verlauf vorhanden ist

Nicht mit Blizzard Entertainment verbunden.
