var treeDataOriginal;
var treeData;

var links;

// Calculate total nodes, max label length
var totalNodes = 0;
var maxLabelLength = 0;
// variables for drag/drop
var selectedNode = null;
var draggingNode = null;
// panning variables
var panSpeed = 200;
var panBoundary = 20; // Within 20px from edges will pan when dragging.
// Misc. variables
var i = 0;
var duration = 750;
var root;

// size of the diagram
var viewerWidth = 0;
var viewerHeight = 0;

var tree = d3.layout.tree()
    .size([viewerHeight, viewerWidth]);

// define a d3 diagonal projection for use by the node paths later on.
var diagonal = d3.svg.diagonal()
    .projection(function(d) {
        return [d.y, d.x];
    });

// define the zoomListener which calls the zoom function on the "zoom" event constrained within the scaleExtents
var zoomListener = d3.behavior.zoom().scaleExtent([0.01, 5]).on("zoom", zoom);
// define the baseSvg, attaching a class for styling and the zoomListener
var baseSvg;
// Append a group which holds all nodes and which the zoom Listener can act upon.
var svgGroup;


var activeRootNode;


function initialise() {

    // Get JSON data
    d3.csv("wbs.csv", function(data){
    			var tree = DataStructures.Tree.createFromFlatTable(data);
    					treeData = tree.toSimpleObject(function(objectToDecorate, originalNode) {
    								objectToDecorate.size = originalNode.size;
    								if (objectToDecorate.children && objectToDecorate.children.length == 0) {
    										delete objectToDecorate.children;
    								}
    								return objectToDecorate;
    					});
          //go
          initialise2();

    });
}

function initialise2() {

  // size of the diagram
  viewerWidth = $(document).width();
  viewerHeight = $(document).height();


  if(document.getElementById('treeGraph'))
  {
    //if the svg already exists then...
    // define the baseSvg, attaching a class for styling and the zoomListener
    baseSvg
        .attr("width", viewerWidth)
        .attr("height", viewerHeight)
        .attr("class", "overlay")
        .attr("id", "treeGraph")
        .call(zoomListener);
  }
  else
  {
    //if the svg does not yet exist then...

      // Call visit function to establish maxLabelLength
      visit(treeData, function(d) {
          totalNodes++;
          var nodeLabelDetails = d.shortCode + " :: " + d.name;
          var labelLength = nodeLabelDetails.length;
          if(labelLength > 70) {
            labelLength = 70;
          }
          maxLabelLength = Math.max(labelLength, maxLabelLength);

      }, function(d) {
          return d.children && d.children.length > 0 ? d.children : null;
      });

      // Sort the tree initially incase the JSON isn't in a sorted order.
      sortTree();

      // define the baseSvg, attaching a class for styling and the zoomListener
      baseSvg = d3.select("#tree-container").append("svg")
          .attr("width", viewerWidth)
          .attr("height", viewerHeight)
          .attr("class", "overlay")
          .attr("id", "treeGraph")
          .call(zoomListener);

      // Append a group which holds all nodes and which the zoom Listener can act upon.
      svgGroup = baseSvg.append("g");

      // Define the root
      root = treeData;
      root.x0 = viewerHeight / 2;
      root.y0 = 0;

      // Layout the tree initially and center on the root node.
      //collapse all children
      root.children.forEach(collapse);
      //collapse(root);
      update(root);
      centerNodeMiddle(root,zoomListener.scale());
  }
}


// A recursive helper function for performing some setup by walking through all nodes

function visit(parent, visitFn, childrenFn) {
    if (!parent) return;

    visitFn(parent);

    var children = childrenFn(parent);
    if (children) {
        var count = children.length;
        for (var i = 0; i < count; i++) {
            visit(children[i], visitFn, childrenFn);
        }
    }
}


// sort the tree according to the node names
function sortTree() {
    tree.sort(function(a, b) {
        return b.name.toLowerCase() < a.name.toLowerCase() ? 1 : -1;
    });
}


//Pan function, can be better implemented???
function pan(domNode, direction) {
    var speed = panSpeed;
    if (panTimer) {
        clearTimeout(panTimer);
        translateCoords = d3.transform(svgGroup.attr("transform"));
        if (direction == 'left' || direction == 'right') {
            translateX = direction == 'left' ? translateCoords.translate[0] + speed : translateCoords.translate[0] - speed;
            translateY = translateCoords.translate[1];
        } else if (direction == 'up' || direction == 'down') {
            translateX = translateCoords.translate[0];
            translateY = direction == 'up' ? translateCoords.translate[1] + speed : translateCoords.translate[1] - speed;
        }
        scaleX = translateCoords.scale[0];
        scaleY = translateCoords.scale[1];
        scale = zoomListener.scale();
        svgGroup.transition().attr("transform", "translate(" + translateX + "," + translateY + ")scale(" + scale + ")");
        d3.select(domNode).select('g.node').attr("transform", "translate(" + translateX + "," + translateY + ")");
        zoomListener.scale(zoomListener.scale());
        zoomListener.translate([translateX, translateY]);
        panTimer = setTimeout(function() {
            pan(domNode, speed, direction);
        }, 50);
    }
}

// Define the zoom function for the zoomable tree

function zoom() {
    svgGroup.attr("transform", "translate(" + d3.event.translate + ")scale(" + d3.event.scale + ")");
}



function initiateDrag(d, domNode) {
    draggingNode = d;
    d3.select(domNode).select('.ghostCircle').attr('pointer-events', 'none');
    d3.selectAll('.ghostCircle').attr('class', 'ghostCircle show');
    d3.select(domNode).attr('class', 'node activeDrag');

    svgGroup.selectAll("g.node").sort(function(a, b) { // select the parent and sort the path's
        if (a.id != draggingNode.id) return 1; // a is not the hovered element, send "a" to the back
        else return -1; // a is the hovered element, bring "a" to the front
    });
    // if nodes has children, remove the links and nodes
    if (nodes.length > 1) {
        // remove link paths
        links = tree.links(nodes);
        nodePaths = svgGroup.selectAll("path.link")
            .data(links, function(d) {
                return d.target.id;
            }).remove();
        // remove child nodes
        nodesExit = svgGroup.selectAll("g.node")
            .data(nodes, function(d) {
                return d.id;
            }).filter(function(d, i) {
                if (d.id == draggingNode.id) {
                    return false;
                }
                return true;
            }).remove();
    }

    // remove parent link
    parentLink = tree.links(tree.nodes(draggingNode.parent));
    svgGroup.selectAll('path.link').filter(function(d, i) {
        if (d.target.id == draggingNode.id) {
            return true;
        }
        return false;
    }).remove();

    dragStarted = null;
}




// Define the drag listeners for drag/drop behaviour of nodes.
dragListener = d3.behavior.drag()
    .on("dragstart", function(d) {
        if (d == root) {
            return;
        }
        dragStarted = true;
        nodes = tree.nodes(d);
        d3.event.sourceEvent.stopPropagation();
        // it's important that we suppress the mouseover event on the node being dragged. Otherwise it will absorb the mouseover event and the underlying node will not detect it d3.select(this).attr('pointer-events', 'none');
    })
    .on("drag", function(d) {
        if (d == root) {
            return;
        }
        if (dragStarted) {
            domNode = this;
            initiateDrag(d, domNode);
        }

        // get coords of mouseEvent relative to svg container to allow for panning
        relCoords = d3.mouse($('svg').get(0));
        if (relCoords[0] < panBoundary) {
            panTimer = true;
            pan(this, 'left');
        } else if (relCoords[0] > ($('svg').width() - panBoundary)) {

            panTimer = true;
            pan(this, 'right');
        } else if (relCoords[1] < panBoundary) {
            panTimer = true;
            pan(this, 'up');
        } else if (relCoords[1] > ($('svg').height() - panBoundary)) {
            panTimer = true;
            pan(this, 'down');
        } else {
            try {
                clearTimeout(panTimer);
            } catch (e) {

            }
        }

        d.x0 += d3.event.dy;
        d.y0 += d3.event.dx;
        var node = d3.select(this);
        node.attr("transform", "translate(" + d.y0 + "," + d.x0 + ")");
        updateTempConnector();
    }).on("dragend", function(d) {
        if (d == root) {
            return;
        }
        domNode = this;

        var tempSelectedNode = selectedNode;

        if (tempSelectedNode) {
            //check with the user that they really meant to re-model the relationship
            if (confirm("Are you sure that you want to permenantly update this relationship?") == true) {
                // now remove the element from the parent, and insert it into the new elements children
                var index = draggingNode.parent.children.indexOf(draggingNode);

                if (index > -1) {
                    draggingNode.parent.children.splice(index, 1);
                }

                if (typeof tempSelectedNode.children !== 'undefined' || typeof tempSelectedNode._children !== 'undefined') {
                    if (typeof tempSelectedNode.children !== 'undefined') {
                        tempSelectedNode.children.push(draggingNode);
                    } else {
                        tempSelectedNode._children.push(draggingNode);
                    }
                } else {
                    tempSelectedNode.children = [];
                    tempSelectedNode.children.push(draggingNode);
                }
                // Make sure that the node being added to is expanded so user can see added node is correctly moved
                expandOneLevel(tempSelectedNode);
                sortTree();
                //reset to null
                tempSelectedNode = null;
            }
            endDrag();

        } else {
            endDrag();
        }
    });

function endDrag() {
    selectedNode = null;
    d3.selectAll('.ghostCircle').attr('class', 'ghostCircle');
    d3.select(domNode).attr('class', 'node');
    // now restore the mouseover event or we won't be able to drag a 2nd time
    d3.select(domNode).select('.ghostCircle').attr('pointer-events', '');
    updateTempConnector();
    if (draggingNode !== null) {
        update(root);
        centerNodeMiddle(draggingNode,zoomListener.scale());
        draggingNode = null;
    }
}

// Helper functions for collapsing and expanding nodes.

function collapse(d) {
    if (d.children) {
        d._children = d.children;
        d._children.forEach(collapse);
        d.children = null;
    }
}

function expand(d) {
    if (d._children) {
        d.children = d._children;
        d.children.forEach(expand);
        d._children = null;
    }
}

function expandOneLevel(d) {
    if (d._children) {
        d.children = d._children;
        d._children = null;
    }
}

var overCircle = function(d) {
    selectedNode = d;
    updateTempConnector();
};
var outCircle = function(d) {
    selectedNode = null;
    updateTempConnector();
};

// Function to update the temporary connector indicating dragging affiliation
var updateTempConnector = function() {
    var data = [];
    if (draggingNode !== null && selectedNode !== null) {
        // have to flip the source coordinates since we did this for the existing connectors on the original tree
        data = [{
            source: {
                x: selectedNode.y0,
                y: selectedNode.x0
            },
            target: {
                x: draggingNode.y0,
                y: draggingNode.x0
            }
        }];
    }
    var link = svgGroup.selectAll(".templink").data(data);

    link.enter().append("path")
        .attr("class", "templink")
        .attr("d", d3.svg.diagonal())
        .attr('pointer-events', 'none');

    link.attr("d", d3.svg.diagonal());

    link.exit().remove();
};

// Function to center node when clicked/dropped so node doesn't get lost when collapsing/moving with large amount of children.
function centerNode(source, scale) {
    x = -source.y0;
    y = -source.x0;
    x = x * scale + viewerWidth / 7;
    y = y * scale + viewerHeight / 2;
    d3.select('g').transition()
        .duration(duration)
        .attr("transform", "translate(" + x + "," + y + ")scale(" + scale + ")");
    zoomListener.scale(scale);
    zoomListener.translate([x, y]);
}

function centerNodeMiddle(source,scale) {
    x = -source.y0;
    y = -source.x0;
    x = x * scale + viewerWidth / 2;
    y = y * scale + viewerHeight / 2;
    d3.select('g').transition()
        .duration(duration)
        .attr("transform", "translate(" + x + "," + y + ")scale(" + scale + ")");
    zoomListener.scale(scale);
    zoomListener.translate([x, y]);
}

// Toggle children function
function toggleChildren(d) {
    if (d.children) {
        d._children = d.children;
        d.children = null;
    } else if (d._children) {
        d.children = d._children;
        d._children = null;
    }
    return d;
}

// Toggle children on click.
function click(d) {
    if (d3.event.defaultPrevented) return; // click suppressed
    d = toggleChildren(d);
    update(d);
    centerNode(d,zoomListener.scale());
    //set the active root node
    activeRootNode = d;
    //load info about the node into the options container
    populateOptionsContainer(d);
}


function populateOptionsContainer(d) {
  //update the node name
  $('#selectedNodeName').val(d.name);
  //update the node names
  $('#selectedNodeId').val(d.id);
  //update the short code
  $('#selectedNodeShortCode').val(d.shortCode);
  //update the node names

  if(d._children)
  {
    $('#collapseAllChildrenButton').fadeOut(400,function(){
      $('#expandAllChildrenButton').fadeIn(400);
    });
  }
  else if(d.children)
  {
    $('#expandAllChildrenButton').fadeOut(400,function(){
      $('#collapseAllChildrenButton').fadeIn(400);
    });
  }
  else
  {
    $('#expandAllChildrenButton').hide();
    $('#collapseAllChildrenButton').hide();
  }

  var uriString = d.uriString;
  $('#selectedNodeURI').val(uriString);
  //only show the edit uriString button if the uri is not null
  if(uriString == "null")
  {
    $('#editDetailsInAssetRegButton').hide();
  }
  else
  {
    $('#editDetailsInAssetRegButton').fadeIn(300);
  }

    //show the container if it is not showing
    $('#nodeOptionsContainer').fadeIn(200);
}

function closeNodeOptionsContainer() {
  //hide the container if it is not showing
  $('#nodeOptionsContainer').fadeOut(200);
}

function update(source) {
    // Compute the new height, function counts total children of root node and sets tree height accordingly.
    // This prevents the layout looking squashed when new nodes are made visible or looking sparse when nodes are removed
    // This makes the layout more consistent.
    var levelWidth = [1];
    var childCount = function(level, n) {

        if (n.children && n.children.length > 0) {
            if (levelWidth.length <= level + 1) levelWidth.push(0);

            levelWidth[level + 1] += n.children.length;
            n.children.forEach(function(d) {
                childCount(level + 1, d);
            });
        }
    };
    childCount(0, root);
    var newHeight = d3.max(levelWidth) * 100; // 25 pixels per line
    tree = tree.size([newHeight, viewerWidth]);

    // Compute the new tree layout.
    var nodes = tree.nodes(root).reverse();
        links = tree.links(nodes);

    // Set widths between levels based on maxLabelLength.
    nodes.forEach(function(d) {
        d.y = (d.depth * (maxLabelLength * 10)); //maxLabelLength * 10px
        // alternatively to keep a fixed scale one can set a fixed depth per level
        // Normalize for fixed-depth by commenting out below line
        // d.y = (d.depth * 500); //500px per level.
    });

    // Update the nodes…
    node = svgGroup.selectAll("g.node")
        .data(nodes, function(d) {
            return d.id || (d.id = ++i);
        });

    // Enter any new nodes at the parent's previous position.
    var nodeEnter = node.enter().append("g")
        .call(dragListener)
        .attr("class", "node")
        .attr("transform", function(d) {
            return "translate(" + source.y0 + "," + source.x0 + ")";
        })
        .on('click', click)
        .on("mouseover", function(d) {
          //set the active root node
          activeRootNode = d;
          //load info about the node into the options container
          populateOptionsContainer(d);
          //highlight the node
          highlightSelectedNode(d);

        });

    nodeEnter.append("circle")
        .attr('class', 'nodeCircle')
        .attr("r", 0)
        .style("stroke-width", function(d) {
            return d == activeRootNode ? 3 : 1;
        })
        .style("fill", function(d) {
            return d._children ? "lightsteelblue" : "#fff";
        })
        .style("stroke", function(d) {
            return d == activeRootNode ? "#f33" : "#666";
        })
        .on("mouseover", function(d){

          //highlight the node


        });


    nodeEnter.append("text")
        .attr("x", function(d) {
            return d.children || d._children ? -30 : 30;
        })
        .attr("dy", ".35em")
        .attr('class', 'nodeText')
        .attr("text-anchor", function(d) {
            return d.children || d._children ? "end" : "start";
        })
        .text(function(d) {
          var nodeName = d.shortCode + " :: " + d.name;
          if(nodeName.length > 70) {
            nodeName = nodeName.substring(0,66) + "...";
          }
          return nodeName;
        })
        .style("fill-opacity", 0);

    // phantom node to give us mouseover in a radius around it
    nodeEnter.append("circle")
        .attr('class', 'ghostCircle')
        .attr("r", 60)
        .attr("opacity", 0.2) // change this to zero to hide the target area
        .style("fill", "red")
        .attr('pointer-events', 'mouseover')
        .on("mouseover", function(node) {
            overCircle(node);
        })
        .on("mouseout", function(node) {
            outCircle(node);
        });

    // Update the text to reflect whether node has children or not.
    node.select('text')
        .attr("x", function(d) {
            return d.children || d._children ? -30 : 30;
        })
        .attr("y", -20)
        .attr("text-anchor", function(d) {
            return d.children || d._children ? "end" : "start";
        })
        .text(function(d) {
            var nodeName = d.shortCode + " :: " + d.name;
            if(nodeName.length > 70) {
              nodeName = nodeName.substring(0,66) + "...";
            }
            return nodeName;
        });

    // Change the circle fill depending on whether it has children and is collapsed
    node.select("circle.nodeCircle")
        .attr("r", 20)
        .style("fill", function(d) {
            return d._children ? "lightsteelblue" : "#fa3";
        });

    // Transition nodes to their new position.
    var nodeUpdate = node.transition()
        .duration(duration)
        .attr("transform", function(d) {
            return "translate(" + d.y + "," + d.x + ")";
        });

    // Fade the text in
    nodeUpdate.select("text")
        .style("fill-opacity", 1);

    // Transition exiting nodes to the parent's new position.
    var nodeExit = node.exit().transition()
        .duration(duration)
        .attr("transform", function(d) {
            return "translate(" + source.y + "," + source.x + ")";
        })
        .remove();

    nodeExit.select("circle")
        .attr("r", 0);

    nodeExit.select("text")
        .style("fill-opacity", 0);

    // Update the links…
    var link = svgGroup.selectAll("path.link")
        .data(links, function(d) {
            return d.target.id;
        });

    // Enter any new links at the parent's previous position.
    link.enter().insert("path", "g")
        .attr("class", "link")
        .attr("d", function(d) {
            var o = {
                x: source.x0,
                y: source.y0
            };
            return diagonal({
                source: o,
                target: o
            });
        });

    // Transition links to their new position.
    link.transition()
        .duration(duration)
        .attr("d", diagonal);

    // Transition exiting nodes to the parent's new position.
    link.exit().transition()
        .duration(duration)
        .attr("d", function(d) {
            var o = {
                x: source.x,
                y: source.y
            };
            return diagonal({
                source: o,
                target: o
            });
        })
        .remove();

    // Stash the old positions for transition.
    nodes.forEach(function(d) {
        d.x0 = d.x;
        d.y0 = d.y;
    });
}



function expandAll() {
  //get the root
  root = treeData;
  root.children.forEach(collapse);
  root.children.forEach(expand);
  update(root);
  centerNode(root,0.1);
}

function collapseAll() {
  //get the root
  root = treeData;
  root.children.forEach(collapse);
  update(root);
  centerNodeMiddle(root,1);
}

function expandAllNodeChildren() {
  //get the root
  toggleChildren(activeRootNode);
  activeRootNode.children.forEach(expand);
  update(activeRootNode);
  centerNode(activeRootNode,0.4);
  //updatethe ui buttons
  $('#expandAllChildrenButton').fadeOut(400,function(){
    $('#collapseAllChildrenButton').fadeIn(400);
  });
}

function collapseAllNodeChildren() {
  activeRootNode.children.forEach(collapse);
  toggleChildren(activeRootNode);
  //activeRootNode.children = null;
  update(activeRootNode);
  centerNodeMiddle(activeRootNode,1);
  //updatethe ui buttons
  $('#collapseAllChildrenButton').fadeOut(400,function(){
    $('#expandAllChildrenButton').fadeIn(400);
  });
}


function centerOnRoot() {
  //get the root
  root = treeData;
  centerNodeMiddle(root,zoomListener.scale());
}


function loadAssetRegPopUp() {
  // do something…
  //get the current uri
  var uriString = document.getElementById('selectedNodeURI').value;
  var windowName = "The Asset Register";
  var windowFeatures = "width=650, height=800, status, resizable, left=100, top= 50, screenX=100, screenY=50, scrollbars=yes";

  newwindow=window.open(uriString,windowName, windowFeatures, "POS");
  if (window.focus) {newwindow.focus()}
  return false;
}


function searchAndZoom(){

  // Get JSON data
  d3.csv("wbs.csv", function(data){
        var tree = DataStructures.Tree.createFromFlatTable(data);
            treeDataOriginal = tree.toSimpleObject(function(objectToDecorate, originalNode) {
                  objectToDecorate.size = originalNode.size;
                  if (objectToDecorate.children && objectToDecorate.children.length == 0) {
                      delete objectToDecorate.children;
                  }
                  return objectToDecorate;
            });

        //first collapse the tree (fully)
        collapseAll();

        //go
        searchAndZoom2();
  });
}


function searchAndZoom2() {

    var zoomTonodeId = document.getElementById('nodeId').value;
    var pos = zoomTonodeId.indexOf(" - ");
    zoomTonodeId = zoomTonodeId.substr(0,pos);

    var listOfParentTreePositions = [];
    getNodeAndChildrenFromFullTree(treeDataOriginal, zoomTonodeId, listOfParentTreePositions);

    //loop through listOfParentTreePositions array to get only the relevant node data
    treeBranch = treeData;

    for (var i = 1; i < listOfParentTreePositions.length; i++) {
       treeBranch = stripTreeBranch(listOfParentTreePositions[listOfParentTreePositions.length - i],treeBranch);
       toggleChildren(treeBranch);
       update(treeBranch);
       centerNodeMiddle(treeBranch,zoomListener.scale());
    }
}


function stripTreeBranch(branchNumber,treeBranch){
    return treeBranch = treeBranch.children[branchNumber];
}

var getNodeAndChildrenFromFullTree = function (parentnode, id, listOfParentTreePositions) {
    if (parentnode.nodeId == id){
        listOfParentTreePositions.push(0);
        return true;
    }
    if (parentnode.children) {
        for (var i = 0; i < parentnode.children.length; i++) {
            var node = parentnode.children[i];
            if (parentnode.parentId && getNodeAndChildrenFromFullTree(node, id, listOfParentTreePositions)) {
                listOfParentTreePositions.push(i);
                return true;
            }
        }
    }
    // no matches found - return false
    return false;
}

function highlightSelectedNode(d) {

  var upstreamNode = activeRootNode;
  //create a list of parent nodes
  var listOfParentNodes = [];
  //add the current node
  var keepLooping = true;
  while (keepLooping == true) {
      listOfParentNodes.push(upstreamNode.id);
      //update with the parent
      if(upstreamNode.parent) {
        upstreamNode = upstreamNode.parent;
      } else {
        //stop the loop
        keepLooping = false;
      }
   }

   //create a list of link source-target relationships
   var sourceTargetRelationships = [];
   for(var i = 0; i < listOfParentNodes.length-1; i++) {
     sourceTargetRelationships.push(listOfParentNodes[i+1]+" - "+listOfParentNodes[i]);
   }

   //reset all nodes
   d3.selectAll("circle.nodeCircle").filter(function(d) { return d.id !== activeRootNode.id; }).style("stroke", "#666").style("stroke-width", 1);
   //reset all link .path styles
   d3.selectAll("path.link").style("stroke", "#666").style("stroke-width", 3);

   //update the color of the parent nodes
   for(var i = 0; i < listOfParentNodes.length; i++) {
     d3.selectAll("circle.nodeCircle").filter(function(d) { return d.id == listOfParentNodes[i]; }).style("stroke", "#f00").style("stroke-width", 3);
     d3.selectAll("path.link").filter(function(l) { return l.target.id == listOfParentNodes[i]; }).style("stroke", "#f00").style("stroke-width", 10);
   }
   //color & size the selected node
   d3.selectAll("circle.nodeCircle").filter(function(d) { return d.id == activeRootNode.id; }).style("stroke", "#f00").style("stroke-width", 10);

}
