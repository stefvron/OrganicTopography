const DEBUG = true;

let fps = 60;
let speed = 10;
let dragIntensity = 0.6;
let dragRadius = 100;
let depth = 150;
let borderColour = "255, 155, 249";
let colour = "20, 0, 15";
let resolution = 40;
let slowDown = 0.5;
let stepCount = 8;
let borderThickness = 2;
let roundingPasses = 1;
let randomness = 0;
let mountainCount = 100;
let mountainSize = 250;

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

let mountains = [];
let mouseMountains = [];
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

    initMountains();
    initProbes();
    renderLoop = setInterval(render, 1000/fps);
    addEventListener("mousemove", handleMouseMove);
    initSteps();
}

function initMountains() {
    mountains = [];
    for(let i = 0; i < mountainCount; i++) {
        let m = {
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            z: Math.random() * depth,
            vx: Math.random() * 2 - 1,
            vy: Math.random() * 2 - 1,
            vz: Math.random() * 2 - 1,
            reach: mountainSize*0.25 + Math.random()**2 * mountainSize * 0.75
        }
        mountains.push(m);
    }
}

function initSteps() {
    const stepDepth = 0.94 * depth;
    steps = [0.97 * depth];
    stepVertices = [new StepGraph()];
    let dist = stepDepth / stepCount;
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
    let vz = Math.abs(Math.sqrt(
        event.movementX**2 +
        event.movementY**2
    )) * dragIntensity;
    let m = {
        x: event.clientX,
        y: event.clientY,
        z: Math.min(depth, vz * depth),
        vx: 0,
        vy: 0,
        vz: depth/100*slowDown,
        reach: dragRadius
    }
    mouseMountains.push(m);

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
    calculateMountains();
}
function getRandomProbeAt(x, y) {
    //       X, Y, Z, VZ, V2Z, MZ
    let v = [0, 0, 0,  0,   0,  0];
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

    calculateMountains();
    calcSteps();
    stepVertices.forEach(g => {
        g.calculateEdges();
        g.roundEdgesNtimes(roundingPasses);
    });
    drawBorders();

    if(DEBUG) {
        drawMountains();
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
    getVertices(x, y, tolerance) {
        if(tolerance == undefined) tolerance = 0;
        return this.vertices.filter(obj => {
            return Math.abs(obj.getBX - x) <= tolerance && 
                Math.abs(obj.getBY - y) <= tolerance
        });
    }
    getVertex(x, y, orientation) {
        return this.getVertices(x, y).find(obj => obj.getOrientation() == orientation);
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
    getDirectedNeighbours(v) {
        return this.edges.filter(e => e.getV1 == v);
    }
    
    clear() {
        this.edges = [];
        this.vertices = [];
    }

    calculateEdges() {
        this.edges = [];
        const order = [
            [0, 0,-1],     // Bottom Left
            [0,-1, 0],      // Left
            [1,-1, 1]       // Top Left
        ];
        this.vertices.forEach(v => {
            let dir = [0,0];
            let side = [0,0];
            switch(v.getOrientation()) {
                case Orientation.NORTH:
                    dir = [0, -1];
                    side = [1, 0];
                    break;
                case Orientation.EAST:
                    dir = [1, 0];
                    side = [0, 1];
                    break;
                case Orientation.SOUTH:
                    dir = [0, 1];
                    side = [-1, 0];
                    break;
                case Orientation.WEST:
                    dir = [-1, 0];
                    side = [0, -1];
            }
            let found = false;
            order.forEach(o => {
                if(found) return;
                let newOri = (v.getOrientation() + o[2]) % 4
                while(newOri < 0) newOri += 4;
                let x = o[0]*dir[0] + o[1]*side[0];
                let y = o[0]*dir[1] + o[1]*side[1];
                x = x * resolution + v.getBX;
                y = y * resolution + v.getBY;
                const v2 = this.getVertex(
                    x,
                    y,
                    newOri
                );
                if(v2 != undefined) {
                    found = true;
                    this.addEdge(v, v2);
                }
            });
        });
    }
    roundEdgesNtimes(n) {
        for(let i = 0; i < n; i++) {
            this.roundEdges();
        }
    }
    roundEdges() {
        // Chaikin corner cutting
        let newVertices = [];
        let newEdges = [];

        let replacedBy = new Map();

        this.vertices.forEach(v => {
            let neighbours = this.getDirectedNeighbours(v);
            neighbours.forEach(e => {
                let v2 = e.getV2;
                let q = new StepGraphVertex(
                    null,
                    null,
                    0.75*v.getX + 0.25*v2.getX,
                    0.75*v.getY + 0.25*v2.getY
                );
                let r = new StepGraphVertex(
                    null,
                    null,
                    0.25*v.getX + 0.75*v2.getX,
                    0.25*v.getY + 0.75*v2.getY
                );
                newVertices.push(q);
                newVertices.push(r);
                newEdges.push(new StepGraphEdge(q, r));
                if(!replacedBy.has(v)) replacedBy.set(v, []);
                if(!replacedBy.has(v2)) replacedBy.set(v2, []);
                replacedBy.get(v).push(q);
                replacedBy.get(v2).push(r);
            });
        });
        this.vertices.forEach(v => {
            let arr = replacedBy.get(v);
            if(arr instanceof Array && arr.length == 2) {
                newEdges.push(new StepGraphEdge(arr[0], arr[1]));
            }
        });
        this.vertices = newVertices;
        this.edges = newEdges;
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
    setX(x) { this.x = x; }
    setY(y) { this.y = y; }

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
    setV1(v) { this.v1 = v; }
    setV2(v) { this.v2 = v; }
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
                appendSteps(a, b);
            }
            if(j+1 < nY) {
                let b = probes[i][j+1];
                appendSteps(a, b);
            }
        }
    }

    function appendSteps(a, b) {
        // Make copies and calculate randomn portion of Z values
        a = [...a];
        b = [...b];
        a[2] = randomness*a[2] + (1-randomness)*a[5];
        b[2] = randomness*b[2] + (1-randomness)*b[5];
        // Switch so that b always has a higher Z value than a
        if(a[2] > b[2]) {
            let c = a;
            a = b;
            b = c;
        }
        let vertices = calcStepsAB(a, b);

        vertices.forEach(v => {
            const layer = stepVertices[steps.indexOf(v[2])];
            const newV = layer.addVertex(
                a[0],     // bX
                a[1],     // bY
                v[0],   // x
                v[1]    //y
            );
        });
    }
}
function calcStepsAB(a, b) {
    let vertices = [];

    for(let i = 0; i < stepCount; i++) {
        if(steps[i] < a[2]) continue;
        if(steps[i] > b[2]) continue;

        let v = a;
        let dP = getDistPerc(steps[i]);
        let bMA = b.map((e, index) => (e-a[index])*dP);
        v = v.map((e, index) => e + bMA[index]);
        v = [v[0], v[1], steps[i]];

        vertices.push(v);
    }
    return vertices;

    function getDistPerc(z) {
        let res = (z - a[2]) / (b[2] - a[2]);
        if(isNaN(res)) res = 0;
        return res;
    }
}
function drawBorders() {
    let edges = [];
    stepVertices.forEach(g => {
        edges.push(...g.getAllEdges);
    });
    let ctx = renderCanvas.getContext('2d');
    edges.forEach(e => {
        ctx.beginPath();
        ctx.moveTo(e.getV1.getX, e.getV1.getY);
        ctx.lineTo(e.getV2.getX, e.getV2.getY);
        ctx.strokeStyle = "rgb(" + borderColour + ")";
        ctx.lineWidth = borderThickness;
        ctx.stroke();
    }); 
}

function calculateMountains() {
    const ms = [...mountains, ...mouseMountains];
    probes.forEach(col => col.forEach(v => {
        v[5] = depth;
        ms.forEach(m => {
            let dist = Math.sqrt(
                (v[0] - m.x)**2 +
                (v[1] - m.y)**2
            );
            if(dist < m.reach) {
                let propZ = m.z;
                let heightPerc = 1 - (dist / m.reach);
                heightPerc = Math.min(1, Math.max(0, heightPerc));
                v[5] -= heightPerc * propZ;
                v[5] = Math.max(0, v[5]);
            }
        })
    }));
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
    const ms = [...mouseMountains, ...mountains];
    ms.forEach(m => {
        m.x += m.vx * speed / fps;
        m.y += m.vy * speed / fps;
        m.z += m.vz * speed / fps;
    });
    mouseMountains.forEach(m => {
    });
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
    mountains.forEach(m => {
        if(m.x < 0 && m.vx < 0) m.vx *= -1;
        if(m.x > canvas.width && m.vx > 0) m.vx *= -1;
        if(m.y < 0 && m.vy < 0) m.vy *= -1;
        if(m.y > canvas.height && m.vy > 0) m.vy *= -1;
        if(m.z < 0 && m.vz < 0) m.vz *= -1;
        if(m.z > depth && m.vz > 0) m.vz *= -1;
    });
    mouseMountains = mouseMountains.filter(m => m.z <= depth);
}

async function render() {
    stepFrame();
    renderFrame();
}


// DEBUG
const stepColours = ["#f00","#0f0","#00f", "#ff0", "#0ff", "#f0f"];
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
        const realDepth = randomness*v[2] + (1-randomness)*v[5];
        let depthPerc = (1 - (realDepth/depth));
        ctx.arc(v[0], v[1], 2, 0, 2*Math.PI);
        ctx.fillStyle = "rgba(" + "0, 0, 255" + ", " + depthPerc + ")";
        ctx.fill();
    }));
}
function drawMountains() {
    let ctx = renderCanvas.getContext('2d');
    mountains.forEach(m => {
        ctx.beginPath();
        let depthPerc = (1 - (m.z/depth));
        ctx.arc(m.x, m.y, m.reach, 0, 2*Math.PI);
        ctx.fillStyle = "rgba(" + "0, 255, 0" + ", " + depthPerc + ")";
        ctx.fill();
    });
    mouseMountains.forEach(m => {
        ctx.beginPath();
        let depthPerc = (1 - (m.z/mountainCount/depth));
        ctx.arc(m.x, m.y, m.reach, 0, 2*Math.PI);
        ctx.fillStyle = "rgba(" + "255, 0, 0" + ", " + depthPerc + ")";
        ctx.fill();
    });
}
