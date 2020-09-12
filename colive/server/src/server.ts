import * as Automerge from 'automerge';
import * as io from 'socket.io-client';
import {
	TextEdit,
	createConnection,
	TextDocuments,
	ProposedFeatures,
	InitializeParams,
	DidChangeConfigurationNotification,
	TextDocumentSyncKind,
	InitializeResult,
	WorkspaceEdit,
	Range
} from 'vscode-languageserver';

import {
	TextDocument
} from 'vscode-languageserver-textdocument';

/*
	* Initialization of language server.
	* Copied from VSCode Languager Server Example.
*/
let connection = createConnection(ProposedFeatures.all);
let documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);
let hasConfigurationCapability: boolean = false;
let hasWorkspaceFolderCapability: boolean = false;
connection.onInitialize((params: InitializeParams) => {
	let capabilities = params.capabilities;
	hasConfigurationCapability = !!(
		capabilities.workspace && !!capabilities.workspace.configuration
	);
	hasWorkspaceFolderCapability = !!(
		capabilities.workspace && !!capabilities.workspace.workspaceFolders
	);
	const result: InitializeResult = {
		capabilities: {
			textDocumentSync: TextDocumentSyncKind.Full,
		}
	};
	if (hasWorkspaceFolderCapability) {
		result.capabilities.workspace = {
			workspaceFolders: {
				supported: true
			}
		};
	}
	return result;
});

connection.onInitialized(() => {
	if (hasConfigurationCapability) {
		connection.client.register(DidChangeConfigurationNotification.type, undefined);
	}
	if (hasWorkspaceFolderCapability) {
		connection.workspace.onDidChangeWorkspaceFolders(_event => {
			connection.console.log('Workspace folder change event received.');
		});
	}
});

interface cursorPosition{
	ID:number,
	line:number,
	character:number
}
interface ChangeIncident{
	operateType:string;
	text:string;
	from:{line:number,ch:number};
	to:{line:number,ch:number};
	rangeOffset:number;
	rangeLength:number;
}

let currentUri:string;
let doc:Automerge.FreezeObject<any>=Automerge.init();	// Automerge doc
let admin:boolean = true;
let editFinished:boolean = true;
let document: TextDocument;
let undoList:Automerge.FreezeObject<any>[]=[];
let userID:number=0;
let wseQueue: WorkspaceEdit[] = [];	// workspace edition queue
let lastChange: ChangeIncident[] = [];

let socket: SocketIOClient.Socket = io.connect();

/*
*	When language server gets the 'enter' request from extension,
*	it will try to connect to server and login.
*	If it logins successfully, the server will send it a unique userID,
*	then language server send it to extension.
*/
connection.onRequest('enter', () => {
	socket = io.connect('http://139.224.129.6:8090');
	socket.emit('login', { 'room_id': 1, 'password': '123' });

	//The functions below are used to connect with server.
	
	socket.on('login', (msg: string) => {
		//Get userID
		userID = parseInt(msg);
		if (msg === '0') {
 			admin = true;
 		}
 		else {
 			admin = false;
 		}
		connection.sendRequest('server/login', userID);
	});

	socket.on('admin', () => {
		//For admin, send the current doc to server.
		if (admin) {
			let str = Automerge.save(doc);
			socket.emit('doc', str);
		}
	});

	socket.on('doc', (msg: string) => {
		//For other clients, write the doc from server to workspace.
		if (doc.text === undefined) {
			let message: string;
			doc = Automerge.load(msg);
			if (doc.text === undefined) {
				message = 'The admin is not ready!';
			}
			else {
				render();
				message = 'connect successfully!';
			}
			connection.sendRequest('init', message);
		}
	});

	socket.on('message', (msg: string) => {
		// Receive the operations from other clients and modify Automerge doc.
		// Get the modification and render it to workspace.
		undoList = [];
		let changeAutomerge = JSON.parse(msg);
		let newDoc = Automerge.applyChanges(doc, changeAutomerge);
		doc = newDoc;
		render();
	});

	socket.on('undo', () => {
		let history = Automerge.getHistory(doc);
		if (history.length >= 2) {
			undo();
		}
	});

	socket.on('redo', () => {
		if (undoList.length > 0) {
			redo();
		}
	});

	socket.on('cursor', (msg: string) => {
		let cursorPositionList: cursorPosition[] = JSON.parse(msg);
		connection.sendRequest('cursorRender', [cursorPositionList]);
	});

	socket.on('othersLogout',(msg:string)=>{
		let userLogout:number=parseInt(msg);
		connection.sendRequest('othersLogout',userLogout);
	});
});

connection.onRequest('cursor',(cursorPositionList:cursorPosition[])=>{
	socket.emit('cursor',JSON.stringify(cursorPositionList));
});

connection.onRequest('disconnect',()=>{ 
	let newDoc:Automerge.FreezeObject<any>=Automerge.init();
	doc=newDoc;
	socket.emit('logout',userID);
	socket.disconnect();
});

/*
*	When language server gets the 'connect' request from extension,
*	it will try to synchronize itself with other server:
*	For admin (the first user, userID = 0), it will write its workspace into Automerge doc.
*	For other client, it will send synchronization request to server.
* 	Then server will get current doc from admin and send it back to other client.
*/
connection.onRequest('connect', () => {
	if (!admin) {
		socket.emit('init'); 
	}
	else {
		doc = Automerge.change(doc, doc => {
			doc.text = new Automerge.Text();
			doc.text.insertAt(0, ...document.getText().split(''));
		});
		connection.sendRequest('init', 'connect successfully!');
	}
});

/*
*	Apply workspace Editions in queue to workspace. 	
*	In order to avoid writing successively, we call it recursively in its callback.
*	When user change concurrently, applyEdit will respond failure,
*	so we reapply it and send last change to server
*/
function applyEdit() {
	if(editFinished && wseQueue.length){
		editFinished = false;
		connection.workspace.applyEdit(wseQueue[0]).then(response => {
			if (response.applied) {
				wseQueue.shift();
			}
			else {
				recvFromUser(lastChange);
			}
			editFinished = true;
			applyEdit();
			render();
		});
	}
}

/*
*	Push WorkspaceEdits into queue and applyEdit.
*/
function render(){
	if (doc.text.toString() !== document.getText()){
		let te: TextEdit[] = [];
		let text = document.getText();
		let range = Range.create(document.positionAt(0), document.positionAt(text.length));
		te.push(TextEdit.replace(range, doc.text.toString()));
		let wse: WorkspaceEdit = {
			changes: {
				[currentUri]: te
			}
		};
		wseQueue.push(wse);
		applyEdit();
	}
}

function redo() {
	//pop the undo stack
	doc = undoList[undoList.length-1];
	undoList.pop();
	render();
}

function undo() {
	//reset the automerge doc version
	let history = Automerge.getHistory(doc);
	undoList.push(doc);
	doc = history[history.length-2].snapshot;
	render();
}

function recvFromUser(changeQueue: ChangeIncident[]){
	lastChange = [];
	let newDoc = Automerge.change(doc, doc => {
		for (const change of changeQueue) {
			if (!editFinished) {
				lastChange.push(change);
				continue;
			}
			else {
				undoList = [];
			}
			if (change.operateType.match('replace')) {
				doc.text.deleteAt(change.rangeOffset, change.rangeLength);
				doc.text.insertAt(change.rangeOffset, ...change.text.split(''));
			}
			else if (change.operateType.match('add')) {
				doc.text.insertAt(change.rangeOffset, ...change.text.split(''));
			}
			else if (change.operateType.match('delete')) {
				doc.text.deleteAt(change.rangeOffset, change.rangeLength);
			}
		}
	});
	if (doc.text.toString() !== newDoc.text.toString()) {
		let changeAutomerge = Automerge.getChanges(doc, newDoc);
		doc = newDoc;
		socket.emit('message', JSON.stringify(changeAutomerge));
	}
}

/*
* 	Receive the operation from the extension.
*	Update Automerge doc.
*	Send changes to other client.
*/
connection.onRequest('custom/data', (changeQueue:ChangeIncident[])=> {
	let history=Automerge.getHistory(doc);

	if(changeQueue[0].operateType.match('undo')||changeQueue[0].operateType.match('redo')){
		if(changeQueue[0].operateType.match('undo')){
			if(history.length>=2){
				undo();
				socket.emit('undo','undo');
			}
		}
		else if(changeQueue[0].operateType.match('redo')){
			if(undoList.length>0){
				redo();
				socket.emit('redo','redo');
			}
		}
	}

	else {
		recvFromUser(changeQueue);
	}

});

documents.onDidOpen(change => {
	//Get current workspace
	document = change.document;
	currentUri = document.uri;
});

documents.listen(connection);
connection.listen();