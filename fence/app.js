const canvas = document.getElementById('fenceCanvas');
const ctx = canvas.getContext('2d');
const clearBtn = document.getElementById('clear-btn');

// Configuration Scale: 1 foot = 5 pixels
const SCALE = 5; 
const GRID_8FT = 8 * SCALE; // 40px visual grid lines
const SNAP_1FT = 1 * SCALE; // 5px snapping resolution
const COST_PER_FOOT = 18.50;

// State management
let segments = []; 
let isDrawing = false;
let startPoint = null;
let currentPoint = null;

// Centered Main Residence: 64ft x 35ft
const house = {
    width: 64 * SCALE,   // 320px
    height: 35 * SCALE,  // 175px
    x: (canvas.width - (64 * SCALE)) / 2, // 240px
    y: Math.floor((canvas.height - (35 * SCALE)) / 2 / SNAP_1FT) * SNAP_1FT, // 210px (snapped)
    label: "MAIN RESIDENCE (64' x 35')"
};

function drawGrid() {
    ctx.strokeStyle = '#1e293b'; 
    ctx.lineWidth = 1;
    for (let x = 0; x < canvas.width; x += GRID_8FT) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
    }
    for (let y = 0; y < canvas.height; y += GRID_8FT) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
    }
}

function drawHouse() {
    ctx.fillStyle = '#1e293b';
    ctx.strokeStyle = '#38bdf8'; 
    ctx.lineWidth = 2;
    ctx.fillRect(house.x, house.y, house.width, house.height);
    ctx.strokeRect(house.x, house.y, house.width, house.height);

    // Architectural cross-hatching
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.1)';
    for(let i = 0; i < house.width + house.height; i += 20) {
        ctx.beginPath();
        ctx.moveTo(house.x + i, house.y);
        ctx.lineTo(house.x + i - house.height, house.y + house.height);
        ctx.stroke();
    }

    ctx.fillStyle = '#38bdf8';
    ctx.font = '600 11px monospace';
    ctx.textBaseline = 'middle'; ctx.textAlign = 'center';
    ctx.fillText(house.label, house.x + (house.width / 2), house.y + (house.height / 2));
}

// Computes structural posts for a segment ensuring max 8ft spacing
function getPostsForSegment(start, end) {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const distanceInFeet = Math.sqrt(dx*dx + dy*dy) / SCALE;
    
    if (distanceInFeet === 0) return [];

    // Calculate minimum spaces needed to keep gaps <= 8 feet
    const spaces = Math.ceil(distanceInFeet / 8);
    const segmentPosts = [];

    for (let i = 0; i <= spaces; i++) {
        const t = i / spaces;
        segmentPosts.push({
            x: start.x + dx * t,
            y: start.y + dy * t
        });
    }
    return segmentPosts;
}

function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawGrid();
    drawHouse();

    // Draw established fence runs
    segments.forEach(seg => drawFenceSegment(seg.start, seg.end));

    // Draw active drag preview
    if (isDrawing && startPoint && currentPoint) {
        ctx.save();
        ctx.globalAlpha = 0.5; // Ghostly preview look
        drawFenceSegment(startPoint, currentPoint);
        ctx.restore();
    }
}

function drawFenceSegment(start, end) {
    // 1. Draw the Fence Rails (Line)
    ctx.strokeStyle = '#fbbf24'; 
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
    ctx.stroke();

    // 2. Compute and Draw Structural Posts (Dots)
    const segmentPosts = getPostsForSegment(start, end);
    segmentPosts.forEach(post => {
        ctx.fillStyle = '#f59e0b';
        ctx.beginPath();
        ctx.arc(post.x, post.y, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 1;
        ctx.stroke();
    });
}

// New Pricing Constants
const COST_PER_POST = 55.50;
const BOARDS_PER_BAY = 14;
const COST_PER_BOARD = 11.28;

function updateCalculations() {
    let totalFeet = 0;
    let uniquePosts = [];
    let totalBays = 0;

    segments.forEach(seg => {
        const dx = seg.end.x - seg.start.x;
        const dy = seg.end.y - seg.start.y;
        const distanceInFeet = Math.sqrt(dx*dx + dy*dy) / SCALE;
        totalFeet += distanceInFeet;

        // Calculate how many 8ft bays are in this specific segment run
        if (distanceInFeet > 0) {
            totalBays += Math.ceil(distanceInFeet / 8);
        }

        // Gather and filter unique physical posts
        const segPosts = getPostsForSegment(seg.start, seg.end);
        segPosts.forEach(sp => {
            if (!uniquePosts.some(up => Math.abs(up.x - sp.x) < 1 && Math.abs(up.y - sp.y) < 1)) {
                uniquePosts.push(sp);
            }
        });
    });

    // Materials Calculations
    const postCount = uniquePosts.length;
    const boardCount = totalBays * BOARDS_PER_BAY;

    const totalPostCost = postCount * COST_PER_POST;
    const totalBoardCost = boardCount * COST_PER_BOARD;
    const finalInvoiceTotal = totalPostCost + totalBoardCost;

    // Render numbers to the Sidebar UI
    document.getElementById('total-feet').innerHTML = `${Math.round(totalFeet)} <small>lin ft</small>`;
    
    document.getElementById('total-posts').innerHTML = 
        `${postCount} <small class="muted">($${totalPostCost.toFixed(2)})</small>`;
    
    document.getElementById('total-lumber').innerHTML = 
        `${boardCount} <small class="muted">($${totalBoardCost.toFixed(2)})</small>`;
    
    document.getElementById('total-cost').innerText = 
        `$${finalInvoiceTotal.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
}

// Mouse Interactions
canvas.addEventListener('mousedown', (e) => {
    const rect = canvas.getBoundingClientRect();
    let rawX = e.clientX - rect.left;
    let rawY = e.clientY - rect.top;

    let snapX = Math.round(rawX / SNAP_1FT) * SNAP_1FT;
    let snapY = Math.round(rawY / SNAP_1FT) * SNAP_1FT;

    // Chain mechanism: Snap to nearby existing terminal endpoints
    segments.forEach(seg => {
        if (Math.abs(seg.end.x - snapX) < 15 && Math.abs(seg.end.y - snapY) < 15) {
            snapX = seg.end.x; snapY = seg.end.y;
        } else if (Math.abs(seg.start.x - snapX) < 15 && Math.abs(seg.start.y - snapY) < 15) {
            snapX = seg.start.x; snapY = seg.start.y;
        }
    });

    isDrawing = true;
    startPoint = { x: snapX, y: snapY };
    currentPoint = { x: snapX, y: snapY };
});

canvas.addEventListener('mousemove', (e) => {
    if (!isDrawing) return;

    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const dx = mouseX - startPoint.x;
    const dy = mouseY - startPoint.y;

    // Intelligent Orthogonal Locking (Enforces perfect 90-degree lines when dragging)
    if (Math.abs(dx) > Math.abs(dy)) {
        currentPoint = {
            x: Math.round(mouseX / SNAP_1FT) * SNAP_1FT,
            y: startPoint.y
        };
    } else {
        currentPoint = {
            x: startPoint.x,
            y: Math.round(mouseY / SNAP_1FT) * SNAP_1FT
        };
    }
    render();
});

canvas.addEventListener('mouseup', () => {
    if (!isDrawing) return;
    
    // Only commit if the drag actually spanned a distance
    if (startPoint.x !== currentPoint.x || startPoint.y !== currentPoint.y) {
        segments.push({ start: { ...startPoint }, end: { ...currentPoint } });
    }
    
    isDrawing = false;
    startPoint = null;
    currentPoint = null;
    
    render();
    updateCalculations();
});

clearBtn.addEventListener('click', () => {
    segments = [];
    render();
    updateCalculations();
});

// Init
render();