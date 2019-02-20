//#region Requires
const express = require('express');
const app = express();
const http = require('http').Server(app);
const server = require('socket.io')(http);
const uuid = require('uuid/v4');
//#endregion

//#region Classes

//The 'Match' class contains information about a specific match: it's ID, the players, and the board object
class Match{
    constructor(id, white, black){
        this.id = id;
        this.white = white;
        this.black = black;
        //this.board = board;
    }
}   

class Position{
    constructor(file, rank){
        this.file = file;
        this.rank = rank;
        this.pos = file + rank;
    }
}

class Piece{
    constructor(color, type, position){
        this.color = color;
        this.type = type;
        this.position = position;
    }
}

//#endregion

//#region Global server variables

let queue = [];
let matches = [];

//#endregion

//#region Server handlers

server.on('connection', client => {

    //The client is searching for an opponent 
    client.on('searching', () => searchForOpponent(client));

    //The client is inside the match
    client.on('join', matchID => {

        //Add each one of the players into the 'socket.server' room
        client.join(matchID);
        client.matchID = matchID;

        //Choose sides
        if (server.sockets.adapter.rooms[`${matchID}`].length == 2){

            //One of the clients is selected to play black
            server.to(matchID).emit('assignSides', client.id);
        }
    });

    //Switch turns
    client.on('endturn', move => {

        //Emit to the other play it's his turn
        client.to(client.matchID).broadcast.emit('endturn', move);
    });

    //If the client disconnects while waiting in queue, remove him from the queue
    client.on('disconnect', () => {
        if (queue.indexOf(client) != -1){
            queue.splice(queue.indexOf(client), 1);
        }
    });

});

//#endregion

//#region Http & Handle new games

function searchForOpponent(client){
    
    queue.push(client);

    //If there are at least two people in queue, remove them from the queue and put them in a room
    if (queue.length >= 2){

        //Create a room for the two
        let matchID = uuid().substring(0, 6);
        for(let i = 0; i < 2; i++){
            queue[i].join(matchID);
        }

        //Create a new match
        matches.push(new Match(matchID, queue[0], queue[1]));

        //Remove them from the queue
        queue.splice(0, 2);

        //Send the clients to the game
        addPage(matchID);
        server.to(matchID).emit('roomCreated', matches[matches.length - 1].id);
        
    }
}

function addPage(matchID){
    app.get(`/${matchID}`, (req, res) => {
        res.sendFile(__dirname + '/public/match.html');
    });
}

//Build the chess board
function buildBoard(){
    let board = [];
    for(let r = 0; r < 8; r++){
        //board.push(sq)
        table.append(`<tr id=\'r${r}\'></tr>`);
        for(let c = 0; c < 8; c++){
            $(`#r${r}`).append(`<td id=\'td${r}_${c}\'> </td>`);
            addSquareToArray(r, c, $(`#td${r}_${c}`));
            if (r % 2 == 0){
                if (c % 2 == 0){
                    color = 'rgb(253,234,182)';
                }
                else{
                    color = 'rgb(198, 161, 118)';
                }
            }

            else{
                if (c % 2 == 0){
                    color = 'rgb(198, 161, 118)';
                }
                else{
                    color = 'rgb(253,234,182)';
                }
            }
            //Change the square's color based on modulus
            $(`#td${r}_${c}`).css('background', color);
        }
    }
}

app.use(express.static(__dirname + '/public'));
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/public/home.html');
});

http.listen(process.env.PORT || 3000);

//#endregion