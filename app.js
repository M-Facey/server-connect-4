const express = require('express');
const app = express();
const server = require('http').Server(app);
const shortid = require('shortid');

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/client/index.html');
});

app.use('/client', express.static(__dirname + '/client'));

server.listen(8080,() => {
    console.log('Server is running on port 8080');
});


const PLAYERS = [];
var ROWS;
var COLS;
var GAME_MODE = '';
var plays = ['red', 'black'];
var currentPlay = 'red';
var time_elapsed = 0;
var count = 0;
var board = [
    ['-','-','-','-','-','-'],
    ['-','-','-','-','-','-'],
    ['-','-','-','-','-','-'],
    ['-','-','-','-','-','-'],
    ['-','-','-','-','-','-'],
    ['-','-','-','-','-','-'],
];

const io = require('socket.io')(server, {});

io.sockets.on('connection', (socket) => {
    socket.id = shortid.generate();
    PLAYERS[socket.id] = socket;
    PLAYERS[socket.id].play = plays[count];
    count++;
    if(GAME_MODE === 'two-player') {
        if(count == 2) {
            for(var i in PLAYERS) {
                var socket = PLAYERS[i];
                socket.emit('start game', {
                    row: 6,
                    col: 7,
                    player: socket.play,
                    current: currentPlay
                });
            }
            ROWS = 6; 
            COLS = 7;
            startTimer();
        }
    } else if(GAME_MODE === 'four-player') {
        if(count == 4) {
            for(var i in PLAYERS) {
                var socket = PLAYERS[i];
                socket.emit('start game', {
                    row: 10,
                    col: 11,
                    player: socket.play,
                    current: currentPlay,
                    mode: GAME_MODE
                });
            }
            ROWS = 10; 
            COLS = 11;
            startTimer();
        }
    }

    socket.on('game mode', (data) => {
        GAME_MODE = data;
        // do something here
        if(GAME_MODE === 'one-player') {
            console.log('start hame');
            socket.emit('start game', {
                row: 6, 
                col: 7, 
                player: 'red',
                current: currentPlay
            });
            ROWS = 6; 
            COLS = 7;
            startTimer();
        } else {
            board = [
                ['-','-','-','-','-','-','-','-','-','-','-'],
                ['-','-','-','-','-','-','-','-','-','-','-'],
                ['-','-','-','-','-','-','-','-','-','-','-'],
                ['-','-','-','-','-','-','-','-','-','-','-'],
                ['-','-','-','-','-','-','-','-','-','-','-'],
                ['-','-','-','-','-','-','-','-','-','-','-'],
                ['-','-','-','-','-','-','-','-','-','-','-'],
                ['-','-','-','-','-','-','-','-','-','-','-'],
                ['-','-','-','-','-','-','-','-','-','-','-'],
                ['-','-','-','-','-','-','-','-','-','-','-'],
            ];
            plays = ['red', 'black', 'yellow', 'green'];
        }
    });

    socket.on('add player', (data) => {
        var player = socket.play;
        if(GAME_MODE === 'one-player') {
            player = currentPlay;
        }

        if(player === currentPlay) {
            const coords = findLastEmptyCell(
                data.col, 
                currentPlay
                );

            game_event('update', {coords, play: board[coords.i][coords.j]});
            if(verticalCheck() || horizontalCheck() || diagonalCheck1() || diagonalCheck2()){
               game_event('game over', {game_over: true, winner: currentPlay});
               stopTimer();
            } else {
                alternatePlayer();
                game_event('current player', {current: currentPlay});
            }
        }
    });

    socket.on('reset', () => {
        for(let r = 0; r < 6; r++) {
            for(let c = 0; c < 7; c++) {
                board[r][c] = '-';     
            }
        }
        game_event('reset game', {status: true, plays });
        time_elapsed = 0;
        stopTimer();
        startTimer();
    });
});

function game_event(event, args){
    for(var i in PLAYERS) {
        var socket = PLAYERS[i];
        socket.emit(event, args);
    }
}

function tick() {
    time_elapsed++;
    var remain = time_elapsed;
    var mins = Math.floor(remain / 60);
    remain -= mins * 60;
    var secs = remain;

    mins = (mins < 10) ? `0${mins}` : mins;
    secs = (secs < 10) ? `0${secs}` : secs; 
    game_event('update time', {mins, secs});
}

function startTimer() {
    timer = setInterval(tick, 1000);
}

function stopTimer() {
    clearInterval(timer);
}

function findLastEmptyCell(col, play) {
    for(let i = ROWS - 1; i >= 0; i--) 
        if(board[i][Number(col)] == '-') {
            var j = Number(col);
            board[i][j] = play;
            console.log(i + ' ' + j);
            return {i, j};
        }
    return null;
}

function alternatePlayer() {
    if(GAME_MODE !== 'four-player'){
        currentPlay = (currentPlay === 'red') ? 'black' : 'red';
    } else {
        var i = plays.indexOf(currentPlay);

        if (i < 3 && currentPlay === plays[i]) {
            currentPlay = plays[i + 1];
        } else {
            currentPlay = plays[0];
        }
    }
}

function colorMatchCheck(one, two, three, four) {
    return(one === two && one === three && one == four && one !== '-');
}

function horizontalCheck() {
    for(let row = 0; row < ROWS - 1; row++) {
        for(let col = 0; col < COLS - 3; col++) {
            if(colorMatchCheck(
                board[row][col],
                board[row][col + 1],
                board[row][col + 2],
                board[row][col + 3]
            )) {
                return true;
            }
        }
    }
}

function verticalCheck() {
    for(let col = 0; col < COLS - 1; col++) {
        for(let row = 0; row < ROWS - 3; row++) {
            if(colorMatchCheck(
                board[row][col],
                board[row + 1][col],
                board[row + 2][col],
                board[row + 3][col]
            )) {
                return true;
            }
        }
    }
}

function diagonalCheck1() {
    for(let col = 0; col < COLS - 3; col++) {
        for(let row = 0; row < ROWS - 3; row++) {
            if(colorMatchCheck(
                board[row][col],
                board[row + 1][col + 1],
                board[row + 2][col + 2],
                board[row + 3][col + 3]
            )) {
                return true;
            }
        }
    }
}

function diagonalCheck2() {
    for(let col = 0; col < COLS - 3; col++) {
        for(let row = ROWS - 1; row > 3; row--) {
            if(colorMatchCheck(
                board[row][col],
                board[row - 1][col + 1],
                board[row - 2][col + 2],
                board[row - 3][col + 3]
            )) {
                return true;
            }
        }
    }
}