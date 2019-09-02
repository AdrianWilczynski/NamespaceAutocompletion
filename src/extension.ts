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

            let rootNamespace = await readRootNamespaceFromElement(csprojInfo.fullPath);

            if (!rootNamespace) {
                rootNamespace = readRootNamespaceFromFileName(csprojInfo.fileName);
            }

            const projectRootRelativePath = path.relative(csprojInfo.dir, fileDir);

            const namespace = resolveNamespace(rootNamespace, projectRootRelativePath);

            return createCompletions(namespace);
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

    let fileName: string | undefined;

    for (let i = 0; i < 25; i++) {
        fileName = fs.readdirSync(searchDir).find(f => /.\.csproj$/.test(f));
        
        if (!fileName && searchDir !== root) {
            searchDir = path.join(searchDir, '..');
        } else {
            break;
        }  
    }

    if (!fileName) {
        return;
    }

    return { fileName: fileName, dir: searchDir, fullPath: path.join(searchDir, fileName) };
}

async function readRootNamespaceFromElement(csprojPath: string) {
    const csproj = await vscode.workspace.openTextDocument(csprojPath);
    const matches = csproj.getText().match(/<RootNamespace>([\w.]+)<\/RootNamespace>/);

    if (!matches) {
        return;
    }

    return matches[1];
}

function readRootNamespaceFromFileName(csprojFileName: string) {
    return path.basename(csprojFileName, path.extname(csprojFileName));
}

function resolveNamespace(rootNamespace: string, projectRootRelativePath: string) {
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

function createCompletions(namespace: string) {
    const moduleCompletion = new vscode.CompletionItem(namespace, vscode.CompletionItemKind.Module);

    const snippetCompletion = new vscode.CompletionItem('namespace-fill', vscode.CompletionItemKind.Snippet);
    snippetCompletion.insertText = namespace;
    snippetCompletion.detail = namespace;

    return [moduleCompletion, snippetCompletion];
}

export function deactivate() { }