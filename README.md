# Awesome Claude Mods [![Awesome](https://awesome.re/badge.svg)](https://awesome.re)

> Hand-picked mods for [Claude Code](https://code.claude.com): plugins that draw panes, bands and pets, guard risky commands, or change how the session works, built on function hooks.

Every mod listed here was **cloned and passed `claude plugin validate`** (Claude Code 2.1.289, 2026-10-05). Tags show what the validator reports a mod can do beyond drawing: `network`, `commands` (runs programs on your machine), `writes files`, `model calls` (spends tokens), `audio`. No tag means it only reads session data and draws. Validation reads the source; it does not prove a mod is safe, so read the code of anything that runs commands or touches the network.

74 mods picked from 124 that passed, across 44 repositories. Looking for everything? See [Related](#related).

## Contents

- [Watch Claude work](#watch-claude-work)
- [Usage, cost and context](#usage-cost-and-context)
- [Spend less](#spend-less)
- [Long sessions and handoffs](#long-sessions-and-handoffs)
- [Code changes and history](#code-changes-and-history)
- [Safety and guardrails](#safety-and-guardrails)
- [Reading the transcript](#reading-the-transcript)
- [Learn while it codes](#learn-while-it-codes)
- [While you wait](#while-you-wait)
- [Integrations](#integrations)
- [Collections](#collections)
- [Build your own](#build-your-own)
- [Related](#related)
- [Contributing](#contributing)

## Using a mod

Claude Code 2.1.287 or newer runs mods out of the box (2.1.273 to 2.1.286 need `CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1`). Install from the mod's repo with `claude plugin marketplace add <owner>/<repo>` and `claude plugin install <mod>@<marketplace>`, or try one without installing: `claude --plugin-dir <path-to-mod>`.

## Watch Claude work

Live views of what the agent is doing.

- [flightdeck](https://github.com/scasella/claude-flightdeck) - A live agent dashboard pane: model vitals, every permission check, subagent cards and a turn receipt, watching without changing anything.
- [cctop](https://github.com/tomstagl/cctop/tree/main/plugin) - A btop-style side pane of Claude Code internals: context, tokens, cost, limits and per-tool latency. `commands` `writes files`
- [flight-recorder](https://github.com/promptadvisers/claude-mods-starter-kit/tree/main/plugins/flight-recorder) - A live Gantt timeline of model requests, tool calls and subagents, with tokens and cost per lane.
- [repo-heatmap](https://github.com/promptadvisers/claude-mods-starter-kit/tree/main/plugins/repo-heatmap) - A treemap of the repo that lights up as files are read, searched and edited. `commands`
- [mission-control](https://github.com/hamzafer/claude-code-mods/tree/main/mods/mission-control) - A live map of the main agent, its subagents and every tool call, plus a code map of the files they touch. `commands` `writes files` `model calls`
- [agent-flow](https://github.com/Charlie0113-T/claude-agent-flow) - `/flow` opens a live tree of the session's subagents and teammates beside the transcript.
- [swarm](https://github.com/OneWave-AI/claude-code-mods/tree/main/swarm) - Mission control for subagents and agent teams: who is running, what each is doing, who spawned whom.
- [agent-radar](https://github.com/hamzafer/claude-code-mods/tree/main/mods/agent-radar) - One live line per running subagent: time, tool count and what it is doing.
- [activity](https://github.com/mishgoldenberg/claude-mods/tree/main/plugins/activity) - A panel of running tools with their real commands and timers, and what is waiting for your approval.
- [agent-narrator](https://github.com/OneWave-AI/claude-code-mods/tree/main/agent-narrator) - Every step of the agent in plain English, with a running time-saved counter. `model calls`

## Usage, cost and context

Know where your plan limits and context window stand.

- [usage-meter](https://github.com/mishgoldenberg/claude-mods/tree/main/plugins/usage-meter) - Plan-limit bars with burn rate and time to empty, session cost, cache hit ratio and a tokens-per-turn sparkline.
- [usageline](https://github.com/Sma1lboy/claude-mods/tree/main/usageline) - A status line with context, cache hit rate, a cache TTL countdown, today's spend for the project and why the cache missed. `commands`
- [token-weather-usage](https://github.com/augiefra/claude-mods/tree/main/plugins/token-weather-usage) - Context as weather, a bar per recent prompt, and 5-hour and 7-day limits against the clock.
- [context-view](https://github.com/kongyo2/context-view) - The context window as one row above the prompt, drawn the way Claude Code draws its own meters.
- [budget-guard](https://github.com/Arunjay4213/claude-mods/tree/main/plugins/budget-guard) - Stops a session before it passes a cost, token or time budget you set.
- [burn-meter](https://github.com/OneWave-AI/claude-code-mods/tree/main/burn-meter) - A session cost odometer drawn as a burning fuse, with threshold alerts.
- [usage-band](https://github.com/JetsonChan/CC-Usage-Band/tree/main/usage-band) - 5-hour and 7-day limits, context window and cache hit rate in one band.
- [token-face](https://github.com/MohamedEmbarak/token-face/tree/main/plugins/token-face) - A face above the prompt that gets more uncanny as the context fills.

## Spend less

Put cheaper models on the chores.

- [frugal](https://github.com/saksham10arora-dotcom/claude-frugal) *(list maintainer's)* - Helper subagents on Haiku, and a tool that hands big files and logs to a free Gemini model instead of reading them whole. `network`
- [model-router](https://github.com/promptadvisers/claude-mods-starter-kit/tree/main/plugins/model-router) - Routes supported subagent work to Sonnet or Haiku while the main conversation keeps its model.
- [fable-pin](https://github.com/karanb192/claude-code-mods/tree/main/plugins/fable-pin) - Pins every subagent to one model, with `/fable-pin on` and `off`.
- [cache-keeper](https://github.com/nateherkai/claude-code-mods/tree/main/cache-keeper) - Keeps a big chat's prompt cache warm and warns before an expensive cold restart. `writes files` `model calls`

## Long sessions and handoffs

Keep a long run coherent past the context window.

- [auto-handoff](https://github.com/alexknowshtml/claude-auto-handoff) - Hands a session to a fresh one before the context fills: a written brief, `/clear`, and a seed that resumes. `commands` `writes files` `model calls`
- [ctx-handoff](https://github.com/cablate/ctx-handoff-mod) - Auto handoff at a context threshold, and keeps the prompt cache warm while you are away. `writes files` `model calls`
- [handoff-compact](https://github.com/trytofly94/handoff-compact) - Replaces compaction with a structured handoff written from the prompt cache. `commands` `writes files` `model calls`
- [compact-adviser](https://github.com/kunchenguid/compact-adviser/tree/main/packages/claude-mod) - Suggests `/compact` (or runs it, opt-in) at a finished checkpoint. `network` `writes files`
- [context-keeper](https://github.com/mishgoldenberg/claude-mods/tree/main/plugins/context-keeper) - What fills the context window, checkpoints before you compact, and nudges before the wall. `writes files` `model calls`
- [where-am-i](https://github.com/hamzafer/claude-code-mods/tree/main/mods/where-am-i) - A live recap above the prompt: the goal, what is happening now, what waits on you, what is next. `model calls`
- [live-recap](https://github.com/benjaminmodayil/live-recap) - A card that says what Claude is working on, refreshed every few minutes during a turn. `model calls`

## Code changes and history

See, replay and undo what Claude changed.

- [vhs](https://github.com/saksham10arora-dotcom/claude-vhs) *(list maintainer's)* - A tape of every edit: watch each change type itself back in, scrub with `h` and `l`, and rewind any file to any step. `writes files`
- [replay-theater](https://github.com/hamzafer/claude-code-mods/tree/main/mods/replay-theater) - Step through the last turn's file edits one diff at a time.
- [changes-receipt](https://github.com/promptadvisers/claude-mods-starter-kit/tree/main/plugins/changes-receipt) - A plain-English receipt after every turn: files created, changed and deleted, with failed attempts. `commands`
- [changes](https://github.com/mishgoldenberg/claude-mods/tree/main/plugins/changes) - Every file changed this session with git line counts and a one-click 'why?'. `commands`
- [md-preview](https://github.com/hamzafer/claude-code-mods/tree/main/mods/md-preview) - Markdown files Claude edits, rendered like GitHub in a pane, before and after side by side. `commands` `writes files`

## Safety and guardrails

Catch the risky stuff before it runs.

- [guardrails](https://github.com/mishgoldenberg/claude-mods/tree/main/plugins/guardrails) - Clickable safety rules with presets: block `rm -rf`, force-push, secret files, sudo, installs and more.
- [blast-radius](https://github.com/hamzafer/claude-code-mods/tree/main/mods/blast-radius) - Holds risky Bash commands and shows what they would change before they run. `commands`
- [launch-codes](https://github.com/OneWave-AI/claude-code-mods/tree/main/launch-codes) - Dangerous Bash commands need launch codes: a red alert pane, a siren, a code to arm and a LAUNCH to fire. `audio`
- [merge-gate](https://github.com/hamzafer/claude-code-mods/tree/main/mods/merge-gate) - Holds `gh pr merge` until CI passes and a review has run. `commands`
- [collision-guard](https://github.com/nateherkai/claude-code-mods/tree/main/collision-guard) - Asks before Claude edits a file another open chat changed in the last 30 minutes. `commands` `writes files`
- [recording-mode](https://github.com/nateherkai/claude-code-mods/tree/main/recording-mode) - `/rec` before you screen-record: masks keys, personal details and business figures. `writes files`
- [pii-guard](https://github.com/danyuchn/pii-guard/tree/main/examples/claude-code-mod) - De-identifies personal data before it reaches the model and restores it on the way back. `network` `commands`
- [jev-permission-gate](https://github.com/madisonrickert/jev-permission-gate) - Lets a fast judge model allow or deny routine tool calls in auto mode, and passes uncertain ones on. `network` `writes files`
- [zsh-safe](https://github.com/HolyGrail/claude-mods/tree/main/plugins/zsh-safe) - Lets Bash commands written for bash run under zsh: unmatched globs, a leading `=`, a missing `timeout`.

## Reading the transcript

Make replies, pastes and prompts easier to read.

- [prismantis](https://github.com/NahumLitvin/prismantis) - Colorful, themeable replies: tables, headings, code, numbers, paths and links in 15 themes.
- [gfm-render](https://github.com/briangtn/claude-gfm-render) - GitHub Flavored Markdown in the transcript: alerts, task lists, strikethrough and Mermaid diagrams. `commands`
- [paste-view](https://github.com/Amorfx/claude-paste-view) - Image thumbnails and long-text previews above the prompt instead of bare `[Image #1]`. `commands`
- [image-peek](https://github.com/karanb192/claude-code-mods/tree/main/plugins/image-peek) - A large preview of a pasted image when the cursor sits on its marker (macOS, Ghostty first). `commands`
- [prompt-rail](https://github.com/oikon48/prompt-rail/tree/main/plugins/prompt-rail) - A rail of the session's prompts: hover to read one, click to jump to it. `commands`
- [message-timestamps](https://github.com/benjaminmodayil/live-recap/tree/main/plugins/message-timestamps) - Prefixes each reply with the local time it arrived.
- [roof-mod](https://github.com/kagamiurayama/claude-code-roof-mod/tree/main/roof-mod) - Replace Claude Code's built-in reminders and template wording with your own.

## Learn while it codes

Understand the code the agent writes.

- [teach-me](https://github.com/saksham10arora-dotcom/claude-teach-me) *(list maintainer's)* - After a turn that changed code, one question about that exact change; scored per concept so you know what to revise. `model calls`
- [prompt-coach](https://github.com/mishgoldenberg/claude-mods/tree/main/plugins/prompt-coach) - Before a vague prompt is sent, suggests a sharper one; you pick which to send. `model calls`
- [next-steps](https://github.com/hamzafer/claude-code-mods/tree/main/mods/next-steps) - After each turn, two or three likely next prompts; press 1 to 3 to draft one. `model calls`

## While you wait

Games, pets and moods for the minutes Claude is busy.

- [lofi](https://github.com/saksham10arora-dotcom/claude-lofi) *(list maintainer's)* - A lofi soundtrack that follows the session: calm, focus, flow, and a chime when tests pass. Original music. `audio`
- [terminal-pet](https://github.com/promptadvisers/claude-mods-starter-kit/tree/main/plugins/terminal-pet) - A pixel-art crab above the prompt that reacts live to what Claude is doing.
- [clawdhouse](https://github.com/ishuagrawal/clawdhouse/tree/main/plugin) - A pixel Clawd in a side pane that reacts to what Claude is doing.
- [boss-fight](https://github.com/OneWave-AI/claude-code-mods/tree/main/boss-fight) - Failing tests spawn a pixel boss; each fixing run lands a hit, zero failures is a KO.
- [sportscaster](https://github.com/OneWave-AI/claude-code-mods/tree/main/sportscaster) - Live TV play-by-play of your session, spoken aloud with crowd effects. `model calls` `audio`
- [fables](https://github.com/henrik-thevibe/Claude-Fables) - Turns what the agent is doing into little animated cartoons above the prompt. `model calls`
- [inner-monologue](https://github.com/OneWave-AI/claude-code-mods/tree/main/inner-monologue) - A pane of Claude's dry inner thoughts about your session, typed out live. `model calls`
- [snake](https://github.com/hamzafer/claude-code-mods/tree/main/mods/snake) - Snake in a pane while Claude works, paused when it is done.
- [cc-dino](https://github.com/giovaborgogno/cc-dino) - The offline T-rex above the prompt, with a leaderboard. `network`
- [mindful-claude](https://github.com/halluton/Mindful-Claude) - Guided breathing exercises above the prompt while Claude works.
- [codecraft](https://github.com/mkpvishnu/claude-mods/tree/main/codecraft) - A Minecraft-style HUD: hearts for context, armor for safety nets, XP for verified work, 60 advancements. `commands`
- [session-wrapped](https://github.com/OneWave-AI/claude-code-mods/tree/main/session-wrapped) - Spotify Wrapped for a session: an animated stat reveal and a shareable PNG card. `commands`
- [plan-progress](https://github.com/zycck/claude-mods/tree/main/plugins/plan-progress) - Live plan progress bars with a pixel fill and soft sounds for decisions, errors and done. `commands` `writes files` `audio`

## Integrations

Bring other tools into the session.

- [terminal-browser](https://github.com/zenbu-labs/terminal-browser/tree/main/claude-code-plugin) - A real browser inside Claude Code: preview sites, read HTML, and let the agent drive it. `network` `commands`
- [xcode-mods](https://github.com/artemnovichkov/xcode-mods/tree/main/mods/xcode-mods) - Xcode in Claude Code: build, run and tests pane, scheme band, notifications and SwiftUI previews. `commands`
- [linear](https://github.com/SaharCarmel/linear-mod/tree/main/linear-mod) - Your Linear projects and issues in a pane, with plan and execute buttons. `network` `commands`
- [glance](https://github.com/hamzafer/claude-code-mods/tree/main/mods/glance) - One line with what needs you: next meeting, PRs, Linear issues and Slack DMs. `commands`
- [notify](https://github.com/mishgoldenberg/claude-mods/tree/main/plugins/notify) - A notification inbox and native OS notifications when a long turn, subagent or task finishes. `commands`
- [pr-relay](https://github.com/HolyGrail/claude-mods/tree/main/plugins/pr-relay) - Watches the session's pull request and wakes the session when it is merged or reviewed. `commands`
- [tw-stock-mod](https://github.com/darrell-tw/darrelltw-mods/tree/main/mods/tw-stock-mod) - A stock watchlist band: Taiwan list in Taiwan hours, US list in US hours. `network` `commands` `writes files`
- [ts-band](https://github.com/hoobnn/hoobnn-agent-mods/tree/main/claude-code/ts-band) - Tailscale node state above the prompt, with a toast when a node goes up or down. `commands`

## Collections

Repos that ship many mods at once; the best ones are also listed above.

- [hamzafer/claude-code-mods](https://github.com/hamzafer/claude-code-mods) - 16 mods: radar, mission control, guards, previews, snake and more.
- [mishgoldenberg/claude-mods](https://github.com/mishgoldenberg/claude-mods) - 12 mods with a `/mods` manager and a quickbar to open them all.
- [OneWave-AI/claude-code-mods](https://github.com/OneWave-AI/claude-code-mods) - 11 playful ones: boss fight, sportscaster, launch codes, session wrapped.
- [promptadvisers/claude-mods-starter-kit](https://github.com/promptadvisers/claude-mods-starter-kit) - 10 mods with beginner guides and a build-your-own template.
- [lemomo-ai/lemo-mod](https://github.com/lemomo-ai/lemo-mod) - 16 mods around one style system, with a Chinese and English interface.
- [hoobnn/hoobnn-agent-mods](https://github.com/hoobnn/hoobnn-agent-mods) - claude-hud as a mod, plus a todo bar, receipts and more.
- [nateherkai/claude-code-mods](https://github.com/nateherkai/claude-code-mods) - Cache keeper, recording mode, goal meter, collision guard.
- [Arunjay4213/claude-mods](https://github.com/Arunjay4213/claude-mods) - Session trackers: context lens, quota meter, token ledger, budget guard.

## Build your own

- [mod-builder](https://github.com/karanb192/claude-code-mods/tree/main/plugins/mod-builder) - A skill that plans, writes, validates and proves a mod in an isolated run.
- [claude-mods-skill](https://github.com/BeLazy167/claude-mods-skill) - A skill that teaches an agent to build mods, with a starter mod.
- [starter-mod template](https://github.com/promptadvisers/claude-mods-starter-kit/tree/main/templates/starter-mod) - The smallest working mod, with a test, to copy from.
- Generate the full API types for your build with `/plugin-types`, check a mod with `claude plugin validate <dir>`, and test it with `claude plugin test <dir>`.

## Related

- [awesome-claude-code-mods](https://github.com/karanb192/awesome-claude-code-mods) - A community catalogue that scans GitHub for every public mod (1,700+) and records what each can reach, with a browsable site at [mods.aidojo.si](https://mods.aidojo.si/).
- [Mods feature request](https://github.com/anthropics/claude-code/issues/91870) - Where Claude Mods were proposed and discussed.

## Contributing

Suggestions welcome: read [CONTRIBUTING.md](CONTRIBUTING.md). In short, a mod gets in when it passes `claude plugin validate`, does something not already listed better, and says plainly what it touches.

## License

[![CC0](https://licensebuttons.net/p/zero/1.0/88x31.png)](https://creativecommons.org/publicdomain/zero/1.0/)

To the extent possible under law, the contributors have waived all copyright to this list. Each mod has its own license.
