# Changelog

PairLab's releases. Each tool keeps its own detailed changelog: [PairDeck](pairdeck/CHANGELOG.md),
[PairTeX](pairtex/CHANGELOG.md), [PairTalk](pairtalk/CHANGELOG.md).

## 0.4.0 (2026-11-18)

Google Antigravity joins Claude Code and Codex (PairDeck 0.2.1, PairTeX 0.5.1, PairTalk 0.1.1, PairPoster 0.2.1).
- **One install, three agents.** Each tool's installer also links its skill at `~/.gemini/config/skills/<tool>`, the global
  skill folder that Antigravity's App, CLI (`agy`) and IDE all read; the skill then runs as a slash command (`/pairdeck`,
  `/pairtex`, ...).
- **Antigravity's terminal sandbox.** Under its default presets, commands run without network and see only the workspace,
  while every tool needs its data home, git remotes, Chrome or a local server. `AGENTS.md` gives the Allow rules the user adds
  once (`command(<tool>)`, `write_file(<home>/.<tool>)`); agents never change those permissions themselves.
- **Waiting for feedback in Antigravity.** The watcher runs as a background command with a timer whose condition is that task,
  so its exit wakes the agent; `/goal watch <slug>` keeps the loop going between batches. Each skill and `AGENTS.md` says so.
- This follows Antigravity's documentation as of 2026-11-18; it has not yet been tried in a live Antigravity session.

## 0.3.0 (2026-11-15)

- **Ask about any part (PairDeck 0.2.0, PairPoster 0.2.0).** The review page has **Ask** (or `q`) beside **Comment**: box a
  part of a slide or a poster and type a question; the agent answers under it, on the page, and leaves the work as it is.
  Answers render light Markdown; a notice says when one arrives; **Put it in the slide** turns an answer into a change.
  Questions come first in each batch and are never style evidence.

## 0.2.0 (2026-11-14)

- **PairPoster 0.1.0** (new): conference posters as one HTML page at the venue's size, built picture-first (icon chains,
  charts, big numbers, formula boxes) with word budgets per block; `qa` measures overflow, type size at print scale, words
  and image resolution and shoots close-ups; `print` writes the one-page vector PDF and the venue's PNG; the comment loop,
  snapshots and style learning are PairDeck's, run in a poster flavour, with a poster style vault in `~/.pairposter`.
- **PairDeck 0.1.1**: the same program now also runs as PairPoster; the review overlay takes its wording and anchors from
  the tool and records the labelled block a comment points at.
- `./install.sh` installs all four tools.
- `pairposter/tools/figdata.py` recovers a matplotlib figure's data from its vector PDF; posters default to Nunito; an
  example poster (`pairposter/examples/simpsons-paradox`); the README tells the suite as four moments, with five tabs.

## 0.1.0 (2026-11-12)

PairTeX becomes one of three tools, and its repository becomes PairLab's.
- **PairDeck 0.1.0** (new): animated HTML decks that report a finding or explain an idea, with a local review page where the
  author comments on a slide, and a visual style guide seeded from the author's own decks.
- **PairTeX 0.5.0**: `pairtex seed` starts the writing-style guide from the author's own papers.
- **PairTalk 0.1.0** (new): talks with builds and a speaker script; coauthors comment on a slide or edit the script on an
  optional shared site or in a local inbox, and a talk style guide is seeded from the author's own slides and scripts.
  Built on [html-slide](https://github.com/Yanwei-Sun/html-slide) by Yanwei Sun.
- **One contract** for the three style vaults ([docs/style-vault.md](docs/style-vault.md)): the same data-home layout,
  evidence kinds, `seed`, `learn`, `watch` and `resolve` in every tool.
- **One installer**: `./install.sh` installs all three, `./install.sh <tool>` one. PairTeX moved to `pairtex/`; `skill` and
  `bin/pairtex` at the top level keep installs from before the move working, and `pairtex/install.sh` (or `./install.sh
  pairtex`) updates their links.
