import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

export function activate(context: vscode.ExtensionContext) {
    const namespaceCompletionProvider = vscode.languages.registerCompletionItemProvider({ scheme: 'file', language: 'csharp' }, {
        provideCompletionItems(document, position, token, context) {
            if (document.fileName.endsWith('.csx')) {
                return undefined;
            }

            const linePrefix = document.lineAt(position).text.substr(0, position.character);
            if (!/namespace[ ]+[\w-]*$/.test(linePrefix)) {
                return undefined;
            }

            const fileDir = path.dirname(document.fileName);

            let searchDir = fileDir;
            const root = path.parse(fileDir).root;

            let found = false;
            let hasParentDir = true;

            let csproj = null;

            while (!found && hasParentDir) {
                const files = fs.readdirSync(searchDir);

                found = files.some(f => f.endsWith('.csproj'));
                hasParentDir = searchDir !== root;

                if (found) {
                    csproj = files.find(f => f.endsWith('.csproj'));
                } else if (hasParentDir) {
                    searchDir = path.join(searchDir, '..');
                }
            }

            if (!found) {
                return undefined;
            }

            const projectRootRelativePath = path.relative(searchDir, fileDir);
            const csprojBaseName = path.basename(csproj as string, path.extname(csproj as string));

            const namespace = path.join(csprojBaseName, projectRootRelativePath)
                .replace(/[\/\\]/g, '.')
                .replace(/[^\w.]/g, '_')
                .replace(/[.]{2,}/g, '.')
                .replace(/^[.]+/, '')
                .replace(/[.]+$/, '')
                .split('.')
                .map(s => /^[0-9]/.test(s) ? '_' + s : s)
                .join('.');

            const namespacePart = namespace.split('.')[0];

            if (new RegExp(`namespace[ ]+${namespacePart}.`).test(linePrefix)) {
                return undefined;
            }

            const moduleCompletion = new vscode.CompletionItem(namespace, vscode.CompletionItemKind.Module);

            const snippetCompletion = new vscode.CompletionItem('namespace-fill', vscode.CompletionItemKind.Snippet);
            snippetCompletion.insertText = namespace;
            snippetCompletion.detail = namespace;

            return [moduleCompletion, snippetCompletion];
        }
    });

    context.subscriptions.push(namespaceCompletionProvider);
}

export function deactivate() { }