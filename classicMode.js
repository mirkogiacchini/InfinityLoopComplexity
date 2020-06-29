const classic_clause_height = 13, classic_var_height = 10;
const classic_var_propagation_len = 4; //must be even!!

//generate level in classic mode from positive planar 1in3sat graph
function generateClassicLevel() {
    var num_clause_levels = clausesLevelsInGraph().size; 
    var ctx = getGameCanvas().getContext("2d");
    
    var height_required = num_clause_levels * (classic_clause_height+1) + classic_var_height;
    ctx.canvas.height = height_required * square_size_px;
    ctx.canvas.width = generateClassicVariableGadgets() * square_size_px; //generate variable gadget (and also compute width of the grid)

    generateClassicClauseGadgets();
}

function classicBottomVarsLine() { //bottom y of variable line
    return negativeClausesLevelsInGraph().size * (classic_clause_height+1) + 2*Math.floor(classic_var_height/3);
}

function closeVarInstance(leftpiece, dir) {
    var x = leftpiece.x, y = leftpiece.y;
    for(var i=1; i<=2; i++) {
        addPiece(new Piece(x, y+i*dir, one_p, 0));
        addPiece(new Piece(x+3, y+i*dir, one_p, 0));
        addPiece(new Piece(x+i, y+2*dir, one_p, 0));
    }
}

function generateClassicVariableGadgets() { //generate variables gadgets
    var bottom_y = classicBottomVarsLine();
    var actX = 1;
    const len_one_exit = 6; //length needed in a variable for a single exits (6 because it's two "center block")

    for(var numVar=0; numVar<variableNodes.length; numVar++) {
        var highlight = []; //insert data to create variable box
        highlight.push(actX);
        highlight.push(bottom_y);

        startingVar.push([actX, bottom_y-3, variableNodes[numVar].truthValue]); //[x, y, state] (used in simulation)

        for(var i=0; i<4; i++) //start variable
            addPiece(new Piece(actX, bottom_y-i, one_p, 0));
        actX++; //move to 2° column of variable block

        var leftExitsPositions = [];
        var nExits = variableNodes[numVar].numberOfExits;
        var upc = variableNodes[numVar].upAdjClauses;
        var downc = variableNodes[numVar].downAdjClauses;
        for(var i=0; i<nExits; i++) {
            for(var j=0; j<2; j++) { //two gadget exits for each real exit
                addPiece(new Piece(actX+3*j, bottom_y, one_p, 0)); //left
                addPiece(new Piece(actX+3*j, bottom_y-3, one_p, 0));
                
                addPiece(new Piece(actX+1+3*j, bottom_y-1, one_p, 0)); //central
                addPiece(new Piece(actX+1+3*j, bottom_y-2, one_p, 0));
                addPiece(new Piece(actX+1+3*j, bottom_y, twosep_p, 0));
                addPiece(new Piece(actX+1+3*j, bottom_y-3, twosep_p, 0));

                addPiece(new Piece(actX+2+3*j, bottom_y, one_p, 0)); //right
                addPiece(new Piece(actX+2+3*j, bottom_y-3, one_p, 0));
            }
            leftExitsPositions.push(actX+1);
            addInMapMap(leftExitPiecesPos, numVar, i, actX+1); //data needed in clauses

            actX += len_one_exit; //6 cells = two exits for one edge
            
            if( (i+1 < upc.length && upc[i] == upc[i+1]) ||
                 (i+1 < downc.length && downc[i] == downc[i+1])) { //propagate to handle multiple instances in same clause
                for(var j=0; j<classic_var_propagation_len; j++) { //must be even
                    addPiece(new Piece(actX+j, bottom_y, one_p, 0));
                    addPiece(new Piece(actX+j, bottom_y-3, one_p, 0));
                }
                actX += classic_var_propagation_len;
            }
        }

        for(var i=0; i<4; i++) //end of variable
            addPiece(new Piece(actX, bottom_y-i, one_p, 0));

        //close extra variables
        for(var i=upc.length; i<nExits; i++)
            closeVarInstance(getPiece(leftExitsPositions[i], bottom_y), 1);
        for(var i=downc.length; i<nExits; i++)
            closeVarInstance(getPiece(leftExitsPositions[i], bottom_y-3), -1);
        
        //gadget highlight
        highlight.push(actX - highlight[0] + 1); //complete data collection for this variable
        highlight.push(4);
        highlight.push(variableNodes[numVar].truthValue ? TRUE_VAR_COLOR : FALSE_VAR_COLOR);
        gadgetsHighlight.push(highlight);
        actX += 3; //space between variables
    }

    return actX;
}

function classicCrossoverGadget(x_left, y_left, dir) {
    addPiece(new Piece(x_left, y_left, twoadj_p, 0));
    addPiece(new Piece(x_left+1, y_left, twoadj_p, 0));
    addPiece(new Piece(x_left, y_left+dir, twoadj_p, 0));
    addPiece(new Piece(x_left+1, y_left+dir, twoadj_p, 0));
}

function classicHorPropGadget(x, y, dir) {
    addPiece(new Piece(x, y, one_p, 0));
    addPiece(new Piece(x+dir, y, one_p, 0));
}

function classicVerPropGadget(x, y, dir) {
    addPiece(new Piece(x, y, one_p, 0));
    addPiece(new Piece(x, y+dir, one_p, 0));
}

function generateClassicClauseGadgets() {
    var bottom_y = classicBottomVarsLine();
    for(var i=0; i<clauseNodes.length; i++) { //iterate clause
        var exits = [];
        var yvar = bottom_y + (clauseNodes[i].up ? 0 : -3);
        for(var j = 0; j<clauseNodes[i].adjVars.length; j++) { //collect left pieces for each exit
            var piece = getPiece(getMapMap(leftExitPiecesPos, clauseNodes[i].adjVars[j][0], clauseNodes[i].adjVars[j][1]), yvar);
            exits.push(piece);
        }
        generateClassicClause(exits, clauseNodes[i].level, (clauseNodes[i].up ? 1 : -1)); //build a single clause
    }
}

function generateClassicClause(exits, height, dir) {
    //create wires
    var len = 2 + (height - 1) * (classic_clause_height + 1);

    for(let e of exits) { //iterate variable exits
        var actY = e.y+dir;
        for(var l=0; l<len; l++) { //create wires for instance 'e'
            addPiece(new Piece(e.x, actY, one_p, 0));
            addPiece(new Piece(e.x+3, actY, one_p, 0));
            actY+=dir;
        }
        gadgetsHighlight.unshift([e.x, dir < 0 ? e.y+dir : e.y + len * dir, 4, len, EDGE_COLOR]);
    }

    gadgetsHighlight.push([exits[0].x, exits[0].y+dir*(len+1) + (dir < 0 ? 0 : classic_clause_height-1), exits[exits.length-1].x+4-exits[0].x, classic_clause_height, CLAUSE_COLOR]);
    
    //create actual clause
    if(exits.length == 1) { //1 variable in clause...
        addPiece(new Piece(exits[0].x, dir*len+exits[0].y+dir, one_p, 0));
        addPiece(new Piece(exits[0].x+3, dir*len+exits[0].y+dir, one_p, 0));
    }
    if(exits.length > 1) { //more than 1 variable
        //two bars at the top
        for(var i=0; i<5; i++) {
            var p = new Piece(i+exits[0].x, dir*len+exits[0].y+11*dir, one_p, 0);
            p.isBar = true;
            addPiece(p);
        }
        for(var i=0; i<5; i++) {
            var p = new Piece(9+i+exits[0].x, dir*len+exits[0].y+11*dir, one_p, 0);
            p.isBar = true;
            addPiece(p);
        }
        
        //connection to the bars
        
        //first variable
        for(var i=0; i<10; i++)
            addPiece(new Piece(exits[0].x, dir*len+exits[0].y+(i+1)*dir, one_p, 0));
        for(var i=0; i<5; i++)
            addPiece(new Piece(3+exits[0].x, dir*len+exits[0].y+(i+1)*dir, one_p, 0));
        addPiece(new Piece(4+exits[0].x, dir*len+exits[0].y+5*dir, one_p, 0));
        classicCrossoverGadget(5+exits[0].x, dir*len+exits[0].y+5*dir, dir); //crossover gadget
        classicHorPropGadget(7+exits[0].x, dir*len+exits[0].y+5*dir, 1); //propagate to bar
        classicVerPropGadget(9+exits[0].x, dir*len+exits[0].y+5*dir, dir);
        classicVerPropGadget(9+exits[0].x, dir*len+exits[0].y+7*dir, dir);
        classicVerPropGadget(9+exits[0].x, dir*len+exits[0].y+9*dir, dir);

        //second variable
        classicVerPropGadget(exits[1].x, dir*len+exits[1].y+dir, dir); //first leg
        var numHor = (exits[1].x - exits[0].x - 6) / 2;
        for(var i=0; i<numHor; i++)
            classicHorPropGadget(exits[1].x-1-2*i, dir*len+exits[1].y+2*dir, -1);
        classicVerPropGadget(exits[0].x + 6, dir*len+exits[1].y+3*dir, dir);

        classicVerPropGadget(exits[0].x + 6, dir*len+exits[1].y+7*dir, dir);
        classicHorPropGadget(exits[0].x + 5, dir*len+exits[1].y+8*dir, -1);
        classicVerPropGadget(exits[0].x + 4, dir*len+exits[1].y+9*dir, dir);

        classicVerPropGadget(3+exits[1].x, dir*len+exits[1].y+dir, dir); //second leg
        classicVerPropGadget(3+exits[1].x, dir*len+exits[1].y+3*dir, dir);
        numHor = (exits[1].x+3 - exits[0].x - 11) / 2;
        for(var i=0; i<numHor; i++)
            classicHorPropGadget(exits[1].x+2-2*i, dir*len+exits[1].y+4*dir, -1);
        for(var i=0; i<3; i++)
            classicVerPropGadget(exits[0].x + 11, dir*len+exits[1].y+5*dir+2*i*dir, dir);

        //third variable
        if(exits.length == 3) { //handle third connection   
            classicVerPropGadget(exits[2].x, dir*len+exits[1].y+dir, dir);
            classicVerPropGadget(exits[2].x+3, dir*len+exits[1].y+dir, dir);
            classicHorPropGadget(exits[2].x+3, dir*len+exits[1].y+3*dir, -1);
            classicCrossoverGadget(exits[2].x, dir*len+exits[1].y+3*dir, dir);

            //up leg
            for(var i=0; i<4; i++) 
                classicVerPropGadget(exits[2].x, dir*len+exits[1].y+5*dir+2*i*dir, dir);
            numHor = (exits[2].x-exits[0].x-3)/2;
            for(var i=0; i<numHor; i++)
                classicHorPropGadget(exits[2].x-2*i, dir*len+exits[1].y+13*dir, -1);
            classicVerPropGadget(exits[0].x+2, dir*len+exits[1].y+12*dir, dir);    

            //left leg
            classicHorPropGadget(exits[2].x-1, dir*len+exits[1].y+3*dir, -1);
            for(var i=0; i<3; i++)
                classicVerPropGadget(exits[2].x-3, dir*len+exits[1].y+3*dir+2*i*dir, dir);
            numHor = (exits[2].x-3-exits[0].x-13)/2;
            for(var i=0; i<numHor; i++)
                classicHorPropGadget(exits[2].x-4-2*i, dir*len+exits[1].y+8*dir, -1);
            classicVerPropGadget(exits[0].x+13, dir*len+exits[1].y+9*dir, dir);
        }
    }
}

//------- simulation -----

//find correct rotation for the piece
function classicFindPieceRotation(x, y) {
    if(getPiece(x, y).type == twoadj_p) 
        findRotationForCrossoverClassic(x, y);
    else //we can't find immediately rotation for 2adj pieces
        getPiece(x, y).rotation = findRotationClassic(getPiece(x, y));
}

function findRotationClassic(piece) {
    var inc = [[1, 0], [-1, 0], [0, 1], [0, -1]]; //possible increments

    if(piece.type == one_p) {
        var candidate = [];
        for(let e of inc)
            if(hasPiece(piece.x+e[0], piece.y+e[1])) {
                var neigh = getPiece(piece.x+e[0], piece.y+e[1]); //has at least one endpoint
                if(!neigh.used) //not used... we can match with it
                    candidate = neigh;
                else 
                    if(thereIsEndOnPoint(neigh, piece.x, piece.y)) { //we must satisfy this end
                        candidate = neigh;
                        break;
                    }
            }
        if(candidate.x > piece.x) return 270;
        if(candidate.x < piece.x) return 90;
        if(candidate.y > piece.y) return 0;
        if(candidate.y < piece.y) return 180;
    }

    if(piece.type == twosep_p) {
        for(let e of inc) 
            if(hasPiece(piece.x+e[0], piece.y+e[1]) && getPiece(piece.x+e[0], piece.y+e[1]).used)  //always exists (by construction)
                if(thereIsEndOnPoint(getPiece(piece.x+e[0], piece.y+e[1]), piece.x, piece.y)) //must satisfy this end
                    return piece.x != piece.x+e[0] ? 90 : 0;
                else  //must NOT satisfy this end
                    return piece.x != piece.x+e[0] ? 0 : 90;
    }
    return piece.rotation;
}

function findRotationForCrossoverClassic(x, y) {
    var crgadget = []; //find gadget's pieces (from top-left to bottom-right)
    for(var j=-1; j<=1; j++)
        for(var i=-1; i<=1; i++) //3x3 square enclosing
            if(hasPiece(x+i, y+j) && getPiece(x+i, y+j).type == twoadj_p) {
                crgadget.push([x+i, y+j]);
                if(getPiece(x+i, y+j).used) //gadget already used
                    return;
                getPiece(x+i, y+j).used = true;
                if(!getPiece(x+i, y+j).inQueue) {
                    getPiece(x+i, y+j).inQueue = true;
                    queue1.push([x+i, y+j]);
                }
            }
    var x1 = crgadget[0][0], y1 = crgadget[0][1];
    var x2 = crgadget[1][0], y2 = crgadget[1][1];
    var x3 = crgadget[2][0], y3 = crgadget[2][1];
    var x4 = crgadget[3][0], y4 = crgadget[3][1];

    var toSatisfy = []; //points that the crossover must satisfy (there will be max two of these, by construction)
    if((hasPiece(x1, y1-1) && getPiece(x1, y1-1).used && thereIsEndOnPoint(getPiece(x1, y1-1), x1, y1)) || (hasPiece(x3, y3+1) && getPiece(x3, y3+1).used && thereIsEndOnPoint(getPiece(x3, y3+1), x3, y3)))
        toSatisfy.push([x3, y3+1]);
    if((hasPiece(x2, y2-1) && getPiece(x2, y2-1).used && thereIsEndOnPoint(getPiece(x2, y2-1), x2, y2)) || (hasPiece(x4, y4+1) && getPiece(x4, y4+1).used && thereIsEndOnPoint(getPiece(x4, y4+1), x4, y4)))
        toSatisfy.push([x4, y4+1]);
    if((hasPiece(x1-1, y1) && getPiece(x1-1, y1).used && thereIsEndOnPoint(getPiece(x1-1, y1), x1, y1)) || (hasPiece(x2+1, y2) && getPiece(x2+1, y2).used && thereIsEndOnPoint(getPiece(x2+1, y2), x2, y2)))
        toSatisfy.push([x1-1, y1]);
    if((hasPiece(x3-1, y3) && getPiece(x3-1, y3).used && thereIsEndOnPoint(getPiece(x3-1, y3), x3, y3)) || (hasPiece(x4+1, y4) && getPiece(x4+1, y4).used && thereIsEndOnPoint(getPiece(x4+1, y4), x4, y4)))
        toSatisfy.push([x3-1, y3]);
    
    var old1r = getPiece(x1, y1).rotation, old2r = getPiece(x2, y2).rotation, old3r = getPiece(x3, y3).rotation, old4r = getPiece(x4, y4).rotation;

    if(toSatisfy.length == 0) { //0 to satisfy, make a circle
        getPiece(x1, y1).rotation = 0;
        getPiece(x2, y2).rotation = 90;
        getPiece(x3, y3).rotation = 270;
        getPiece(x4, y4).rotation = 180;
    }

    if(toSatisfy.length == 1) {
         //4 cases:
         if(toSatisfy[0][0] == x3) {
             getPiece(x1, y1).rotation = 270;
             getPiece(x2, y2).rotation = 90;
             getPiece(x3, y3).rotation = 0;
             getPiece(x4, y4).rotation = 180;
         }
         if(toSatisfy[0][0] == x4) {
            getPiece(x1, y1).rotation = 0;
            getPiece(x2, y2).rotation = 180;
            getPiece(x3, y3).rotation = 270;
            getPiece(x4, y4).rotation = 90;    
         }
         if(toSatisfy[0][0] == x3-1 && toSatisfy[0][1] == y1) {
            getPiece(x1, y1).rotation = 90;
            getPiece(x2, y2).rotation = 0;
            getPiece(x3, y3).rotation = 270;
            getPiece(x4, y4).rotation = 180;
         }
         if(toSatisfy[0][0] == x3-1 && toSatisfy[0][1] == y3) {
            getPiece(x1, y1).rotation = 0;
            getPiece(x2, y2).rotation = 90;
            getPiece(x3, y3).rotation = 180;
            getPiece(x4, y4).rotation = 270;
         }
    }

    if(toSatisfy.length == 2) {
        //4 cases:
        if(toSatisfy[0][0] == x3 && toSatisfy[1][1] == y1) {
            getPiece(x1, y1).rotation = getPiece(x4, y4).rotation = 180;
            getPiece(x2, y2).rotation = getPiece(x3, y3).rotation = 0;
        }
        if(toSatisfy[0][0] == x3 && toSatisfy[1][1] == y3) {
            getPiece(x1, y1).rotation = getPiece(x4, y4).rotation = 270;
            getPiece(x2, y2).rotation = getPiece(x3, y3).rotation = 90;
        }
        if(toSatisfy[0][0] == x4 && toSatisfy[1][1] == y3) {
            getPiece(x1, y1).rotation = getPiece(x4, y4).rotation = 0;
            getPiece(x2, y2).rotation = getPiece(x3, y3).rotation = 180;
        }
        if(toSatisfy[0][0] == x4 && toSatisfy[1][1] == y1) {
            getPiece(x1, y1).rotation = getPiece(x4, y4).rotation = 90;
            getPiece(x2, y2).rotation = getPiece(x3, y3).rotation = 270;
        }
    }

    return (old1r != getPiece(x1, y1).rotation || old2r != getPiece(x2, y2).rotation || old3r != getPiece(x3, y3).rotation || old4r != getPiece(x4, y4).rotation);
}

function classicAddNeighbors(x, y) {
    var inc = [[1, 0], [-1, 0], [0, 1], [0, -1]] //possible increments
    for(let e of inc) 
        if(hasPiece(x+e[0], y+e[1]) && !getPiece(x+e[0], y+e[1]).used && !getPiece(x+e[0], y+e[1]).inQueue) { //check if there is piece
            if(getPiece(x+e[0], y+e[1]).isBar) {
                if(!hasPiece(x+e[0]+1, y+e[1]) || !hasPiece(x+e[0]-1, y+e[1]) || getPiece(x, y).isBar) {
                    queue3.push([x+e[0], y+e[1]]);
                    getPiece(x+e[0], y+e[1]).inQueue = true; //we don't want to add the same piece multiple times
                }
            }
            else {
                if(getPiece(x+e[0], y+e[1]).type == twoadj_p)
                    queue2.push([x+e[0], y+e[1]]);
                else
                    queue1.push([x+e[0], y+e[1]]);
                getPiece(x+e[0], y+e[1]).inQueue = true; //we don't want to add the same piece multiple times
            }
        }
}
