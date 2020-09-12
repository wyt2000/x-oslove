import * as path from 'path';
import { workspace, ExtensionContext } from 'vscode';
import * as vscode from 'vscode';

import {
	LanguageClient,
	LanguageClientOptions,
	ServerOptions,
	TransportKind,
} from 'vscode-languageclient';

import { TreeViewProvider } from './TreeViewProvider';

let client: LanguageClient;
let userID:number = -1;
let connect:boolean = false;
let colorList:string[] = ['red','blue','green','orange','yellow','purple','pink','white']; //cursor colors
let enter:boolean = false;



function initClient(context: ExtensionContext, port: string){
/*
*  	Set language server for the client.
*	Each extension should use one of the localhost ports.
*/
	let client: LanguageClient;
	let serverModule = context.asAbsolutePath(
		path.join('server', 'out', 'server.js')
	);
	let debugOptions = { execArgv: ['--nolazy', '--inspect=' + port] };
	let serverOptions: ServerOptions = {
		run: { module: serverModule, transport: TransportKind.ipc },
		debug: {
			module: serverModule,
			transport: TransportKind.ipc,
			options: debugOptions
		}
	};
	let clientOptions: LanguageClientOptions = {
		documentSelector: [{ scheme: 'file', language: 'plaintext' }],
		synchronize: {
			fileEvents: workspace.createFileSystemWatcher('**/.clientrc')
		}
	};
	client = new LanguageClient(
		'languageServerExample',
		'Language Server Example',
		serverOptions,
		clientOptions
	);
	return client;
}

interface cursorPosition{
	ID:number,
	line:number,
	character:number
}

interface CursorRender{
	ID:number,
	decorationType:vscode.TextEditorDecorationType,
	decorationOptions: vscode.DecorationOptions[]
}
let cursorRenderList:CursorRender[]=[];

interface ChangeIncident {
/*
*  	The operation of user: insert, delete, replace, redo, undo
*	When multi-cursors are used, we consider them as different operation
*/
	operateType: string;
	text: string;
	from: { line: number, ch: number };
	to: { line: number, ch: number };
	rangeOffset: number;
	rangeLength: number;
}
let operateList: ChangeIncident[] = [];

//init cursor color
let decorationTypeList:Array<vscode.TextEditorDecorationType>=[];
for(let i=0;i<colorList.length;i++){
	let decorationType:vscode.TextEditorDecorationType =vscode.window.createTextEditorDecorationType({
		border:'2px solid '+colorList[i]+';'
	});
	decorationTypeList.push(decorationType);
}

export function activate(context: ExtensionContext) {
/*
*  	When the extension is activated, it will run the code belows
*/
	vscode.window.onDidChangeTextEditorSelection(()=>{
	/*
	*  	When the cursors move, we record their position and send to server
	*/
		let editor=vscode.window.activeTextEditor;
		let cursorPositionList:cursorPosition[]=[];
		for(let i=0;i<editor.selections.length;i++){
			let cur=editor.selections[i].active;
			cursorPositionList.push({
				ID:userID,
				line:cur.line,
				character:cur.character
			});
		}
		client.onReady().then(() => {
			if(connect){
				client.sendRequest('cursor',[cursorPositionList]);
			}
		});
	});

	vscode.workspace.onDidChangeTextDocument(changeEvent => {
	/*
	*  	When document changes from user, we get the ChangeIncident and send them to server
	* 	Notice: The modify of language server will be considered as operations,
	*	so it will fire this funciton as well.
	*   We use flag to avoid loop responds, but there are still bugs.
	*/
		for (const change of changeEvent.contentChanges) {
			let count: number = 0;
			let temp: ChangeIncident;
			if (change.text.length === 0) {
				temp = {
					operateType: 'delete',
					text: change.text,
					from: { line: change.range.start.line, ch: change.range.start.character },
					to: { line: change.range.end.line, ch: change.range.end.character },
					rangeOffset: change.rangeOffset,
					rangeLength: change.rangeLength,
				};
			}
			else if (change.range.start.line === change.range.end.line && change.range.start.character === change.range.end.character) {
				for (let i = 0; i < change.text.length; i++) {
					if (change.text.charAt(i) === '\n') {
						count++;
					}
				}

				temp = {
					operateType: 'add',
					text: change.text,
					from: { line: change.range.start.line, ch: change.range.start.character },
					to: { line: change.range.end.line, ch: change.range.end.character },
					rangeOffset: change.rangeOffset,
					rangeLength: change.rangeLength,
				};
				
			}
			else {
				for (let i = 0; i < change.text.length; i++) {
					if (change.text.charAt(i) === '\n') {
						count++;
					}
				}
				temp = {
					operateType: 'replace',
					text: change.text,
					from: { line: change.range.start.line, ch: change.range.start.character },
					to: { line: change.range.end.line, ch: change.range.end.character },
					rangeOffset: change.rangeOffset,
					rangeLength: change.rangeLength,
				};
			}
			operateList.push(temp);
		}
		if(!connect){
			operateList = [];
		}
		client.onReady().then(() => {
		/*
		*  Send operationList to server and clear it
		*/
			if (connect&&operateList.length>0) {
				client.sendRequest('custom/data', [operateList]);
			}
			operateList = [];
		});
	});

	let undoDisposable = vscode.commands.registerCommand('colive.undo', () => {
		let temp: ChangeIncident = {
			operateType: 'undo',
			text: '',
			from: { line: -1, ch: -1 },
			to: { line: -1, ch: -1 },
			rangeOffset: -1,
			rangeLength: -1,
		};
		operateList.push(temp);
		client.onReady().then(() => { 
			client.sendRequest('custom/data', [operateList]);
			operateList = [];
		});
		
	});
	context.subscriptions.push(undoDisposable);

	let redoDisposable = vscode.commands.registerCommand('colive.redo', () => {
		let temp: ChangeIncident = {
			operateType: 'redo',
			text: '',
			from: { line: -1, ch: -1 },
			to: { line: -1, ch: -1 },
			rangeOffset: -1,
			rangeLength: -1,
		};
		operateList.push(temp);
		client.onReady().then(() => { 
			client.sendRequest('custom/data', [operateList]);
			operateList = [];
		});
		
	});
	context.subscriptions.push(redoDisposable);

	let connectDisposable = vscode.commands.registerCommand('colive.connect', () => {
		if(enter){
			vscode.window.showInformationMessage('Connecting to server...');
			client.onReady().then(() => {
				client.sendRequest('connect');
			});
		}
		else{
			vscode.window.showInformationMessage('Please enter first!');
		}
	});
	context.subscriptions.push(connectDisposable);

	let disconnectDisposable = vscode.commands.registerCommand('colive.disconnect', () => {
		if(enter){
			vscode.window.showInformationMessage('disconnect from server!');
			enter=false;
			connect=false;
			client.onReady().then(() => {
				client.sendRequest('disconnect').then(() => {
					for(let i=0;i<cursorRenderList.length;i++){
						cursorRenderList[i].decorationType.dispose();
					}
					cursorRenderList=[];
					decorationTypeList=[];
					for(let i=0;i<colorList.length;i++){
						let decorationType:vscode.TextEditorDecorationType =vscode.window.createTextEditorDecorationType({
							border:'2px solid '+colorList[i]+';'
						});
						decorationTypeList.push(decorationType);
					}
				});
			});
		}
	});
	context.subscriptions.push(disconnectDisposable);

	let enterDisposable = vscode.commands.registerCommand('colive.enter', () => {
		if(!enter){
			vscode.window.showInformationMessage('entering...');
			client.onReady().then(() => {
				client.sendRequest('enter');
			});
		}
		else{
			vscode.window.showInformationMessage('You are already enter!');
		}
	});
	context.subscriptions.push(enterDisposable);

	TreeViewProvider.initTreeViewItem();
	context.subscriptions.push(vscode.commands.registerCommand('itemClick', (label:string) => {
		if(label.match('disconnect')){
			if(enter){
				vscode.window.showInformationMessage('disconnect from server!');
				enter = false;
				connect = false;
				client.onReady().then(() => {
					client.sendRequest('disconnect').then(() => {
						for(let i=0;i<cursorRenderList.length;i++){
							cursorRenderList[i].decorationType.dispose();
						}
						cursorRenderList=[];
						decorationTypeList=[];
						for(let i=0;i<colorList.length;i++){
							let decorationType:vscode.TextEditorDecorationType =vscode.window.createTextEditorDecorationType({
								border:'2px solid '+colorList[i]+';'
							});
							decorationTypeList.push(decorationType);
						}
					});
				});
			}
		}
		else if(label.match('connect')){
			if(enter){
				vscode.window.showInformationMessage('Connecting to server...');
				client.onReady().then(() => {
					client.sendRequest('connect');
				});
			}
			else{
				vscode.window.showInformationMessage('Please enter first!');
			}
		}
		else if(label.match('enter')){
			if(!enter){
				vscode.window.showInformationMessage('entering...');
				client.onReady().then(() => {
					client.sendRequest('enter');
				});
			}
			else{
				vscode.window.showInformationMessage('You are already enter!');
			}
		}
	}));

	client = initClient(context, '6009');

	client.start();

	client.onReady().then(() => {
		client.onRequest('server/login', (id:number) => {
			userID=id;
			if(id===0){
				vscode.window.showInformationMessage('You are the admin!');
			}
			else{
				vscode.window.showInformationMessage(`You are user ${userID}!`);
			}
			enter = true;
		});
	});

	client.onReady().then(() => {
		client.onRequest('init', (msg: string) => {
		//init successfully
			vscode.window.showInformationMessage(msg);
			connect = true;
		});
	});

	client.onReady().then(() => {
		client.onRequest('cursorRender', (cursorPositionList:cursorPosition[]) => {
			//When the cursors of other client move, modify the position of cursors.
			let editor=vscode.window.activeTextEditor;
			let decorationOptions:vscode.DecorationOptions[]=[];
			
			let id:string='';
			if(cursorPositionList[0].ID===0){
				id='admin';
			}
			else{
				id='user '+cursorPositionList[0].ID;
			}
			for(let i=0;i<cursorPositionList.length;i++){
				decorationOptions.push({
					range:new vscode.Range(
						new vscode.Position(cursorPositionList[i].line,cursorPositionList[i].character),
						new vscode.Position(cursorPositionList[i].line,cursorPositionList[i].character)
					),
					hoverMessage:id
				});
			}
			let j=0;
			for(j=0;j<cursorRenderList.length;j++){
				if(cursorRenderList[j].ID===cursorPositionList[0].ID){
					cursorRenderList[j].decorationType=decorationTypeList[cursorPositionList[0].ID];
					cursorRenderList[j].decorationOptions=decorationOptions;
					break;
				}
			}
			if(j===cursorRenderList.length){
				cursorRenderList.push({
					ID:cursorPositionList[0].ID,
					decorationType:decorationTypeList[cursorPositionList[0].ID],
					decorationOptions:decorationOptions
				});
			}
			for(let i=0;i<cursorRenderList.length;i++){
				editor.setDecorations(cursorRenderList[i].decorationType,cursorRenderList[i].decorationOptions);
			}
		});
	});

	client.onReady().then(() => {
		//When user logout, server will inform other clients
		client.onRequest('othersLogout',(userLogout:number)=>{
			let id:string='';
			if(userLogout===0){
				id='admin';
			}
			else{
				id='user '+userLogout;
			}
			vscode.window.showInformationMessage(id+' has logouted');
			let i:number;
			for(i=0;i<cursorRenderList.length;i++){
				if(cursorRenderList[i].ID === userLogout){
					break;
				}
			}
			if(i !== cursorRenderList.length){
				cursorRenderList[i].decorationType.dispose();
				cursorRenderList.splice(i, 1);

				decorationTypeList = [];
				for (let i = 0; i < colorList.length; i++) {
					let decorationType: vscode.TextEditorDecorationType = vscode.window.createTextEditorDecorationType({
						border: '2px solid ' + colorList[i] + ';'
					});
					decorationTypeList.push(decorationType);
				}			
			}
		});
	});
}
export function deactivate(): Thenable<void> | undefined {
	if (!client) {
		return undefined;
	}
	return client.stop();
}