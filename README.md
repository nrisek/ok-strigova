# OK Štrigova

Web aplikacija Odbojkaškog kluba Štrigova: raspored, rezultati i poredak svih ekipa kluba na jednom mjestu.
Podaci se automatski preuzimaju sa stranica županijskih saveza ([osvz.hr](https://osvz.hr) i
[osmz.hr](https://www.osmz.hr)), koje nemaju API, pa se čitaju iz HTML-a.

## Što aplikacija radi

- naslovnica: sljedeća utakmica, nadolazeće utakmice, zadnji rezultati i mjesto svake ekipe u ligi
- stranica ekipe: poredak s istaknutom ekipom i cijeli raspored po kolima
- stranica natjecanja: sve skupine, poredak i sve utakmice lige
- popis svih utakmica kluba po mjesecima
- iCal kalendar (`/kalendar.ics` za sve ekipe, `/kalendar/<ekipa>.ics` po ekipi) za pretplatu na mobitelu

Ekipe se prepoznaju po imenu (`OK Štrigova`, `OK Štrigova 2`, …), a natjecanja se otkrivaju automatski iz
izbornika na stranicama saveza. Ligu koju oba saveza objavljuju s istim utakmicama (npr. U13) aplikacija
prikazuje samo jednom.

## Struktura

```
apps/web/           Astro site (statički build)
packages/scraper/   TypeScript scraper: dohvat, parsiranje (cheerio), deduplikacija
data/snapshot.json  generirani podaci; jedini ulaz u web aplikaciju
.github/workflows/  CI, periodični scrape i deploy na GitHub Pages
```

Scraper čita tri vrste stranica saveza:

| stranica | URL | daje |
| --- | --- | --- |
| natjecanje | `index.php?rubrika=utakmica&natjecanje=<id>` | poredak (po skupinama) i sve utakmice po kolima |
| ekipa | `index.php?rubrika=ekipa&obrazac=1&id=<id>` | klub, dvoranu, kategoriju, kontakt |
| utakmica | `index.php?rubrika=utakmica&obrazac=1&id=<id>` | vrijeme početka, dvoranu, suce, trajanje |

Detalji utakmica dohvaćaju se samo za utakmice ekipa kluba. Jedan puni prolaz je oko 35 HTTP zahtjeva s
razmakom od pola sekunde, s jasnim `User-Agent` zaglavljem.

## Razvoj

Potreban je Node 22.12+ i pnpm (`corepack enable`).

```bash
pnpm install
pnpm scrape             # dohvati podatke u data/snapshot.json
pnpm dev                # Astro dev server na http://localhost:4321
pnpm test               # testovi parsera nad spremljenim HTML-om (packages/scraper/fixtures)
pnpm typecheck
pnpm build              # statički site u apps/web/dist
```

Za razvoj scrapera koristan je lokalni keš HTML-a, pa stranice saveza ne opterećujemo kod svakog pokretanja:

```bash
pnpm scrape -- --cache          # sprema sirovi HTML u packages/scraper/.cache
pnpm scrape -- --no-details     # preskače stranice pojedinih utakmica
```

Ako se promijeni HTML saveza, prvo padaju testovi nad `fixtures/`; nove verzije stranica spremite tamo i
prilagodite parsere u `packages/scraper/src/parse/`.

## Objava

Workflow `Osvježi podatke` 4 puta dnevno pokreće scraper, zapisuje promjene u `data/` i objavljuje site.
Workflow `Deploy` gradi site za GitHub Pages, ali tek kad se postave:

1. Settings → Pages → Source: **GitHub Actions**
2. Settings → Secrets and variables → Actions → Variables: `DEPLOY_PAGES` = `true`

Site je tada na `https://<korisnik>.github.io/ok-strigova`. Za vlastitu domenu postavite još varijable
`SITE_URL` (npr. `https://okstrigova.hr`) i `BASE_PATH` (`/`). Umjesto GitHub Pagesa jednako radi bilo koji
statički hosting (Netlify, Vercel, Cloudflare Pages): build naredba `pnpm build`, izlazna mapa `apps/web/dist`.

## Planirano

Zasad je aplikacija samo javni prikaz podataka. U planu je proširenje u aplikaciju za sve oko kluba:
prijava dolaska na trening, unos treninga, obavijesti i dashboard. To traži prijavu korisnika i bazu, pa će
Astro tada dobiti server adapter ili zasebni backend; postojeći statički dio ostaje kakav jest.
