import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

export function activate(context: vscode.ExtensionContext) {
    const namespaceCompletionProvider = vscode.languages.registerCompletionItemProvider({ scheme: 'file', language: 'csharp' }, {
        async provideCompletionItems(document, position, token, context) {
            if (isScriptFile(document)) {
                return;
            }

            const linePrefix = getLinePrefix(document, position);

            if (!isNamespaceDeclaration(linePrefix)) {
                return;
            }

            const fileDir = path.dirname(document.fileName);

            const csprojInfo = findCsprojFile(fileDir);
            if (!csprojInfo) {
                return;
            }

            let rootNamespace = await getRootNamespaceFromElement(csprojInfo.fullPath);

            if (!rootNamespace) {
                rootNamespace = getRootNamespaceFromFileName(csprojInfo.fileName);
            }

            const projectRootRelativePath = path.relative(csprojInfo.dir, fileDir);

            const namespace = getNamespace(rootNamespace, projectRootRelativePath);

            return getCompletions(namespace);
        }
    });

    context.subscriptions.push(namespaceCompletionProvider);
}

function isScriptFile(document: vscode.TextDocument) {
    return document.fileName.endsWith('.csx');
}

function isNamespaceDeclaration(linePrefix: string) {
    return /^[ \t]*namespace[ \t]+\w*$/.test(linePrefix);
}

function getLinePrefix(document: vscode.TextDocument, position: vscode.Position) {
    return document.lineAt(position).text.substr(0, position.character);
}

function findCsprojFile(fileDir: string) {
    let searchDir = fileDir;
    const root = path.parse(fileDir).root;

    let found = false;
    let hasParentDir = true;

    let csprojFileName: string | undefined;
    const csprojExt = '.csproj';

    while (!found && hasParentDir) {
        const files = fs.readdirSync(searchDir);

        found = files.some(f => f.endsWith(csprojExt));
        hasParentDir = searchDir !== root;

        if (found) {
            csprojFileName = files.find(f => f.endsWith(csprojExt));
        } else if (hasParentDir) {
            searchDir = path.join(searchDir, '..');
        }
    }

    if (!found || !csprojFileName) {
        return;
    }

    return { fileName: csprojFileName, dir: searchDir, fullPath: path.join(searchDir, csprojFileName) };
}

async function getRootNamespaceFromElement(csprojPath: string) {
    const csproj = await vscode.workspace.openTextDocument(csprojPath);
    const matches = csproj.getText().match(/<RootNamespace>([\w.]+)<\/RootNamespace>/);

    if (!matches) {
        return;
    }

    return matches[1];
}

function getRootNamespaceFromFileName(csprojFileName: string) {
    return path.basename(csprojFileName, path.extname(csprojFileName));
}

function getNamespace(rootNamespace: string, projectRootRelativePath: string) {
    return path.join(rootNamespace, projectRootRelativePath)
        .replace(/[\/\\]/g, '.')
        .replace(/[^\w.]/g, '_')
        .replace(/[.]{2,}/g, '.')
        .replace(/^[.]+/, '')
        .replace(/[.]+$/, '')
        .split('.')
        .map(s => /^[0-9]/.test(s) ? '_' + s : s)
        .join('.');
}

function getCompletions(namespace: string) {
    const moduleCompletion = new vscode.CompletionItem(namespace, vscode.CompletionItemKind.Module);

    const snippetCompletion = new vscode.CompletionItem('namespace-fill', vscode.CompletionItemKind.Snippet);
    snippetCompletion.insertText = namespace;
    snippetCompletion.detail = namespace;

    return [moduleCompletion, snippetCompletion];
}

export function deactivate() { }