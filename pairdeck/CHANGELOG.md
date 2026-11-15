# Changelog

## 0.2.0 (2026-11-15)

- **Ask about any part.** The review page has **Ask** (or `q`) beside **Comment** (or `c`). Box a part of a slide and type a
  question; the agent answers under it, on the page, and leaves the deck as it is. A comment records its `kind` (`change`, the
  default, or `question`). Under an answer: **Ask more** (a follow-up question), **Put it in the slide** (a change that
  carries the question and its answer to the agent) and **Done**. Question boxes and the Ask button are purple, the agent's
  colour; the compose box switches between "Change it" and "Ask about it".
- **Answers read well.** Replies render light Markdown (paragraphs, `-` and `1.` lists, bold, italic, code, https links),
  escaped first. A notice in the corner says when an answer or reply arrives (also across the reload a fix causes), and
  **⇔** widens the panel to up to 640 pixels for long answers.
- **The loop.** A batch lists questions first, under "Questions", with what a good answer needs; a batch of questions alone
  asks for answers only (no QA, snapshot or learning). Questions are never style evidence, and Done on a question is not
  `kept`. `pairdeck status` counts questions apart from comments. 8 new end-to-end checks (66 in all).

## 0.1.1 (2026-11-14)

- **Runs PairPoster too.** `../pairposter/bin/pairposter` runs this program in its poster flavour (`PAIRLAB_FLAVOR=poster`):
  its own data home, template, engine, `qa` and `print`; the review page, watch, resolve, snapshot, learn and seed are shared.
  Deck behaviour is unchanged.
- **Review overlay.** Its wording, anchors and tool name come from the page's configuration; a comment also records the
  smallest labelled block under its box (`block`), and the comment list works without a slide engine.

- **Review page.** Once the author presses **Keep** on an answer, that comment's box is no longer drawn on the slide; it
  shows again only while the comment is selected in the list.

## 0.1.0 (2026-11-12)

The first release, as part of PairLab.
- **Animated explainer decks.** `pairdeck new` scaffolds a deck on the bundled engine: Computer Modern type, colour roles that
  keep their meaning across decks, line icons, step-by-step builds (drawing lines, growing bars, counters, dimming takeaways),
  interactions, light and dark mode, and a phone layout. The skill (`skill/SKILL.md` and `references/`) carries the visual
  language, the engine's components, accuracy rules and story structures for papers, overviews, course concepts, projects,
  proposals, reports and experiment results.
- **Checks on screenshots.** `pairdeck qa` lints a deck, steps through every build in headless Chrome, screenshots every slide in
  light, dark and phone width (also single build steps and interaction states), and reports overlapping, clipped or
  low-contrast labels, arrows that end inside shapes, lines through labels, text that scrolls inside a box and slides taller
  than the window. Chrome runs with a throwaway profile and a mock keychain, so it never waits for the macOS keychain.
- **Comment on the slide.** `pairdeck review` serves the deck on 127.0.0.1 with a comment layer (never written into the deck):
  drag a box, type, send. A comment records the slide, the build step, the box (pinned to the figure or text under it) and the
  words under it. Replies appear under each comment; **Keep** accepts an answer, **Follow up** continues the thread; the page
  reloads when the deck changes. The server refuses cross-site requests and serves nothing outside the deck's folder.
- **The loop.** `pairdeck watch` waits for comments and for the author's own edits to the deck, lets them settle, prints one
  batch (comments with slide, step, box and words; edits as diffs against the agent's last `snapshot`; the style guide's sha)
  and exits. One watcher per deck (`--takeover`), `--once` for agents that poll, and exit 4 when the agent answered comments
  but did not snapshot its edits. `pairdeck resolve` answers a comment.
- **A style vault that learns**, per PairLab's style-vault contract: `STYLE.md` with base rules, confirmed rules, tentative
  patterns, a "Palette, type and layout" table and what the author undid; evidence `revised`, `reverted` and `own_edit`
  (slide-by-slide comparison with the agent's snapshots), `stated` (comments with general words, or `resolve --stated`),
  `kept` (the Keep button) and `seed`; `pairdeck learn` with `--ack` and `--discard --why`.
- **Seeding from past decks.** `pairdeck seed` reads `.pptx`, `.pdf` and `.html` decks through `shared/seed_visual.py`:
  palette with shares, fonts and sizes, words per slide, titles, speaker notes, layouts, and sampled page images (macOS PDFKit,
  pdftoppm or mutool; PPTX through LibreOffice when installed). `--list` and `--forget`.
- **Delivery.** `pairdeck bundle` (one self-contained file) and `pairdeck card` (a share image).
- An example deck on Simpson's paradox (`examples/simpsons-paradox/`), an end-to-end test (`tests/test_e2e.py`), and `AGENTS.md`
  for agents that install and run PairDeck for their user.
