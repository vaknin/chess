//#region Variables
//const client = io();
const timeRadios = [$('#radio_unlimited'), $('#radio_3min'), $('#radio_5min'), $('#radio_10min')];
let roomCreated = false;

//#endregion

//#region On clicks

$('#btn_createRoom').on('click', onCreateRoom);
$('#btn_cancel').on('click', cancelRoomCreation);
$('#btn_create').on('click', createRoom);
$('#cbox_hasPassword').on('change', e => {
    let on = e.target.checked;
    if (on){
        $('#input_roomPassword').prop('disabled', false);
    }

    else{
        $('#input_roomPassword').val('');
        $('#input_roomPassword').prop('disabled', true);
    }
    createRoom();
});

//#endregion

//#region Create a room

//'Create Room' on click [Creates a room or deletes a created one]
function onCreateRoom(){

    //Create a room
    if (roomCreated == false){
        //Disable the create room button
        $('#btn_createRoom').prop('disabled', 'disabled');

        //Display the div
        $('#create-room-container').css('display', 'flex');
    }

    //Delete the created room
    else{
        roomCreated = false;
        $('#btn_createRoom').text(`Create a Room`);
        //client.emit('deleteRoom');
    }
}

//Click the 'cancel' button while creating a room, simply return to the main menu
function cancelRoomCreation(){
    //Enable the create room button
    $('#btn_createRoom').prop('disabled', false);

    //Display the div
    $('#create-room-container').css('display', 'none');
}

//Finalize the room creation
function createRoom(){
    let roomName = $('#input_roomName').val();
    let password = $('#input_roomPassword').val();
    if (password.length == 0){
        password = undefined;
    }
    let time;

    for (let i = 0; i < 4; i++){
        if(timeRadios[i][0].checked){
            time = timeRadios[i][0].value;
        }
    }

    let room = {
        name: roomName,
        password: password,
        time: time
    };

    roomCreated = true;
    $('#btn_createRoom').text(`Delete '${roomName}'`);
    $('#btn_createRoom').prop('disabled', false);
    $('#create-room-container').css('display', 'none');
    client.emit('createRoom', room);
}

//#endregion


//#region Server communication



//#endregion
/*client.on('roomCreated', matchID => {
    window.location.href = window.location.href + matchID;
});*/