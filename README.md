# Reeksstats

Voetbalstatistieken van 1e Afdeling/D1 tot 4e Provinciaal, met data van RBFA.
Site: https://amer-gh.github.io/reeksstatus-/

## Bestanden

- `index.html`: de website (pagina België + pagina Reeksen)
- `data.js`: de cijfers voor de België-pagina
- `collector.js`: haalt de wedstrijdbladen op en rekent alles uit
- `update.html`: vernieuwt `data.js` vanuit je browser en zet het op GitHub
- `update.mjs`: hetzelfde voor op je eigen pc met Node (optioneel)

## Elke zondag bijwerken

RBFA blokkeert servers (zoals GitHub), dus het bijwerken gebeurt vanuit je eigen browser:

1. Open https://amer-gh.github.io/reeksstatus-/update.html
2. De eerste keer: maak een GitHub-sleutel (uitleg staat op de pagina) en plak hem erin.
3. Klik **Bijwerken en publiceren**. De eerste keer duurt dat ~70 minuten, daarna enkele minuten.
4. De site is 1 à 2 minuten later bijgewerkt.

De reekspagina's (mijn ploeg, uitslagen, topscorers, spelers van de week/maand, kaarten, minuten, klassement) halen hun cijfers altijd live bij RBFA.

## Regels

- Goals = gewone goals + penaltygoals. Eigen doelpunten tellen niet.
- Speler van de week: meeste goals van maandag tot zondag. Wisselt zondag om 22u.
- Speler van de maand: meeste goals in de volledige maand. Wisselt op de 1e van de maand.
- Evenveel goals = gedeelde plaats.
- RBFA laat 200 verzoeken per minuut toe; de scripts blijven daaronder.
