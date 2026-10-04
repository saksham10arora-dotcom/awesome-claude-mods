# teach-me + vhs, recorded live in a real Claude Code session.
# Run from demos/ with a clean environment:
#   env -i HOME=$HOME PATH=$PATH USER=$USER TERM=xterm-256color LANG=en_US.UTF-8 vhs learn.tape
Output learn.gif
Output learn.mp4
Set Shell "zsh"
Set FontSize 16
Set Width 1400
Set Height 860
Set Padding 24
Set TypingSpeed 45ms
Set Theme "Catppuccin Mocha"
Env CLAUDE_CODE_ENABLE_FUNCTION_HOOKS "1"
Env DISABLE_AUTOUPDATER "1"
Env CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC "1"

Hide
Type `cd work && clear && claude --model haiku --strict-mcp-config --settings '{"spinnerTipsEnabled":false}' --permission-mode acceptEdits --plugin-dir ../../plugins/teach-me --plugin-dir ../../plugins/vhs --allowedTools "Read,Glob,Grep"`
Enter
Sleep 7s
Show

Sleep 1s
Type "add an in-memory Map cache to getUser in ./api.js (no expiry yet)"
Sleep 600ms
Enter
Wait+Screen@120s /answer with/
Sleep 6s
Type "/a 1"
Sleep 500ms
Enter
Sleep 6s
Type "now give each cache entry a 60 second expiry"
Sleep 600ms
Enter
Sleep 28s
Type "/vhs"
Sleep 500ms
Enter
Wait+Screen@20s /step 1/
Sleep 9s
Type "h"
Sleep 4s
Type "l"
Sleep 5s
Type "c"
Sleep 2s
