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

            //One of the clients is selected to play black, the other one is white
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
            game.selectedPosition = notation;
            server.to(client.id).emit('moves', calculateMoves(notation, game.board));
        }
    });

    //Move and capture a piece
    client.on('move', newPosition => {

        //Variables
        let board = getMatch(client.matchID).board;
        let formerPosition = getMatch(client.matchID).selectedPosition;
        let formerIndex = getSquareIndex(formerPosition, board);
        let newIndex = getSquareIndex(newPosition, board);

        //Change the piece's 'moved' property to true
        board[formerIndex].piece.moved = true;

        //Update piece's new position
        board[newIndex].piece = board[formerIndex].piece;

        //Remove the piece from it's former position
        delete board[formerIndex].piece;

        //The move object contains the position that was just played
        let move = {
            from: formerPosition,
            to: newPosition
        };

        //Change turns
        server.to(client.matchID).emit('turn', move);
    });

    //#endregion
});

//#endregion

//#region Game Logic

//Returns the square's index by giving it the square's notation
function getSquareIndex(notation, board){

    //For memory optimization, check only max 8 squares instead of max 64 squares
    //That is possible due to board[0 ~ 7] represent rank 8, board[8~15] represent rank 7 and so on
    let file = notation.substring(0, 1);
    let rank = notation.substring(1, 2);
    
    let i = (8 - rank) * 8;
    let stop = i + 8;

    for (;i < stop; i++){

        //The square has the same rank and file, return it's array index
        if (board[i].notation.file == file){
            return i;
        }
    }
}

//Returns an array of possible moves for the selected piece
function calculateMoves(notation, board){

    const moves = [];
    let i = getSquareIndex(notation, board);
    let color = board[i].piece.color;
    let piece = board[i].piece.name;
    let pieceAlreadyMoved = board[i].piece.moved;
    let pieceFile = notation.substring(0, 1);
    let pieceRank = parseInt(notation.substring(1, 2));
    let pieceFileNumber = fileConverter('number', pieceFile);

    //Different pieces have different moves
    switch(piece){

        //Pawn movement
        case 'pawn':

            let pawnDirection = color == 'white' ? 1 : -1; //White pawns move up the ranks, Black pawns move down

            //The pawn hasn't moved yet, allow double move
            if (!pieceAlreadyMoved){

                //Scan the next two squares the pawn is facing (i.e. E2 pawn is facing E3 and E4)
                for (let i = 1; i <= 2; i++){
                    let squareToCheck = `${pieceFile}${pieceRank + (i * pawnDirection)}`;

                    //If the square is empty, add it to possible moves array
                    if(!board[getSquareIndex(squareToCheck, board)].piece){
                        moves.push(squareToCheck);
                    }

                    else break;
                }
            }
            
            //The pawn has already moved
            else{
                //TODO: EN PASSANT

                //Scan the square the pawn is facing (i.e. White E4 pawn is facing E5 square)
                let squareToCheck = `${pieceFile}${pieceRank + pawnDirection}`;

                //If the square is empty, add it to possible moves array
                if(!board[getSquareIndex(squareToCheck, board)].piece){
                    moves.push(squareToCheck);
                }
            }

            //Pawn capture system:
            let diff = 1;

            //Iterate over the two squares the pawn is defending, and check if they're taken by an enemy piece
            for(let j = 0; j < 2; j++){

                let file = fileConverter('file', pieceFileNumber + diff);
                
                let notation = file + (pieceRank + pawnDirection);
                diff *= -1;

                //If no such file exists, continue to the next iteration (i.e. A0)
                if (file == undefined){
                    continue;
                }

                //The index of the square we're checking
                let i = getSquareIndex(notation, board);

                //If the square is taken by an enemy piece
                if (board[i].piece && board[i].piece.color != color){
                    
                    //Add it to the moves array
                    moves.push(notation);                    
                }
            }
        break;
    }

    return moves;
}

//#endregion

//#region Helper methods

//Converts files to numbers and numbers to files
function fileConverter(mode, arg){

    //Conver a number to file, i.e. 1 -> A, H -> 8
    if (mode == 'file'){
        switch(arg){
            case 1:
            return 'A';
            case 2:
            return 'B';
            case 3:
            return 'C';
            case 4:
            return 'D';
            case 5:
            return 'E';
            case 6:
            return 'F';
            case 7:
            return 'G';
            case 8:
            return 'H';
        }
    }

    //Conver a file to a number, i.e. A -> 1, 8 -> H
    else if (mode == 'number'){
        switch(arg){
            case 'A':
                return 1;
            case 'B':
                return 2;
            case 'C':
                return 3;
            case 'D':
                return 4;
            case 'E':
                return 5;
            case 'F':
                return 6;
            case 'G':
                return 7;
            case 'H':
                return 8;
        }
    }
}

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