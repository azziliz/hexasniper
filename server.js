function GameParameters() {
    this.worldSizeX = 30; //156; // number of horizontal tiles. Has to be an even number
    this.worldSizeY = 20; //100; // number of vertical tiles. Has to be an even number
    this.playerCount = 2;
    this.initialUnitCount = 2; //600; // number of units per player at startup.
    this.unitRange = 5; //number of tiles around a unit, where the unit is able to shoot
    this.units = null;
    this.players = null;
    this.uniqueID = 0.0;
}
var currentGameParameters = new GameParameters();

function ArmyUnit() {
    this.posX = 0;
    this.posY = 0;
    this.team = 0;
    this.hp = 0;
    this.ao = false;
    this.mo = false;
}

function Player() {
    this.team = 0;
    this.uniqueID = 0.0;
    this.ordersGiven = false;
    this.feedbackGiven = false;
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
            var newUnit = new ArmyUnit();
            newUnit.hp = 12; //Math.floor(1 + 12 * Math.random());
            newUnit.team = i % currentGameParameters.playerCount;
            newUnit.posX = coordX;
            newUnit.posY = coordY;
            currentGameParameters.units.push(newUnit);
            i--;
        }
    }
}

function checkEndTurn(request, response, playerTeam) {
    var allOrdersGiven = true;
    currentGameParameters.players.forEach(
        function (player) {
            if (!player.ordersGiven) allOrdersGiven = false;
        });
    if (allOrdersGiven) {
        compressAndSend(request, response, 'application/json', JSON.stringify(currentGameParameters.units));
        currentGameParameters.players[playerTeam].feedbackGiven = true;
        var allFeedbackGiven = true;
        currentGameParameters.players.forEach(
            function (player) {
                if (!player.feedbackGiven) allFeedbackGiven = false;
            });
        if (allFeedbackGiven) {
            //TODO listenToNewBoard();
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
    if (request.url != '/feedback') console.log(request.url);
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
            else if (request.url == '/login') {
                if (currentGameParameters.players.length < currentGameParameters.playerCount) {
                    var player = new Player();
                    player.team = currentGameParameters.players.length; // Warning: player with team X has to be in position X in the players Array. See Orders
                    player.uniqueID = Math.random().toString(16);
                    currentGameParameters.players.push(player);
                    compressAndSend(request, response, 'application/json',
                        JSON.stringify({ game: { uniqueID: currentGameParameters.uniqueID }, player: player }));
                }
                else {
                    response.writeHead(200, { 'Content-Type': 'application/json' });
                    response.end(JSON.stringify({ error: 'Game is full.' }));
                }
            }
            else if (request.url == '/logoff') {
                //TODO
                response.writeHead(404);
                response.end();
            }
            else if (request.url == '/orders') {
                var postData = JSON.parse(buffer);
                if (postData.authentication.game.uniqueID != currentGameParameters.uniqueID) {
                    response.writeHead(200, { 'Content-Type': 'application/json' });
                    response.end(JSON.stringify({ error: 'This game is not running.' }));
                }
                else {
                    var playerTeam = postData.authentication.player.team;
                    if (postData.authentication.player.uniqueID != currentGameParameters.players[playerTeam].uniqueID) {
                        response.writeHead(200, { 'Content-Type': 'application/json' });
                        response.end(JSON.stringify({ error: 'Wrong authentication.' }));
                    }
                    else {
                        if (currentGameParameters.players[playerTeam].ordersGiven) {
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
                            currentGameParameters.players[playerTeam].ordersGiven = true;
                            checkEndTurn(request, response, playerTeam);
                        }
                    }
                }      
            }
            else if (request.url == '/feedback') {
                var postData = JSON.parse(buffer);
                if (postData.authentication.game.uniqueID != currentGameParameters.uniqueID) {
                    response.writeHead(200, { 'Content-Type': 'application/json' });
                    response.end(JSON.stringify({ error: 'This game is not running.' }));
                }
                else {
                    var playerTeam = postData.authentication.player.team;
                    if (postData.authentication.player.uniqueID != currentGameParameters.players[playerTeam].uniqueID) {
                        response.writeHead(200, { 'Content-Type': 'application/json' });
                        response.end(JSON.stringify({ error: 'Wrong authentication.' }));
                    }
                    else {
                        checkEndTurn(request, response, playerTeam);
                    }
                }
            }
            else {
                response.writeHead(404);
                response.end();
            }
        });
    }
}).listen(15881);

console.log('Server running at http://127.0.0.1:15881/');