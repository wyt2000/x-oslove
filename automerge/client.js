const Automerge = require('automerge')
const Connection = require('./connection')
const net = require('net')
const HOST = '127.0.0.1'
const PORT = 9876
const docSet = new Automerge.DocSet()
const readline = require('readline');

/*input:
* ${add} ${pos} ${content}
* ${del} ${begin} ${end}
* ${undo}
* ${redo}
*/
let input=[];
let ctx='';

/*
// Print out the document whenever it changes
docSet.registerHandler((docId, doc) => {
  if(doc.context!=undefined)
  console.log(`[${docId}] ${JSON.stringify(doc)}`)
})
*/

// Make a change to the document every 3 seconds
setInterval(() => {
    let doc = docSet.getDoc('example')
    ctx = doc.context;
    if (doc) {
        if(doc.context===undefined){
        console.log('init');
        doc = Automerge.change(doc, doc => {
            doc.context = '';
        });
    }
    switch(input[0]){
        case 'add':
            if (typeof input[1] !== 'string'|| input[1] > '9' || input[1] < '0' || 
                typeof input[2] !== 'string' || typeof input[3] !== 'undefined'){
                console.log('syntax error!');
                break;
            }
            doc = Automerge.change(doc, doc => {
                doc.context = ctx.slice(0, input[1]) + input[2] + ctx.slice(input[1]);
            });
        break;
        case 'del':
            if (typeof input[1] !== 'string' || input[1] > '9' || input[1] < '0' || 
                typeof input[2] !== 'string' || input[2] > '9' || input[2] < '0' || 
                typeof input[3] !== 'undefined') {
                console.log('syntax error!');
                break;
            }
            doc = Automerge.change(doc, doc => {
            doc.context = ctx.slice(0, input[1]) + ctx.slice(input[2]);
            });
        break;
        case 'undo':
            if (typeof input[1] !== 'undefined') {
                console.log('syntax error!');
                break;
            }
            else if (Automerge.canUndo(doc) !== true){
                console.log('You cannot undo!');
                break;
            }
            doc = Automerge.undo(doc);
        break;
        case 'redo':
            if (typeof input[1] !== 'undefined') {
                console.log('syntax error!');
                break;
            }
            else if (Automerge.canRedo(doc) !== true) {
                console.log('You cannot redo!');
                break;
            }
            doc = Automerge.redo(doc);
        break;
        default:
            if (typeof input[0] !== 'undefined') {
                console.log('syntax error!');
                break;
            }
        break;
    }
    input=[];
    docSet.setDoc('example', doc);
  }
}, 3000)

const socket = new net.Socket()
let connection

//receive the input
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});
rl.on('line', (answer) => {
    console.log(`Receive input：${answer}`);
    input = answer.split(' ');
});


// Connecting to a TCP port
socket.connect(PORT, HOST, () => {
    console.log(`[${HOST}:${PORT}] connected`);
    connection = new Connection(docSet, socket);
})

// Receiving data from the server
socket.on('data', (data) => {
    if (!(data instanceof Buffer)) {
        data = Buffer.from(data, 'utf8')
    }
    connection.receiveData(data)
})

socket.on('close', () => {
    console.log(`[${HOST}:${PORT}] connection closed`)
})

socket.on('error', (err) => {
    console.log(`[${socket.remoteAddress}:${socket.remotePort}] error: ${err}`)
})
