# Bed voor Roan

Zelfbouwbed (standaard 90 × 200 cm) als interactieve webapp: kamer in 3D, ontwerp met kostprijs, zaaglijst, montagehandleiding in IKEA-stijl en een winkelmandje.

## Openen

Het is een statische pagina zonder build-stap. Start een lokale webserver in deze map (ES-modules werken niet via `file://`):

```bash
python3 -m http.server 8000
# open http://localhost:8000
```

Three.js wordt geladen van jsDelivr, dus je hebt internet nodig.

## Tabbladen

| Tab | Wat |
|---|---|
| Ruimte | Kamermaten, deur, ramen en bestaande meubels. Laad een 3D-scan (.glb/.obj, bijv. Polycam of 3d Scanner App) en meet met het meetlint. |
| Ontwerp | Matrasmaat, bedhoogte, hoofdbord, lattenbodem, afwerking en plek in de kamer. Controleert botsingen met muren, radiator, deur en de vrije ruimte voor kast en bureau. |
| Kosten | Materiaallijst, totaal per categorie en zaaglijst per handelslengte. |
| Handleiding | Montagehandleiding met lijntekeningen uit het model. Afdrukken via de browser (A4, staand). |
| Winkelmandje | Boodschappenlijst met aanpasbare aantallen en prijzen, afvinken, zoeklinks naar GAMMA, KARWEI en HORNBACH, kopiëren als tekst. |

## Let op

- De kamermaten zijn **geschat uit foto's**. Meet ze na en vul ze in op het tabblad Ruimte.
- Prijzen zijn **indicatief** (najaar 2026) en niet live gecontroleerd.
- Instellingen worden alleen lokaal in je browser bewaard.

## Constructie (90 × 200)

- Poten vuren 70 × 70 mm. Hoofdeinde 90 cm hoog, voeteinde 39 cm.
- Kop- en zijbalken vuren 44 × 144 mm. Kopbalken vast tussen de poten, zijbalken met bedverbinders, dus het bed is uit elkaar te halen.
- Draaglatten 22 × 44 mm. Bedlatten 18 × 70 mm (16 stuks, ± 57 mm tussenruimte) of een rolbodem.
- Vanaf 120 cm breed: een middenbalk met 2 poten.

## Code

- `js/bed.js` — parametrisch model (onderdelen, bevestiging, montagestappen)
- `js/costs.js` — prijscatalogus, zaaglijst-optimalisatie, kostprijs
- `js/room.js` — kamermodel en plaatsingscontroles
- `js/viewer.js` — 3D-weergave, scan-import, meten
- `js/manual.js` — handleiding (lijntekeningen + pictogrammen)
- `js/app.js` — interface en winkelmandje
