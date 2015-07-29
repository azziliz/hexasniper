"use strict";

//#region Utility Classes

function Player() {
    this.team = 0;
    this.uniqueID = 0.0;
    this.ordersGiven = false;
    this.feedbackGiven = false;
    this.toJSON = function () {
        return { team: this.team, uniqueID: this.uniqueID };
    };
}

function ArmyUnit() {
    this.position = null; // the WorldTile where the Unit is
    this.team = 0;
    this.hp = 0; // max HP = 12 ; 0 = dead
    this.attackOrder = null;
    this.moveOrder = null;
    this.toJSON = function () {
        // This function is automatically called by JSON.stringify
        return {
            pos: this.position,
            ao: this.attackOrder, mo: this.moveOrder,
            team: this.team, hp: this.hp
        };
    };
}
ArmyUnit.prototype.toString = function () { return "xx"; }
ArmyUnit.prototype.toLocaleString = function () { return "xx"; }
ArmyUnit.prototype.valueOf = function () { return "xx"; }

function WorldTile() {
    this.matrixX = 0; // in integer units (usually [0, 150])
    this.matrixY = 0;
    this.unit = null; // type is ArmyUnit
    this.neighbors = null; // all neighboring WorldTiles
    this.neighborNW = null;
    this.neighborNE = null;
    this.neighborW = null;
    this.neighborE = null;
    this.neighborSW = null;
    this.neighborSE = null;
    this.movingCount = 0;
    this.toJSON = function () {
        return { x: this.matrixX, y: this.matrixY };
    };
}

function DefaultGameParameters() {
    this.worldSizeX = 10; //156; // number of horizontal tiles. Has to be an even number
    this.worldSizeY = 10; //100; // number of vertical tiles. Has to be an even number
    this.playerCount = 2;
    this.initialUnitCount = 2; //600; // number of units per player at startup.
    this.unitRange = 5; // number of tiles around a unit, where the unit is able to shoot
    this.uniqueID = 0.0; // unique ID of the current game (hexadecimal string)
}

function GameEngine(){
    this.tiles = null; // array of all World Tiles
    this.units = null; // array of all Army Units
    this.players = null; // array of all Players
    this.ordersComputed = false;
    this.listeningToOrders = true; // TODO : remove this

    this.teamColorsBright = ["#f22", "#04f", "#4d0", "#a0f"];
    this.teamColorsGrayed = ["#777", "#777", "#777", "#777"];
}

var gameParameters = new DefaultGameParameters();
var engine = new GameEngine();

//#endregion


//#region Game functions

// Fills tile arrays inside the engine. Computes neighbors. Draws grid.
function initTiles() {
    //#region Creating tiles
    engine.tiles = new Array();
    for (var x = 0; x < gameParameters.worldSizeX; x++) {
        engine.tiles[x] = new Array();
        for (var y = 0; y < gameParameters.worldSizeY; y++) {
            engine.tiles[x][y] = new WorldTile();
        }
    }
    //#endregion
    //#region Calculating neighbors
    for (var x = 0; x < gameParameters.worldSizeX; x++) {
        for (var y = 0; y < gameParameters.worldSizeY; y++) {
            var tmp = engine.tiles[x][y];
            var mod = y % 2;
            tmp.matrixX = x;
            tmp.matrixY = y;
            tmp.neighbors = new Array();
            if (x != 0) {
                tmp.neighbors.push(engine.tiles[x - 1][y]);
                tmp.neighborW = engine.tiles[x - 1][y];
            }
            if (x != gameParameters.worldSizeX - 1) {
                tmp.neighbors.push(engine.tiles[x + 1][y]);
                tmp.neighborE = engine.tiles[x + 1][y];
            }
            if (mod == 0) {
                tmp.neighbors.push(engine.tiles[x][y + 1]);
                tmp.neighborSE = engine.tiles[x][y + 1];
                if (x != 0) {
                    tmp.neighbors.push(engine.tiles[x - 1][y + 1]);
                    tmp.neighborSW = engine.tiles[x - 1][y + 1];
                }
                if (y != 0) {
                    tmp.neighbors.push(engine.tiles[x][y - 1]);
                    tmp.neighborNE = engine.tiles[x][y - 1];
                    if (x != 0) {
                        tmp.neighbors.push(engine.tiles[x - 1][y - 1]);
                        tmp.neighborNW = engine.tiles[x - 1][y - 1];
                    }
                }
            }
            else {
                tmp.neighbors.push(engine.tiles[x][y - 1]);
                tmp.neighborNW = engine.tiles[x][y - 1];
                if (x != gameParameters.worldSizeX - 1) {
                    tmp.neighbors.push(engine.tiles[x + 1][y - 1]);
                    tmp.neighborNE = engine.tiles[x + 1][y - 1];
                }
                if (y != gameParameters.worldSizeY - 1) {
                    tmp.neighbors.push(engine.tiles[x][y + 1]);
                    tmp.neighborSW = engine.tiles[x][y + 1];
                    if (x != gameParameters.worldSizeX - 1) {
                        tmp.neighbors.push(engine.tiles[x + 1][y + 1]);
                        tmp.neighborSE = engine.tiles[x + 1][y + 1]
                    }
                }
            }

        }
    }
            //#endregion
}

// Resets players and units. Fills board with new units.
function buildInitialBoard() {
    initTiles();
    engine.players = new Array();
    engine.units = new Array();
    gameParameters.uniqueID = Math.random().toString(16);
    var i = gameParameters.initialUnitCount * gameParameters.playerCount;
    while (i > 0) {
        var coordX = Math.floor(gameParameters.worldSizeX * Math.random());
        var coordY = Math.floor(gameParameters.worldSizeY * Math.random());
        var occupiedTile = false;
        engine.units.forEach(
            function (unit) {
                if ((unit.position.matrixX === coordX) && (unit.position.matrixY === coordY)) {
                    occupiedTile = true;
                }
            });
        if (!occupiedTile) {
			var newUnit = new ArmyUnit();
            newUnit.hp = 12; 
            newUnit.team = i % gameParameters.playerCount;
            newUnit.position = engine.tiles[coordX][coordY];
            engine.tiles[coordX][coordY].unit = newUnit;
            engine.units.push(newUnit);
            i--;
        }
    }
}

// When all orders are received from clients, this function applies them to the board in sequence:
// 1. Attack Orders (all players at the same time)
// 2. Move Orders (all players at the same time)
function computeOrders() {
    // shooting
    engine.units.forEach(
        function (sniper) {
            if (sniper.attackOrder != null) {
                sniper.attackOrder.unit.hp -= 2;
                sniper.attackOrder = null;
            }
        });
    // bring out your dead
    var newUnitArray = new Array();
    engine.units.forEach(
        function (alive) {
            if (alive.hp <= 0) {
                alive.position.unit = null;
                alive.position = null;
                alive.attackOrder = null;
                alive.moveOrder = null;
                alive = null;
            }
            else newUnitArray.push(alive);
        });
    engine.units = newUnitArray;
    // initializing tiles (for move)
    engine.tiles.forEach(
        function (row) {
            row.forEach(
                function (tile) {
                    tile.movingCount = 0;
                });
        });
    var targetedTiles = new Array();
    // removing move orders if 2 (or more) units target the same tile
    engine.units.forEach(
        function (moving) {
            if (moving.moveOrder != null) {
                moving.moveOrder.movingCount++;
                if (targetedTiles.indexOf(moving.moveOrder) === -1) {
                    targetedTiles.push(moving.moveOrder);
                }
            }
        });
    targetedTiles.forEach(
        function (targetedTile) {
            if (targetedTile.movingCount > 1) {
                engine.units.forEach(
                    function (moving) {
                        if (moving.moveOrder === targetedTile) {
                            moving.moveOrder = null;
                        }
                    });
            }
        });
    // moving units
    engine.units.forEach(
        function (moving) {
            if (moving.moveOrder != null) {
                moving.position.unit = null;
                moving.position = engine.tiles[moving.moveOrder.matrixX][moving.moveOrder.matrixY];
                engine.tiles[moving.moveOrder.matrixX][moving.moveOrder.matrixY].unit = moving;
                moving.moveOrder = null;
            }
        });
}

function checkEndTurn(request, response, correctAuth) {
    var allOrdersReceived = true;
    engine.players.forEach(
        function (player) {
            if (!player.ordersGiven) allOrdersReceived = false;
        });
    if (allOrdersReceived) {
        log('all orders received');
        if (!engine.ordersComputed) {
            computeOrders();
            engine.ordersComputed = true;
        }
        compressAndSend(request, response, 'application/json', JSON.stringify(engine.units));
        correctAuth.feedbackGiven = true;
        var allFeedbackGiven = true;
        engine.players.forEach(
            function (player) {
                if (!player.feedbackGiven) allFeedbackGiven = false;
            });
        if (allFeedbackGiven) {
            //TODO listenToNewBoard();
            engine.ordersComputed = false;
            log('all feedback given');
            //engine.listeningToOrders = false;
            engine.players.forEach(
                function (player) {
                    player.ordersGiven = false;
                    player.feedbackGiven = false;
                });
        }
    }
    else {
        response.writeHead(200, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify({ standby: true }));
    }
}

//#endregion

//#region Server stuff

/// Tries to compress (gzip) the response, if the client browser allows it
function compressAndSend(request, response, contType, txt) {
    var acceptEncoding = request.headers['accept-encoding'];
    if (!acceptEncoding) {
        acceptEncoding = '';
    }
    if (acceptEncoding.match(/\bgzip\b/)) {
        response.writeHead(200, { 'Content-Type': contType, 'Content-Encoding': 'gzip' });
        response.end(require('zlib').gzipSync(txt));
    } else {
        response.writeHead(200, { 'Content-Type': contType });
        response.end(txt);
    }
}

/// Sends timestamped log to console
function log(txt) {
    console.log(''.concat((new Date()).toISOString(), ' - ', txt));
}

//#endregion

require('http').createServer(function (request, response) {
    //if (request.url !== '/feedback') console.log("".concat((new Date()).toISOString(), " - ", request.url));
    if (request.url === '/favicon.ico') {
        response.writeHead(404);
        response.end();
    }
    else if (request.url === '/') {
        compressAndSend(request, response, 'text/html', require('fs').readFileSync('client.html'));
    }
    else {
        var buffer = "";
        request.on('data', function (chunk) {
            buffer = buffer.concat(chunk.toString());
            if (buffer.length > 1e6) request.connection.destroy();
        });
        request.on('end', function () {
            if (request.url === '/getEngineConfig') {
                response.writeHead(200, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify(gameParameters, ["worldSizeX", "worldSizeY", "unitRange"]));
            }
            else if (request.url === '/getBoard') {
                if (engine.units === null) buildInitialBoard();
                compressAndSend(request, response, 'application/json', JSON.stringify(engine.units));
            }
            else if (request.url === '/initBoard') {
                buildInitialBoard();
                response.writeHead(200, { 'Content-Type': 'text/plain' });
                response.end("OK");
            }
            else if (request.url === '/newBoard') {
                //#region new board
                //TODO: delete this when rules are implemented on server side
                if (!engine.listeningToOrders) {
                    engine.players.forEach(
                        function (player) {
                            player.ordersGiven = false;
                            player.feedbackGiven = false;
                        });
                    engine.units = new Array();
                    var postData = JSON.parse(buffer);
                    postData.board.forEach(
                        function (unit) {
                            var newUnit = new ArmyUnit();
                            newUnit.hp = unit.hp;
                            newUnit.team = unit.team;
                            newUnit.position = engine.tiles[unit.pos.x][unit.pos.y];
                            engine.tiles[unit.pos.x][unit.pos.y].unit = newUnit;
                            engine.units.push(newUnit);
                        });
                    //console.log(JSON.stringify(engine.units));
                    engine.listeningToOrders = true;
                }
                response.writeHead(200, { 'Content-Type': 'text/plain' });
                response.end("OK");
                //#endregion
            }
            else if (request.url === '/login') {
                //#region login         
                if (engine.players.length < gameParameters.playerCount) {
                    var player = new Player();
                    var currentPlayersIds = new Array();
                    engine.players.forEach(
                        function (currentPlayer) {
                            currentPlayersIds.push(currentPlayer.team);
                        });
                    var i = 0;
                    while (currentPlayersIds.indexOf(i) >= 0) i++;
                    player.team = i; 
                    player.uniqueID = Math.random().toString(16);
                    engine.players.push(player);
                    log(''.concat('login ', JSON.stringify(player)));
                    compressAndSend(request, response, 'application/json',
                        JSON.stringify({ game: { uniqueID: gameParameters.uniqueID }, player: player }));
                }
                else {
                    response.writeHead(200, { 'Content-Type': 'application/json' });
                    response.end(JSON.stringify({ error: 'Game is full.' }));
                }
                //#endregion
            }
            else if (request.url === '/logoff') {
                //#region logoff
                var postData = JSON.parse(buffer);
                //console.log("postData = ".concat(buffer));
                //console.log("gameParameters = ".concat(JSON.stringify(gameParameters)));
                if ((postData === null) ||
                    (postData.authentication === null) ||
                    (postData.authentication.game === null) ||
                    (postData.authentication.game.uniqueID !== gameParameters.uniqueID)) {
                    response.writeHead(200, { 'Content-Type': 'application/json' });
                    response.end(JSON.stringify({ error: 'This game is not running.' }));
                }
                else {
                    var playerTeam = postData.authentication.player.team;
                    var correctAuth = null;
                    engine.players.forEach(
                        function (currentPlayer) {
                            if ((currentPlayer.team === postData.authentication.player.team) && (currentPlayer.uniqueID === postData.authentication.player.uniqueID)) {
                                correctAuth = currentPlayer;
                            }
                        });
                    if (correctAuth === null) {
                        response.writeHead(200, { 'Content-Type': 'application/json' });
                        response.end(JSON.stringify({ error: 'Wrong authentication.' }));
                    }
                    else {
                        log(''.concat('logoff ', JSON.stringify(correctAuth)));
                        var newPlayers = new Array();
                        engine.players.forEach(
                            function (player) {
                                if (player.uniqueID !== correctAuth.uniqueID) {
                                    newPlayers.push(player);
                                }
                            });
                        engine.players = newPlayers;
                    }
                }
                response.writeHead(200, { 'Content-Type': 'text/plain' });
                response.end("OK");
                //#endregion
            }
            else if (request.url === '/orders') {
                //#region orders
                // TODO : handle "server not ready yet (listeningToOrders)
                //console.log("postData = ".concat(buffer));
                //console.log("gameParameters = ".concat(JSON.stringify(gameParameters)));
                var postData = JSON.parse(buffer);
                if ((postData === null) ||
                    (postData.authentication === null) ||
                    (postData.authentication.game === null) ||
                    (postData.authentication.game.uniqueID !== gameParameters.uniqueID)) {
                    response.writeHead(200, { 'Content-Type': 'application/json' });
                    response.end(JSON.stringify({ error: 'This game is not running.' }));
                }
                else {
                    var playerTeam = postData.authentication.player.team;
                    var correctAuth = null;
                    engine.players.forEach(
                        function (currentPlayer) {
                            if ((currentPlayer.team === postData.authentication.player.team) && (currentPlayer.uniqueID === postData.authentication.player.uniqueID))
                                correctAuth = currentPlayer;
                        });
                    if (correctAuth === null) {
                        response.writeHead(200, { 'Content-Type': 'application/json' });
                        response.end(JSON.stringify({ error: 'Wrong authentication.' }));
                    }
                    else {
                        if (correctAuth.ordersGiven) {
                            response.writeHead(200, { 'Content-Type': 'application/json' });
                            response.end(JSON.stringify({ error: 'Orders already given.' }));
                        }
                        else {
                            postData.orders.forEach(
                                function (unit) {
                                    var unitValidated = false;
                                    engine.units.forEach(
                                        function (candidate) {
                                            if ((candidate.position.matrixX === unit.pos.x)
                                                && (candidate.position.matrixY === unit.pos.y)
                                                && (candidate.team === unit.team)
                                                && (candidate.hp === unit.hp)
                                                && (candidate.team === playerTeam)
                                                && ((unit.ao === null) || (unit.mo === null))
                                                ) {
                                                if (unit.ao !== null) candidate.attackOrder = engine.tiles[unit.ao.x][unit.ao.y];
                                                if (unit.mo !== null) candidate.moveOrder = engine.tiles[unit.mo.x][unit.mo.y];
                                                unitValidated = true;
                                            }
                                        });
                                    if (!unitValidated) {
                                        response.writeHead(200, { 'Content-Type': 'application/json' });
                                        response.end(JSON.stringify({ error: 'Order given to a wrong unit.' }));
                                    }
                                });
                            correctAuth.ordersGiven = true;
                            checkEndTurn(request, response, correctAuth);
                        }
                    }
                }
                //#endregion
            }
            else if (request.url === '/feedback') {
                //#region Performance tests
                var postData = JSON.parse(buffer);
                if ((postData === null) ||
                    (postData.authentication === null) ||
                    (postData.authentication.game === null) ||
                    (postData.authentication.game.uniqueID !== gameParameters.uniqueID)) {
                    response.writeHead(200, { 'Content-Type': 'application/json' });
                    response.end(JSON.stringify({ error: 'This game is not running.' }));
                }
                else {
                    var playerTeam = postData.authentication.player.team;
                    var correctAuth = null;
                    engine.players.forEach(
                        function (currentPlayer) {
                            if ((currentPlayer.team === postData.authentication.player.team) && (currentPlayer.uniqueID === postData.authentication.player.uniqueID))
                                correctAuth = currentPlayer;
                        });
                    if (correctAuth === null) {
                        response.writeHead(200, { 'Content-Type': 'application/json' });
                        response.end(JSON.stringify({ error: 'Wrong authentication.' }));
                    }
                    else {
                        checkEndTurn(request, response, correctAuth);
                    }
                }
                //#endregion
            }
            else {
                response.writeHead(404);
                response.end();
            }
        });
    }
}).listen(15881);

console.log('Server running at http://127.0.0.1:15881/');

