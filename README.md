# NEET stopa mladih u Europi

Projekt za kolegij Vizualizacija podataka.

## Podaci

Podaci su preuzeti iz Eurostat skupa TESEM150:

https://ec.europa.eu/eurostat/databrowser/product/page/TESEM150

Lokalno su spremljene dvije datoteke:

- `data/eurostat_tesem150_raw.json` - izvorni odgovor Eurostat API-ja
- `data/neet.json` - obrađeni podaci koje koristi D3 aplikacija
- `data/europe-countries.geojson` - izvorne granice država iz Eurostat GISCO servisa
- `data/europe-neet.geojson` - smanjena karta Europe za države iz NEET skupa

Obrada se može ponoviti naredbom:

```bash
node scripts/process-eurostat.mjs
```

## Funkcionalnosti

- odabir godine, dobi i spola
- karta Europe s prostornom raspodjelom NEET stope
- promjena sortiranja država
- animacija vremenskog prikaza po godinama
- usporedba više odabranih država
- povezivanje karte, stupčastog, linijskog i grupiranog stupčastog grafikona
- D3 Enter/Update/Exit obrazac uz tranzicije
