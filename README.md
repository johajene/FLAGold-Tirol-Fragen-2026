# Feuerwehr LernApp

Offline-fähige Browser-LernApp für die Multiple-Choice-Fragen aus dem Feuerwehrwesen.

## Funktionen

- Übungsmodus mit sofortiger Rückmeldung
- Prüfungsmodus mit 30 Zufallsfragen
- 1 Punkt pro Frage
- bestanden ab 80 % bzw. 24 von 30 Punkten
- Fehlertraining mit automatisch geführter Fehlerliste
- Antworten werden bei jeder Frage neu gemischt
- lokaler Fortschritt über den Browser-Speicher
- PWA-Dateien für Nutzung am iPhone/Smartphone

## Wichtig für iOS

Eine PWA kann am iPhone nicht direkt aus einer ZIP-Datei installiert werden.
Sie muss über Safari von einer HTTPS-Adresse geöffnet werden, z. B. über GitHub Pages, Netlify, einen Webserver oder eine andere sichere Website.

Vorgehen:

1. Ordnerinhalt auf einen Webserver oder eine HTTPS-Seite hochladen.
2. Seite in Safari am iPhone öffnen.
3. Teilen-Symbol antippen.
4. „Zum Home-Bildschirm“ wählen.
5. App einmal online öffnen, damit die Dateien gecacht werden.
6. Danach funktioniert sie offline.

## Lokal am PC testen

Im entpackten Ordner einen einfachen lokalen Server starten:

```bash
python -m http.server 8080
```

Danach im Browser öffnen:

```text
http://localhost:8080
```

Direktes Öffnen der `index.html` per Doppelklick kann je nach Browser die Datei `questions.json` blockieren.
