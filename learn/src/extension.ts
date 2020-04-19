// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "learn" is now active!');
	let clipboardCopyDisposable = vscode.commands.registerTextEditorCommand('editor.action.clipboardCopyAction', overriddenClipboardCopyAction); 
	context.subscriptions.push(clipboardCopyDisposable);
	function overriddenClipboardCopyAction(textEditor:vscode.TextEditor, edit:vscode.TextEditorEdit, params:void) {//重载原来的复制功能
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
	}
	function getCurrentSelectionEvents(){ ////获取当前选区的内容，如果没有，返回undefined
		console.log('Get the selection:');
		let selection = vscode.window.activeTextEditor?.selection; 
		let text = vscode.window.activeTextEditor?.document.getText(selection);
		console.log(text);
		return text;
	}
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
