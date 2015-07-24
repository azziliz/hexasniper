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

function DefaultGameParameters() {
    this.worldSizeX = 10; //156; // number of horizontal tiles. Has to be an even number
    this.worldSizeY = 10; //100; // number of vertical tiles. Has to be an even number
    this.playerCount = 2;
    this.initialUnitCount = 2; //600; // number of units per player at startup.
    this.unitRange = 5; //number of tiles around a unit, where the unit is able to shoot
    this.uniqueID = 0.0; //unique ID of the current game (hexadecimal string)
}

function GameEngine(){
    this.units = null;
    this.players = null;
    this.listeningToOrders = true;
}

var gameParameters = new DefaultGameParameters();
var engine = new GameEngine();

//#endregion


function ArmyUnit_() {
    this.posX = 0;
    this.posY = 0;
    this.team = 0;
    this.hp = 0;
    this.ao = null;
    this.mo = null;
}

//#region Game functions

function buildInitialBoard() {
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
                if ((unit.posX === coordX) && (unit.posY === coordY)) {
                    occupiedTile = true;
                }
            });
        if (!occupiedTile) {
			var newUnit = new ArmyUnit_();
            newUnit.hp = 12; 
            newUnit.team = i % gameParameters.playerCount;
            newUnit.posX = coordX;
            newUnit.posY = coordY;
            engine.units.push(newUnit);
            i--;
        }
    }
}

function checkEndTurn(request, response, correctAuth) {
    var allOrdersGiven = true;
    engine.players.forEach(
        function (player) {
            if (!player.ordersGiven) allOrdersGiven = false;
        });
    if (allOrdersGiven) {
        log('all orders received');
        compressAndSend(request, response, 'application/json', JSON.stringify(engine.units));
        correctAuth.feedbackGiven = true;
        var allFeedbackGiven = true;
        engine.players.forEach(
            function (player) {
                if (!player.feedbackGiven) allFeedbackGiven = false;
            });
        if (allFeedbackGiven) {
            //TODO listenToNewBoard();
            log('all feedback given');
            engine.listeningToOrders = false;
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
                            var newUnit = new ArmyUnit_();
                            newUnit.hp = unit.hp;
                            newUnit.team = unit.team;
                            newUnit.posX = unit.pos.x;
                            newUnit.posY = unit.pos.y;
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
                                            if ((candidate.posX === unit.pos.x)
                                                && (candidate.posY === unit.pos.y)
                                                && (candidate.team === unit.team)
                                                && (candidate.hp === unit.hp)
                                                && (candidate.team === playerTeam)) {
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