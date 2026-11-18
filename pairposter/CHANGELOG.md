# Changelog

## 0.2.1 (2026-11-18)

- **Works in Google Antigravity** (the App, the CLI `agy`, the IDE). The installer also links the skill at
  `~/.gemini/config/skills/pairposter`, the global skill folder all three read; it then runs as `/pairposter`. `AGENTS.md` and
  the skill say how the user allows `pairposter` outside Antigravity's terminal sandbox (no network, workspace only) with
  `command(pairposter)` and `write_file(<home>/.pairposter)` in its Allow list, and how to wait for feedback there: the watcher as
  a background command plus a timer whose condition is that task, or `/goal watch <slug>`.
  This follows Antigravity's documentation as of 2026-11-18; it has not yet been tried in a live Antigravity session.

## 0.2.0 (2026-11-15)

- **Ask about any part.** The review page (PairDeck's, shared) has **Ask** (or `q`) beside **Comment**: box a part of the
  poster and type a question; the agent answers under it from the poster's sources and leaves the poster as it is. Questions
  come first in each batch and are never style evidence. See PairDeck 0.2.0 for the details.

## 0.1.0 (2026-11-14)

The first version, as PairLab's fourth tool.
- **Posters at print size.** `pairposter new <slug> --size WxH` scaffolds one HTML page at the venue's size (mm), with the
  poster engine (`skill/assets/engine/`): a grid of blocks, icon chains, cards, big numbers, formula boxes (MathJax 3), icon
  rows, takeaway band and QR cards, type in points, 45 line icons inlined, Computer Modern fonts. On screen the page fits the
  window and zooms (+, −, 0, 1, Ctrl or pinch + scroll); the zoom survives reloads; printed, it is exactly its size.
- **Checks.** `pairposter qa` measures the laid-out poster in headless Chrome after fonts and formulas are ready: overflow per
  block, type under `min_pt` (fine print under `fine_pt`; SVG text at its drawn scale; indices not counted), words per block
  and in all against the budgets in `<meta name="pairposter">`, sentences, image dpi at print size, empty space; plus a
  picture of the whole poster and close-ups (`--grid 3x2`).
- **Print.** `pairposter print` writes a one-page vector PDF at the page size (checked) and the PNG for a venue's site
  (`--png-width`, `--png-max-height`, `--png-max-mb`; defaults fit NeurIPS).
- **The comment loop** is PairDeck's (review page, watch, resolve, snapshot, learn, seed), in its poster mode: comments name
  the block under the box, boxes stay on their content at any zoom, batches speak of the poster.
- **A poster style vault** (`~/.pairposter`), with its own template; the visual look is read from PairDeck's guide.
- **The skill** (`skill/SKILL.md`, `references/poster.md`, `components.md`, `qa.md`, `learning.md`, `seeding.md`): what a poster is
  for, picture-first grammar, word budgets, type sizes for print, turning a LaTeX or Beamer poster into one.
- **Builds on screen**: `data-build="N"` parts appear in order the first time the page opens (▶ or `p` replays); print,
  export and `qa` show the finished poster.
- A block's parts keep their size (`.pp-block > *` does not shrink), so `qa` reports the block that overflows, not a
  squeezed part; `.pp-spread` spreads a tall block's spare height.
- **`tools/figdata.py`**: recovers the data of a matplotlib vector PDF (lines, error bands, axis mapping from the tick
  labels), so a paper's plot can be redrawn in the poster's style. Standard library only.
- **Nunito** (SIL OFL) is the engine's default poster typeface; Computer Modern stays bundled (`--font-serif`).
- **An example poster**, `examples/simpsons-paradox` (A0 landscape, the 1986 kidney-stone data), and README images.
- SVG text keeps its own `fill` (the engine's default ink applies only to text without one).
- `tests/test_e2e.py`: 31 checks (the measured checks, screenshots and printing need Chrome).
