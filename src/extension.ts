import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

export function activate(context: vscode.ExtensionContext) {
	let namespaceCompletionProvider = vscode.languages.registerCompletionItemProvider({ scheme: 'file', language: 'csharp' }, {
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
			let isRoot = fileDir === root;

			while (!found && !isRoot) {
				found = fs.readdirSync(searchDir).some(f => f.endsWith('.csproj'));

				if (!found) {
					searchDir = path.join(searchDir, '..');
					isRoot = searchDir === root;
				}
			}

			if (!found) {
				return undefined;
			}

			const projectRootRelativePath = path.relative(path.join(searchDir, '..'), fileDir);

			const namespace = projectRootRelativePath
				.replace(/[\/\\]/g, '.')
				.replace(/[ -]/g, '_')
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