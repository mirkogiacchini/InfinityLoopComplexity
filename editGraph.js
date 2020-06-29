var jqueryLoaded = false;

const square_size_px = 22; //20 //size of square grid
var variable_line = new Set() //contains variable blocks which are selected
var true_var_blocks = new Set() //which variable blocks are set to true?
var clause_lines = new Map() //clause blocks selected (x, offset_from_variable_line), x:key, the value is the list of offsets
var cv_joins = new Map() //(x, offset_clause) join between variable x and clause (x, offset_clause)

const CREATE_MODE = 0, DELETE_MODE = 1, SELECT_MODE = 2; //constants to remember the modes
var mode; //modality {create, delete, select}
var dragging; //dragging the mouse around?

var TRUE_VAR_COLOR = "#FFAC33";
var FALSE_VAR_COLOR = "#FF0000";
var CLAUSE_COLOR = "#19DA3A";
var EDGE_COLOR = "#1E2AA0";

function thereIsInMapSet(map, key, value) { //utility to handle a map of sets
	return map.has(key) && map.get(key).has(value);
}

function addToMapSet(map, key, value) { //utility to handle a map of sets
	if(!map.has(key)) map.set(key, new Set());
	map.get(key).add(value);	
}

function removeFromMapSet(map, key, value) { //utility to handle a map of sets
	if(!thereIsInMapSet(map, key, value)) return false;
	map.get(key).delete(value);
	if(map.get(key).size == 0)
		map.delete(key);
	return true;
}

function getSetSizeMp(map, key) { //utility to handle a map of sets
	if(!map.has(key)) return 0;
	return map.get(key).size;
}

function getGraphCanvas() {
	return document.getElementById("graphCanvas");
}

function getVariableY() {
	var ctx = getGraphCanvas().getContext("2d");
	return Math.floor(Math.floor(ctx.canvas.height / square_size_px) / 2);
}

function cleanCanvas(ctx) {
	ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
}

function canvasCoordinates(canvas, x, y) { //returns coordinate relative to the canvas
	var rect = canvas.getBoundingClientRect();
	x -= rect.left;
	y -= rect.top;
	return [x, y]
}

function getGridWidth(ctx, size) { //context and pixel size
	return Math.floor(ctx.canvas.width / size);
}

function getGridHeight(ctx, size) {
	return Math.floor(ctx.canvas.height / size);
}

function init() {
	var canvas = getGraphCanvas();
	dragging = false;
	//listeners for mouse on canvas
	canvas.addEventListener('mousedown', (e)=>{dragging=true, graphCanvasEditing(e)}, false);
	canvas.addEventListener('mousemove', graphCanvasEditing, false);
	canvas.addEventListener('mouseup', (e)=>{dragging=false, clicked(e)}, false);
	goInCreateMode();
	createDefaultGraph();
	drawGrid();
}

function drawGrid() { //draw grid on screen (this is not called constantly: it is called just when something has been modified)
	var ctx = getGraphCanvas().getContext("2d");
	ctx.lineWidth = 1;
	ctx.globalAlpha = 1;
	cleanCanvas(ctx);
	
	var ch = ctx.canvas.height, cw = ctx.canvas.width; //canvas width/height
	var w = Math.floor(cw / square_size_px); //matrix sizes
	var h = Math.floor(ch / square_size_px);

	var variable_axis = getVariableY();

	var joinaxis1 = variable_axis + 1;
	var joinaxis2 = variable_axis - 1;

	for(var i=0; i<w; i++) { //draw variable axis
		ctx.globalAlpha = 0.3;
		ctx.fillStyle = "#FF0000";
		ctx.fillRect(i*square_size_px, variable_axis*square_size_px, square_size_px, square_size_px); //x-y-w-h

		//join axis
		ctx.globalAlpha = 1;
		ctx.fillStyle = "#CCEEFF";
		ctx.fillRect(i*square_size_px, joinaxis1*square_size_px, square_size_px, square_size_px); //x-y-w-h
		ctx.fillRect(i*square_size_px, joinaxis2*square_size_px, square_size_px, square_size_px); //x-y-w-h
	}

	//grid lines
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
	
	//clauses
	ctx.globalAlpha = 1;
	for(let [key, elements] of clause_lines) 
		for(let elem of elements) {
			ctx.fillStyle = CLAUSE_COLOR; //draw clauses
			var x = key, y = variable_axis + elem;
			var xpx = x * square_size_px, ypx = y * square_size_px;
			ctx.fillRect(xpx, ypx, square_size_px, square_size_px);
			
			//border lines
			ctx.strokeStyle = "#000000";
			ctx.lineWidth = 2;
			drawLine(ctx, xpx, ypx, xpx + square_size_px, ypx);
			drawLine(ctx, xpx, ypx+square_size_px, xpx+square_size_px, ypx+square_size_px);
			if(!thereIsInMapSet(clause_lines, x-1, elem))
				drawLine(ctx, xpx, ypx, xpx, ypx + square_size_px);
			if(!thereIsInMapSet(clause_lines, x+1, elem))
				drawLine(ctx, xpx+square_size_px, ypx, xpx+square_size_px, ypx+square_size_px);
		}
	
	//selected variable blocks
	for(var i=0; i<w; i++) //draw variable axis
		if(variable_line.has(i)) {
			ctx.globalAlpha = 1;
			if(true_var_blocks.has(i)) //one color for true variables and another for false variables
				ctx.fillStyle = TRUE_VAR_COLOR;
			else
				ctx.fillStyle = FALSE_VAR_COLOR;
			var xpx = i * square_size_px, ypx = variable_axis * square_size_px;
			ctx.fillRect(xpx, ypx, square_size_px, square_size_px); //x-y-w-h
			
			//border lines
			ctx.strokeStyle = "#000000";
			ctx.lineWidth = 2;
			drawLine(ctx, xpx, ypx, xpx + square_size_px, ypx);
			drawLine(ctx, xpx, ypx+square_size_px, xpx+square_size_px, ypx+square_size_px);
			if(!variable_line.has(i-1))
				drawLine(ctx, xpx, ypx, xpx, ypx + square_size_px);
			if(!variable_line.has(i+1))
				drawLine(ctx, xpx+square_size_px, ypx, xpx+square_size_px, ypx+square_size_px);
		}
	
	ctx.fillStyle = EDGE_COLOR;
	ctx.globalAlpha = 0.5; //draw join-lines
	for(let [x, elements] of cv_joins)
		for(let elem of elements) {
			var dir = -elem / Math.abs(elem);
			for(var i=elem+dir; i!=0; i+=dir) {
				var xpx = x*square_size_px, ypx = (i+variable_axis)*square_size_px;
				ctx.fillRect(xpx, ypx, square_size_px, square_size_px);
				
				ctx.strokeStyle = "#000000";
				ctx.lineWidth = 2;
				drawLine(ctx, xpx, ypx, xpx, ypx + square_size_px);
				drawLine(ctx, xpx + square_size_px, ypx, xpx + square_size_px, ypx + square_size_px);
			}
		}
}

function numberVarsInClause(x, off) { //how many variables in the clause (x, off) ? (repetitions count)
	if(!thereIsInMapSet(clause_lines, x, off)) return 0;
	var count = 0;
	var ind = x;
	while(thereIsInMapSet(clause_lines, ind, off)) {
		if(thereIsInMapSet(cv_joins, ind, off))
			count++;
		ind++;
	}
	ind = x-1;
	while(thereIsInMapSet(clause_lines, ind, off)) {
		if(thereIsInMapSet(cv_joins, ind, off))
			count++;
		ind--;
	}
	return count;
}

function leftmostClauseAtXOffset(startX, offset) {
	while(existsInMapMap(clause_lines, startX, offset))
		startX--;
	return startX+1;
}

function lowestPositiveClauseOff(x) { //lowest positive clause at x (0 if there isn't) [returns offset]
	if(!clause_lines.has(x)) return 0;
	var ret = 0;
	for(let e of clause_lines.get(x)) 
		if(e > 0 && (ret == 0 || ret > e))
			ret = e;
	return ret;
}

function greatestNegativeClauseOff(x) { //greatest negative clause at x (0 if there isn't) [returns offset]
	if(!clause_lines.has(x)) return 0;
	var ret = 0;
	for(let e of clause_lines.get(x)) 
		if(e < 0 && (ret == 0 || ret < e))
			ret = e;
	return ret;
}

function joinIfPossible(cellx, celly) { //join clause to variable, if it is possible (coordinate of the cell from which to expand is needed)
	var vy = getVariableY();
	if(Math.abs(celly-vy) != 1 || !variable_line.has(cellx)) return false; //a neighbour cell of the variables must be clicked
	var dir = celly - vy;
	var off = dir > 0 ? lowestPositiveClauseOff(cellx) : greatestNegativeClauseOff(cellx);

	if(off == 0) return false;
	
	if(thereIsInMapSet(cv_joins, cellx, off) || numberVarsInClause(cellx, off) >= 3) 
		return false;
	addToMapSet(cv_joins, cellx, off);
	return true;
}

function removeOverlappingJoins(x, offset) { //remove joins that overlaps with the clause (x, offset)
	if(!cv_joins.has(x)) return false;
	var to_rem = []
	for(let e of cv_joins.get(x))
		if(offset * e > 0 && Math.abs(e) > Math.abs(offset))
			to_rem.push(e);
	for(let off of to_rem)
		removeFromMapSet(cv_joins, x, off);
}

function removeVariable(x) { //remove variable block x, and fix everything
	variable_line.delete(x);
	if(true_var_blocks.has(x))
		true_var_blocks.delete(x)
	if(cv_joins.has(x))
		cv_joins.delete(x);
}

function removeClause(x, off) { //remove clause (x, off)
	removeFromMapSet(clause_lines, x, off);
	if(thereIsInMapSet(cv_joins, x, off))
		removeFromMapSet(cv_joins, x, off);
}

function removeJoin(x, dir) { //remove join at x (positive or negative direction?)
	if(!cv_joins.has(x)) return false;
	var offToRem = 0;
	for(let e of cv_joins.get(x))
		if(e * dir > 0)
			offToRem = e;
	if(offToRem == 0) return false;
	removeFromMapSet(cv_joins, x, offToRem);
	return true;
}

//set state of the variable block (we don't check that it's actually a variable block)
function setVarBlockState(vx, state) {
	if(state)
		true_var_blocks.add(vx);
	else
		if(true_var_blocks.has(vx))
			true_var_blocks.delete(vx);
}

//set the state of variable vx to state
function setVariableState(vx, state) {
	var i = vx; //iterate all the blocks of the variable
	while(variable_line.has(i)) {
		setVarBlockState(i, state);
		i+=1;
	}
	i = vx;
	while(variable_line.has(i)) {
		setVarBlockState(i, state);
		i-=1;
	}
}

//true if there is at least one true block in the variable, false otherwise
function thereIsTrueBlock(vx) {
	var i = vx;
	while(variable_line.has(i)) {
		if(true_var_blocks.has(i))
			return true;
		i+=1;
	}
	i = vx;
	while(variable_line.has(i)) {
		if(true_var_blocks.has(i))
			return true;
		i-=1;
	}
	return false;
}

function graphCanvasEditing(event) {
	if(dragging) {
		var tmp = canvasCoordinates(getGraphCanvas(), event.clientX, event.clientY);
		var x = tmp[0], y = tmp[1];

		var cellx = Math.floor(x / square_size_px), celly = Math.floor(y / square_size_px);

		var maxCellx = Math.floor(getGraphCanvas().width / square_size_px), maxCelly = Math.floor(getGraphCanvas().height / square_size_px);
		if(cellx >= maxCellx || celly >= maxCelly || cellx < 0 || celly < 0)
			return;

		var vy = getVariableY();
		var offset = celly - vy;

		if(mode == CREATE_MODE) { //create mode... we can create new elements
			if(celly == vy && !variable_line.has(cellx)) { //variable line clicked
				variable_line.add(cellx);
				if(thereIsTrueBlock(cellx)) //if there is at least a true block in this variable, make all of them true
					setVariableState(cellx, true)
				drawGrid();
			}

			if(Math.abs(offset) > 1 && !thereIsInMapSet(clause_lines, cellx, offset)) { //empty clause cell clicked
				addToMapSet(clause_lines, cellx, offset);
				removeOverlappingJoins(cellx, offset); //when inserting a clause, it may overlap with pre-existing joins... in that case we remove the joins
				drawGrid();
			}

			if(Math.abs(offset) == 1 && joinIfPossible(cellx, celly)) //trying to join a variable to a clause
				drawGrid();
		}
		
		if(mode == DELETE_MODE) { //delete mode... we can remove existing elements
			if(offset == 0 && variable_line.has(cellx)) { //variable (removes connections too, if needed)
				removeVariable(cellx);
				drawGrid();
				return;
			}
			if(thereIsInMapSet(clause_lines, cellx, offset)) { //remove a clause block (removes connections too, if needed)
				removeClause(cellx, offset);
				drawGrid();
				return;
			}
			if( (offset > 0 && lowestPositiveClauseOff(cellx) > offset) || //just connection
				(offset < 0 && greatestNegativeClauseOff(cellx) < offset) ) {
				if(removeJoin(cellx, offset > 0 ? 1 : -1))
					drawGrid();
			}
		}
	}
}

//clicked on canvas
function clicked(event) {
	var tmp = canvasCoordinates(getGraphCanvas(), event.clientX, event.clientY);
	var x = tmp[0], y = tmp[1];
	if(x >= getGraphCanvas().width || x < 0 || y < 0 || y >= getGraphCanvas().height)
		return;

	var cellx = Math.floor(x / square_size_px), celly = Math.floor(y / square_size_px);
	var vy = getVariableY();

	if(mode == SELECT_MODE) { //select mode: we can select variables to be set to true (or false)
		if(celly == vy && variable_line.has(cellx)) { //we clicked on a variable
			//toggle all the variable blocks
			state = true_var_blocks.has(cellx) ? false : true; //what state should the variable assume? (if the block was true, now we want them false and vice versa)
			setVariableState(cellx, state);
			drawGrid();
		}
	}
}

function goInCreateMode() {
	mode = CREATE_MODE;
	document.getElementById("create_button").disabled = true;
	document.getElementById("delete_button").disabled = false;
	document.getElementById("select_button").disabled = false;
}

function goInDeleteMode() {
	mode = DELETE_MODE;
	document.getElementById("create_button").disabled = false;
	document.getElementById("delete_button").disabled = true;
	document.getElementById("select_button").disabled = false;
}

function goInSelectMode() {
	mode = SELECT_MODE;
	document.getElementById("create_button").disabled = false;
	document.getElementById("delete_button").disabled = false;
	document.getElementById("select_button").disabled = true;
}

//create a default graph
function createDefaultGraph() {
	var vy = getVariableY();
	for(var i=0; i<15; i++)
		if((i+1)%4 != 0)
			variable_line.add(i + 25);
	for(var i=27; i<=33; i++)
		addToMapSet(clause_lines, i, 4 - vy);
	for(var i=25; i<=37; i++)
		addToMapSet(clause_lines, i, 2 - vy);
	for(var i=31; i<=37; i++)
		addToMapSet(clause_lines, i, 10 - vy);
	for(var i=27; i<=39; i++)
		addToMapSet(clause_lines, i, 12 - vy);
	
	addToMapSet(cv_joins, 25, 2 - vy);
	addToMapSet(cv_joins, 35, 2 - vy);
	addToMapSet(cv_joins, 37, 2 - vy);
	addToMapSet(cv_joins, 27, 4 - vy);
	addToMapSet(cv_joins, 30, 4 - vy);
	addToMapSet(cv_joins, 33, 4 - vy);
	addToMapSet(cv_joins, 31, 10 - vy);
	addToMapSet(cv_joins, 34, 10 - vy);
	addToMapSet(cv_joins, 37, 10 - vy);
	addToMapSet(cv_joins, 27, 12 - vy);
	addToMapSet(cv_joins, 29, 12 - vy);
	addToMapSet(cv_joins, 39, 12 - vy);

	for(var i=29; i<=31; i++) 
		true_var_blocks.add(i);
	for(var i=37; i<=39; i++)
		true_var_blocks.add(i);
}

//utilities to extract information

function clausesLevelsInGraph() { //all different offset for clauses
    var tmp = new Set()
    for(let [k, e] of clause_lines)
        tmp = new Set([...tmp, ...e]);
    return tmp;
}

function negativeClausesLevelsInGraph() { //all different negative offsets for clauses
    var all = clausesLevelsInGraph();
    var pos = new Set();
    for(let e of all)
        if(e < 0)
            pos.add(e);
    return pos;
}

function numberExitsNextVariable(start, maxInd) { //returns number of exits needed for the next variable (and index to start looking for the next one)
    var first = -1;
    var nUp = 0, nDown = 0;
    for(var i=start; i<maxInd+2; i++) {
        if(variable_line.has(i)) {
            if(first == -1) first = i;
			if(cv_joins.has(i))
				for(let e of cv_joins.get(i))
					if(e < 0)
						nDown++;
					else
						nUp++;
		}
		else
			if(first != -1)
				return [Math.max(nUp, nDown), i];
    }
    return [-1, -1];
}

//returns the exits set, not just the number of exits
//WARNING: don't do len(exitsNextVariable) to get number of exits, because it contains both negative and postive exits
function exitsNextVariable(start, maxInd) {
	var first = -1;
	var ret = [];
    for(var i=start; i<maxInd+2; i++) {
        if(variable_line.has(i)) {
            if(first == -1) first = i;
			if(cv_joins.has(i))
				for(let e of cv_joins.get(i))
					ret.push([i, e]);
		}
		else
			if(first != -1)
				return [ret, i];
    }
    return [[], -1];
}

function startOfClause(x, offset) {
	while(thereIsInMapSet(clause_lines, x, offset))
		x--;
	return x+1;
}

function sameClause(x1, offset1, x2, offset2) {
	if(offset1 != offset2)
		return false;
	return startOfClause(x1, offset1) == startOfClause(x2, offset2);
}

//return the truth state of the next variable (starting at 'start')
function stateOfNextVariable(start, maxInd) {
	for(var i=start; i<maxInd+2; i++)
		if(variable_line.has(i))
			return true_var_blocks.has(i); 
	return false;
}

function getSortedJoins() { //returns joins sorted by x
	var j = []
	for(let [x, s] of cv_joins)
		for(let y of s)
			j.push([x, y]);
	j.sort(function(a, b) {return a[0] - b[0];}); 
	return j;
}

function addInMapMap(mp, x, y, v) {
	if(!mp.has(x)) mp.set(x, new Map());
	mp.get(x).set(y, v);
}

function existsInMapMap(mp, x, y) {
	if(!mp.has(x)) return false;
	return mp.get(x).has(y);
}

function deleteInMapMap(mp, x, y) {
	if(existsInMapMap(mp, x, y)) {
		mp.get(x).delete(y);
		if(mp.get(x).size == 0)
			mp.delete(x);
	}
}

function getMapMap(mp, x, y) {
	if(!existsInMapMap(mp, x, y)) return null;
	return mp.get(x).get(y);
}

function exitsOfNextClause(offset, actInd) { //returns the exits of the next clause starting from actInd (gives also the index to start looking for the second next clause)
	var maxInd = getGridWidth(getGraphCanvas().getContext("2d"), square_size_px);
	var first = -1;
	var ret = []
	for(var i=actInd; i<maxInd+2; i++) {
		if(thereIsInMapSet(clause_lines, i, offset)) {
			if(first == -1) first = i;
			if(thereIsInMapSet(cv_joins, i, offset))
				ret.push(i);
		}
		else
			if(first != -1) 
				return [ret, i];
	}
	return [null, -1];
}

function drawLine(ctx, x1, y1, x2, y2) {
	ctx.beginPath();
	ctx.moveTo(x1, y1); 
	ctx.lineTo(x2, y2);
	ctx.stroke();
}

function clearGraph() {
	variable_line = new Set() //contains variable blocks which are selected
	true_var_blocks = new Set() //which variable blocks are set to true?
	clause_lines = new Map() //clause blocks selected (x, offset_from_variable_line), x:key, the value is the list of offsets
	cv_joins = new Map()
	drawGrid();
}

//-------optimize the graph to create a smaller infinity loop's grid----
function optimizeLevel() {
	var offsets = [...clausesLevelsInGraph()]; //all clauses levels
	offsets.sort(function(x, y){
		if(x * y < 0 || (x < 0 && y < 0))
			return x-y;
		return y-x;
	});

	for(let lvl of offsets) { //remove useless clause blocks
		var ind = 0;
		while(ind != -1) { //iterate clauses
			var ret = exitsOfNextClause(lvl, ind);
			ind = ret[1];
			if(ind != -1) {
				var exits = ret[0];
				var l = exits[0]-1;
				var r = exits[exits.length-1]+1;
				while(thereIsInMapSet(clause_lines, l, lvl)) {
					removeFromMapSet(clause_lines, l, lvl);
					l--;
				}
				while(thereIsInMapSet(clause_lines, r, lvl)) {
					removeFromMapSet(clause_lines, r, lvl);
					r++;					
				}
			}
		}
	}

	//remove useless clause levels
	for(o=0; o < offsets.length-1; o++) {
		if( (offsets[o] < 0 && offsets[o+1] < 0) || (offsets[o] > 0 && offsets[o+1] > 0) ) {  
			var ind = 0;
			while(ind != -1) { //iterate clauses
				var ret = exitsOfNextClause(offsets[o], ind);
				ind = ret[1];
				if(ind != -1) {
					var good = true;
					for(var j=ret[0][0]-1; j<=ret[0][ret[0].length-1]+1; j++)
						if(thereIsInMapSet(clause_lines, j, offsets[o+1]))
							good = false;
					if(good) {
						for(var j=ret[0][0]; j<=ret[0][ret[0].length-1]; j++) { //move clause blocks
							removeFromMapSet(clause_lines, j, offsets[o]);
							addToMapSet(clause_lines, j, offsets[o+1]);
						}
						for(let e of ret[0]) { //move joins
							removeFromMapSet(cv_joins, e, offsets[o]);
							addToMapSet(cv_joins, e, offsets[o+1]);
						}
					}
				}
			}
		}
	}

	drawGrid();
}