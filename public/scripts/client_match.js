//#region Classes

//Square
class Square{
    constructor(notation, td){
        this.notation = notation;
        this.td = td;
    }
}

//Position
class Position{
    constructor(file, rank){
        this.file = file;
        this.rank = rank;
        this.notation = file+rank;
    }
}

//Piece
class Piece{
    constructor(color, type, position){
        this.color = color;
        this.type = type;
        this.position = position;
    }
}

//Chess notation, i.e. "H3" or "A7"
class Notation{
    constructor(file, rank){
        this.file = file;
        this.rank = rank;
        this.name = file + rank;
    }
}

//#endregion

//#region Variables

//Consts
const client = io();
const board = [];
const pieces = [];

//Lets
let black, turn, selectedPiece;

//Main method
initializeBoard();

//#endregion

//#region Initialize Board

//Master function to initialize the board:
async function initializeBoard(){
    joinRoom();
    await colorDecided();
    buildBoard();
    addPieces();
    onSquare();
    if (black)
        flipBoard();
}

//Connects the client to the server via socket.io
function joinRoom(){

    document.title = `${document.location.href.substring(document.location.href.length - 6, document.location.href.length)}`;
    let matchID = document.title.substring(document.title.indexOf('#') + 1, document.title.length);

    //Join the socket.io room
    client.emit('join', matchID);
}

//Builds the board's files and ranks
function buildBoard(){
    
    //Helper method to determine square's background color
    function assignColor(r, f, td){

        let color, colorClass;

        //Assign square color
        if (r % 2 == 0){
            if (f % 2 == 0){
                color = 'rgb(253,234,182)';
                colorClass = 'lightSquare';
            }
            else{
                color = 'rgb(198, 161, 118)';
                colorClass = 'darkSquare';
            }
        }

        else{
            if (f % 2 == 0){
                color = 'rgb(198, 161, 118)';
                colorClass = 'darkSquare';
            }
            else{
                color = 'rgb(253,234,182)';
                colorClass = 'lightSquare';
            }
        }
        //Change the square's color based on modulus
        $(td).css('background', color);
        $(td).toggleClass(colorClass, true);
    }

    //Helper function to return the chess notation of a table square
    function getNotation(r, f){
        switch(r){
            case 0:
                r = 8;
            break;
            case 1:
                r = 7;
            break;
            case 2:
                r = 6;
            break;
            case 3:
                r = 5;
            break;
            case 4:
                r = 4;
            break;
            case 5:
                r = 3;
            break;
            case 6:
                r = 2;
            break;
            case 7:
                r = 1;
            break;
        }

        switch(f){
            case 0:
                f = 'A';
            break;
            case 1:
                f = 'B';
            break;
            case 2:
                f = 'C';
            break;
            case 3:
                f = 'D';
            break;
            case 4:
                f = 'E';
            break;
            case 5:
                f = 'F';
            break;
            case 6:
                f = 'G';
            break;
            case 7:
                f = 'H';
            break;
        }

        return new Notation(f, r);
    }

    //Build an 8x8 grid, each square will have: position('H3'), and might have a piece('black', 'pawn'):
    //Add 8 rows to the table:
    for (let r = 0; r < 8; r++){

        $('#board').append('<tr></tr>');
        let row = $('#board')[0].children[r];
        
        //Add 8 squares to each row
        for (let f = 0; f < 8; f++){
            let notation = getNotation(r, f);
            $(row).append(`<td id= \'${notation.name}\' ></td>`);
            let td = row.children[f];
            assignColor(r, f, td);
            board.push(new Square(notation, td));
        }
    }
}

//Add the pieces and their images to the board
function addPieces(){

    //Loop through all squares in the board
    for (let i = 0; i < board.length; i++){

        let onRank1 = board[i].notation.rank == 1;
        let onRank2 = board[i].notation.rank == 2;
        let onRank7 = board[i].notation.rank == 7;
        let onRank8 = board[i].notation.rank == 8;

        //Ranks 1,2,7 and 8 and the only ranks with pieces on them
        if (onRank1 || onRank2 || onRank7 || onRank8){
            
            //Variables for easier reference
            let file = board[i].notation.file;
            let td = board[i].td;
            let pieceName, pieceColor;

            //White pieces
            if (onRank1 || onRank2){
                pieceColor = 'white';
            }

            //Black pieces
            else{
                pieceColor = 'black';
            }

            //Pawns
            if (onRank2 || onRank7){
                pieceName = 'pawn';
            }

            //Other pieces
            else if (onRank1 || onRank8){

                //Rooks
                if (file == 'H' || file == 'A'){
                    pieceName = 'rook';
                }

                //Knights
                else if (file == 'B' || file == 'G'){
                    pieceName = 'knight';
                }

                //Bishops
                else if (file == 'F' || file == 'C'){
                    pieceName = 'bishop';
                }

                //Queens
                else if (file == 'D'){
                    pieceName = 'queen';
                }

                //Kings
                else pieceName = 'king';
            }
            $(td).append(`<img class= \'${pieceColor}\' src= \'../images/pieces/${pieceColor}_${pieceName}.png\'>`);
        }
    }
}

//Flip the board 180 degrees for black
function flipBoard(){
    $('#board').toggleClass('rotated');
    $('img').toggleClass('rotated');
}

//#endregion

//#region Helper methods

async function sleep(ms){
    return new Promise(resolve => setTimeout(resolve, ms));
}

//Wait for the server to determine sides
async function colorDecided(){
    return new Promise(async function(resolve){
        while(black == undefined){
            await sleep(10);
        }
        resolve();
    });
}

//#endregion

//#region Handle server emissions

//Assign sides:
client.on('assignSides', blackID => {

    //Client is not black and it's his turn to play:
    if (client.id != blackID){
        black = false;
        turn = true;
    }

    //Client is black:
    else{
        black = true;
    }
});

//#endregion

//#region Square onClick & Hover

//After creating the board, call this function to add all the onClick listeners to them
function onSquare(){

    //Click on a square
    $('td').on('click', (e) => {

        //If it's not your turn, return
        if (!turn){
            return;
        }

    });

    //Click on a piece
    $('img').on('click', e => {

        //If it's not your turn - return
        if (!turn){
            return;
        }

        let squareNotation = e.target.parentNode.id;
        let pieceColor = $(e.target).hasClass('black') ? 'black' : 'white';
        let td = $(e.target.parentNode);

        //Client's piece - select the piece
        if (pieceColor == 'black' && black || pieceColor == 'white' && !black){
            selectPiece(squareNotation, true);
        }

        //Opponent's piece
        else{

            //Capture a piece
            if (selectedPiece /* && pieceCapturable */){

            }
        }
    });
}

//Selects a piece - toggle image background and emit to server asking for legal moves
function selectPiece(notation, select){

    //#region Visual effects

    if (select && selectedPiece == notation){
        selectPiece(selectedPiece, false);
        return;
    }

    //If there's already a selected piece - unselect it
    else if (select && selectedPiece != undefined){
        selectPiece(selectedPiece, false);
    }

    let td = $(`#${notation}`);
    let lightSquared = td.hasClass('lightSquare') ? true : false;

    //Select a piece
    if (select){

        //It is light squared
        if(lightSquared){
            let darkerLight = 'rgb(216, 202, 162)';
            td.css('background', darkerLight);
        }

        //It is dark squared
        else{
            let lighterDark = 'rgb(229, 185, 135)';
            td.css('background', lighterDark);
        }

        selectedPiece = notation;
    }

    //Unselect a piece
    else{

        //It is light squared
        if(lightSquared){
            let lightColor = 'rgb(253,234,182)';
            td.css('background', lightColor);
        }

        //It is dark squared
        else{
            let darkColor = 'rgb(198, 161, 118)';
            td.css('background', darkColor);
        }

        selectedPiece = undefined;
    }
    //#endregion

    //#region Emission

    //Ask the server for legal moves

    client.emit('select', notation);

    //#endregion

}


//#endregion
