const client = io();
const btn_findMatch = $('.button_findMatch');

function findMatch(){
    client.emit('searching');
    btn_findMatch.text('Searching..');
    btn_findMatch.attr('disabled', 'disabled');
}

client.on('roomCreated', matchID => {
    window.location.href = window.location.href + matchID;
});