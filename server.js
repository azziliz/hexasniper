function GameParameters() {
    this.worldSizeX = 30; //156; // number of horizontal tiles. Has to be an even number
    this.worldSizeY = 20; //100; // number of vertical tiles. Has to be an even number
    this.playerCount = 3;
    this.initialUnitCount = 5; //600; // number of units per player at startup.
    this.unitRange = 5; //number of tiles around a unit, where the unit is able to shoot
    this.units = null;
    this.players = null;
}
var currentGameParameters = new GameParameters();

function ArmyUnit() {
    this.posX = 0;
    this.posY = 0;
    this.team = 0;
    this.hp = 0;
    this.ao = false;
    this.mo = false;
    this.oX = 0;
    this.oY = 0;
}

function Player() {
    this.team = 0;
    this.uniqueID = 0.0;
}

function buildInitialBoard() {
    currentGameParameters.players = new Array();
    currentGameParameters.units = new Array();
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
            newUnit.hp = Math.floor(1 + 6 * Math.random());
            newUnit.team = i % currentGameParameters.playerCount;
            newUnit.posX = coordX;
            newUnit.posY = coordY;
            currentGameParameters.units.push(newUnit);
            i--;
        }
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
                    compressAndSend(request, response, 'application/json', JSON.stringify(currentGameParameters.units));
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