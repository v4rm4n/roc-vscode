# Roc (nightly) for VS Code

Roc language support for the **new compiler nightlies**. Everything comes from the
language server built into the `roc` binary (`roc experimental-lsp`):
highlighting, errors, hover, go-to-definition, completion, rename and formatting.

## Requirements

A new-compiler Roc nightly on your PATH, or set its path in the `roc.path` setting.

## Try it

1. `npm install`
2. Open this folder in VS Code and press **F5**. A second VS Code window opens with the extension loaded.
3. Open a `.roc` file in that window.

## Install it for everyday use

```sh
npx @vscode/vsce package
code --install-extension roc-nightly-0.0.1.vsix
```

## If something looks wrong

- Run **Roc: Restart Language Server** from the command palette.
- Check **Output → Roc Language Server** for errors.
- No colours? Make sure `editor.semanticHighlighting.enabled` isn't set to `false`.
