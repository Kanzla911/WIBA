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

- **Einer hostet:** einfach „Spiel hosten“ klicken. Beim ersten Mal fragt die Windows-Firewall –
  „Zugriff zulassen“ anklicken. Am Startbildschirm steht unten die eigene IP-Adresse.
- **Die anderen:** IP-Adresse des Hosts eintragen und **Beitreten** klicken.
- **Gleiches WLAN/LAN:** funktioniert sofort.
- **Übers Internet:** entweder am Router Port **31337 (TCP)** zum Host-PC weiterleiten und die
  öffentliche IP verwenden – oder alle installieren ein kostenloses VPN wie Tailscale, ZeroTier
  oder Radmin VPN und nehmen die dort angezeigte IP.

Die Welt (alles Gegrabene und Gebaute) wird beim Host gespeichert und bleibt erhalten.
Geld, Inventar und WIBA-Punkte speichert jeder Spieler für sich.

## Die Spielwelt

Die Karte bildet die Region **Vöcklabruck – Attersee – Weißenbachtal** verkleinert nach (ca. 2 × 2 km Spielfläche,
Norden ist oben auf der Minimap):

- **Vöcklabruck** im Norden: Stadtplatz mit den beiden Stadttürmen, Hinterstadt mit Stadtpfarrkirche, Maria Schöndorf
  auf der Anhöhe, Bahnhof, Stadtpark an der Vöckla, Tischlerei, Tankstelle – östlich davon die Baustelle mit den Baggern.
- **Vöckla und Ager**: die Ager fließt vom Nordende des Attersees über Lenzing Richtung Vöcklabruck und nimmt dort die Vöckla auf.
- **A1, B1, B151** und die Uferstraßen verbinden alles; dazu Timelkam, Lenzing, Gampern, St. Georgen, Vöcklamarkt.
- **Attersee**: Seewalchen und Schörfling mit Schloss Kammer am Nordende, Attersee und Nußdorf am Westufer,
  Weyregg, Steinbach und Weißenbach am Ostufer, Unterach im Süden – mit Stegen, Strandbädern und Segelbooten.
- **Gahberg**: Serpentinenstraße von Weyregg hinauf, auf halber Höhe der Schneiderbauerhof, oben Kapelle und Sternwarte.
- **Weißenbachtal** und **Höllengebirge** im Südosten: eingeschnittenes Tal mit Bach, Nixenfall und dem Betriebshof Nöhmer Stein & Beton.

Gelände, Seeumriss, Straßen und Ortslagen sind aus der topografischen Karte abgeleitet. Einzelne Gebäude innerhalb der Orte
(z. B. die Betriebe) stehen an plausiblen, aber nicht vermessenen Stellen. Der Flugplatz im Nordwesten ist erfunden – irgendwo müssen die Jets ja starten.

Rund 150 **NPCs** beleben die Orte: Sie grüßen, weichen Autos aus, laufen bei Schüssen davon und kommentieren, was du so treibst.
**Radio Salzburg** läuft im Hintergrund (offizieller ORF-Livestream, braucht Internet; `M` = an/aus, `,` `.` = Lautstärke).
Du startest mit **15 Bier** – `B` trinkt eins, auch am Steuer: Lenkung und Sicht werden mit jedem Promille schwammiger.

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
| `B` · `M` | Bier trinken · Radio an/aus |

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
