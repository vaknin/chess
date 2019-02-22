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

//#endregion

//#region Global server variables

const defaultBoard = getInitialBoard();
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
        let formerIndex = getSquareIndex(formerPosition);
        let newIndex = getSquareIndex(newPosition);
        let piece = board[formerIndex].piece;
        delete board.doubleMove; //Disable en passant opportunity if not used

        //#region Pawns

        if (piece.name == 'pawn'){

            let formerFile = formerPosition.substring(0, 1);
            let newFile = newPosition.substring(0, 1);
            let movedFiles = formerFile != newFile;

            let formerRank = formerPosition.substring(1, 2);
            let newRank = newPosition.substring(1, 2);
            let movedTwice = Math.abs(formerRank - newRank) == 2;

            //If the pawn just moved twice, mark that as a property
            if (movedTwice){
                board.doubleMove = newPosition;
            }

            //If the pawn moved between files, to an empty square - En passant was executed
            else if(board[newIndex].piece == undefined && movedFiles){

                //Remove the captured piece from the board on (newFile, oldRank)
                let i = getSquareIndex(newFile + formerRank);
                delete board[i].piece;
            }

            //Promotion
            else if(newRank == 1 || newRank == 8){

                //Set as queen (might do knight rook bishop later)
                board[formerIndex].piece.name = 'queen';
            }
        }

        //#endregion

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

        //#region Checks
        
        //Get an array of possible moves
        let moves = calculateMoves(newPosition, board);

        //Loop through all moves and check if the king is checked
        for(let i = 0; i < moves.length; i++){

            let index = getSquareIndex(moves[i]);
            
            if (board[index].piece && board[index].piece.name == 'king'){
                board.check = moves[i];
                break;
            }
        }
        

        //#endregion

        //Change turns
        server.to(client.matchID).emit('turn', move, board.check);
    });

    //#endregion
});

//#endregion

//#region Game Logic

//Returns the square's index by giving it the square's notation
function getSquareIndex(notation){

    //For memory optimization, check only max 8 squares instead of max 64 squares
    //That is possible due to board[0 ~ 7] represent rank 8, board[8~15] represent rank 7 and so on

    if (!notation.substring){
        return -1;
    }

    let file = notation.substring(0, 1);
    let rank = notation.substring(1, 2);
    
    let i = (8 - rank) * 8;
    let stop = i + 8;

    for (;i < stop; i++){

        //The square has the same rank and file, return it's array index
        let exists = defaultBoard[i] != undefined;
        
        if (exists && defaultBoard[i].notation.file == file){
            return i;
        }
    }

    return -1;
}

//Returns an array of possible moves for the selected piece
function calculateMoves(notation, board){

    //Variables
    const moves = [];
    let i = getSquareIndex(notation);
    let color = board[i].piece.color;
    let piece = board[i].piece;
    let pieceAlreadyMoved = board[i].piece.moved;
    let pieceFile = notation.substring(0, 1);
    let pieceRank = parseInt(notation.substring(1, 2));
    let pieceFileNumber = fileConverter('number', pieceFile);

    //Different pieces have different moves
    switch(piece.name){

        //#region Pawn
        case 'pawn':

            let pawnDirection = color == 'white' ? 1 : -1; //White pawns move up the ranks, Black pawns move down

            //The pawn hasn't moved yet, allow double move
            if (!pieceAlreadyMoved){

                //Scan the next two squares the pawn is facing (i.e. E2 pawn is facing E3 and E4)
                for (let i = 1; i <= 2; i++){
                    let squareToCheck = `${pieceFile}${pieceRank + (i * pawnDirection)}`;

                    //If the square is empty, add it to possible moves array
                    if(!board[getSquareIndex(squareToCheck)].piece){
                        moves.push(squareToCheck);
                    }

                    else break;
                }
            }
            
            //The pawn has already moved
            else{
                //Scan the square the pawn is facing (i.e. White E4 pawn is facing E5 square)
                let squareToCheck = `${pieceFile}${pieceRank + pawnDirection}`;
                let squareExists = getSquareIndex(squareToCheck) != -1;

                //If the square is empty, add it to possible moves array
                if(squareExists && !board[getSquareIndex(squareToCheck)].piece){
                    moves.push(squareToCheck);
                }

                //En Passant;
                //Check if a double move has occured in the last game
                if (board.doubleMove){
                    
                    //Check if it is the proper rank
                    let doubleMoveRank = parseInt(board.doubleMove.substring(1, 2));
                    let sameRank = pieceRank == doubleMoveRank;
                    
                    //Proper rank
                    if (sameRank){

                        //Check if it is the proper file:
                        //The file the pawn has double-moved to
                        let doubleMoveFile = board.doubleMove.substring(0, 1);

                        //Loop twice and check if en-passant is possible
                        let n = 1;
                        for(let i = 0; i < 2; i++){

                            let properFile = fileConverter('file', pieceFileNumber + n);

                            //The ranks and files are proper for en passant, add the move
                            if (doubleMoveFile == properFile){
                                moves.push(properFile + (pieceRank + pawnDirection));
                                break;
                            }

                            else{
                                n *= -1;
                                continue;
                            }
                        }
                    }
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
                let i = getSquareIndex(notation);
                let squareExists = i != -1;

                //If the square is taken by an enemy piece
                if (squareExists && board[i].piece && board[i].piece.color != color){
                    
                    //Add it to the moves array
                    moves.push(notation);                    
                }
            }
        break;
        //#endregion

        //#region Knight
        case 'knight':

            //First file to check
            let currFileNumber = pieceFileNumber - 2;

            //Check all four possible files
            for (let f = 0; f < 4; f++){

                let currFile = fileConverter('file', currFileNumber);

                //Check The two possible squares for the given file
                for(let s = 0; s < 2; s++){

                    let rankModifier;

                    //Second and third iterations - check ranks on (pieceRank + 2) and (pieceRank - 2) 
                    if (f == 1 || f == 2){
                        rankModifier = 2;
                    }

                    //First and fourth iterations - check ranks on (pieceRank + 1) and (pieceRank - 1) 
                    else{
                        rankModifier = 1;
                    }

                    //If it is the first iteration
                    if (s % 2 == 0){
                        rankModifier *= -1;
                    }

                    let notation = currFile + (pieceRank + rankModifier);

                    //If the square can be moved to(i.e. no ally piece on it)
                    if (squareIsMoveable(notation, board, color)){

                        moves.push(notation);
                    }
                }

                //First and third iterations
                if (f % 2 == 0){
                    currFileNumber += 1;
                }

                //Second iteration
                else{
                    currFileNumber += 2;
                }
            }
        break;
        //#endregion

        //#region Bishop
        case 'bishop':

            //Every bishop moves in 4 diagonal directions, check each of them
            for(let i = 1; i <= 4; i++){

                let currFile = pieceFileNumber;
                let currRank = pieceRank;
                
                //Maximum diagonal travel distance is 7 squares - loop through them
                for(let d = 0; d < 7; d++){

                    //Decide the diagonal direction (uu/ud/du/dd)
                    switch(i){
                    
                        //Up the files, up the ranks
                        case 1:
                        currFile += 1;
                        currRank += 1;

                    break;
                        //Up the files, down the ranks
                        case 2:
                        currFile += 1;
                        currRank -= 1;
                            
                    break;
                        //Down the files, up the ranks
                        case 3:
                        currFile -= 1;
                        currRank += 1;
                            
                    break;

                        //Down the files, down the ranks
                        case 4:
                        currFile -= 1;
                        currRank -= 1;
                            
                    break;
                    }

                    let notation = fileConverter('file', currFile) + currRank;

                    //If the square is moveable, add it to the possible list of moves
                    if (squareIsMoveable(notation, board, color)){
                        moves.push(notation);

                        //If the square has an enemy piece on it, break(as it blocks the bishop)
                        let i = getSquareIndex(notation);
                        if (board[i].piece){
                            break;
                        }
                    }


                    //If not, break the loop, pieces cannot go through other pieces
                    else break;
                }
            } 

        break;
        //#endregion

        //#region Rook
        case 'rook':

            //Rooks can move in four different directions
            for(let direction = 1; direction <= 4; direction++){

                let currFile = pieceFileNumber;
                let currRank = pieceRank;

                //Maximum travel distance is 7, check each of the squares
                for(let i = 1; i <= 7; i++){

                    switch(direction){

                        //Up the Files (left to right)
                        case 1:
                            currFile += 1;
                        break;

                        //Up the Ranks (bottom to top)
                        case 2:
                            currRank += 1;
                        break;

                        //Down the files (right to left)
                        case 3:
                            currFile -= 1;
                        break;

                        //Down the ranks (top to bottom)
                        case 4:
                            currRank -= 1;
                        break;
                    }

                    //The square to check
                    let notation = fileConverter('file', currFile) + currRank;

                    //If the square is moveable, add it to the possible list of moves
                    if (squareIsMoveable(notation, board, color)){
                        moves.push(notation);

                        //If the square has an enemy piece on it, break - as it blocks movement
                        let i = getSquareIndex(notation);
                        if (board[i].piece){
                            break;
                        }
                    }

                    //If the square is blocked by an ally piece or the square doesn't exist - break
                    else break;
                }
            }

        break;

        //#endregion

        //#region Queen

        case 'queen':

            //The queen can move in 8 different directions
            for (let direction = 1; direction <= 8; direction++){

                let currFile = pieceFileNumber;
                let currRank = pieceRank;

                //Maximum number of steps is 7
                for(let i = 1; i<= 7; i++){

                    switch(direction){

                        //Up the files(left to right)
                        case 1:
                            currFile += 1;
                        break;

                        //Down the files(right to left)
                        case 2:
                            currFile -= 1;
                        break;

                        //Up the ranks(bottom to top)
                        case 3:
                            currRank += 1;
                        break;

                        //Down the ranks(top to bottom)
                        case 4:
                            currRank -= 1;
                        break;

                        //Up the files + up the ranks (diagonal topright)
                        case 5:
                            currFile += 1;
                            currRank += 1;
                        break;

                        //Up the files + down the ranks (diagonal bottomright)
                        case 6:
                            currFile += 1;
                            currRank -= 1;

                        break;

                        //Down the files + up the ranks (diagonal topleft)
                        case 7:
                            currFile -= 1;
                            currRank += 1;                    
                        break;

                        //Down the files + down the ranks (diagonal bottomleft)
                        case 8:
                            currFile -= 1;
                            currRank -= 1;
                        break;
                    }

                    //The square to check
                    let notation = fileConverter('file', currFile) + currRank;

                    //If the square is moveable, add it to the possible list of moves
                    if (squareIsMoveable(notation, board, color)){
                        moves.push(notation);

                        //If the square has an enemy piece on it, break - as it blocks movement
                        let i = getSquareIndex(notation);
                        if (board[i].piece){
                            break;
                        }
                    }

                    //If the square is blocked by an ally piece or the square doesn't exist - break
                    else break;

                }
            }

        break;

        //#endregion

        //#region King

        case 'king':

            //The king can move in 8 different directions
            for (let direction = 1; direction <= 8; direction++){

                let currFile = pieceFileNumber;
                let currRank = pieceRank;

                switch(direction){

                    //Up the files(left to right)
                    case 1:
                        currFile += 1;
                    break;

                    //Down the files(right to left)
                    case 2:
                        currFile -= 1;
                    break;

                    //Up the ranks(bottom to top)
                    case 3:
                        currRank += 1;
                    break;

                    //Down the ranks(top to bottom)
                    case 4:
                        currRank -= 1;
                    break;

                    //Up the files + up the ranks (diagonal topright)
                    case 5:
                        currFile += 1;
                        currRank += 1;
                    break;

                    //Up the files + down the ranks (diagonal bottomright)
                    case 6:
                        currFile += 1;
                        currRank -= 1;

                    break;

                    //Down the files + up the ranks (diagonal topleft)
                    case 7:
                        currFile -= 1;
                        currRank += 1;                    
                    break;

                    //Down the files + down the ranks (diagonal bottomleft)
                    case 8:
                        currFile -= 1;
                        currRank -= 1;
                    break;
                }

                //The square to check
                let notation = fileConverter('file', currFile) + currRank;

                //If the square is moveable, add it to the possible list of moves
                if (squareIsMoveable(notation, board, color)){
                    moves.push(notation);
                }
            }

        break;

        //#endregion
    }

    return moves;
}

//#endregion

//#region Helper methods

//Returns false only if an ally piece is on the square
function squareIsMoveable(notation, board, clientColor){

    if (notation == -1 || notation == undefined || notation.length != 2 || notation[1] <= 0 || notation[1] >= 9){
        return false;
    }

    let i = getSquareIndex(notation);

    if (i != - 1 && board[i].piece && board[i].piece.color == clientColor){
        return false;
    }

    return true;
}

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

    return -1;
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