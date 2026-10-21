# Wortwerk – Englisch bis C1

Vokabeltrainer als Web-App (PWA) nach dem Vorbild von Vocabuo – mit drei Erweiterungen:

1. **Geschichten:** Nach je 10 neuen Wörtern (einstellbar) schreibt die KI eine kurze Geschichte, die genau diese Wörter verbindet – mit Vorlesefunktion, Verständnisfragen und Lückentext.
2. **FSRS-5** statt fester Stufen: vier Bewertungen (Nochmal / Schwer / Gut / Leicht), Intervalle passen sich jedem Wort an.
3. **C1-orientierte Karten:** Niveau-Tags (B1–C1), Themen, Kollokationen, False-Friend-Warnungen.

## Funktionen

- Startseite mit Serie, Tageskarte (fällige + neue Wörter) und Fortschritt Richtung C1
- Lernkarten: deutsche Bedeutung + Lückensatz → englisches Wort, optional eintippen, Hinweis, „Kenne ich schon“
- Wortschatz mit Suche, Filter nach Niveau, eigene Wörter, **„Mit KI ausfüllen“** und **„Wortliste mit KI erweitern“**
- Statistik: Fälligkeiten, Gedächtnisstabilität, Aktivität, Trefferquote (einheitliche Definition: „gelernt“ = Intervall ≥ 21 Tage)
- Offline-fähig, auf dem iPhone als App installierbar, Sprachausgabe über die eingebaute Stimme
- Sicherung als JSON herunterladen / laden

## Lokal starten (Mac)

Voraussetzung: Node.js 18+ (`brew install node`).

```bash
git clone https://github.com/my-project-26/Sprachen.git
cd Sprachen
cp .env.example .env      # dann ANTHROPIC_API_KEY eintragen
node server.js
```

Dann <http://localhost:5173> öffnen. Ohne API-Key funktioniert alles außer den KI-Funktionen; Geschichten gehen dann über den **manuellen Modus** (Prompt kopieren → in der Claude-App einfügen → Antwort zurück einfügen).

API-Key: <https://console.anthropic.com> → API Keys. Eine Geschichte kostet je nach Modell nur Bruchteile eines Cents bis wenige Cent.

## Online stellen (Vercel, kostenlos)

1. Auf <https://vercel.com> mit GitHub anmelden → **Add New → Project** → Repo `Sprachen` importieren (keine Build-Einstellungen nötig).
2. Unter **Settings → Environment Variables** eintragen:
   - `ANTHROPIC_API_KEY` = dein Schlüssel
   - `APP_SECRET` = ein langes Passwort (schützt deine KI-Kosten, da die URL öffentlich ist)
   - optional `ANTHROPIC_MODEL` (Standard `claude-sonnet-5-5`, günstiger `claude-haiku-5-5`)
3. Deployen. In der App unter **Einstellungen → KI-Server** das `APP_SECRET` eintragen und „Verbindung testen“.

**Auf dem iPhone installieren:** URL in Safari öffnen → Teilen → „Zum Home-Bildschirm“.

> Der Lernfortschritt liegt im Browser des jeweiligen Geräts. Für einen Gerätewechsel: Einstellungen → Sicherung herunterladen / laden.

## Aufbau

```
index.html, styles.css     Oberfläche
js/app.js                  Ansichten und Ablauf
js/fsrs.js                 FSRS-5-Planer
js/store.js                Speicherung (localStorage), Tageslogik
js/words.js                Startwortschatz B1–C1 (139 Wörter, nach Thema)
js/prompts.js              KI-Prompts (von Server und manuellem Modus genutzt)
js/api.js, js/tts.js       Server-Aufrufe, Sprachausgabe
api/story.js               POST: Geschichte erzeugen
api/words.js               POST: Wörter generieren / Karte ausfüllen
api/health.js              GET: Verbindungstest
server.js                  lokaler Server ohne Abhängigkeiten
sw.js, manifest.webmanifest PWA / Offline
```

## Ideen für die nächsten Schritte

- Eigene Sätze schreiben mit KI-Korrektur (aktive Produktion für C1)
- Wortfamilien (*establish → establishment → established*) als eigene Kartenseite
- Synchronisierung zwischen Geräten (z. B. Supabase)
- Wechselnde Beispielsätze pro Wiederholung
- FSRS-Parameter aus den eigenen Wiederholungsdaten optimieren
