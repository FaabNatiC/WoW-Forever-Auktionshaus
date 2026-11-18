# Gold-Rechner · WoW Forever

Private Web-App (PWA) für WoW Forever: Gewinn pro Craft für Forever-Rezepte, alle Auktionshaus-Preise und Preisverlauf. Markt: **Normal (PvE), EU**, Allianz, Horde und Blackwater.

**App:** https://faabnatic.github.io/WoW-Forever-Auktionshaus/

## Funktionen

- **Rezepte:** Gewinn und Marge pro Craft, Sortierung, „nur profitable“, Filter nach eigener Fertigkeit
- **Mengenrechner:** Gesamtkosten und Gewinn für X Crafts, Einkaufsliste zum Kopieren, Warnung bei zu wenig Material im AH
- **Auktionshaus:** alle gehandelten Items mit Suche (deutsch/englisch/ID), Kategorien, Vergleich mit dem 7-Tage-Schnitt
- **Preisverlauf:** 7 Tage stündlich, 30 Tage täglich (baut sich ab dem ersten Lauf auf)
- **Deutsche Forever-Namen und Icons** direkt aus der Blizzard-API (auch für neue Forever-Items)
- **Merkliste**, Hell/Dunkel, zweispaltig am PC, Item-Icons

## Aufbau

| Datei | Zweck |
|---|---|
| `index.html` | die App |
| `items.json` | Grunddaten: englische Namen, Kategorien, Icon-Namen |
| `update.js` | holt Preise und Namen, schreibt den Verlauf |
| `package.json` | markiert `update.js` als ES-Modul |
| `.github/workflows/update.yml` | startet `update.js` jede Stunde |
| Branch `data` | Daten (`latest.json`, `h/` stündlich, `d/` täglich, `names.json` deutsche Namen/Icons), wird bei jedem Lauf ersetzt |

Die Preisdaten liegen bewusst in einem eigenen Branch, der bei jedem Lauf überschrieben wird. So wächst das Repo nicht mit jeder Stunde.

## Einrichtung

1. **Settings → Actions → General → Workflow permissions:** „Read and write permissions“
2. **Settings → Pages:** „Deploy from a branch“, `main`, `/ (root)`
3. **Settings → Secrets and variables → Actions:** `BLIZZARD_CLIENT_ID` und `BLIZZARD_CLIENT_SECRET` (Client von develop.battle.net)
4. **Actions → „Preise aktualisieren“ → Run workflow** (erster Lauf von Hand)

Hinweis: GitHub pausiert geplante Workflows nach 60 Tagen ohne Aktivität im Repo und schickt dann eine E-Mail. Mit einem Klick unter „Actions“ läuft er wieder.

## Datenquellen

- **AH-Preise:** Blizzard-API (Forever, EU). Fällt sie aus, springt [forever-prices](https://github.com/mkborik-cloud/forever-prices) ein. Die genutzte Quelle steht in der App unter Einstellungen.
- **Item-Namen/Icons:** Blizzard-API (deutsch), je Lauf bis zu 1.500 Items, bis alle da sind
- **Rezepte:** Forever-Client laut [ForeverDB.net](https://foreverdb.net)
- **Grunddaten:** [wow-classic-items](https://github.com/nexus-devs/wow-classic-items) (MIT), Icon-Grafiken © Blizzard Entertainment
- Häuser-Zuordnung Normal = 111/114/117 ist eine Annahme

## Geplant

- Bester Verkaufszeitpunkt (nach Wochentag/Uhrzeit), sobald genug Verlauf vorhanden ist

Nicht mit Blizzard Entertainment verbunden.
