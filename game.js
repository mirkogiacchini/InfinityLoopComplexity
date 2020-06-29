const CLASSIC_MODE = 0, DARK_MODE = 1;
var actualMode = CLASSIC_MODE;

const empty_p = 0, one_p = 1, twoadj_p = 2, twosep_p = 3, full_p = 4; //pieces'ids
var pieces; //all the pieces (non empty) x->y->piece

//var joinToPieces; //for each connection in the graph, we keep the corresponding infinity loop piece
var leftExitPiecesPos; //x position of each left exit of variable
var startingVar; //top left 1-exit piece for each variable (we store the pair [x, y] to be used in @pieces); we also store if the variable is true or false

//list of (x_start, y_start, width, height) to highlight gadgets (y increasing going up)
var gadgetsHighlight; 

var is_simulating; //are we simulating?

var rotateMode; //rotate mode?

var listenersAdded = false;

//---- 1-in-3SAT Graph-----
var clauseNodes = [];
var variableNodes = [];

function getGameCanvas() {
    return document.getElementById("infinityLoopCanvas");
}

//draw rotated image
function drawImage(ctx, image, x, y, w, h, rotation) {
    ctx.save();
    ctx.translate(x+w/2, y+h/2);
    ctx.rotate(rotation*Math.PI/180.0);
    ctx.translate(-x-w/2, -y-h/2);
    ctx.drawImage(image, x, y, w, h);
    ctx.restore();
} 

function checkGraphWellFormed() {
    var offsets = [...clausesLevelsInGraph()];
 
    for(var i=0; i<offsets.length; i++) { //iterate offsets
        var iter = exitsOfNextClause(offsets[i], 0);
        while(iter[1] != -1) { 
            if(iter[0].length <= 0 || iter[0].length > 3) 
                return [false, iter[0].length];
            iter = exitsOfNextClause(offsets[i], iter[1]);
        }
    }
 
    return [true, -1];
}

function resetEverything() {
    pieces = new Map(); //x->y -> piece (map of maps) 
    //joinToPieces = new Map(); //x->offset->piece
    leftExitPiecesPos = new Map(); //id var -> exit number -> piece
    gadgetsHighlight = []; //list of (x, y, width, height, color)
    is_simulating = false;
    rotateMode = false;
    startingVar = [];

    clauseNodes = [];
    variableNodes = [];
    buildPositivePlanar1in3SatGraph();
}

//clause node in a planar 1-in-3sat graph
class ClauseNode {
    constructor(level, up) {
        this.level = level;
        this.up = up;
        this.adjVars = [];
    }

    addVar(index, numExit) {
        this.adjVars.push([index, numExit]);
    }
}

//variable node in a planar 1-in-3sat graph
class VariableNode {
    constructor(truthValue, numberOfExits) {
        this.truthValue = truthValue;
        this.upAdjClauses = [];
        this.downAdjClauses = [];
        this.numberOfExits = numberOfExits;
    }

    addClause(index, up=true) {
        if(up)
            this.upAdjClauses.push(index);
        else
            this.downAdjClauses.push(index);
    }
}

//builds the graph from user's input
function buildPositivePlanar1in3SatGraph() {
    var negSet = negativeClausesLevelsInGraph();
    var neg_offsets = [...negSet];
    neg_offsets.sort(); //sorts using modulo
    var pos_offsets = [...clausesLevelsInGraph()].filter(x => !negSet.has(x));
    pos_offsets.sort();
    var offToLevel = new Map();
    for(var i=0; i<neg_offsets.length; i++)
        offToLevel.set(neg_offsets[i], i);
    for(var i=0; i<pos_offsets.length; i++)
        offToLevel.set(pos_offsets[i], i);

    var xOffToClauseIndex = new Map();

    var clauseIndex = 0;
    for(let [x, st] of cv_joins) {
        for(let off of st) {
            var xleft = leftmostClauseAtXOffset(x, off);
            if(!existsInMapMap(xOffToClauseIndex, xleft, off)) {
                var cNode = new ClauseNode(offToLevel.get(off) + 1, off > 0);
                clauseNodes.push(cNode);
                addInMapMap(xOffToClauseIndex, xleft, off, clauseIndex);
                clauseIndex++;
            }
        }
    }

    var nextInd = 0;
    var maxInd = 0;

    for(let e of variable_line)
        maxInd = Math.max(e, maxInd);

    var variableIndex = 0;
    while(nextInd < maxInd) { //iterate variables
        var varTruthState = stateOfNextVariable(nextInd, maxInd);
        var tmp = numberExitsNextVariable(nextInd, maxInd);
        var nExits = tmp[0];
        var vnode = new VariableNode(varTruthState, nExits);

        var exitPoints = exitsNextVariable(nextInd, maxInd)[0]; //exits are already sorted (x, offset)
        nextInd = tmp[1];
        if(nExits == -1) break;
        
        var actExitUp = 0;
        var actExitDown = 0;
        for(var i=0; i<exitPoints.length; i++) {
            var cind = getMapMap(xOffToClauseIndex, leftmostClauseAtXOffset(exitPoints[i][0], exitPoints[i][1]), exitPoints[i][1]);
            var actExit = actExitUp;
            if(exitPoints[i][1] < 0)
                actExit = actExitDown;
            clauseNodes[cind].addVar(variableIndex, actExit);
            
            if(exitPoints[i][1] < 0) {
                actExitDown++;
                vnode.addClause(cind, false);
            } else {
                actExitUp++;
                vnode.addClause(cind, true);
            }
        }

        variableNodes.push(vnode);
        variableIndex++;
    }
}

class Piece {
    constructor(x, y, type, rotation) {
        this.x = x;
        this.y = y;
        this.type = type;
        this.rotation = rotation;
        this.drawRotation = rotation;
        
        this.used = false;
        this.inQueue = false;
        this.isBar = false; //is a piece on a clause's bar? (classic mode)
    }

    draw(ctx, square_size) {
        if(this.type == empty_p) return false;
        
        ctx.globalAlpha = 0.2;
        if( (actualMode == CLASSIC_MODE && isPieceCovered(this, true)) || (actualMode == DARK_MODE && isPieceDisconnected(this, true)) )
            ctx.fillStyle = "#00FF00";
        else
            ctx.fillStyle = "#FF6600";
        ctx.fillRect(this.x*square_size_px, this.y*square_size_px, square_size, square_size);

        ctx.globalAlpha = 1;
        if(this.type == one_p)
            drawImage(ctx, document.getElementById("one_img"), this.x*square_size, this.y*square_size, square_size, square_size, this.drawRotation);
        if(this.type == twosep_p)
            drawImage(ctx, document.getElementById("two_sep_img"), this.x*square_size, this.y*square_size, square_size, square_size, this.drawRotation);
        if(this.type == twoadj_p)
            drawImage(ctx, document.getElementById("two_adj_img"), this.x*square_size, this.y*square_size, square_size, square_size, this.drawRotation);
        if(this.type == full_p)
            drawImage(ctx, document.getElementById("four_img"), this.x*square_size, this.y*square_size, square_size, square_size, this.drawRotation);
        return true;
    }
}

function addPiece(piece) {
    if(!pieces.has(piece.x)) pieces.set(piece.x, new Map());
    pieces.get(piece.x).set(piece.y, piece);
}

function hasPiece(piece) {
    return pieces.has(piece.x) && pieces.get(piece.x).has(piece.y);
}

function deletePiece(piece) {
    if(!hasPiece(piece.x, piece.y)) return false;
    pieces.get(piece.x).delete(piece.y);
    if(pieces.get(piece.x).size == 0) pieces.delete(piece.x);
}

function getPiece(x, y) {
    return pieces.get(x).get(y);
}

function hasPiece(x, y) {
    return pieces.has(x) && pieces.get(x).has(y);
}

//generate level from planar-1in3sat graph
function generateLevel() {
    var mode = document.getElementById("selMode");
    actualMode = mode.options[mode.selectedIndex].value;

    stopSimulation();
    var wellFormed = checkGraphWellFormed();
    if(!wellFormed[0]) {
        //alert("the graph is not well formed, there is a clause with "+wellFormed[1]+" exits");
        $("#invalidModal").modal()
        return false;
    }

    resetEverything();
    document.getElementById("play_button").style = ""; //make buttons visible
    document.getElementById("stop_button").style = "";
    document.getElementById("user_button").style = "";
    document.getElementById("single_button").style = "";

    document.getElementById("play_button").disabled = false;
    document.getElementById("single_button").disabled = false;
    document.getElementById("stop_button").disabled = true;
    document.getElementById("user_button").disabled = true;
    enterRotateMode();

    document.getElementById("play_button").onclick = function() { //listeners for play/stop buttons
        simulate();
        exitRotateMode();
        document.getElementById("play_button").disabled = true;
        document.getElementById("stop_button").disabled = false;
        document.getElementById("user_button").disabled = false;
        document.getElementById("single_button").disabled = true;
    }
    document.getElementById("stop_button").onclick = function() {
        stopSimulation();
        exitRotateMode();
        document.getElementById("play_button").disabled = false;
        document.getElementById("stop_button").disabled = true;
        document.getElementById("user_button").disabled = false;
        document.getElementById("single_button").disabled = false;
    }
    document.getElementById("user_button").onclick = function() {
        stopSimulation();
        enterRotateMode();
        document.getElementById("play_button").disabled = false;
        document.getElementById("stop_button").disabled = true;
        document.getElementById("user_button").disabled = true;
        document.getElementById("single_button").disabled = false;
    }
    document.getElementById("single_button").onclick = function() {
        simulate(); //O(N^2), can be done in O(N)
        simulateStep(); 
        stopSimulation();
    }

    if(actualMode == CLASSIC_MODE)
        generateClassicLevel();
    else
        generateDarkLevel();

    getGameCanvas().style = "border:1px solid #C2C2C2";

    //listener for rotation mode
    if(!listenersAdded) {
        getGameCanvas().addEventListener('mouseup', (e)=>{mouseUpForRotation(e)}, false);
        listenersAdded = true;
    }

    drawGameGrid();

    findTargetRotations();
}

function drawGameGrid() {
    var ctx = getGameCanvas().getContext("2d");
    cleanCanvas(ctx);
    var cw = ctx.canvas.width, ch = ctx.canvas.height; 
    var w = cw / square_size_px, h = ch / square_size_px;

    for(let [x, y] of pieces) //draw infinity loop pieces
        for(let [k, e] of y)
            e.draw(ctx, square_size_px);

    ctx.strokeStyle = "#C2C2C2";
    ctx.globalAlpha = 1;
    for(var i=0; i<h; i++) { //horizonal lines
		ctx.beginPath();
		ctx.moveTo(0, i*square_size_px); //xy
		ctx.lineTo(cw, i*square_size_px);
		ctx.stroke();
    }
	for(var i=0; i<w; i++) { //vertical lines
		ctx.beginPath();
		ctx.moveTo(i*square_size_px, 0);
		ctx.lineTo(i*square_size_px, ch);
		ctx.stroke();
    }
    
    //gadgets highlights:
    ctx.lineWidth = 3;
    for(let h of gadgetsHighlight) {
        ctx.beginPath();
        ctx.strokeStyle = h[4];
        ctx.rect(h[0]*square_size_px+1, (h[1]-h[3]+1)*square_size_px + ctx.lineWidth - 1, h[2]*square_size_px, h[3]*square_size_px - ctx.lineWidth + 1);
        ctx.stroke();
    }
    ctx.lineWidth = 1;
}

//-----simulation----

var queue1; //queue for bfs (1-pieces/2-sep pieces)
var queue2; //2adj pieces
var queue3; //bar pieces, extremities

var playItvl;

//finds the final rotations for the pieces, without performing actual step by step redrawing
function findTargetRotations() {
    queue1 = [];
    queue2 = [];
    queue3 = [];

    for(let [x, v] of pieces) 
        for(let [y, e] of v) {
            e.used = false;
            e.inQueue = false;
        }
    
    for(let e of startingVar) { //init starting points for variables
        getPiece(e[0], e[1]).used = true;
        if(actualMode == CLASSIC_MODE) {
            classicAddNeighbors(e[0], e[1]); //add neighbors of the pieces to the queue
            getPiece(e[0], e[1]).rotation = e[2] ? 270 : 0;
        } else {
            darkAddNeighbors(e[0], e[1]); //add neighbors of the pieces to the queue
            getPiece(e[0], e[1]).rotation = e[2] ? 0 : 90;
        }
    }

    if(actualMode == DARK_MODE) { //manually fix four legged pieces and twosep adjacent to four legged
        for(let [x, v] of pieces)
            for(let [y, p] of v) 
                if(p.type == full_p) {
                    p.rotation = 0;
                    p.used = true;
                    if(hasPiece(p.x+1, p.y) && getPiece(p.x+1, p.y).type == twosep_p) {
                        getPiece(p.x+1, p.y).rotation = 0;
                        getPiece(p.x+1, p.y).used = true;
                    }
                    if(hasPiece(p.x-1, p.y) && getPiece(p.x-1, p.y).type == twosep_p) {
                        getPiece(p.x-1, p.y).rotation = 0;
                        getPiece(p.x-1, p.y).used = true;
                    }
                }
    }

    while(queue1.length+queue2.length+queue3.length>0) {
        //in one step we fix all the pieces in the queue
        var q = []

        if(queue1.length != 0) { //pick a queue, in order
            for(let e of queue1)
                q.push(e);
            queue1 = [];
        }
        else
            if(queue2.length != 0) {
                for(let e of queue2)
                    q.push(e);
                queue2 = [];    
            }
            else {
                for(let e of queue3)
                    q.push(e);
                queue3 = [];
            }
            

        for(let e of q) {
            if(actualMode == CLASSIC_MODE) {
                classicFindPieceRotation(e[0], e[1]);
                classicAddNeighbors(e[0], e[1]);
            }
            else {
                darkFindPieceRotation(e[0], e[1]);
                darkAddNeighbors(e[0], e[1]);
            }
            
            getPiece(e[0], e[1]).used = true;
        }
    }
}

function simulate() {
    if(!is_simulating) {
        is_simulating = true;
        
        queue1 = [];
        for(let [x, v] of pieces) 
            for(let [y, e] of v) {
                e.used = false;
                e.inQueue = false;
            }
        
        for(let e of startingVar) { //init starting points for variables
            getPiece(e[0], e[1]).used = true;
            getPiece(e[0], e[1]).drawRotation = getPiece(e[0], e[1]).rotation;
            addNeighborsToQueue(e[0], e[1], queue1); //add neighbors of the pieces to the queue
        }
        
        drawGameGrid();

        playItvl = window.setInterval(simulateStep, 100);
    }
}

function addNeighborsToQueue(x, y, queue) {
    var inc = [[1, 0], [-1, 0], [0, 1], [0, -1]] //possible increments
    for(let e of inc) 
        if(hasPiece(x+e[0], y+e[1]) && !getPiece(x+e[0], y+e[1]).used && !getPiece(x+e[0], y+e[1]).inQueue) { //check if there is piece
            queue.push([x+e[0], y+e[1]]);
            getPiece(x+e[0], y+e[1]).inQueue = true;
        }
}

//the piece currently has an end on x,y
function thereIsEndOnPoint(piece, x, y, drawing=false) {
    var rotation = (drawing ? piece.drawRotation : piece.rotation);

    if(piece.type == one_p) {
        var possibilities = [[0, [0, 1]], [90, [-1, 0]], [180, [0, -1]], [270, [1, 0]]];
        for(let e of possibilities)
            if((rotation+360)%360 == e[0] && x == piece.x+e[1][0] && y == piece.y+e[1][1])
                return true;
        return false;
    }

    if(piece.type == twosep_p) {
        var possibilities = [[0, [0, 1]], [0, [0, -1]], [90, [-1, 0]], [90, [1, 0]]];
        for(let e of possibilities)
            if( ((rotation+360)%360 == e[0] || (rotation+360+180)%360 == e[0]) &&
                x == piece.x+e[1][0] && y == piece.y+e[1][1])
                return true;
        return false;
    }

    if(piece.type == twoadj_p) {
        if(x == piece.x+1 && y == piece.y && (rotation == 0 || rotation == 270)) return true;
        if(x == piece.x && y == piece.y-1 && (rotation == 180 || rotation == 270)) return true;
        if(x == piece.x-1 && y==piece.y && (rotation == 90 || rotation == 180)) return true;
        if(x == piece.x && y==piece.y+1 && (rotation == 0 || rotation == 90)) return true;
        return false;
    }

    if(piece.type == full_p) {
        return Math.abs(x - piece.x) + Math.abs(y - piece.y) <= 1;
    }
}


function simulateStep() {
    var movedSomething = false;
    while(!movedSomething && queue1.length > 0) {
        var q = []
        for(let e of queue1)
            q.push(e);
        queue1 = [];
        
        for(let e of q) {
            movedSomething = movedSomething || getPiece(e[0], e[1]).drawRotation != getPiece(e[0], e[1]).rotation;
            getPiece(e[0], e[1]).drawRotation = getPiece(e[0], e[1]).rotation;
            addNeighborsToQueue(e[0], e[1], queue1);
        }
    }
    drawGameGrid();
    if(!movedSomething) {
        stopSimulation();

        if(levelComplete())
            $("#levelcompleteModal").modal();
        else
            $("#levelfailedModal").modal();

        document.getElementById("play_button").disabled = false;
        document.getElementById("single_button").disabled = false;
        document.getElementById("stop_button").disabled = true;
        document.getElementById("user_button").disabled = false;
    }
}

function stopSimulation() {
    is_simulating = false;
    window.clearInterval(playItvl);
}

//rotate mode
function enterRotateMode() {
    rotateMode = true;
}

function exitRotateMode() {
    rotateMode = false;
}

function mouseUpForRotation(event) {
    if(rotateMode) {
        if(is_simulating)
            stopSimulation();
        var coord = canvasCoordinates(getGameCanvas(), event.x, event.y);
        coord[0] = Math.floor(coord[0]/square_size_px);
        coord[1] = Math.floor(coord[1]/square_size_px);
        if(hasPiece(coord[0], coord[1])) {
            getPiece(coord[0], coord[1]).drawRotation = (getPiece(coord[0], coord[1]).drawRotation + 90) % 360;
            drawGameGrid();
        }
    }
}

function isPieceCovered(piece, drawing=false) {
    if(piece.type == empty_p) return true;
    var right = hasPiece(piece.x+1, piece.y) && thereIsEndOnPoint(getPiece(piece.x+1, piece.y), piece.x, piece.y, drawing);
    var left = hasPiece(piece.x-1, piece.y) && thereIsEndOnPoint(getPiece(piece.x-1, piece.y), piece.x, piece.y, drawing);
    var up = hasPiece(piece.x, piece.y-1) && thereIsEndOnPoint(getPiece(piece.x, piece.y-1), piece.x, piece.y, drawing);
    var down = hasPiece(piece.x, piece.y+1) && thereIsEndOnPoint(getPiece(piece.x, piece.y+1), piece.x, piece.y, drawing);
    var rotation = (drawing ? piece.drawRotation : piece.rotation);
    if(piece.type == one_p) {
        return (rotation == 0 && down) || (rotation == 90 && left) || (rotation == 180 && up) || (rotation == 270 && right);
    }
    if(piece.type == twosep_p) {
        return ((rotation == 0 || rotation == 180) && up && down) || ((rotation == 90 || rotation == 270) && right && left);
    }
    return (rotation == 0 && down && right) || (rotation == 90 && down && left) || (rotation == 180 && up && left) || (rotation == 270 && up && right);
}

function isPieceDisconnected(piece, drawing = false) {
    if(piece.type == empty_p) return true;
    var right = hasPiece(piece.x+1, piece.y) && thereIsEndOnPoint(getPiece(piece.x+1, piece.y), piece.x, piece.y, drawing);
    var left = hasPiece(piece.x-1, piece.y) && thereIsEndOnPoint(getPiece(piece.x-1, piece.y), piece.x, piece.y, drawing);
    var up = hasPiece(piece.x, piece.y-1) && thereIsEndOnPoint(getPiece(piece.x, piece.y-1), piece.x, piece.y, drawing);
    var down = hasPiece(piece.x, piece.y+1) && thereIsEndOnPoint(getPiece(piece.x, piece.y+1), piece.x, piece.y, drawing);

    var rotation = (drawing ? piece.drawRotation : piece.rotation);
    if(piece.type == one_p) {
        return (rotation == 0 && !down) || (rotation == 90 && !left) || (rotation == 180 && !up) || (rotation == 270 && !right);
    }
    if(piece.type == twosep_p) {
        return ((rotation == 0 || rotation == 180) && !up && !down) || ((rotation == 90 || rotation == 270) && !right && !left);
    }
    if(piece.type == twoadj_p) {
        return (rotation == 0 && !down && !right) || (rotation == 90 && !down && !left) || (rotation == 180 && !up && !left) || (rotation == 270 && !up && !right);
    }
    if(piece.type == full_p) {
        return !up && !left && !right && !down;
    }
}

function levelComplete() {
    for(const y of pieces.values())
        for(const p of y.values())
            if( (actualMode == CLASSIC_MODE && !isPieceCovered(p)) || (actualMode == DARK_MODE && !isPieceDisconnected(p)) )
                return false;
    return true;
}