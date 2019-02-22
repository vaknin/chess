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
        this.moved = false;
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

const captureSound = new Audio('../sounds/Capture.mp3');
const moveSound = new Audio('../sounds/Move.mp3');

//Lets
let black, turn, selectedPiece, legalMoves;

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
            $(td).append(`<img class= '${pieceColor}' src= \'../images/pieces/${pieceColor}_${pieceName}.png\'>`);
        }
    }

    //Add pointer cursor on piece hover for white
    if (!black){
        $('.white').toggleClass('clickable', true);
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

    // Client is white
    if (client.id != blackID){
        black = false;
        turn = true;
        document.title = 'Your turn!';
    }

    // Client is black
    else{
        black = true;
        document.title = 'Opponent\'s turn..';
    }
});

//Receive an array of possible moves:
client.on('moves', moves => {

    //Add the class 'moveable' to the legal squares
    for(let i = 0; i < moves.length; i++){
        $(`#${moves[i]}`).toggleClass('moveable', true);
    }

    legalMoves = moves;
});

//Handle turn switching
client.on('turn', (move, checkedKing) => {

    //#region Variables
    let disableDefaultSound = false;
    let color = black ? 'black' : 'white';
    let img = $($(`#${move.from}`)[0].children[0]);
    let underscoreIndex = img[0].src.indexOf('_');
    let periodIndex = img[0].src.lastIndexOf('.');
    let pieceName = img[0].src.substring(underscoreIndex + 1, periodIndex);
    let destination = $($(`#${move.to}`)[0]);
    let squareToCheck = $(`#${move.to}`)[0];
    let moveToEmptySquare = squareToCheck.children.length == 0;

    //#endregion

    //#region Turn switch effects(document title, etc.)

    //End turn
    if (turn){

        //Change document's title
        document.title = 'Opponent\'s turn..';

        //Disable pointer cursor on piece hover
        $('.moveable').toggleClass('moveable', false);
        $('.clickable').toggleClass('clickable', false);

        //Toggle off selection effects
        selectPiece(selectedPiece, false);
    }

    //Start turn
    else{

        //Change document's title
        document.title = 'Your turn!';

        //Set pieces pointer cursor for his own pieces on hover
        $(`.${color}`).toggleClass('clickable', true);
    }

    //#endregion

    //#region Special moves(en passant, pawn promotion, castle, etc)

    switch(pieceName){

        //Pawns
        case 'pawn':
            let oldFile = move.from.substring(0, 1);
            let newFile = move.to.substring(0, 1);

            let oldRank = move.from.substring(1, 2);
            let newRank = move.to.substring(1, 2);


            //En passant
            if (oldFile != newFile && moveToEmptySquare){
                
                $(`#${newFile + oldRank}`)[0].children[0].remove();

                //Play piece capture sound
                captureSound.play();
                disableDefaultSound = true;
            }

            //Pawn promotion
            else if(newRank == 1 || newRank == 8){
                
                let queenColor = color;

                //Get the proper promotion color
                if (!turn){
                    queenColor = black ? 'white' : 'black';
                }
                img[0].src = `../images/pieces/${queenColor}_queen.png`;
            }
        break;
    }

    //#endregion
    
    //#region On capture / On move (images and sounds)

    //On piece capture
    if (!moveToEmptySquare){

        //Remove it's image
        squareToCheck.children[0].remove();

        //Play capture sound
        if (!disableDefaultSound){
            captureSound.play();
        }
    }

    //On piece movement
    else if (!disableDefaultSound){

        //Play piece movement sound
        moveSound.play();
    }

    //Update the piece image location
    img.appendTo(destination);

    //#endregion
    
    //#region Checks

    //A check was made
    if (checkedKing){

        //Toggle the checked class on for the king's square
        let king = $(`#${checkedKing}`);
        
        king.toggleClass('checked', true);
    }

    //#endregion
    
    turn = !turn;
});

client.on('gameOver', winner => {

    alert(`${winner} wins!`);
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

        //If the square can legally be moved to
        if ($(e.target).hasClass('moveable')){

            //The square's notation
            let notation = e.target.id;

            //Update the server
            client.emit('move', notation);
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

        //Client's piece
        if (pieceColor == 'black' && black || pieceColor == 'white' && !black){

            //Disselect the currently selected piece, and select the new one
            selectPiece(squareNotation, true);
        }

        //Opponent's piece
        else{

            //A bool that stores the information whether the square is clickable
            let moveableSquare = $(e.target.parentNode).hasClass('moveable');
            
            //If the square is moveable and there's a piece currently selected - capture it
            if (selectedPiece && moveableSquare){

                //The square's notation
                let notation = e.target.parentNode.id;

                //Update the server
                client.emit('move', notation);
            }
        }
    });
}

//Selects a piece - toggle image background and emit to server asking for legal moves
function selectPiece(notation, select){

    //#region Visual effects

    //Variables for easier reference
    let td = $(`#${notation}`);
    let lightSquared = td.hasClass('lightSquare') ? true : false;

    //Select a piece
    if (select){

        //If trying to select a piece that is already selected - unselect it
        if (selectedPiece == notation){
            selectPiece(selectedPiece, false);
            return;
        }
    
        //If there's already a selected piece - unselect the already selected piece before selecting the new one
        else if (selectedPiece != undefined){
            selectPiece(selectedPiece, false);
        }

        //It is a light squared piece
        if(lightSquared){
            let darkerLight = 'rgb(216, 202, 162)';
            td.css('background', darkerLight);
        }

        //It is a dark squared piece
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

        //Disable moveable squares
        for(let i = 0; i < legalMoves.length; i++){
            $(`#${legalMoves[i]}`).toggleClass('moveable', false);
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
