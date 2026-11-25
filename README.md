# Reeksstats

Voetbalstatistieken van 1e Afdeling/D1 tot 4e Provinciaal, met data van RBFA.

## Bestanden

- `index.html`: de website
- `data.js`: de cijfers voor de België-pagina (wordt elke week vernieuwd)
- `collector.js`: haalt de wedstrijdbladen op en rekent alles uit
- `update.mjs` + `.github/workflows/update.yml`: automatisch bijwerken via GitHub
- `update.html`: met de hand bijwerken in je browser (reserveplan)

## Automatisch elke zondag (GitHub, gratis)

1. Maak een account op github.com en een nieuwe repository, bv. `reeksstats` (Public).
2. Upload alle bestanden, ook de map `.github` (tip: GitHub Desktop of `git push`).
3. Settings → Pages → Source: "Deploy from a branch", branch `main`, map `/ (root)` → Save.
   Je site komt op `https://amer-gh.github.io/reeksstatus-/`.
4. Tabblad Actions → "Reeksstats bijwerken" → **Run workflow** (de eerste keer duurt dat ongeveer 70 minuten).
5. Daarna loopt het vanzelf: zondag rond 20-21u, maandagochtend en donderdagochtend. Een update duurt dan enkele minuten.

De reekspagina's (mijn ploeg, uitslagen, week, maand, kaarten, minuten, klassement) halen hun cijfers altijd live bij RBFA.

## Regels

- Goals = gewone goals + penaltygoals. Eigen doelpunten tellen niet.
- Speler van de week: meeste goals van maandag tot zondag. Wisselt zondag om 22u.
- Speler van de maand: meeste goals in de volledige maand. Wisselt op de 1e van de maand.
- Evenveel goals = gedeelde plaats.
- RBFA laat 200 verzoeken per minuut toe; de scripts blijven daaronder.
