# Contributing

Thanks for helping. This list is hand-picked, so not every mod makes it in, and that is no judgment on yours.

## What gets in

1. It is a Claude Code mod (a plugin with a hooks module, `"modules"` in `hooks/hooks.json`) in a public repository with a license.
2. `claude plugin validate <dir>` passes. Paste the output, including the `calls:` line, in your pull request.
3. It does something not already listed, or does it clearly better.
4. Its README says how to install it and what it touches.

## How

Open a pull request that adds one line to the right section:

```
- [name](https://github.com/owner/repo/tree/main/path) - What it does, in one plain sentence. `network` `commands`
```

Tags come from the validator's `calls:` line: `network` for `$.http.fetch`, `commands` for `$.process`, `writes files` for `$.fs.write`, `model calls` for `$.model`, `audio` for `$.audio`. Leave tags off when it only reads session data and draws.

Keep descriptions short, plain and accurate: no hype words, no em dashes.
