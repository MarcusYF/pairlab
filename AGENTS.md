# PairLab for coding agents

This file is for coding agents: Claude Code, Codex, Google Antigravity, and any other agent that can run shell commands and edit
files. PairLab is four tools that share one design. Each has its own `AGENTS.md` with the full steps; this page says which tool
fits a request, how to install one or all of them for the user, and the rules every tool shares.

## Which tool

| The user wants to … | Tool | Its guide |
| --- | --- | --- |
| report what they found, explain a paper or idea, an animated HTML deck, a visual explainer | **PairDeck** | [pairdeck/AGENTS.md](pairdeck/AGENTS.md) |
| write or revise a LaTeX paper with comments in the source (Overleaf, a git remote, a local folder) | **PairTeX** | [pairtex/AGENTS.md](pairtex/AGENTS.md) |
| make or revise a talk: slides with builds, a speaker script, comments from coauthors | **PairTalk** | [pairtalk/AGENTS.md](pairtalk/AGENTS.md) |
| make or polish a conference poster, or turn a LaTeX/Beamer poster into one; print it at the venue's size | **PairPoster** | [pairposter/AGENTS.md](pairposter/AGENTS.md) |

## Which agent, which plan

No tool has a model or an API key of its own. Each is a command-line tool plus a skill; the thinking is done by the agent the user
already runs, on the user's own plan: **Claude Code** (a Claude subscription or an Anthropic API key), **Codex** (a ChatGPT plan
or an OpenAI API key), **Google Antigravity** (a Google AI plan or a Gemini API key), or another agent that runs shell commands
(it reads the tool's `skill/SKILL.md`). `install.sh` links each skill into `~/.claude/skills/<tool>`, `~/.agents/skills/<tool>`
and `~/.gemini/config/skills/<tool>`, so one install serves all three. The user's style guides and projects live in each tool's
data home (`~/.pairdeck`, `~/.pairtex`, `~/.pairtalk`, `~/.pairposter`), not in the agent, so they can switch agents at any time.

## In Google Antigravity

Antigravity (the App, the CLI `agy` and the IDE) reads each skill from `~/.gemini/config/skills/<tool>`, which `install.sh`
links, and turns it into a slash command (`/pairdeck`, `/pairtex`, ...). It reads `AGENTS.md` and `GEMINI.md` as workspace
rules. Two things differ from Claude Code and Codex.

- **The terminal sandbox.** Under Antigravity's Default and Auto permission presets, commands run in a sandbox that sees only
  the workspace and the temp folders and has no network. Every PairLab command needs more than that: its data home, git
  remotes (Overleaf, PairTalk's shared site), Chrome, and a local server for the review pages. So the user lets the tools run
  outside the sandbox, once, by adding rules to Antigravity's **Allow** list: in the App, under Settings, permissions; in the
  CLI, the `allow` list in `~/.gemini/antigravity-cli/settings.json`. A `command(...)` rule covers the command inside or
  outside the sandbox; `write_file(...)` lets you edit files outside the workspace without a prompt each time. Paths are
  absolute (the user's home, `echo $HOME`).

  | Tool | Allow rules |
  | --- | --- |
  | PairDeck | `command(pairdeck)`, `write_file(<home>/.pairdeck)`, and any folder given to `pairdeck new --dir` |
  | PairTeX | `command(pairtex)`, `write_file(<home>/.pairtex)` |
  | PairTalk | `command(pairtalk)`, `write_file(<home>/.pairtalk)`, and the talk folders if they are outside the workspace |
  | PairPoster | `command(pairposter)`, `write_file(<home>/.pairposter)` |

  As the agent, give the user these lines with their home filled in; never change Antigravity's permissions yourself. Without
  them, each command asks for approval, and a command kept in the sandbox fails for want of the network or the data home.
- **Waiting for feedback.** Antigravity runs a command in the background (it shows under `/tasks`), and a background task
  that ends sends a message that wakes the agent. So: start `<tool> watch <slug>` as a background command, then set a timer
  (the one behind `/schedule`, up to 30 minutes) whose condition is that task. The watcher's exit wakes you at once; if the
  timer fires first, nothing came, so set another. The review pages (`pairdeck review`, `pairtalk serve`) are background
  commands too. The user can start a loop as a goal, `/goal watch <slug> until I say stop`, so that you keep going between
  batches instead of ending your turn.

## Install for the user

When the user asks you to install PairLab or one of its tools (for example "install PairLab from
https://github.com/MarcusYF/pairlab"):

1. **Get the code.** If you are not in a clone, `git clone https://github.com/MarcusYF/pairlab ~/pairlab`. Another folder only
   if the user names one. To update later: `git -C ~/pairlab pull`.
2. **Ask which tools**, unless the request says: all four, or the ones for their next task. Then run
   `~/pairlab/install.sh` (all) or `~/pairlab/install.sh <tool> …`. Read what it prints: each tool checks what it needs
   (Python 3.9+, git, latexmk, Chrome, Node 22) and says what is missing. Install a missing dependency only if the user says
   yes.
3. **Follow each installed tool's `AGENTS.md`** from its own setup step on: the user's name (once per tool), where their work
   lives, and the offer to **seed** the tool's style guide from two to five things the user made themselves (papers for
   PairTeX, decks for PairDeck, talks and scripts for PairTalk, posters for PairPoster). Seeding is optional and never needed to start.
4. **In Antigravity**, give the user the Allow rules for each installed tool ("In Google Antigravity" above), with their home
   filled in, before the first run.
5. **Tell the user** in a few lines what is installed, how to give feedback in each tool, and what to say to start.

## Rules every tool shares

- **The style vault** (`docs/style-vault.md`): read the tool's `STYLE.md` before every piece of work; after each round, turn the
  evidence into entries, acknowledge it with `<tool> learn --ack`, commit the vault, and name any new rule in your report so the
  user can object. Only the owner's own edits and comments teach their style; a coauthor's never do. Style never changes a
  claim, a number or a result.
- **Credentials are the user's.** Never ask for a token or password in chat, never type one, and never put one in a file, a URL
  or a command. Overleaf tokens, git credentials and Cloudflare logins are stored by the user, in their own terminal. So are
  the agent's own permissions (Antigravity's Allow list, Claude Code's or Codex's settings): give the user the rules to add.
- **Publish only what the loop was asked for.** Starting a tool's loop at the user's request authorizes publishing the changes
  that answer the feedback it receives, in that project, for this session. Nothing else: no other projects, no force pushes,
  no deletions the user did not ask for.
- **The user's work stays theirs.** Their papers, decks, talks, evidence and style guides stay in the data home and their own
  projects. Never copy them into this repository.
