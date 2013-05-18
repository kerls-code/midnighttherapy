
teleports_map = {
  '1': '!',
  '2': '@',
  '3': '#',
  '4': '$',
  '5': '%',
  '6': '^',
  '7': '&',
  '8': '*',
  '9': '(',
  '0': ')',
}

TYPE_MAP = {
    'a': 'A',
    'b': 'B',
    'c': 'C',
    'd': 'D',
    'e': 'E',
    's': 's',
    'f': 't',
    'r': 'X',
    't': '1',
    'u': '!',
    'm': '2',
    'n': '@',
    'g': '3',
    'h': '#',
    'i': '4',
    'j': '$',
    'k': '5',
    'l': '%',
}

function parse_blocks(blocksstring) {
  var blocks = {};
  var str_blocks = blocksstring.split('.');
  for (var k in str_blocks) {
    var block = str_blocks[k];
    if (str_blocks[k]) {
      var x = parseInt(block.split(',')[0]);
      var y = parseInt(block.split(',')[1]);
      blocks['[' + (x-1) + ',' + y + ']'] = true;
    }
  }
  return blocks;
}

function parse_board(code) {
    var head = code.split(':')[0];
    var body = code.split(':')[1];
    
    var head = head.split('.');
    var dims = head[0].split('x');
    var width = parseInt(dims[0], 10);
    var height = parseInt(dims[1], 10);
    if (head[1][0] != 'c') {console.log('head[1][0] was ' + head[1][0] + ' expected c');}
    var targets = parseInt(head[1].slice(1), 10);
    if (head[2][0] != 'r') {console.log('head[2][0] was ' + head[2][0] + ' expected r');}
    if (head[3][0] != 'w') {console.log('head[3][0] was ' + head[3][0] + ' expected w');}
    //if (board['walls'] != parseInt(head[3].slice(1))) {console.log('board.walls is different from walls in header');}
    if (head[4][0] != 't') {console.log('head[4][0] was ' + head[4][0] + ' expected t');}
    
    var teleports = parseInt(head[4].slice(1), 10)
    
    var data = new Array();
    for (i = 0; i < height; i++) {
        var row = new Array();
        for (j = 0; j < width; j++) {
            row.push(' ');
        }
        data.push(row);
    }
    
    var i = -1;
    var j = width - 1;
    var body_split = body.split('.').slice(0, -1);
    
    for (var k = 0; k < body_split.length; k++) {
        var item = body_split[k];
        for (var l = 0; l < parseInt(item.slice(0, -1), 10) + 1; l++) {
            j += 1;
            if (j >= width) {
                j = 0;
                i += 1;
            }
        }
        var type = item[item.length - 1];
        if (!TYPE_MAP.hasOwnProperty(type)) {console.log('Unexpected type ' + type);}
        data[i][j] = TYPE_MAP[type];
    }
    //board['data'] = [''.join(row) for row in data]
    //board['data'] = new Array();
    //return board
    return data;
}


function Graph(board) {
  
  var self  = {};

  self.board = board;
  self.n = board.length;
  self.m = board[0].length;

  var boardstuff = {};
  // Note that these lists start from top-left and go right, then down
  // In particular, starts and finishes are ordered top to bottom
  for (i = 0; i < self.n; i++) {
    for (j = 0; j < self.m; j++) {
      var stuff = self.board[i][j];
      if (stuff != ' ') {
        if (boardstuff.hasOwnProperty(stuff)) {
          boardstuff[stuff].push([i, j]);
        } else {
          boardstuff[stuff] = [[i, j]]
        }
      }
    }
  }

  self.milestones = []; // list of lists of intermediate targets, including starts and ends
  self.milestones.push(boardstuff['s']);

  var letters = ['A', 'B', 'C', 'D', 'E'];
  for (var i = 0; i < 5; i++) {
    var letter = letters[i];
    if (!(boardstuff.hasOwnProperty(letter))) {
      break;
    }
    self.milestones.push(boardstuff[letter]);
  }
  self.milestones.push(boardstuff['t']);

  self.teleports = {};
  var d = 1
  while (boardstuff.hasOwnProperty('' + d)) {
    if ( boardstuff['' + d].length != 1) {console.log("LENGTH SHOULDVE BEEN 1 FOR TELEPORT " + d);}
    self.teleports[JSON.stringify(boardstuff['' + d][0])] = boardstuff[teleports_map['' + d]];
    d+=1;
  }
        
/////////
  self.can_place = function(i, j) {
    return (this.board[i][j] == ' ');
  }


  self.get = function(block) {
    return this.board[block[0]][block[1]];
  }

  self.get_neighbors = function(blocks, u) {
    if (u == null) { //# invisible 'meta-start' vertex
      return this.milestones[0].slice(0); // return the start vertices
    }
    var x = u[0];
    var y = u[1];
    var neighbors = [];
    // order here is important, as per pathery rules
    var ds =  [[-1, 0], [0, 1], [1, 0], [0, -1]];
    for (var i = 0; i < 4; i++) {
      var dx = ds[i][0];
      var dy = ds[i][1];
      var xp = x + dx;
      var yp = y + dy;
      if (((0 <= xp) && (xp < this.n)) && ((0 <= yp) && (yp < this.m))) {
        if ((! blocks.hasOwnProperty(JSON.stringify([xp, yp]))) && (['X', 'x', '*'].indexOf(this.board[xp][yp]) == -1)) {
          neighbors.push([xp, yp]);
        }
      }
    }
    return neighbors;
  }

  self.teleport = function(block, used_teleports) {
    var stuff = this.get(block);
    if ( teleports_map.hasOwnProperty(stuff) ) {
      if (!(used_teleports.hasOwnProperty(JSON.stringify(block)))) {
        used_teleports[JSON.stringify(block)] = true;
        return this.teleports[JSON.stringify(block)]
      }
    }
    return null;
  }

  return self;
}

function BFS(graph, // graph description, as an array
             blocks, // currently placed blocks
             source, // source vertex
             targets // set of target vertices
            ) {
  parent_dict = {};
  parent_dict[JSON.stringify(source)] = null;
  var queue = [source];

  var get_path = function(v){
    var path = [];
    while (v !== null) {
      path.push(v);
      v = parent_dict[JSON.stringify(v)];
    }
    reversed_path = [];
    for (var i = 0; i < path.length; i ++ ) {
      reversed_path.push(path[path.length - 1 - i]);
    }
    return reversed_path
  }

  while (queue.length > 0) {
    var newqueue = []
    for (var i = 0; i < queue.length; i++) {
      var u = queue[i];
      var neighbors = graph.get_neighbors(blocks, u);
      for (var k = 0; k < neighbors.length; k++) {
        var v = neighbors[k];
        if (!parent_dict.hasOwnProperty(JSON.stringify(v))) {
          newqueue.push(v)
          parent_dict[JSON.stringify(v)] = u;
        }
        if (targets.hasOwnProperty(JSON.stringify(v))) {
          return get_path(v);
        }
      }
    }
    queue = newqueue;
  }
  return null;
}

function find_full_path(graph, blocks ){
                   
  var used_teleports = {};
  var index = 0;
  var fullpath = new Array();
  var cur = null;

  while (index < graph.milestones.length - 1) {
    var best_path = null;
    var target_dict = {};
    for (var i in graph.milestones[index+1]) {
      var target = graph.milestones[index+1][i];
      target_dict[JSON.stringify(target)] = true;
    }
    var path = BFS(graph, blocks, cur, target_dict);
    if ((best_path == null)  || ((path != null) && (path.length < best_path.length))) {
      best_path = path;
    }
    if (best_path == null) {
      return [null, -Number.MAX_VALUE];
    }
    var out_blocks = null;

    var path_blocks = best_path.slice((index == 0 ? 0 : 1));
    for (var k in path_blocks) {
      var block = path_blocks[k];
      fullpath.push(block);
      var out_blocks = graph.teleport(block, used_teleports);
      if (out_blocks != null) {
        cur = out_blocks[0];
        fullpath.push(cur);
        if (out_blocks.length > 1) {
          // TODO: MULTIPLE OUTS
          console.log("CAN'T DEAL WITH MULTIPLE OUTS YET");
        }
        break;
      }
    }
    if (out_blocks == null) {
      index += 1;
      cur = block;
    }
  }

  var solution_length = fullpath.length - 1;
  for (var k in used_teleports) {
    if (used_teleports.hasOwnProperty(k)) {
      solution_length -=1;
    }
  }
  return [fullpath, solution_length ];
}


var bm_values = {};
var bm_old_old_solution = null;
var bm_old_solution = null;

function draw_single_value(mapid, i, j, value, css) {
    if (Math.abs(value) > 200000000) {
      value = '';
    }
    var elt = $('[id="child_' + mapid + ',' + (i+1) + ',' + j + '"]');
    for (var attr in css) {
      if (css.hasOwnProperty(attr)) {
        elt.css(attr, css[attr]);
      }
    }
    elt.text(value);
    bm_values[JSON.stringify([i,j])] = value;
}

function draw_values() {
    bm_mapid = parseInt($('.shown-maps .grid_outer').attr('id').split(',')[0]);

    if (bm_old_solution == solution[bm_mapid]) {
      return;
    } else if (bm_old_old_solution != bm_old_solution) {
      bm_old_old_solution = bm_old_solution;
      return;
    }
    bm_old_old_solution = bm_old_solution;
    bm_old_solution = solution[bm_mapid];

    bm_board= parse_board(mapdata[bm_mapid].code);
    bm_graph = Graph(bm_board);
    //BFS(bm_graph, {}, null, {'[2,2]':true})

    bm_current_blocks = parse_blocks(solution[bm_mapid]);
    bm_solution = find_full_path(bm_graph, bm_current_blocks);

    bm_solution_path = bm_solution[0];
    bm_solution_value = bm_solution[1];

    //var t = new Date().getTime();
    //console.log("TIME ELAPSED")
    //console.log(new Date().getTime() - t)
    if (!$('#' + bm_mapid + 'client_score').length) {
      var my_score = $('<span id="' + bm_mapid + 'client_score"></span>');
      $('[id="' + bm_mapid + ',dspbl"]').append(my_score);
    }
    $('#' + bm_mapid + 'client_score').text(bm_solution_value + ' moves');

    
    //console.log("bm_current_blocks", bm_current_blocks);
    //console.log("fullpath, length", bm_solution_path);
    //console.log(bm_current_blocks)
    
    for (var i in bm_board) {
        i = parseInt(i);
        for (var j in bm_board[i]) {
            j = parseInt(j);
            if (bm_graph.get([i,j]) == ' ') {
                var blockstring = JSON.stringify([i, j]);
                var value;
                var diff;
                var css;
                if (blockstring in bm_current_blocks) {
                    delete bm_current_blocks[blockstring];
                    value = find_full_path(bm_graph, bm_current_blocks)[1];
                    diff = bm_solution_value - value;
                    bm_current_blocks[blockstring] = true;
                    css = {'color': 'white',
                           'text-align': 'center'
                          };
                } else {
                    bm_current_blocks[blockstring] = true;
                    value = find_full_path(bm_graph, bm_current_blocks)[1];
                    diff = value - bm_solution_value;
                    delete bm_current_blocks[blockstring];
                    css = {'color': 'black',
                           'text-align': 'center'
                          };
                }
                draw_single_value(bm_mapid, i, j, diff, css);
            }
        }
    }
}

var interval_var;

function bm_toggle() {
  if (interval_var) {
    clearInterval(interval_var);
    interval_var = null;
    $('.map .child').text('');
    $('#bm_button').text('Turn bookmarklet on')
  } else {
    interval_var = setInterval(draw_values, 1000);
    $('#bm_button').text('Turn bookmarklet off')
  }
}


$(document).ready(function() {
  var my_button;
  if ($('#bm_button').length == 0) {
    my_button = $('<button id="bm_button">Turn bookmarklet on</button>');
    $('#difficulties').append(my_button);
    my_button.click(bm_toggle);
    bm_toggle();
  }
  
});
