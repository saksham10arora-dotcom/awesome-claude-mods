# nerfsaksham-mods

Four mods for Claude Code, built on Claude Mods (function hooks, early access).

| Mod | What it does | Commands |
|---|---|---|
| **frugal** | Helper subagents (Explore and friends) run on Haiku, and a `summarize_free` tool lets Claude hand big files and logs to a free Gemini model instead of reading them whole. A line above the prompt counts what was offloaded. | `/frugal on`, `off`, `status` |
| **teach-me** | After a turn that changed code, one multiple-choice question about that exact change appears above the prompt. Answers are scored per concept, so you know what to revise. Hinglish or English. | `/a 1-4`, `/a skip`, `/teach stats`, `/teach now`, `/teach on`, `off` |
| **vhs** | Every edit is taped, before and after. `/vhs` opens a replay pane: each change types itself in, `h`/`l` step, `p` plays, `f` switches file, `r` twice rewinds the file to that step. | `/vhs`, `/vhs list`, `/vhs <file>`, `/vhs close` |
| **lofi** | A soundtrack that follows the session: calm while idle, focus while Claude works, flow during heavy editing; a chime when tests pass, a low note when they fail, a chord when a long turn ends. Original music, synthesised by `plugins/lofi/scripts/make_audio.py`. | `/lofi on`, `off`, `vol 0-100`, `status` |

## Install

Mods need Claude Code 2.1.273 or newer with function hooks on:

```bash
export CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1
claude plugin marketplace add ~/Desktop/claude-mods
claude plugin install frugal@nerfsaksham-mods
claude plugin install teach-me@nerfsaksham-mods
claude plugin install vhs@nerfsaksham-mods
claude plugin install lofi@nerfsaksham-mods
```

frugal needs a free Gemini key (aistudio.google.com): set `GEMINI_API_KEY`, or `claude plugin configure frugal`.

Or try one without installing: `CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1 claude --plugin-dir plugins/vhs`.

## Develop

```bash
CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1 claude plugin validate plugins/<mod>
CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1 claude plugin test plugins/<mod>
```

16 tests across the four mods. MIT.
