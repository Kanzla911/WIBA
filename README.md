# WIBA 🍌🚜

**Wichsen & Baggerfahren** – das Multiplayer-Open-World-Spiel übers Nichtstun.

Ein Low-Poly-Cartoon-Sandbox-Spiel für Windows: Bagger fahren, Bunker graben, Waffen schmieden,
Flieger und Kampfjets fliegen, im Wirtshaus versumpern – und nebenbei die Banane auf Hochglanz wichsen.

## Spielen

1. **WIBA.exe** herunterladen: [aktuelle Version](../../releases/latest/download/WIBA.exe)
   (oder unter *Releases* / *Actions* im Repository).
2. Doppelklick. Keine Installation nötig.
   Windows zeigt beim ersten Start evtl. „Der Computer wurde durch Windows geschützt“ →
   *Weitere Informationen* → *Trotzdem ausführen* (die EXE ist nicht signiert).
3. Namen eintragen und **Spiel hosten / Solo** klicken.

### Mit Freunden spielen

1. **Einer hostet:** „Spiel hosten" klicken. Oben rechts erscheint der **Spielcode** (6 Zeichen, z. B. `K7M2QX`). Der Code bleibt bei jedem Start gleich.
2. **Die anderen:** Code eintippen, „Beitreten" klicken. Fertig – im selben WLAN oder übers Internet, ohne Router-Einstellungen.
3. Alle brauchen dieselbe Spielversion.

Die Verbindung läuft direkt zwischen euren PCs (WebRTC); nur zum Finden über den Code wird der öffentliche PeerJS-Vermittlungsdienst benutzt.
In manchen Netzen (z. B. Handy-Hotspot, strenge Firmen-/Schulnetze) klappt die Direktverbindung nicht – dann statt des Codes die
IP-Adresse des Hosts eintragen (gleiches WLAN) oder ein VPN wie Tailscale/Radmin benutzen.

Die Welt (alles Gegrabene und Gebaute) wird beim Host gespeichert und bleibt erhalten.
Geld, Inventar und WIBA-Punkte speichert jeder Spieler für sich.

## Die Spielwelt

Die Welt ist die **echte Region Vöcklabruck – Attersee – Höllengebirge im Maßstab 1:1** (ca. 24 × 30 km):

- **Gelände** aus einem echten Höhenmodell – vom Vöckla-Ager-Tal über den Attersee (469 m) bis zum Großen Höllkogel (1862 m).
- **Jedes Gebäude** aus OpenStreetMap an seiner echten Stelle, mit echtem Grundriss; Höhe, Geschosse und Dachform, wo sie eingetragen sind.
- **Straßen, Wege, Bahn, Brücken, Flüsse, Seen, Wälder, Felder** nach echten Daten.
- **Orte, Wirtshäuser, Werkstätten, Läden, Tankstellen, Gipfel, Sehenswürdigkeiten** als Punkte in der Welt und auf der Karte.
- Du startest am Stadtplatz Vöcklabruck. Zum Attersee sind es wie in echt rund 9 km – nimm ein Auto.

**Karte:** Die Minimap zeigt die Umgebung. `M` öffnet die große Karte: ziehen, zoomen, Klick setzt einen Wegpunkt.
Dort siehst du Orte, Wirtshäuser, Läden, Fahrzeuge und alle Mitspieler.

Fassaden, Fenster und Dächer werden aus den Daten erzeugt (keine Fotos). Wirtshäuser, Werkstätten und Läden sind die echten
Einträge aus OpenStreetMap; „Der Franz" steht erfunden in jedem größeren Ort. Gibt es im Gebiet keinen echten Flugplatz,
legt das Spiel eine Graspiste auf dem flachsten Wiesenstreifen bei Vöcklabruck an.

**NPCs** tauchen rund um Orte und Betriebe auf. **Radio Salzburg** läuft im Hintergrund (`P` = an/aus, `,` `.` = Lautstärke).
Du startest mit **15 Bier** – `B` trinkt eins, auch am Steuer.

### Karte neu bauen

Die Kartendaten liegen in `public/world`. Sie werden von der GitHub-Aktion „Karte bauen (echte Daten)" erzeugt
(Österreich-Auszug von Geofabrik, mit `osmium` zugeschnitten, plus Höhenkacheln) und ins Repository geschrieben.
Daten: © OpenStreetMap-Mitwirkende (ODbL); Höhen: Terrarium/Mapzen.

## Was man tun kann

| | |
|---|---|
| 🚜 **Baggerfahren** | Auf der Baustelle östlich von Vöcklabruck stehen Bagger. Graben, Erde abladen, Gruben und Rampen bauen. |
| 🕳️ **Bunker bauen** | Grube ausheben, in der Werkstatt Betonplatten und -wände herstellen, Deckel drauf – hält Bomben ab. |
| ⛏️ **Erz finden** | Beim Graben fallen Eisenerz, Kohle und Schwefel ab – je tiefer, desto mehr. |
| 🔫 **Waffen schmieden** | Werkstatt im Dorf: Pistole, Schrotflinte, Sturmgewehr, Panzerfaust, Granaten, Munition. |
| ⚔️ **PvP** | Kopfschüsse, Raketen, Überfahren, Baggerschaufel – 50 € Kopfgeld pro Abschuss. |
| ✈️ **Fliegen** | Propellerflieger (Jauchebomben) und Kampfjets (Bord-MG, Raketen, Bomben) am Flugplatz im Nordwesten. Schleudersitz + Fallschirm inklusive. |
| 🍺 **Wirtshaus & Franz** | Bier, Marillenschnaps, Leberkässemmel – und beim Franz hinterm Stadl Kräuterzigaretten, Zauberschwammerl und Turbo-Pulver. Alles mit Wirkung (und Nebenwirkung). |
| 🍌 **WIBA-Punkte** | Banane auswählen, Linksklick halten: Banane wird auf Hochglanz gewichst. Oder einfach im Bagger sitzen und nix tun. Wer am wenigsten leistet, führt die Rangliste an. |
| 💰 **Handeln** | Erde und Erz beim Schrotthandel verkaufen, Munition und Raketen kaufen. |
| 🌗 **Sonstiges** | Tag/Nacht-Wechsel, Minimap, Chat, Rangliste, Hupe, Filmriss bei zu viel Schnaps. |

## Steuerung

**F1** zeigt im Spiel die komplette Übersicht.

| Zu Fuß | |
|---|---|
| `W A S D` / `Shift` / `Leertaste` | gehen / rennen / springen (in der Luft: Fallschirm) |
| `1`–`9`, Mausrad | Gegenstand wählen |
| Linksklick | benutzen, schießen, graben, bauen |
| Rechtsklick | zielen · mit Schaufel: Erde auffüllen |
| `R` | nachladen · Bauteil drehen |
| `E` | einsteigen / aussteigen / Laden öffnen |
| `I` · `Tab` · `Enter` | Inventar · Rangliste · Chat |
| `M` | große Karte (Klick = Wegpunkt) |
| `B` · `P` | Bier trinken · Radio an/aus |

| Bagger | |
|---|---|
| `W S` / `A D` | fahren / lenken |
| Maus | Oberwagen drehen, Arm aus- und einfahren |
| Linksklick / Rechtsklick | graben / Erde abladen |
| `H` | Hupe |

| Flieger & Kampfjet | |
|---|---|
| `W S` | Schub |
| Maus oder Pfeiltasten | zurückziehen = Nase hoch, seitlich = rollen |
| `A D` | Seitenruder |
| Linksklick / Rechtsklick | Bord-MG / Rakete (nur Jet) |
| `Leertaste` | Bombe abwerfen |
| `E` | aussteigen – in der Luft: Schleudersitz |

`F11` Vollbild · `ESC` Maus freigeben. Auf schwachen Laptops am Startbildschirm **Grafik: Niedrig** wählen.

## Selber bauen (für Entwickler)

Voraussetzung: [Node.js](https://nodejs.org) 18 oder neuer.

```bash
npm install
```

```bash
npm start
```

Die fertige `dist/WIBA.exe` erzeugen:

```bash
npm run dist
```

Jeder Push baut die EXE außerdem automatisch über GitHub Actions (`.github/workflows/build.yml`)
und legt sie als Release „WIBA – aktuelle Version“ ab.

Eigener Server ohne Spielfenster (z. B. auf einem Mini-PC, Port 31337):

```bash
npm run server
```

Server-Schnelltest:

```bash
npm test
```

## Technik

- **Spiel:** Three.js (WebGL), eigener Low-Poly-Cartoon-Stil, alle Modelle und Sounds werden im Code erzeugt – keine fremden Assets.
- **Multiplayer:** eingebauter WebSocket-Server (`server.js`), der Host ist gleichzeitig Server.
- **Desktop-App:** Electron (`main.js`), gepackt mit electron-builder als portable EXE.
