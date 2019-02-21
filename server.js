//#region Requires
const express = require('express');
const app = express();
const http = require('http').Server(app);
const server = require('socket.io')(http);
const uuid = require('uuid/v4');
const fs = require('fs');
//#endregion

//#region Classes

//The 'Match' class contains information about a specific match: it's ID, the players, and the board object
class Match{
    constructor(id, player1, player2){
        this.id = id;
        this.player1 = player1;
        this.player2 = player2;
        this.board = getInitialBoard();
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

const initialBoard = getInitialBoard();
const queue = [];
const matches = [];
main();

//#endregion

//#region Server handlers

server.on('connection', client => {

    //#region Lobby

    //The client is searching for an opponent 
    client.on('searching', () => searchForOpponent(client));

    //If the client disconnects while waiting in queue, remove him from the queue
    client.on('disconnect', () => {
        if (queue.indexOf(client) != -1){
            queue.splice(queue.indexOf(client), 1);
        }
    });

    //#endregion

    //#region Game Creation

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

    //#endregion

    //#region In-game

    //Select a piece
    client.on('select', notation => {

        let game = getMatch(client.matchID);

        //Unselect the piece - nothing for the server to do
        if (game.selected){
            game.selected = false;
            return;
        }

        //Select a piece - send legal moves to the client
        else{
            game.selected = true;
            server.to(client.id).emit('moves', calculateMoves(notation, game.board));
        }
    });


    //Switch turns
    client.on('endturn', move => {

        //Emit to the other play it's his turn
        client.to(client.matchID).broadcast.emit('endturn', move);
    });

    //#endregion
});

//#endregion

//#region Game Logic

//Returns the square's index by giving it the square's notation
function getSquareIndex(notation){

    //For memory optimization, check only max 8 squares instead of max 64 squares
    //That is possible due to board[0 ~ 7] represent rank 8, board[8~15] represent rank 7 and so on
    let file = notation.substring(0, 1);
    let rank = notation.substring(1, 2);
    
    let i = (8 - rank) * 8;
    let stop = i + 8;

    for (;i < stop; i++){

        //The square has the same rank and file, return it's array index
        if (initialBoard[i].notation.file == file){
            return i;
        }
    }
}

//Calculates the currently legal moves for a given piece in the given board
function calculateMoves(notation, board){
    
    let i = getSquareIndex(notation);
    let piece = board[i].piece.name;
    let color = board[i].piece.color;
}

//#endregion

//#region Helper methods

//Initialize server(main method)
function main(){
    getInitialBoard();
}

//Gets the initial board information from a JSON file, it includes all the square notations and the location of all pieces:
function getInitialBoard(){
    return JSON.parse(fs.readFileSync(__dirname+'/board.json', 'utf8'));
}

//Returns a match from the 'matches' array, by giving it the match's ID
function getMatch(matchID){
    for (let i = 0; i < matches.length; i++){
        if (matches[i].id == matchID){
            return matches[i];
        }
    }
}

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
        matches.push(new Match(matchID, queue[0].id, queue[1].id));

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

app.use(express.static(__dirname + '/public'));
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/public/home.html');
});

http.listen(process.env.PORT || 3000);

//#endregion