const dark_clause_height = 13, dark_var_height = 2;
const dark_var_propagation_len = 4; //must be even!!

//generate level in dark mode from positive planar 1in3sat graph
function generateDarkLevel() {
    var num_clause_levels = clausesLevelsInGraph().size; 
    var ctx = getGameCanvas().getContext("2d");
    
    var height_required = num_clause_levels * (dark_clause_height+1) + dark_var_height + 4;
    ctx.canvas.height = height_required * square_size_px;
    ctx.canvas.width = generateDarkVariableGadgets() * square_size_px; //generate variable gadget (and also compute width of the grid)

    generateDarkClauseGadgets();
}

function darkBottomVarsLine() { //bottom y of variable line
    return negativeClausesLevelsInGraph().size * (dark_clause_height+1) + Math.floor(dark_var_height/2) + 2;
}

function generateDarkVariableGadgets() { //generate variables gadgets
    var bottom_y = darkBottomVarsLine();
    var actX = 1;
    const len_one_exit = 4; //length needed in a variable for a single exits

    for(var numVar=0; numVar<variableNodes.length; numVar++) {
        var highlight = []; //insert data to create variable box
        highlight.push(actX);
        highlight.push(bottom_y);

        startingVar.push([actX, bottom_y-1, variableNodes[numVar].truthValue]); //[x, y, state] (used in simulation)

        var leftExitsPositions = [];
        var nExits = variableNodes[numVar].numberOfExits;
        var upc = variableNodes[numVar].upAdjClauses;
        var downc = variableNodes[numVar].downAdjClauses;
        for(var i=0; i<nExits; i++) {
            var len = (i != nExits - 1) ? len_one_exit : 2;
            for(var t=0; t<len; t++) {
                addPiece(new Piece(actX+t, bottom_y, twosep_p, 0));
                addPiece(new Piece(actX+t, bottom_y-1, twosep_p, 0));
            }

            leftExitsPositions.push(actX);
            addInMapMap(leftExitPiecesPos, numVar, i, actX); //data needed in clauses
            actX += len;
            
            if( (i+1 < upc.length && upc[i] == upc[i+1]) ||
                 (i+1 < downc.length && downc[i] == downc[i+1])) { //propagate to handle multiple instances in same clause
                for(var j=0; j<dark_var_propagation_len; j++) { //must be even
                    addPiece(new Piece(actX+j, bottom_y, twosep_p, 0));
                    addPiece(new Piece(actX+j, bottom_y-1, twosep_p, 0));
                }
                actX += dark_var_propagation_len;
            }
        }
        
        //gadget highlight
        highlight.push(actX - highlight[0]); //complete data collection for this variable
        highlight.push(2);
        highlight.push(variableNodes[numVar].truthValue ? TRUE_VAR_COLOR : FALSE_VAR_COLOR);
        gadgetsHighlight.push(highlight);
        actX += 6; //space between variables
    }

    return actX - 5;
}

//creates satisfy gadget from top-left coordinates
function darkSatisfy3(topLeftX, topLeftY, dir) {
    addPiece(new Piece(topLeftX, topLeftY, full_p, 0));
    addPiece(new Piece(topLeftX-dir*1, topLeftY, twosep_p, 0));
    addPiece(new Piece(topLeftX, topLeftY-dir*1, one_p, 0));
    addPiece(new Piece(topLeftX, topLeftY-dir*2, twoadj_p, 0));
    addPiece(new Piece(topLeftX-dir*1, topLeftY-dir*1, twoadj_p, 0));
    addPiece(new Piece(topLeftX-dir*1, topLeftY-dir*2, one_p, 0));
    addPiece(new Piece(topLeftX-dir*2, topLeftY-dir*1, twoadj_p, 0));
    addPiece(new Piece(topLeftX-dir*2, topLeftY-dir*2, twoadj_p, 0));
    addPiece(new Piece(topLeftX-dir*3, topLeftY-dir*1, twosep_p, 0));
    addPiece(new Piece(topLeftX-dir*3, topLeftY-dir*2, twosep_p, 0));
}

//2-satisfy
function darkSatisfy2(topLeftX, topLeftY, dir) {
    darkSatisfy3(topLeftX, topLeftY, dir);
    addPiece(new Piece(topLeftX, topLeftY-dir*3, full_p, 0));
}

//other version of 2 satisfy for 2-variable clauses
function darkSatisfy2v2(topLeftX, topLeftY, dir) {
    darkSatisfy3(topLeftX, topLeftY, dir);
    addPiece(new Piece(topLeftX-dir, topLeftY-dir*3, full_p, 0));
}

function generateDarkClauseGadgets() {
    var bottom_y = darkBottomVarsLine();
    for(var i=0; i<clauseNodes.length; i++) { //iterate clauses
        var exits = [];
        var yvar = bottom_y + (clauseNodes[i].up ? 0 : -1);
        for(var j = 0; j<clauseNodes[i].adjVars.length; j++) { //collect left pieces for each exit
            var piece = getPiece(getMapMap(leftExitPiecesPos, clauseNodes[i].adjVars[j][0], clauseNodes[i].adjVars[j][1]), yvar);
            exits.push(piece);
        }
        generateDarkClause(exits, clauseNodes[i].level, (clauseNodes[i].up ? 1 : -1)); //build a single clause
    }
}

//generate single clause
function generateDarkClause(exits, height, dir) {
    var len = 2 + (height - 1) * (dark_clause_height + 1);

    for(let e of exits) { //iterate variable exits
        var actY = e.y+dir;
        for(var l=0; l<len; l++) { //create wires for instance 'e'
            addPiece(new Piece(e.x, actY, twosep_p, 0));
            addPiece(new Piece(e.x+1, actY, twosep_p, 0));
            actY+=dir;
        }
        gadgetsHighlight.unshift([e.x, dir < 0 ? e.y+dir : e.y + len * dir, 2, len, EDGE_COLOR]);
    }

    gadgetsHighlight.push([exits[0].x, exits[0].y+dir*(len+1) + (dir < 0 ? 0 : dark_clause_height-1), exits[exits.length-1].x+2-exits[0].x, dark_clause_height, CLAUSE_COLOR]);
    
    //create actual clause
    if(exits.length == 1) { //1 variable in clause...
        if(dir < 0) //up
            addPiece(new Piece(exits[0].x+1, dir*len+exits[0].y+dir, full_p, 0));
        else //down
            addPiece(new Piece(exits[0].x, dir*len+exits[0].y+dir, full_p, 0));
    }
    if(exits.length == 2) { //2 variables
        var startY = dir*len+exits[0].y+dir;
        for(var i=0; i<10; i++) {
            addPiece(new Piece(exits[0].x, startY + dir * i, twosep_p, 0)); 
            addPiece(new Piece(exits[0].x+1, startY + dir * i, twosep_p, 0));

            addPiece(new Piece(exits[1].x, startY + dir * i, twosep_p, 0)); 
            addPiece(new Piece(exits[1].x+1, startY + dir * i, twosep_p, 0)); 
        }
        if(dir < 0) {
            for(var i=exits[0].x+2; i<exits[1].x-4; i++) {
                addPiece(new Piece(i, startY + dir * 2, twosep_p, 0)); 
                addPiece(new Piece(i, startY + dir * 3, twosep_p, 0));
                addPiece(new Piece(i, startY + dir * 8, twosep_p, 0)); 
                addPiece(new Piece(i, startY + dir * 9, twosep_p, 0));
            }
            darkSatisfy2(exits[1].x-4, startY + dir*4, dir);
            darkSatisfy2v2(exits[1].x-4, startY + dir*10, dir);
        } else {
            for(var i=exits[1].x-1; i>exits[0].x+5; i--) {
                addPiece(new Piece(i, startY + dir * 2, twosep_p, 0)); 
                addPiece(new Piece(i, startY + dir * 3, twosep_p, 0));
                addPiece(new Piece(i, startY + dir * 8, twosep_p, 0)); 
                addPiece(new Piece(i, startY + dir * 9, twosep_p, 0));
            }
            darkSatisfy2(exits[0].x+5, startY + dir*4, dir);
            darkSatisfy2v2(exits[0].x+5, startY + dir*10, dir);
        }
    }
    if(exits.length == 3) { //3 variables
        var startY = dir*len+exits[0].y+dir;
        for(var i=0; i<12; i++) {
            addPiece(new Piece(exits[0].x, startY + dir * i, twosep_p, 0)); 
            addPiece(new Piece(exits[0].x+1, startY + dir * i, twosep_p, 0)); 

            addPiece(new Piece(exits[2].x, startY + dir * i, twosep_p, 0)); 
            addPiece(new Piece(exits[2].x+1, startY + dir * i, twosep_p, 0)); 
        }
        for(var i=0; i<6; i++) {
            addPiece(new Piece(exits[1].x, startY + dir * i, twosep_p, 0)); 
            addPiece(new Piece(exits[1].x+1, startY + dir * i, twosep_p, 0)); 
        }

        if(dir < 0) {
            for(var i=exits[0].x+2; i<exits[1].x-4; i++) { //1° and 2° wire
                addPiece(new Piece(i, startY + dir * 2, twosep_p, 0)); 
                addPiece(new Piece(i, startY + dir * 3, twosep_p, 0)); 
            }
            for(var i=exits[1].x+2; i<exits[2].x-4; i++) { //2° and 3° wire
                addPiece(new Piece(i, startY + dir * 2, twosep_p, 0)); 
                addPiece(new Piece(i, startY + dir * 3, twosep_p, 0)); 
            }
            for(var i=exits[0].x+2; i<exits[2].x-4; i++) { //1° and 3° wire
                addPiece(new Piece(i, startY + dir * 10, twosep_p, 0)); 
                addPiece(new Piece(i, startY + dir * 11, twosep_p, 0)); 
            }
            //all 3 wire
            for(var i=exits[0].x+2; i<exits[1].x; i++) { 
                addPiece(new Piece(i, startY + dir * 6, twosep_p, 0)); 
                addPiece(new Piece(i, startY + dir * 7, twosep_p, 0)); 
            }
            for(var i=exits[2].x-1; i>=exits[1].x+4; i--) { 
                addPiece(new Piece(i, startY + dir * 6, twosep_p, 0)); 
                addPiece(new Piece(i, startY + dir * 7, twosep_p, 0)); 
            }

            darkSatisfy3(exits[1].x, startY+dir*8, dir);
            darkSatisfy2(exits[1].x-4, startY+dir*4, dir); //1-2
            darkSatisfy2(exits[2].x-4, startY+dir*4, dir); //3-2
            darkSatisfy2(exits[2].x-4, startY+dir*12, dir); //3-1
        } else {
            for(var i=exits[1].x-1; i>exits[0].x+5; i--) { //1° and 2° wire
                addPiece(new Piece(i, startY + dir * 2, twosep_p, 0)); 
                addPiece(new Piece(i, startY + dir * 3, twosep_p, 0)); 
            }
            for(var i=exits[2].x-1; i>exits[1].x+5; i--) { //2° and 3° wire
                addPiece(new Piece(i, startY + dir * 2, twosep_p, 0)); 
                addPiece(new Piece(i, startY + dir * 3, twosep_p, 0)); 
            }
            for(var i=exits[2].x-1; i>exits[0].x+5; i--) { //1° and 3° wire
                addPiece(new Piece(i, startY + dir * 10, twosep_p, 0)); 
                addPiece(new Piece(i, startY + dir * 11, twosep_p, 0)); 
            }
            //all 3 wire
            for(var i=exits[0].x+2; i<exits[1].x-2; i++) { 
                addPiece(new Piece(i, startY + dir * 6, twosep_p, 0)); 
                addPiece(new Piece(i, startY + dir * 7, twosep_p, 0)); 
            }
            for(var i=exits[2].x-1; i>exits[1].x+1; i--) { 
                addPiece(new Piece(i, startY + dir * 6, twosep_p, 0)); 
                addPiece(new Piece(i, startY + dir * 7, twosep_p, 0)); 
            }

            darkSatisfy3(exits[1].x+1, startY+dir*8, dir);
            darkSatisfy2(exits[0].x+5, startY+dir*4, dir); //1-2
            darkSatisfy2(exits[1].x+5, startY+dir*4, dir); //3-2
            darkSatisfy2(exits[0].x+5, startY+dir*12, dir); //3-1
        }
    }
}

//----- simulation----
function darkFindPieceRotation(x, y) {
    var piece = getPiece(x, y);

    var inc = [[1, 0], [-1, 0], [0, 1], [0, -1]]; //possible increments [right, left, down, top]
    var freeWithPiece = []; //this is surely free (with a piece in it)
    var freeEmpty = []; //free and empty
    var notFree = []; //this is surely not free
    var possibleNotFree = []; //might not be free, but we don't know
    var index = 0;
    for(let e of inc) {
        if(hasPiece(piece.x+e[0], piece.y+e[1])) {
            var neigh = getPiece(piece.x+e[0], piece.y+e[1]); //has at least one endpoint
            if(!neigh.used && piece.type != full_p) //not used... might not be free
                possibleNotFree.push(index);
            else 
                if(thereIsEndOnPoint(neigh, piece.x, piece.y)) 
                    notFree.push(index);
                else
                    freeWithPiece.push(index);
        }
        else
            freeEmpty.push(index);
        index++;
    }

    if(piece.type == full_p || piece.type == empty_p) {
        piece.rotation = 0;
    }
    if(piece.type == twosep_p) {
        if(notFree.length > 0)
            piece.rotation = (notFree[0] == 0 || notFree[0] == 1) ? 0 : 90; //not free right/left -> 0, not free down/top -> 90 (if both, doesn't matter, it's not solvable)
        else {
            if(freeWithPiece.length > 0) {
                piece.rotation = (freeWithPiece[0] == 0 || freeWithPiece[0] == 1) ? 90 : 0;
            }
        }
    }

    if(piece.type == one_p) {
        var rot = [270, 90, 0, 180];
        if(freeEmpty.length > 0) {
            piece.rotation = rot[freeEmpty[0]];
        }
        else if(freeWithPiece.length > 0) {
            piece.rotation = rot[freeWithPiece[0]];
        }
        else if(possibleNotFree.length > 0) {
            piece.rotation = rot[possibleNotFree[0]];
        }
        else
            piece.rotation = 0;
    }

    if(piece.type == twoadj_p) {
        var free = freeEmpty.concat(freeWithPiece);
        if(free.includes(0) && free.includes(2)) piece.rotation = 0; //2 free -> put it ther
        else if(free.includes(2) && free.includes(1)) piece.rotation = 90;
        else if(free.includes(1) && free.includes(3)) piece.rotation = 180;
        else if(free.includes(3) && free.includes(0)) piece.rotation = 270;
        else if(notFree.includes(0) && notFree.includes(2)) piece.rotation = 180; //2 not free -> don't put it there
        else if(notFree.includes(2) && notFree.includes(1)) piece.rotation = 270;
        else if(notFree.includes(1) && notFree.includes(3)) piece.rotation = 0;
        else if(notFree.includes(3) && notFree.includes(0)) piece.rotation = 90;
        else if(notFree.includes(0) && free.includes(2)) piece.rotation = 90; //1 not free and 1 free -> only one possibility
        else if(notFree.includes(0) && free.includes(3)) piece.rotation = 180;
        else if(notFree.includes(1) && free.includes(2)) piece.rotation = 0;
        else if(notFree.includes(1) && free.includes(3)) piece.rotation = 270;
        else if(notFree.includes(3) && free.includes(1)) piece.rotation = 90;
        else if(notFree.includes(3) && free.includes(0)) piece.rotation = 0;
        else if(notFree.includes(2) && free.includes(1)) piece.rotation = 180;
        else if(notFree.includes(2) && free.includes(0)) piece.rotation = 270;
    }
}

function darkAddNeighbors(x, y) {
    var inc = [[1, 0], [-1, 0], [0, 1], [0, -1]] //possible increments
    for(let e of inc) 
        if(hasPiece(x+e[0], y+e[1]) && !getPiece(x+e[0], y+e[1]).used && !getPiece(x+e[0], y+e[1]).inQueue) { //check if there is piece
            if(getPiece(x+e[0], y+e[1]).type == twosep_p || getPiece(x+e[0], y+e[1]).type == full_p)
                queue1.push([x+e[0], y+e[1]]);
            else
                if(getPiece(x+e[0], y+e[1]).type == twoadj_p)
                    queue2.push([x+e[0], y+e[1]]);
                else
                    queue3.push([x+e[0], y+e[1]]);
            getPiece(x+e[0], y+e[1]).inQueue = true; //we don't want to add the same piece multiple times
        }
}

