/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */
import * as path from 'path';
import { workspace, ExtensionContext } from 'vscode';
import * as vscode from 'vscode';
import * as Automerge from 'automerge';

import {
	LanguageClient,
	LanguageClientOptions,
	ServerOptions,
	TransportKind
} from 'vscode-languageclient';

let client: LanguageClient;
let fromUser: boolean = true; //监听的操作来自用户而非 vscode 本身

export function activate(context: ExtensionContext) {
	console.log('Congratulations, your extension "learn" is now active!');
	
	interface ChangeIncident{
		operateType:string;
		text:string;
		from:{line:number,ch:number};
		to:{line:number,ch:number};
		cursorPosition:{line:number,ch:number};
	}
	let operateList:ChangeIncident[]=[];
	
	vscode.workspace.onDidChangeTextDocument(changeEvent => {
		for (const change of changeEvent.contentChanges) {
			let count: number = 0;
			if (change.text.length === 0) {
				let temp: ChangeIncident = {
					operateType: 'delete',
					text: change.text,
					from: { line: change.range.start.line, ch: change.range.start.character },
					to: { line: change.range.end.line, ch: change.range.end.character },
					cursorPosition: { line: change.range.start.line, ch: change.range.start.character }
				};
				operateList.push(temp);
			}
			else if (change.range.start.line === change.range.end.line && change.range.start.character === change.range.end.character) {
				for (let i = 0; i < change.text.length; i++) {
					if (change.text.charAt(i) === '\n') {
						count++;
					}
				}

				let temp: ChangeIncident = {
					operateType: 'add',
					text: change.text,
					from: { line: change.range.start.line, ch: change.range.start.character },
					to: { line: change.range.end.line, ch: change.range.end.character },
					cursorPosition: { line: change.range.start.line + count, ch: change.range.start.character + change.text.length }
				};
				if (change.text.lastIndexOf('\n') !== -1) {
					temp.cursorPosition.ch = change.text.length - 1 - change.text.lastIndexOf('\n');
				}
				operateList.push(temp);
			}
			else {
				for (let i = 0; i < change.text.length; i++) {
					if (change.text.charAt(i) === '\n') {
						count++;
					}
				}
				let temp: ChangeIncident = {
					operateType: 'add+delete',
					text: change.text,
					from: { line: change.range.start.line, ch: change.range.start.character },
					to: { line: change.range.end.line, ch: change.range.end.character },
					cursorPosition: { line: change.range.start.line + count, ch: change.range.start.character + change.text.length }
				};
				if (change.text.lastIndexOf('\n') !== -1) {
					temp.cursorPosition.ch = change.text.length - 1 - change.text.lastIndexOf('\n');
				}
			}
			client.onReady().then(() => {
				if (fromUser) {
					client.sendRequest('custom/data', operateList[0]).then(a => { console.log('from client send to server successfully!'); });
				}
				fromUser = false;
				client.onRequest('server/data', (doc: Automerge.FreezeObject<any>) => {
					console.log('get message from server');
					fromUser = true;
				});
			});
			console.log(operateList);
			console.log(changeEvent.document.uri.path);
		}

	});


	let undoDisposable = vscode.commands.registerCommand('learn.undo', () => {
	   let line:number=0;
	   let ch:number=0;
	   if(operateList.length>=1){
	   		line=operateList[operateList.length-1].cursorPosition.line;
	   		ch=operateList[operateList.length-1].cursorPosition.ch;
	   }
		let temp:ChangeIncident={
			operateType:'undo',
			text:'',
			from:{line:-1,ch:-1},
			to:{line:-1,ch:-1},
			cursorPosition:{line:line,ch:ch}
		};
		operateList.push(temp);
		console.log(operateList);
	});
	context.subscriptions.push(undoDisposable);

	let disposable = vscode.commands.registerCommand('learn.helloWorld', () => {
		vscode.window.showInformationMessage('Hello World from learn!');
	});
	context.subscriptions.push(disposable);


	// The server is implemented in node
	let serverModule = context.asAbsolutePath(
		path.join('server', 'out', 'server.js')
	);
	// The debug options for the server
	// --inspect=6009: runs the server in Node's Inspector mode so VS Code can attach to the server for debugging
	let debugOptions = { execArgv: ['--nolazy', '--inspect=6009'] };

	// If the extension is launched in debug mode then the debug server options are used
	// Otherwise the run options are used
	let serverOptions: ServerOptions = {
		run: { module: serverModule, transport: TransportKind.ipc },
		debug: {
			module: serverModule,
			transport: TransportKind.ipc,
			options: debugOptions
		}
	};

	// Options to control the language client
	let clientOptions: LanguageClientOptions = {
		// Register the server for plain text documents
		documentSelector: [{ scheme: 'file', language: 'plaintext' }],
		synchronize: {
			// Notify the server about file changes to '.clientrc files contained in the workspace
			fileEvents: workspace.createFileSystemWatcher('**/.clientrc')
		}
	};

	// Create the language client and start the client.
	client = new LanguageClient(
		'languageServerExample',
		'Language Server Example',
		serverOptions,
		clientOptions
	);

	// Start the client. This will also launch the server
	client.start();

	

/*
	client.onReady().then(a=>client.onRequest('server/data',(doc:Automerge.FreezeObject<any>)=>{
	    
		let editor = vscode.window.activeTextEditor;
		if (editor) {
			let document = editor.document;
			let s:string=document.getText();
			editor.edit(editBuilder => {
				let line:number=0;
				let character:number=0;
				for(let i=0;i<s.length;i++){
					if(s[i]==='\n'){
						line++;character=0;
					}
					else{
						character++;
					}
				}
				editBuilder.replace(new vscode.Range(new vscode.Position(0,0),new vscode.Position(line,character)),doc.text.toString());
			});
		}
	})); */
}
export function deactivate(): Thenable<void> | undefined {
	if (!client) {
		return undefined;
	}
	return client.stop();
}
