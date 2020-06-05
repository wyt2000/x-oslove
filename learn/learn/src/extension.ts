// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { format } from 'url';

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	
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
			let count:number=0;
			if(change.text.length===0){
				let temp:ChangeIncident={
					operateType:"delete",
					text:change.text,
					from:{line:change.range.start.line,ch:change.range.start.character},
					to:{line:change.range.end.line,ch:change.range.end.character},
					cursorPosition:{line:change.range.start.line,ch:change.range.start.character}
				};
				operateList.push(temp);
			}
			else if(change.range.start.line===change.range.end.line&&change.range.start.character===change.range.end.character){
				for(let i=0;i<change.text.length;i++){
					if(change.text.charAt(i)==='\n'){
						count++;
					}
				}
				
				let temp:ChangeIncident={
					operateType:"add",
					text:change.text,
					from:{line:change.range.start.line,ch:change.range.start.character},
					to:{line:change.range.end.line,ch:change.range.end.character},
					cursorPosition:{line:change.range.start.line+count,ch:change.range.start.character+change.text.length}
				};
				if(change.text.lastIndexOf('\n')!==-1){
					temp.cursorPosition.ch=change.text.length-1-change.text.lastIndexOf('\n');
				}
				operateList.push(temp);
			}
			else{
				for(let i=0;i<change.text.length;i++){
					if(change.text.charAt(i)==='\n'){
						count++;
					}
				}
				
				let temp:ChangeIncident={
					operateType:"add+delete",
					text:change.text,
					from:{line:change.range.start.line,ch:change.range.start.character},
					to:{line:change.range.end.line,ch:change.range.end.character},
					cursorPosition:{line:change.range.start.line+count,ch:change.range.start.character+change.text.length}
				};
				if(change.text.lastIndexOf('\n')!==-1){
					temp.cursorPosition.ch=change.text.length-1-change.text.lastIndexOf('\n');
				}
				operateList.push(temp);
			}
			

			 console.log(operateList);
			 console.log(change.range.end.line); // range of text being replaced
			 console.log(change.range.end.character);
			 console.log(change.range.start.line);
			 console.log(change.range.start.character);
             console.log(change.text); // text replacement
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
	 operateType:"undo",
	 text:"",
	 from:{line:-1,ch:-1},
	 to:{line:-1,ch:-1},
	 cursorPosition:{line:line,ch:ch}
 };
 operateList.push(temp);
 console.log(operateList);
});
context.subscriptions.push(undoDisposable);
   

	/* let clipboardCopyDisposable = vscode.commands.registerTextEditorCommand('editor.action.clipboardCopyAction', overriddenClipboardCopyAction); 
	context.subscriptions.push(clipboardCopyDisposable); */

	/* let clipboardPasteDisposable = vscode.commands.registerTextEditorCommand('editor.action.clipboardPasteAction',overriddenClipboardPasteAction);
	context.subscriptions.push(clipboardPasteDisposable); */

	/* function overriddenClipboardCopyAction(textEditor:vscode.TextEditor, edit:vscode.TextEditorEdit, params:void) {//重载原来的复制功能
		console.log("---COPY TEST---");
		getCurrentSelectionEvents(); 
		//dispose of the overridden editor.action.clipboardCopyAction- back to default copy behavior
		clipboardCopyDisposable.dispose();
		//execute the default editor.action.clipboardCopyAction to copy
		vscode.commands.executeCommand("editor.action.clipboardCopyAction").then(function(){
			console.log("---After Copy---");
			//add the overridden editor.action.clipboardCopyAction back
			clipboardCopyDisposable = vscode.commands.registerTextEditorCommand('editor.action.clipboardCopyAction', overriddenClipboardCopyAction);
			context.subscriptions.push(clipboardCopyDisposable);
		}); 
	} */
	/* function overriddenClipboardPasteAction(textEditor:vscode.TextEditor, edit:vscode.TextEditorEdit, params:void) {//重载原来的复制功能
		console.log("---PASTE TEST---");
		
		//dispose of the overridden editor.action.clipboardCopyAction- back to default copy behavior
		clipboardPasteDisposable.dispose();
		//execute the default editor.action.clipboardCopyAction to copy
		vscode.commands.executeCommand("editor.action.clipboardPasteAction").then(function(){
			console.log("---After PASTE---");
			//add the overridden editor.action.clipboardCopyAction back
			clipboardPasteDisposable = vscode.commands.registerTextEditorCommand('editor.action.clipboardPasteAction', overriddenClipboardPasteAction);
			context.subscriptions.push(clipboardPasteDisposable);
		}); 
	} */
	/* function getCurrentSelectionEvents(){ ////获取当前选区的内容，如果没有，返回undefined
		console.log('Get the selection:');
		let selection = vscode.window.activeTextEditor?.selection; 
		let text = vscode.window.activeTextEditor?.document.getText(selection);
		console.log(text);
		return text;
	} */

	
	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json
	let disposable = vscode.commands.registerCommand('learn.helloWorld', () => {
		vscode.window.showInformationMessage('Hello World from learn!');
	});
	context.subscriptions.push(disposable);

}
// this method is called when your extension is deactivated
export function deactivate() {}
