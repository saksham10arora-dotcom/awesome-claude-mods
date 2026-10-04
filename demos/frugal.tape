# frugal, recorded live. GEMINI_API_KEY comes from the environment, never this file:
#   env -i HOME=$HOME PATH=$PATH USER=$USER TERM=xterm-256color LANG=en_US.UTF-8 GEMINI_API_KEY=... vhs frugal.tape
Output frugal.gif
Output frugal.mp4
Set Shell "zsh"
Set FontSize 16
Set Width 1400
Set Height 820
Set Padding 24
Set TypingSpeed 45ms
Set Theme "Catppuccin Mocha"
Env CLAUDE_CODE_ENABLE_FUNCTION_HOOKS "1"
Env DISABLE_AUTOUPDATER "1"
Env CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC "1"

Hide
Type `cd work && clear && claude --model haiku --strict-mcp-config --settings '{"spinnerTipsEnabled":false}' --plugin-dir ../../plugins/frugal --allowedTools "mcp__frugal__summarize_free,Glob"`
Enter
Sleep 7s
Show

Sleep 1s
Type "use summarize_free on server.log: a short timeline of last night"
Sleep 600ms
Enter
Wait+Screen@120s /big read/
Sleep 6s
Type "/frugal status"
Sleep 500ms
Enter
Sleep 6s
