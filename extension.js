const vscode = require("vscode");
const {
  LanguageClient,
  ErrorAction,
  CloseAction,
} = require("vscode-languageclient/node");
const sig = require("./signature");

let client;

async function startClient() {
  const rocPath = vscode.workspace.getConfiguration("roc").get("path") || "roc";

    const clientOptions = {
    documentSelector: [{ scheme: "file", language: "roc" }],
    errorHandler: {
      // A single bad message: keep the connection, don't spam.
      error: () => ({ action: ErrorAction.Continue }),
      // The server process died (e.g. it got stuck and was killed):
      // restart it, up to 5 times within 3 minutes, then give up.
      closed: () => ({
        action: CloseAction.Restart,
        maxRestartCount: 5,
      }),
    },
  };

  // The new compiler ships its language server inside the `roc` binary.
  const serverOptions = {
    command: rocPath,
    args: ["experimental-lsp", "--stdio"],
  };

  const clientOptions = {
    documentSelector: [{ scheme: "file", language: "roc" }],
  };

  client = new LanguageClient("roc", "Roc Language Server", serverOptions, clientOptions);
  await client.start();
}

// The Roc language server doesn't answer "signature help" requests yet, so we build
// it ourselves: find the function being called, ask the server for its hover text,
// and show the type from that hover as the signature.
function registerSignatureHelp(context) {
  const provider = {
    async provideSignatureHelp(document, position) {
      const text = document.getText(new vscode.Range(new vscode.Position(0, 0), position));
      const call = sig.findCall(text);
      if (!call) return null;
      const callee = sig.findCallee(text, call.openIndex);
      if (!callee) return null;

      const hovers = await vscode.commands.executeCommand(
        "vscode.executeHoverProvider",
        document.uri,
        document.positionAt(callee.nameStart + 1)
      );
      const markdown = (hovers || [])
        .flatMap((hover) => hover.contents)
        .map((part) => {
          if (typeof part === "string") return part;
          if (part.language) return "```" + part.language + "\n" + part.value + "\n```";
          return part.value;
        })
        .join("\n");
      const parsed = sig.parseHover(markdown);
      if (!parsed) return null;

      const info = new vscode.SignatureInformation(
        parsed.signature,
        new vscode.MarkdownString(parsed.docs)
      );
      info.parameters = sig
        .parameterRanges(parsed.signature)
        .map((range) => new vscode.ParameterInformation(range));

      const help = new vscode.SignatureHelp();
      help.signatures = [info];
      help.activeSignature = 0;
      // In `xs.sublist(...)`, `xs` is already the first argument.
      help.activeParameter = call.commas + (callee.isMethodCall ? 1 : 0);
      return help;
    },
  };

  context.subscriptions.push(
    vscode.languages.registerSignatureHelpProvider({ language: "roc" }, provider, "(", ",")
  );
}

// Turn the server's type hints (like `: I64` after `var $total = 0`) on or off,
// for Roc files only. A status bar button shows the current state.
function registerTypeHintsToggle(context) {
  const item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  item.command = "roc.toggleTypeHints";

  const current = () =>
    vscode.workspace.getConfiguration("editor", { languageId: "roc" }).get("inlayHints.enabled");

  const refresh = () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== "roc") {
      item.hide();
      return;
    }
    const on = current() !== "off";
    item.text = on ? "$(eye) Roc types" : "$(eye-closed) Roc types";
    item.tooltip = on ? "Type hints are on. Click to hide them." : "Type hints are off. Click to show them.";
    item.show();
  };

  context.subscriptions.push(
    item,
    vscode.commands.registerCommand("roc.toggleTypeHints", async () => {
      const next = current() === "off" ? "on" : "off";
      await vscode.workspace
        .getConfiguration("editor", { languageId: "roc" })
        .update("inlayHints.enabled", next, vscode.ConfigurationTarget.Global, true);
      refresh();
    }),
    vscode.window.onDidChangeActiveTextEditor(refresh),
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("editor.inlayHints.enabled", { languageId: "roc" })) refresh();
    })
  );
  refresh();
}

async function activate(context) {
  registerSignatureHelp(context);
  registerTypeHintsToggle(context);

  context.subscriptions.push(
    vscode.commands.registerCommand("roc.restartServer", async () => {
      if (client) await client.stop();
      await startClient();
      vscode.window.showInformationMessage("Roc language server restarted.");
    })
  );

  try {
    await startClient();
  } catch (err) {
    vscode.window.showErrorMessage(
      `Roc: couldn't start "roc experimental-lsp". Is a new-compiler nightly on your PATH, or set in the "roc.path" setting? (${err.message})`
    );
  }
}

function deactivate() {
  return client ? client.stop() : undefined;
}

module.exports = { activate, deactivate };