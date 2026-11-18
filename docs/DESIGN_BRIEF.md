# Afterempire: Design Brief

## Concept: the Observatory and the Record Room
The site has two connected worlds:

- **The Observatory** (dark): a live instrument for watching empire through time. HUD panels, a glowing globe, a dotted earth. Used for **Territorial Ledger** and **Flows of Empire**.
- **The Record Room** (paper): the evidence behind the instrument. Folders, filing drawers, index cards, serif typography. Used for **Inherited Systems**, **Divergence Metrics**, **The Archive**, **Terms of Account** and **Correspondence**.

Moving from the dark instrument into the paper archive is deliberate: a site about colonial records should feel like one.

References (supplied screenshots): glowing wireframe globe; dotted particle globe; sci-fi HUD callout frames; stacked colour folder tabs; line-art filing drawer; the Globe of Economic Complexity (layout patterns: left rail, play intro, bottom filter strip); a dotted globe with floating labelled nodes. We borrow patterns, not any single site's look.

---

## Colour tokens

### Observatory (dark)
| Token | Value | Use |
|---|---|---|
| `--space` | `#030508` | page background |
| `--land-dot` | `#2a3a52` | land dots (dim, so empire colours pop) |
| `--grid` | `rgba(220,235,255,0.35)` | graticule lines |
| `--halo` | `#5fd3c6` → `#3b7bd8` | atmospheric rim glow |
| `--border-hist` | `rgba(170,190,220,0.25)` | faint historical borders |
| `--hud-line` | `#e8eef7` | panel frames, leader lines |
| `--hud-text` | `#c9d4e3` | panel body text |
| `--hud-dim` | `#6b7a90` | metadata, IDs |

### Record Room (paper)
| Token | Value | Use |
|---|---|---|
| `--paper` | `#e4e2dd` | page background |
| `--card` | `#f3f1ec` | cards, folders |
| `--ink` | `#111111` | text, line art |
| `--ink-dim` | `#6a6a6a` | metadata |
| `--marker` | `#f4e04d` | highlight label (yellow tag) |

### Empire colours (drawn from the interface palette)
| Empire | Paper pages | Dark Observatory | Notes |
|---|---|---|---|
| British | `#c23b2e` red | `#e2574a` | |
| French | `#1d3a6b` navy | `#5f7fc4` | |
| Portuguese | `#2a52d1` bright blue | `#8fb3ff` | the two blues are told apart by lightness, so always paired with a label |
| Dutch | `#977a3c` deep beige | `#e6dcc4` beige | dark text on the paper version |
| Other powers | `#b3b6bd` grey | `#7d828c` | Japan, Germany, Denmark, USA, etc., distinguished by label |

Development models: Soviet `#111111` (black), US / Bretton Woods `#6e737c` (grey), homegrown `#e6dcc4` (beige, ink outline); regional is an ink hatch. Text on any of these colours is white or ink, chosen by luminance (`--on-*` tokens, `textOn()` in systems.js). Separation between the colours passes in normal and colour-blind vision; because the palette is small, colour is never the only cue.

---

## Typography (Google Fonts)
- **Display / headings:** EB Garamond (serif). Wordmark, page titles, folder tabs in the Record Room.
- **Data / IDs / metadata:** IBM Plex Mono. HUD text, holding codes (`HLD-IND-GOA`), years, sources.
- **UI / body:** IBM Plex Sans. Menus, controls, paragraphs.

Wordmark: **Afterempire** in EB Garamond, with a small mono tag beneath: `TERRITORIAL LEDGER · 1800–2025`.

---

## Layout: Territorial Ledger (home)

```
┌──────────┬──────────────────────────────────────────────┐
│ AFTER-   │                                              │
│ EMPIRE   │                 ( globe )                    │   ┌─ HUD panel ─╮
│          │            dotted land, faint borders,       │───│ holding     │
│ ▶ Intro  │            bubbles, arcs, event callouts     │   │ details     │
│ [search] │                                              │   └─────────────┘
│ ◎ Globe  │                                              │
│ ▭ Flat   │                                              │
│ ─────    │                                              │
│ Ledger   │                                              │
│ Flows    │                                              │
│ Systems →│                                              │
│ Archive →│                                              │
│ ─────    │                                              │
│ Labels   │                                              │
│ Quiet    │                                              │
│ Contrast │                                              │
├──────────┴──────────────────────────────────────────────┤
│ ■ British  ■ French  ■ Portuguese  ■ Dutch  ■ Other     │  empire filter strip
│ ▁▂▃▅▆▇▇▆▅▅▆▇█  data density                              │
│ 1800 ─┼─────┼─────┼──●──┼─────┼─────┼─── 2025  ▶ ⏩      │  yearly slider, decade ticks
└─────────────────────────────────────────────────────────┘
```

- **Left rail:** wordmark, Play Intro, search, globe/flat toggle, page links, toggles (labels, quiet mode for event callouts, high contrast).
- **Bottom dock (pinned):** empire filter strip → data-density strip → time slider (yearly steps, decade ticks, play / fast-forward).
- **HUD panel:** opens on click with a leader line from the bubble. Cut-corner frame, mono text.

## Globe rendering
- **Land as dots** (hex dot grid), dim. **Faint historical borders** for the selected year on top.
- Graticule in thin white lines, with a cyan-to-blue atmospheric halo.
- **Bubbles:** fixed size by holding type. Fill by empire colour. Status style: ● solid / ◐ half / ○ hollow.
- **Change of hands:** the bubble transitions colour with a brief pulse. A **floating event callout** rises and fades: `{1824} Anglo-Dutch Treaty · Malacca → GBR`. On by default, with a quiet-mode toggle.
- **Trade arcs:** great-circle arcs lifted above the surface, one per pair, width class by percentile among the flows shown, small particles travelling along the arc.
- **Flat-map toggle:** Equal Earth projection, same layers.
- **Phones:** flat map automatically, glow and particles off.

## HUD components
- **Holding panel:** code, name, current owner and status, ownership timeline bar, transfer list, trade share with coloniser (percentage bar), link "Open file →" to Inherited Systems.
- **Flow hover box:**
  ```
  ┌─ FLOW · 1913 ───────────────────╮
  │ BRITISH INDIA ⇄ UNITED KINGDOM  │
  │ Total ≈ £ 115 m      rank 2 / 50│
  │ IND → GBR : GBR → IND  ≈  3 : 2 │
  │ ▓▓▓▓▓▓▓▓▓░░░░░░  India surplus  │
  │ src: RICardo · estimated ◇      │
  └─────────────────────────────────┘
  ```
- **Data-density strip:** a "scan bar" histogram of record counts per year.
- **Loading screen:** a dotted globe resolving into the full globe, with `LOADING ARCHIVE · 17%`.

## Record Room components
- **Top bar:** wordmark left; page links; search; "Return to Observatory" button.
- **Inherited Systems:** stacked folder tabs, one per country, tab colour = coloniser. An open folder shows the lineage alluvial (coloniser / Soviet bloc / US–WB–IMF / regional / homegrown → post-independence system), evidence notes in mono with dates and confidence, and a "Filed from" source list.
- **Divergence Metrics:** paper-style charts. Inheritance index over time, nearest-model strip by decade, persistence half-life table, trade-vs-institutions scatter.
- **The Archive:** a filing drawer. A–Z black divider tabs, numbered line-art index cards that lift on hover and open to the full citation, licence and "updated on" stamp.
- **Terms of Account:** a long-form method page with definitions (holding, status ladder, width ranking, estimation flags, coding rules).
- **Correspondence:** a submission form (correction / source suggestion), which becomes a GitHub issue for approval.

## Accessibility
- Empire colour is never the only cue: labels, textures and status shapes accompany it.
- High-contrast toggle. Keyboard control of the slider (←/→ = year, Shift = decade).
- Respect `prefers-reduced-motion` (no particles, no pulse).
- A text/table equivalent for every map state (the "Ledger table" view).

## Page themes (as built)
Every sub-page shares one header (js/nav.js, css/topbar.css); only colours change per theme.

| Page | Theme | Idea |
|---|---|---|
| Territorial Ledger | blue-phosphor database terminal | the live instrument |
| Flows of Empire | bluebar computer printout (tractor holes, perforations) | database records printed onto paper |
| Inherited Systems | coloured office folders, index tab first | the case files |
| Divergence Metrics | graph-paper worksheets | the analyst's working |
| The Archive | high-contrast line-art filing drawer, yellow label | the source index |

## Interface palette (applies to UI, not to data)
| Role | Colour |
|---|---|
| Blue, deep | `#1d3a6b` (navy ink: report headers, airmail stripes) |
| Blue, bright | `#2a52d1` (accents, chart traces, graph-paper grid) |
| Red | `#c23b2e` (page markers, pins, margin rules, links) |
| Neutrals | black `#111`, greys, white (the Archive is black/grey only) |
| Beige | `#f1efe7` paper, with `#e6dcc4` (same hue) for post-its and labels |

Data colours (empire index, development models) use the same palette (see Empire colours above); country files are coloured by their former coloniser's index colour.

## Motion
- Charts on Flows of Empire and Divergence Metrics draw in as they scroll into view (`site/js/reveal.js`).
- Files on Inherited Systems and cards in The Archive open as physical case files (`site/js/casefile.js`), after the folder interaction on mosbyfiles.com: the stack drops back, the folder rises and flattens, the cover swings open, the title rises, a pinned post-it carries the metadata, and page markers slide out of the folder edge.
- Both respect `prefers-reduced-motion`.
