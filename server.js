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
        this.board.whiteKing = 'E1';
        this.board.blackKing = 'E8';
    }
}   

//#endregion

//#region Global server variables

const defaultBoard = getInitialBoard();
const queue = [];
const matches = [];

//#endregion

//#region Server handlers

server.on('connection', client => {

    //#region Lobby

    //The client has created a room, the room object contains the room's name, password and time per player
    client.on('createRoom', room => {
        
    });

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
        client.color = 'white';

        //Choose sides
        if (server.sockets.adapter.rooms[`${matchID}`].length == 2){

            //One of the clients is selected to play black, the other one is white
            server.to(matchID).emit('assignSides', client.id, defaultBoard);
            client.color = 'black';
        }
    });

    //#endregion

    //#region In-game

    //Send the move to the other client
    client.on('move', move => {

        client.to(client.matchID).broadcast.emit('move', move);
    });

    //Chat system
    client.on('message', msg => {
        client.to(client.matchID).broadcast.emit('message', msg);
    });

    //#endregion
});

//#endregion

//#region Helper methods

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