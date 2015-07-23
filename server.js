"use strict";

//#region Utility Classes

function Player() {
    this.team = 0;
    this.uniqueID = 0.0;
    this.ordersGiven = false;
    this.feedbackGiven = false;
}

function ArmyUnit() {
    this.position = null; // type is WorldTile
    this.team = 0;
    this.hp = 0; // max HP = 12 ; 0 = dead
    this.range = null; // list of all the World Tiles that are within range
    this.attackOrder = null;
    this.moveOrder = null;
    this.toJSON = function () {
        // This function is automatically called by JSON.stringify
        // We only stringify when we send unit orders to server
        return {
            pos: this.position,
            ao: this.attackOrder, mo: this.moveOrder,
            team: this.team, hp: this.hp
        };
    };
}

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

function GameParameters() {
    this.worldSizeX = 10; //156; // number of horizontal tiles. Has to be an even number
    this.worldSizeY = 10; //100; // number of vertical tiles. Has to be an even number
    this.playerCount = 2;
    this.initialUnitCount = 2; //600; // number of units per player at startup.
    this.unitRange = 5; //number of tiles around a unit, where the unit is able to shoot
    this.units = null;
    this.players = null;
    this.uniqueID = 0.0;
    this.listeningToOrders = true;
}
var currentGameParameters = new GameParameters();

//#endregion


function ArmyUnit_() {
    this.posX = 0;
    this.posY = 0;
    this.team = 0;
    this.hp = 0;
    this.ao = null;
    this.mo = null;
}

function buildInitialBoard() {
    currentGameParameters.players = new Array();
    currentGameParameters.units = new Array();
    currentGameParameters.uniqueID = Math.random().toString(16);
    var i = currentGameParameters.initialUnitCount * currentGameParameters.playerCount;
    while (i > 0) {
        var coordX = Math.floor(currentGameParameters.worldSizeX * Math.random());
        var coordY = Math.floor(currentGameParameters.worldSizeY * Math.random());
        var occupiedTile = false;
        currentGameParameters.units.forEach(
            function (unit) {
                if ((unit.posX == coordX) && (unit.posY == coordY)) {
                    occupiedTile = true;
                }
            });
        if (!occupiedTile) {
            var newUnit = new ArmyUnit_();
            newUnit.hp = 12; //Math.floor(1 + 12 * Math.random());
            newUnit.team = i % currentGameParameters.playerCount;
            newUnit.posX = coordX;
            newUnit.posY = coordY;
            currentGameParameters.units.push(newUnit);
            i--;
        }
    }
}

function checkEndTurn(request, response, correctAuth) {
    var allOrdersGiven = true;
    currentGameParameters.players.forEach(
        function (player) {
            if (!player.ordersGiven) allOrdersGiven = false;
        });
    if (allOrdersGiven) {
        compressAndSend(request, response, 'application/json', JSON.stringify(currentGameParameters.units));
        correctAuth.feedbackGiven = true;
        var allFeedbackGiven = true;
        currentGameParameters.players.forEach(
            function (player) {
                if (!player.feedbackGiven) allFeedbackGiven = false;
            });
        if (allFeedbackGiven) {
            //TODO listenToNewBoard();
            console.log("all feedback given");
            currentGameParameters.listeningToOrders = false;
        }
    }
    else {
        response.writeHead(200, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify({ standby: true }));
    }
}

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

require('http').createServer(function (request, response) {
    if (request.url != '/feedback') console.log("".concat((new Date()).toISOString(), " - ", request.url));
    if (request.url == '/favicon.ico') {
        response.writeHead(404);
        response.end();
    }
    else if (request.url == '/') {
        compressAndSend(request, response, 'text/html', require('fs').readFileSync('client.html'));
    }
    else {
        var buffer = "";
        request.on('data', function (chunk) {
            buffer = buffer.concat(chunk.toString());
            if (buffer.length > 1e6) request.connection.destroy();
        });
        request.on('end', function () {
            if (request.url == '/getEngineConfig') {
                response.writeHead(200, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify(currentGameParameters, ["worldSizeX", "worldSizeY", "unitRange"]));
            }
            else if (request.url == '/getBoard') {
                compressAndSend(request, response, 'application/json', JSON.stringify(currentGameParameters.units));
            }
            else if (request.url == '/initBoard') {
                buildInitialBoard();
                response.writeHead(200, { 'Content-Type': 'text/plain' });
                response.end("OK");
            }
            else if (request.url == '/newBoard') {
                //#region new board
                //TODO: check consistency between new boards
                if (!currentGameParameters.listeningToOrders) {
                    currentGameParameters.players.forEach(
                        function (player) {
                            player.ordersGiven = false;
                            player.feedbackGiven = false;
                        });
                    currentGameParameters.units = new Array();
                    var postData = JSON.parse(buffer);
                    postData.board.forEach(
                        function (unit) {
                            var newUnit = new ArmyUnit_();
                            newUnit.hp = unit.hp;
                            newUnit.team = unit.team;
                            newUnit.posX = unit.pos.x;
                            newUnit.posY = unit.pos.y;
                            currentGameParameters.units.push(newUnit);
                        });
                    //console.log(JSON.stringify(currentGameParameters.units));
                    currentGameParameters.listeningToOrders = true;
                }
                response.writeHead(200, { 'Content-Type': 'text/plain' });
                response.end("OK");
                //#endregion
            }
            else if (request.url == '/login') {
                //#region login
                if (currentGameParameters.players.length < currentGameParameters.playerCount) {
                    var player = new Player();
                    var currentPlayersIds = new Array();
                    currentGameParameters.players.forEach(
                        function (currentPlayer) {
                            currentPlayersIds.push(currentPlayer.team);
                        });
                    var i = 0;
                    while (currentPlayersIds.indexOf(i) >= 0) i++;
                    player.team = i; 
                    player.uniqueID = Math.random().toString(16);
                    currentGameParameters.players.push(player);
                    compressAndSend(request, response, 'application/json',
                        JSON.stringify({ game: { uniqueID: currentGameParameters.uniqueID }, player: player }));
                }
                else {
                    response.writeHead(200, { 'Content-Type': 'application/json' });
                    response.end(JSON.stringify({ error: 'Game is full.' }));
                }
                //#endregion
            }
            else if (request.url == '/logoff') {
                //#region logoff
                var postData = JSON.parse(buffer);
                //console.log("postData = ".concat(buffer));
                //console.log("currentGameParameters = ".concat(JSON.stringify(currentGameParameters)));
                if ((postData == null) ||
                    (postData.authentication == null) ||
                    (postData.authentication.game == null) ||
                    (postData.authentication.game.uniqueID != currentGameParameters.uniqueID)) {
                    response.writeHead(200, { 'Content-Type': 'application/json' });
                    response.end(JSON.stringify({ error: 'This game is not running.' }));
                }
                else {
                    var playerTeam = postData.authentication.player.team;
                    var correctAuth = null;
                    currentGameParameters.players.forEach(
                        function (currentPlayer) {
                            if ((currentPlayer.team == postData.authentication.player.team) && (currentPlayer.uniqueID == postData.authentication.player.uniqueID)) {
                                correctAuth = currentPlayer;
                            }
                        });
                    if (correctAuth == null) {
                        response.writeHead(200, { 'Content-Type': 'application/json' });
                        response.end(JSON.stringify({ error: 'Wrong authentication.' }));
                    }
                    else {
                        var newPlayers = new Array();
                        currentGameParameters.players.forEach(
                            function (player) {
                                if (player.uniqueID != correctAuth.uniqueID) {
                                    newPlayers.push(player);
                                }
                            });
                        currentGameParameters.players = newPlayers;
                    }
                }
                response.writeHead(200, { 'Content-Type': 'text/plain' });
                response.end("OK");
                //#endregion
            }
            else if (request.url == '/orders') {
                //#region orders
                // TODO : handle "server not ready yet (listeningToOrders)
                console.log("postData = ".concat(buffer));
                console.log("currentGameParameters = ".concat(JSON.stringify(currentGameParameters)));
                var postData = JSON.parse(buffer);
                if ((postData == null) ||
                    (postData.authentication == null) ||
                    (postData.authentication.game == null) ||
                    (postData.authentication.game.uniqueID != currentGameParameters.uniqueID)) {
                    response.writeHead(200, { 'Content-Type': 'application/json' });
                    response.end(JSON.stringify({ error: 'This game is not running.' }));
                }
                else {
                    var playerTeam = postData.authentication.player.team;
                    var correctAuth = null;
                    currentGameParameters.players.forEach(
                        function (currentPlayer) {
                            if ((currentPlayer.team == postData.authentication.player.team) && (currentPlayer.uniqueID == postData.authentication.player.uniqueID))
                                correctAuth = currentPlayer;
                        });
                    if (correctAuth == null) {
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
                                    currentGameParameters.units.forEach(
                                        function (candidate) {
                                            if ((candidate.posX == unit.pos.x)
                                                && (candidate.posY == unit.pos.y)
                                                && (candidate.team == unit.team)
                                                && (candidate.hp == unit.hp)
                                                && (candidate.team == playerTeam)) {
                                                candidate.ao = unit.ao;
                                                candidate.mo = unit.mo;
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
            else if (request.url == '/feedback') {
                //#region Performance tests
                var postData = JSON.parse(buffer);
                if ((postData == null) ||
                    (postData.authentication == null) ||
                    (postData.authentication.game == null) ||
                    (postData.authentication.game.uniqueID != currentGameParameters.uniqueID)) {
                    response.writeHead(200, { 'Content-Type': 'application/json' });
                    response.end(JSON.stringify({ error: 'This game is not running.' }));
                }
                else {
                    var playerTeam = postData.authentication.player.team;
                    var correctAuth = null;
                    currentGameParameters.players.forEach(
                        function (currentPlayer) {
                            if ((currentPlayer.team == postData.authentication.player.team) && (currentPlayer.uniqueID == postData.authentication.player.uniqueID))
                                correctAuth = currentPlayer;
                        });
                    if (correctAuth == null) {
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