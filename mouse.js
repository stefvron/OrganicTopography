const DEBUG = true;

let fps = 60;
let speed = 10;
let dragIntensity = 0.3;
let dragRadius = 250;
let depth = 300;
let colour = "255, 155, 249";
let borderColour = "20, 0, 15";
let resolution = 2**7;
let slowDown = 0.5;
let stepCount = 10;
let conProxFact = 1;
let borderThickness = 2;

window.wallpaperPropertyListener = {
    applyUserProperties: function(props) {
        if(props.fps) fps = props.fps.value;
        if(props.colour) {
            let c = props.colour.value.split(" ");
            colour = 
                Math.ceil(c[0]*255) + ", " +
                Math.ceil(c[1]*255) + ", " +
                Math.ceil(c[2]*255);
        }
        if(props.bordercolour) {
            let c = props.bordercolour.value.split(" ");
            borderColour = 
                Math.ceil(c[0]*255) + ", " +
                Math.ceil(c[1]*255) + ", " +
                Math.ceil(c[2]*255);
        }
        if(props.speed) speed = props.speed.value;
        if(props.dragintensitivity) dragIntensity = props.dragintensitivity.value;
        if(props.dragradius) dragRadius = props.dragradius.value;
        if(props.depth) depth = props.depth.value;
        if(props.resolution) resolution = props.resolution.value;
        if(props.slowdown) slowDown = props.slowdown.value;
        
        restartCanvas();
    }
}

let canvas = null;
let renderCanvas = document.createElement("canvas");
let renderLoop = null;

let probes = [];
let mousePos = [[innerWidth/2, innerHeight/2, 0]];

let steps = [];
let stepVertices = [];

function initCanvas() {
    console.log("Initialising")
    canvas = document.getElementById('mouseCanvas');
    canvas.width = innerWidth;
    canvas.height = innerHeight;

    renderCanvas.width = innerWidth;
    renderCanvas.height = innerHeight;

    initProbes();
    renderLoop = setInterval(render, 1000/fps);
    addEventListener("mousemove", handleMouseMove);
    initSteps();
}

function initSteps() {
    steps = [depth];
    stepVertices = [new StepGraph()];
    let dist = depth / stepCount;
    for(i = 1; i < stepCount; i++) {
        steps.push(steps[i-1]-dist)
        stepVertices.push(new StepGraph());
    }
}

function restartCanvas() {
    clearInterval(renderLoop);
    probes = [];
    removeEventListener("mousemove", handleMouseMove);

    initCanvas();
}

function handleMouseMove(event) {
    setMouseAt(event, 0);
    probes.forEach(col => col.forEach(v => {
        let dist = Math.abs(Math.sqrt(
            (v[0] - event.clientX)**2 +
            (v[1] - event.clientY)**2 +
            v[2]**2
        ));
        if(dist < dragRadius) {
            let radPerc = 1 - (dist / dragRadius);
            let vz = Math.abs(Math.sqrt(
                event.movementX**2 +
                event.movementY**2
            )) * (-1) * dragIntensity * (radPerc ** 2);
            
            if(Math.abs(v[4]) < Math.abs(vz)) v[4] += vz;
        }
    }));

}
function setMouseAt(event, n) {
    mousePos[n] = [event.clientX + 2, event.clientY + 2, 0];
}

function initProbes() {
    let nX = Math.ceil(canvas.width / resolution);
    let nY = Math.ceil(canvas.height / resolution);
    for(i = 0; i < nX; i++) {
        let probeCol = [];
        for(j = 0; j < nY; j++) {
            probeCol.push([...getRandomProbeAt(
                i*resolution+resolution/2,
                j*resolution+resolution/2
            )]);
        }
        probes.push(probeCol);
    }
}
function getRandomProbeAt(x, y) {
    //       X, Y, Z, VZ, V2Z
    let v = [0, 0, 0,  0,   0];
    v[0] = x;
    v[1] = y;
    v[2] = Math.random() * depth;
    v[3] = Math.random() * 2 - 1;
    return v;
}

function renderFrame() {
    let ctx = renderCanvas.getContext('2d');
    ctx.fillStyle = "rgb(" + colour + ")";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    calcSteps();
    drawBorders();

    if(DEBUG) {
        drawProbes();
        drawStepVertices();
    }

    canvas.getContext('2d').drawImage(renderCanvas, 0, 0);
}
class StepGraph {
    constructor() {
        this.edges = [];
        this.vertices = [];
    }
    get getAllVertices() { return this.vertices; }
    get getAllEdges() { return this.edges; }
    getVertices(x, y) {
        return this.vertices.filter(obj => obj.getBX == x && obj.getBY == y);
    }
    getVertex(x, y, orientation) {
        return this.getVertices(x, y).find(obj => obj.getOrientation == orientation);
    }
    addVertex(bX, bY, x, y) {
        if(
            isNaN(bX) ||
            isNaN(bY) ||
            isNaN(x) ||
            isNaN(y)
        ) throw "Can only create vertex from coordinates";
        const newV = new StepGraphVertex(bX, bY, x, y);
        this.vertices.push(newV);
        return newV;
    }
    addEdge(v1, v2) {
        if(
            !(v1 instanceof StepGraphVertex) ||
            !(v2 instanceof StepGraphVertex)
        ) throw "Can only create edges between two vertices";
        const newE = new StepGraphEdge(v1, v2);
        this.edges.push(newE);
        return newE;
    }
    getNeighbours(v) {
        return this.edges.filter(e => e.hasV(v));
    }
    
    clear() {
        this.edges = [];
        this.vertices = [];
    }

    calculateEdges() {
        const order = [
            -1,     // Bottom Left
            0,      // Left
            1       // Top Left
        ];
        this.vertices.forEach(v => {
            let off = [0,0];
            switch(v.getOrientation()) {
                case Orientation.NORTH:
                    off = [-1, 0];
                    break;
                case Orientation.EAST:
                    off = [0, -1];
                    break;
                case Orientation.SOUTH:
                    off = [1, 0];
                    break;
                case Orientation.WEST:
                    off = [0, 1];
            }
            let found = false;
            order.forEach(o => {
                if(found) return;
                const v2 = this.getVertex(
                    v.getBX + off[0] + o*off[1],
                    v.getBY + off[1] + o*off[0],
                    (v.getOrientation() + o) % 4
                );
                console.log(v2)
            });
        });
    }
}
const Orientation = Object.freeze({
    NORTH: 0,
    EAST: 1,
    SOUTH: 2,
    WEST: 3,
});
class StepGraphVertex {
    constructor(bX, bY, x, y) {
        this.bX = bX;
        this.bY = bY;
        this.x = x;
        this.y = y;
    }
    get getBX() { return this.bX; }
    get getBY() { return this.bY; }
    get getX() { return this.x; }
    get getY() { return this.y; }

    getOrientation() {
        if(this.bX > this.x) return Orientation.WEST;
        if(this.bX < this.x) return Orientation.EAST;
        if(this.bY > this.y) return Orientation.NORTH;
        return Orientation.SOUTH;
    }
}
class StepGraphEdge {
    constructor(v1, v2) {
        this.v1 = v1;
        this.v2 = v2;
    }
    get getV1() { return this.v1; }
    get getV2() { return this.v2; }
    hasV(v) { return this.v1 == v || this.v2 == v; }
}
function calcSteps() {
    for(let i = 0; i < stepCount; i++) {
        stepVertices[i].clear();
    }

    let nX = Math.ceil(canvas.width / resolution);
    let nY = Math.ceil(canvas.height / resolution);
    for(let i = 0; i < nX; i++) {
        for(let j = 0; j < nY; j++) {
            let a = probes[i][j];
            if(i+1 < nX) {
                let b = probes[i+1][j];
                appendSteps(calcStepsAB(a,b));
            }
            if(j+1 < nY) {
                let b = probes[i][j+1];
                appendSteps(calcStepsAB(a,b));
            }
        }
    }

    function appendSteps(vertices) {
        vertices.forEach(v => {
            const layer = stepVertices[steps.indexOf(v[2])];
            layer.addVertex(
                v[3],   // bX
                v[4],   // bY
                v[0],   // x
                v[1]    //y
            );
        });
    }
}
function calcStepsAB(a, b) {
    // Switch so that b always has a higher Z value than a
    if(a[2] > b[2]) {
        let c = a;
        a = b;
        b = c;
    }

    let vertices = [];

    for(let i = 0; i < stepCount; i++) {
        if(steps[i] < a[2]) continue;
        if(steps[i] > b[2]) continue;

        let v = a;
        let dP = getDistPerc(steps[i]);
        let bMA = b.map((e, index) => (e-a[index])*dP);
        v = v.map((e, index) => e + bMA[index]);
        v = [v[0], v[1], steps[i], a[0], a[1]];

        vertices.push(v);
    }
    return vertices;

    function getDistPerc(z) {
        return (z - a[2]) / (b[2] - a[2]);
    }
}
function drawBorders() {
    stepVertices.forEach(g => g.calculateEdges());
    let edges = [];
    stepVertices.forEach(g => edges.push(...g.getAllEdges));
    stepVertices.forEach(layer => {
        return;
        let vs = [...(layer.getAllVertices)];
        while(vs.length > 0) {
            let v1 = vs.pop();
            vs.forEach(v2 => {
                let dist =
                    Math.abs(Math.sqrt(
                        (v1.getX - v2.getX)**2 + 
                        (v1.getY - v2.getY)**2
                    ));
                if(dist < conProxFact*resolution) {
                    let edge = Array(2);
                    edge[0] = v1;
                    edge[1] = v2;
                    edges.push(edge);
                }
            })
        }
    });
    let ctx = renderCanvas.getContext('2d');
    edges.forEach(e => {
        ctx.beginPath();
        ctx.moveTo(e[0].getX, e[0].getY);
        ctx.lineTo(e[1].getX, e[1].getY);
        ctx.strokeStyle = "rgb(" + borderColour + ")";
        ctx.lineWidth = borderThickness;
        ctx.stroke();
    }); 
}

function stepFrame() {
    moveProbes();
    handleOutOfBounds();
}
function moveProbes() {
    probes.forEach(col => col.forEach(v => {
        v[2] += v[3]*speed/fps + v[4];

        if(Math.abs(v[4]) >= 0.05) v[4] = v[4]*slowDown;
        else v[4] = 0;
    }));
}
function handleOutOfBounds() {
    bounceOutOfBounds();
}
function bounceOutOfBounds() {
    probes.forEach(col => col.forEach(v => {
        if(v[2] < 0 && v[3] < 0) v[3] *= -1;
        if(v[2] < 0 && v[4] < 0) v[4] *= -1;
        if(v[2] > depth && v[3] > 0) v[3] *= -1;
        if(v[2] > depth && v[4] > 0) v[4] *= -1;
        return;
        v[2] = Math.min(depth, Math.max(0, v[2]));
    }));
}

async function render() {
    stepFrame();
    renderFrame();
}


// DEBUG
const stepColours = ["#f00","#0f0","#00f"];
function drawStepVertices() {
    let ctx = renderCanvas.getContext('2d');
    stepVertices.forEach(vs => [...vs.getAllVertices].forEach(v => {
        step = stepVertices.indexOf(vs);
        ctx.beginPath();
        ctx.arc(v.getX, v.getY, 2, 0, 2*Math.PI);
        ctx.fillStyle = stepColours[step % stepColours.length];
        ctx.fill();
    }));
}
function drawProbes() {
    let ctx = renderCanvas.getContext('2d');
    probes.forEach(col => col.forEach(v => {
        ctx.beginPath();
        let depthPerc = (1 - (v[2]/depth));
        ctx.arc(v[0], v[1], 2, 0, 2*Math.PI);
        ctx.fillStyle = "rgba(" + borderColour+ ", " + depthPerc + ")";
        ctx.fill();
    }));
}
