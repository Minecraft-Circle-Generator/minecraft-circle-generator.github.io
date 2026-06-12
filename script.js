/* ===================================================
   Minecraft Circle Generator — Core Logic
   SOP Module 4: Generator Engine + Canvas Renderer
   =================================================== */

(function () {
    'use strict';

    // ── DOM Elements ──
    const canvas = document.getElementById('circleCanvas');
    const ctx = canvas.getContext('2d');
    const container = document.getElementById('canvasContainer');
    const tooltip = document.getElementById('coordTooltip');

    const diameterSlider = document.getElementById('diameterSlider');
    const diameterValue = document.getElementById('diameterValue');
    const heightSlider = document.getElementById('heightSlider');
    const heightValue = document.getElementById('heightValue');
    const heightGroup = document.getElementById('heightGroup');
    const ovalToggle = document.getElementById('ovalToggle');
    const gridToggle = document.getElementById('gridToggle');
    const segmentToggle = document.getElementById('segmentToggle');

    const blockCountEl = document.getElementById('blockCount');
    const dimensionEl = document.getElementById('dimensionDisplay');

    const exportBtn = document.getElementById('exportBtn');
    const copyBtn = document.getElementById('copyBtn');

    const zoomInBtn = document.getElementById('zoomIn');
    const zoomOutBtn = document.getElementById('zoomOut');
    const zoomFitBtn = document.getElementById('zoomFit');
    const zoomLevelEl = document.getElementById('zoomLevel');

    const segBtns = document.querySelectorAll('.seg-btn');

    // ── State ──
    let state = {
        diameter: 15,
        height: 15,
        isOval: false,
        fillMode: 'hollow',   // 'hollow' | 'thick' | 'filled'
        showGrid: true,
        showSegments: true,
        zoom: 1,
        grid: [],             // 2D array: true = block, false = empty
        hoveredCell: null,     // {x, y} or null
    };

    // ── Constants ──
    const MIN_CELL_SIZE = 4;
    const MAX_CELL_SIZE = 48;
    const ZOOM_STEP = 0.2;

    // ── Colors ──
    const COLORS = {
        bg: '#0f0f13',               // mc-bg
        gridLine: 'rgba(255, 255, 255, 0.04)',
        gridLineStrong: 'rgba(255, 255, 255, 0.08)',
        blockFill: '#3ddc84',        // mc-green
        blockStroke: '#2b9e5e',      // darker green
        blockGlow: 'rgba(61, 220, 132, 0.25)',
        empty: 'rgba(255, 255, 255, 0.015)',
        hover: 'rgba(61, 220, 132, 0.2)',
        hoverStroke: 'rgba(61, 220, 132, 0.6)',
        centerLine: 'rgba(255, 255, 255, 0.15)', // Changed to neutral for cleaner look
        text: '#94a3b8',
    };

    // ═════════════════════════════════════════════════
    // CIRCLE GENERATION ALGORITHM
    // ═════════════════════════════════════════════════

    function generateCircle(width, height, fillMode) {
        const grid = Array.from({ length: height }, () => Array(width).fill(false));
        const cx = (width - 1) / 2;
        const cy = (height - 1) / 2;
        const rx = (width - 1) / 2;
        const ry = (height - 1) / 2;

        if (fillMode === 'filled') {
            // Fill all blocks inside the ellipse
            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    const dx = (x - cx) / rx;
                    const dy = (y - cy) / ry;
                    if (dx * dx + dy * dy <= 1.0001) {
                        grid[y][x] = true;
                    }
                }
            }
        } else if (fillMode === 'hollow') {
            // Thin outline: a block is on the circle if it's inside but
            // at least one 4-neighbor is outside
            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    const dx = (x - cx) / rx;
                    const dy = (y - cy) / ry;
                    if (dx * dx + dy * dy <= 1.0001) {
                        // Check if at least one neighbor is outside
                        const neighbors = [
                            [x - 1, y], [x + 1, y],
                            [x, y - 1], [x, y + 1],
                        ];
                        for (const [nx, ny] of neighbors) {
                            if (nx < 0 || nx >= width || ny < 0 || ny >= height) {
                                grid[y][x] = true;
                                break;
                            }
                            const ndx = (nx - cx) / rx;
                            const ndy = (ny - cy) / ry;
                            if (ndx * ndx + ndy * ndy > 1.0001) {
                                grid[y][x] = true;
                                break;
                            }
                        }
                    }
                }
            }
        } else if (fillMode === 'thick') {
            // Thick outline: 2-block wide border
            const innerRx = Math.max(0, rx - 1.5);
            const innerRy = Math.max(0, ry - 1.5);
            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    const dx = (x - cx) / rx;
                    const dy = (y - cy) / ry;
                    if (dx * dx + dy * dy <= 1.0001) {
                        if (innerRx <= 0 || innerRy <= 0) {
                            grid[y][x] = true;
                        } else {
                            const idx = (x - cx) / innerRx;
                            const idy = (y - cy) / innerRy;
                            if (idx * idx + idy * idy > 1.0001) {
                                grid[y][x] = true;
                            }
                        }
                    }
                }
            }
        }

        return grid;
    }

    function countBlocks(grid) {
        let count = 0;
        for (const row of grid) {
            for (const cell of row) {
                if (cell) count++;
            }
        }
        return count;
    }

    // ═════════════════════════════════════════════════
    // SEGMENT GUIDES ALGORITHM
    // ═════════════════════════════════════════════════

    function drawSegmentGuides(ctx, gridW, gridH, cellSize, gridData) {
        const cx = (gridW - 1) / 2;
        const cy = (gridH - 1) / 2;

        ctx.font = `bold ${Math.max(10, cellSize * 0.55)}px 'Space Grotesk', sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const textColor = '#818cf8';

        function drawLabel(text, px, py) {
            ctx.fillStyle = COLORS.bg;
            const w = ctx.measureText(text).width + 6;
            const h = Math.max(12, cellSize * 0.6 + 4);
            ctx.globalAlpha = 0.8;
            ctx.fillRect(px - w/2, py - h/2, w, h);
            ctx.globalAlpha = 1.0;
            ctx.fillStyle = textColor;
            ctx.fillText(text, px, py);
        }

        // Top Runs
        let currentRun = null;
        for (let x = 0; x < gridW; x++) {
            let y = 0;
            while (y <= cy && !gridData[y][x]) y++;
            if (y <= cy && gridData[y][x]) {
                if (!currentRun || currentRun.y !== y) {
                    if (currentRun) drawTopRun(currentRun);
                    currentRun = { y, startX: x, endX: x };
                } else {
                    currentRun.endX = x;
                }
            } else {
                if (currentRun) drawTopRun(currentRun);
                currentRun = null;
            }
        }
        if (currentRun) drawTopRun(currentRun);

        function drawTopRun(run) {
            const len = run.endX - run.startX + 1;
            const px = (run.startX + run.endX + 1) / 2 * cellSize;
            const py = run.y * cellSize - cellSize * 0.6;
            drawLabel(len.toString(), px, py);
        }

        // Bottom Runs
        currentRun = null;
        for (let x = 0; x < gridW; x++) {
            let y = gridH - 1;
            while (y >= cy && !gridData[y][x]) y--;
            if (y >= cy && gridData[y][x]) {
                if (!currentRun || currentRun.y !== y) {
                    if (currentRun) drawBottomRun(currentRun);
                    currentRun = { y, startX: x, endX: x };
                } else {
                    currentRun.endX = x;
                }
            } else {
                if (currentRun) drawBottomRun(currentRun);
                currentRun = null;
            }
        }
        if (currentRun) drawBottomRun(currentRun);

        function drawBottomRun(run) {
            const len = run.endX - run.startX + 1;
            const px = (run.startX + run.endX + 1) / 2 * cellSize;
            const py = (run.y + 1) * cellSize + cellSize * 0.6;
            drawLabel(len.toString(), px, py);
        }

        // Left Runs
        currentRun = null;
        for (let y = 0; y < gridH; y++) {
            let x = 0;
            while (x <= cx && !gridData[y][x]) x++;
            if (x <= cx && gridData[y][x]) {
                if (!currentRun || currentRun.x !== x) {
                    if (currentRun) drawLeftRun(currentRun);
                    currentRun = { x, startY: y, endY: y };
                } else {
                    currentRun.endY = y;
                }
            } else {
                if (currentRun) drawLeftRun(currentRun);
                currentRun = null;
            }
        }
        if (currentRun) drawLeftRun(currentRun);

        function drawLeftRun(run) {
            const len = run.endY - run.startY + 1;
            const py = (run.startY + run.endY + 1) / 2 * cellSize;
            const px = run.x * cellSize - cellSize * 0.6;
            drawLabel(len.toString(), px, py);
        }

        // Right Runs
        currentRun = null;
        for (let y = 0; y < gridH; y++) {
            let x = gridW - 1;
            while (x >= cx && !gridData[y][x]) x--;
            if (x >= cx && gridData[y][x]) {
                if (!currentRun || currentRun.x !== x) {
                    if (currentRun) drawRightRun(currentRun);
                    currentRun = { x, startY: y, endY: y };
                } else {
                    currentRun.endY = y;
                }
            } else {
                if (currentRun) drawRightRun(currentRun);
                currentRun = null;
            }
        }
        if (currentRun) drawRightRun(currentRun);

        function drawRightRun(run) {
            const len = run.endY - run.startY + 1;
            const py = (run.startY + run.endY + 1) / 2 * cellSize;
            const px = (run.x + 1) * cellSize + cellSize * 0.6;
            drawLabel(len.toString(), px, py);
        }
    }

    // ═════════════════════════════════════════════════
    // CANVAS RENDERING
    // ═════════════════════════════════════════════════

    function calculateCellSize() {
        const availW = container.clientWidth - 2;  // border
        const availH = container.clientHeight - 2;
        const gridW = state.isOval ? state.diameter : state.diameter;
        const gridH = state.isOval ? state.height : state.diameter;

        let cellSize = Math.min(availW / gridW, availH / gridH);
        cellSize = Math.max(MIN_CELL_SIZE, Math.min(MAX_CELL_SIZE, cellSize));
        return Math.floor(cellSize * state.zoom);
    }

    function fitZoom() {
        const containerW = container.clientWidth || 600;
        const containerH = container.clientHeight || 600;
        const availW = containerW - 40;
        const availH = Math.min(containerH, window.innerHeight - 140) - 40;
        const gridW = state.isOval ? state.diameter : state.diameter;
        const gridH = state.isOval ? state.height : state.diameter;

        const maxCell = Math.min(availW / gridW, availH / gridH);
        const baseCell = Math.max(MIN_CELL_SIZE, Math.min(MAX_CELL_SIZE, maxCell));
        state.zoom = Math.max(0.2, Math.min(4, maxCell / baseCell));
        state.zoom = Math.round(state.zoom * 10) / 10;
        if (state.zoom > 4) state.zoom = 4;
        if (state.zoom < 0.2) state.zoom = 0.2;
        updateZoomDisplay();
    }

    function render() {
        const gridW = state.isOval ? state.diameter : state.diameter;
        const gridH = state.isOval ? state.height : state.diameter;

        // Generate circle data
        state.grid = generateCircle(gridW, gridH, state.fillMode);

        // Calculate cell size
        const availW = container.clientWidth - 2;
        const availH = Math.min(container.clientHeight || 600, window.innerHeight - 140) - 2;

        let baseCell = Math.min(availW / gridW, availH / gridH);
        baseCell = Math.max(MIN_CELL_SIZE, Math.min(MAX_CELL_SIZE, baseCell));
        const cellSize = Math.max(2, Math.floor(baseCell * state.zoom));

        const padding = state.showSegments && cellSize >= 10 ? Math.max(25, cellSize * 1.5) : 2;
        const canvasW = gridW * cellSize + padding * 2;
        const canvasH = gridH * cellSize + padding * 2;

        // Set canvas dimensions
        const dpr = window.devicePixelRatio || 1;
        canvas.width = canvasW * dpr;
        canvas.height = canvasH * dpr;
        canvas.style.width = canvasW + 'px';
        canvas.style.height = canvasH + 'px';
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        // Clear
        ctx.fillStyle = COLORS.bg;
        ctx.fillRect(0, 0, canvasW, canvasH);

        ctx.translate(padding, padding);

        // Draw empty cells background
        ctx.fillStyle = COLORS.empty;
        for (let y = 0; y < gridH; y++) {
            for (let x = 0; x < gridW; x++) {
                if (!state.grid[y][x]) {
                    ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
                }
            }
        }

        // Draw active blocks
        for (let y = 0; y < gridH; y++) {
            for (let x = 0; x < gridW; x++) {
                if (state.grid[y][x]) {
                    const px = x * cellSize;
                    const py = y * cellSize;

                    // Block fill with subtle gradient
                    const grad = ctx.createLinearGradient(px, py, px + cellSize, py + cellSize);
                    grad.addColorStop(0, '#3be0a4');
                    grad.addColorStop(1, '#2cb583');
                    ctx.fillStyle = grad;
                    ctx.fillRect(px + 0.5, py + 0.5, cellSize - 1, cellSize - 1);

                    // Inner highlight (Minecraft block texture feel)
                    if (cellSize > 8) {
                        ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
                        ctx.fillRect(px + 1, py + 1, cellSize - 2, 2);
                        ctx.fillRect(px + 1, py + 1, 2, cellSize - 2);

                        ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
                        ctx.fillRect(px + cellSize - 2, py + 1, 1, cellSize - 2);
                        ctx.fillRect(px + 1, py + cellSize - 2, cellSize - 2, 1);
                    }
                }
            }
        }

        // Draw grid lines
        if (state.showGrid && cellSize >= 6) {
            ctx.strokeStyle = COLORS.gridLine;
            ctx.lineWidth = 0.5;
            ctx.beginPath();
            for (let x = 0; x <= gridW; x++) {
                ctx.moveTo(x * cellSize, 0);
                ctx.lineTo(x * cellSize, canvasH);
            }
            for (let y = 0; y <= gridH; y++) {
                ctx.moveTo(0, y * cellSize);
                ctx.lineTo(canvasW, y * cellSize);
            }
            ctx.stroke();

            // Center lines
            if (cellSize >= 8) {
                ctx.strokeStyle = COLORS.centerLine;
                ctx.lineWidth = 1;
                ctx.setLineDash([4, 4]);
                ctx.beginPath();
                // Vertical center
                const cx = Math.floor(gridW / 2) * cellSize + (gridW % 2 === 0 ? 0 : cellSize / 2);
                ctx.moveTo(cx, 0);
                ctx.lineTo(cx, canvasH);
                // Horizontal center
                const cy = Math.floor(gridH / 2) * cellSize + (gridH % 2 === 0 ? 0 : cellSize / 2);
                ctx.moveTo(0, cy);
                ctx.lineTo(canvasW, cy);
                ctx.stroke();
                ctx.setLineDash([]);
            }
        }

        // Draw hovered cell
        if (state.hoveredCell) {
            const { x, y } = state.hoveredCell;
            if (x >= 0 && x < gridW && y >= 0 && y < gridH) {
                const px = x * cellSize;
                const py = y * cellSize;
                ctx.fillStyle = COLORS.hover;
                ctx.fillRect(px, py, cellSize, cellSize);
                ctx.strokeStyle = COLORS.hoverStroke;
                ctx.lineWidth = 2;
                ctx.strokeRect(px + 1, py + 1, cellSize - 2, cellSize - 2);
            }
        }

        // Draw Segment Guides
        if (state.showSegments && cellSize >= 8) {
            drawSegmentGuides(ctx, gridW, gridH, cellSize, state.grid);
        }

        // Update stats
        const blocks = countBlocks(state.grid);
        animateNumber(blockCountEl, blocks);
        dimensionEl.textContent = `${gridW} × ${gridH}`;
    }

    // ═════════════════════════════════════════════════
    // NUMBER ANIMATION
    // ═════════════════════════════════════════════════

    let animFrame = null;
    let currentDisplayNum = 0;

    function animateNumber(el, target) {
        if (animFrame) cancelAnimationFrame(animFrame);
        const start = currentDisplayNum;
        const diff = target - start;
        if (diff === 0) { el.textContent = target; return; }
        const duration = 300;
        const startTime = performance.now();

        function step(now) {
            const elapsed = now - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3); // easeOutCubic
            const val = Math.round(start + diff * eased);
            el.textContent = val;
            currentDisplayNum = val;
            if (progress < 1) {
                animFrame = requestAnimationFrame(step);
            }
        }
        animFrame = requestAnimationFrame(step);
    }

    // ═════════════════════════════════════════════════
    // EVENT HANDLERS
    // ═════════════════════════════════════════════════

    // Diameter slider
    diameterSlider.addEventListener('input', () => {
        state.diameter = parseInt(diameterSlider.value, 10);
        diameterValue.textContent = state.diameter;
        if (!state.isOval) state.height = state.diameter;
        fitZoom();
        render();
    });

    // Height slider (oval mode)
    heightSlider.addEventListener('input', () => {
        state.height = parseInt(heightSlider.value, 10);
        heightValue.textContent = state.height;
        fitZoom();
        render();
    });

    // Oval toggle
    ovalToggle.addEventListener('change', () => {
        state.isOval = ovalToggle.checked;
        heightGroup.style.display = state.isOval ? 'flex' : 'none';
        if (!state.isOval) {
            state.height = state.diameter;
        } else {
            state.height = parseInt(heightSlider.value, 10);
            heightValue.textContent = state.height;
        }
        fitZoom();
        render();
    });

    // Grid toggle
    gridToggle.addEventListener('change', () => {
        state.showGrid = gridToggle.checked;
        render();
    });

    // Segment toggle
    segmentToggle.addEventListener('change', () => {
        state.showSegments = segmentToggle.checked;
        render();
    });

    // Fill mode buttons
    segBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            segBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            state.fillMode = btn.dataset.fill;
            render();
        });
    });

    // Canvas hover
    canvas.addEventListener('mousemove', (e) => {
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / (window.devicePixelRatio || 1) / rect.width;
        const scaleY = canvas.height / (window.devicePixelRatio || 1) / rect.height;

        const gridW = state.isOval ? state.diameter : state.diameter;
        const gridH = state.isOval ? state.height : state.diameter;

        const availW = container.clientWidth - 2;
        const availH = Math.min(container.clientHeight || 600, window.innerHeight - 140) - 2;
        let baseCell = Math.min(availW / gridW, availH / gridH);
        baseCell = Math.max(MIN_CELL_SIZE, Math.min(MAX_CELL_SIZE, baseCell));
        const cellSize = Math.max(2, Math.floor(baseCell * state.zoom));

        const padding = state.showSegments && cellSize >= 10 ? Math.max(25, cellSize * 1.5) : 2;

        const mouseX = (e.clientX - rect.left) * scaleX - padding;
        const mouseY = (e.clientY - rect.top) * scaleY - padding;

        const cellX = Math.floor(mouseX / cellSize);
        const cellY = Math.floor(mouseY / cellSize);

        if (cellX >= 0 && cellX < gridW && cellY >= 0 && cellY < gridH) {
            state.hoveredCell = { x: cellX, y: cellY };

            // Show tooltip
            const isBlock = state.grid[cellY] && state.grid[cellY][cellX];
            tooltip.textContent = `(${cellX}, ${cellY}) ${isBlock ? '🧱' : ''}`;
            tooltip.style.display = 'block';

            // Position tooltip near cursor
            const tipX = e.clientX - container.getBoundingClientRect().left + 15;
            const tipY = e.clientY - container.getBoundingClientRect().top - 10;
            tooltip.style.left = tipX + 'px';
            tooltip.style.top = tipY + 'px';
        } else {
            state.hoveredCell = null;
            tooltip.style.display = 'none';
        }

        render();
    });

    canvas.addEventListener('mouseleave', () => {
        state.hoveredCell = null;
        tooltip.style.display = 'none';
        render();
    });

    // Zoom controls
    zoomInBtn.addEventListener('click', () => {
        state.zoom = Math.min(4, state.zoom + ZOOM_STEP);
        updateZoomDisplay();
        render();
    });

    zoomOutBtn.addEventListener('click', () => {
        state.zoom = Math.max(0.2, state.zoom - ZOOM_STEP);
        updateZoomDisplay();
        render();
    });

    zoomFitBtn.addEventListener('click', () => {
        fitZoom();
        render();
    });

    function updateZoomDisplay() {
        zoomLevelEl.textContent = Math.round(state.zoom * 100) + '%';
    }

    // Export PNG
    exportBtn.addEventListener('click', () => {
        const gridW = state.isOval ? state.diameter : state.diameter;
        const gridH = state.isOval ? state.height : state.diameter;
        const exportCellSize = Math.max(8, Math.min(32, Math.floor(1600 / Math.max(gridW, gridH))));
        const padding = state.showSegments ? Math.max(40, exportCellSize * 1.5) : 2;

        const exportCanvas = document.createElement('canvas');
        const exportCtx = exportCanvas.getContext('2d');
        const w = gridW * exportCellSize + padding * 2;
        const h = gridH * exportCellSize + padding * 2;
        exportCanvas.width = w;
        exportCanvas.height = h;

        // Background
        exportCtx.fillStyle = COLORS.bg;
        exportCtx.fillRect(0, 0, w, h);

        exportCtx.translate(padding, padding);

        // Empty cells
        exportCtx.fillStyle = COLORS.empty;
        for (let y = 0; y < gridH; y++) {
            for (let x = 0; x < gridW; x++) {
                if (!state.grid[y][x]) {
                    exportCtx.fillRect(x * exportCellSize, y * exportCellSize, exportCellSize, exportCellSize);
                }
            }
        }

        // Active blocks
        for (let y = 0; y < gridH; y++) {
            for (let x = 0; x < gridW; x++) {
                if (state.grid[y][x]) {
                    const px = x * exportCellSize;
                    const py = y * exportCellSize;
                    const grad = exportCtx.createLinearGradient(px, py, px + exportCellSize, py + exportCellSize);
                    grad.addColorStop(0, '#3be0a4');
                    grad.addColorStop(1, '#2cb583');
                    exportCtx.fillStyle = grad;
                    exportCtx.fillRect(px + 0.5, py + 0.5, exportCellSize - 1, exportCellSize - 1);

                    // Texture
                    if (exportCellSize > 8) {
                        exportCtx.fillStyle = 'rgba(255, 255, 255, 0.12)';
                        exportCtx.fillRect(px + 1, py + 1, exportCellSize - 2, 2);
                        exportCtx.fillRect(px + 1, py + 1, 2, exportCellSize - 2);
                        exportCtx.fillStyle = 'rgba(0, 0, 0, 0.15)';
                        exportCtx.fillRect(px + exportCellSize - 2, py + 1, 1, exportCellSize - 2);
                        exportCtx.fillRect(px + 1, py + exportCellSize - 2, exportCellSize - 2, 1);
                    }
                }
            }
        }

        // Grid lines
        exportCtx.strokeStyle = 'rgba(255,255,255,0.06)';
        exportCtx.lineWidth = 0.5;
        exportCtx.beginPath();
        for (let x = 0; x <= gridW; x++) {
            exportCtx.moveTo(x * exportCellSize, 0);
            exportCtx.lineTo(x * exportCellSize, gridH * exportCellSize);
        }
        for (let y = 0; y <= gridH; y++) {
            exportCtx.moveTo(0, y * exportCellSize);
            exportCtx.lineTo(gridW * exportCellSize, y * exportCellSize);
        }
        exportCtx.stroke();

        if (state.showSegments) {
            drawSegmentGuides(exportCtx, gridW, gridH, exportCellSize, state.grid);
        }

        // Download
        const link = document.createElement('a');
        link.download = `minecraft-circle-${gridW}x${gridH}-${state.fillMode}.png`;
        link.href = exportCanvas.toDataURL('image/png');
        link.click();
        showToast('✓ PNG exported successfully!');
    });

    // Copy Data
    copyBtn.addEventListener('click', () => {
        const gridW = state.isOval ? state.diameter : state.diameter;
        const gridH = state.isOval ? state.height : state.diameter;
        const blocks = countBlocks(state.grid);

        let text = `Minecraft Circle Chart\n`;
        text += `Dimension: ${gridW} × ${gridH}\n`;
        text += `Mode: ${state.fillMode}\n`;
        text += `Total Blocks: ${blocks}\n`;
        text += `\nLayer-by-Layer Block Count:\n`;

        for (let y = 0; y < gridH; y++) {
            let rowCount = 0;
            let rowBlocks = [];
            for (let x = 0; x < gridW; x++) {
                if (state.grid[y][x]) {
                    rowCount++;
                    rowBlocks.push(x);
                }
            }
            if (rowCount > 0) {
                text += `  Row ${y + 1}: ${rowCount} blocks (columns: ${rowBlocks.map(b => b + 1).join(', ')})\n`;
            }
        }

        navigator.clipboard.writeText(text).then(() => {
            showToast('✓ Layer data copied to clipboard!');
        }).catch(() => {
            showToast('✗ Copy failed — try again');
        });
    });

    // ═════════════════════════════════════════════════
    // TOAST
    // ═════════════════════════════════════════════════

    function showToast(message) {
        let toast = document.querySelector('.toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.className = 'toast';
            document.body.appendChild(toast);
        }
        toast.textContent = message;
        toast.classList.add('visible');
        setTimeout(() => toast.classList.remove('visible'), 2500);
    }

    // ═════════════════════════════════════════════════
    // RESIZE HANDLER
    // ═════════════════════════════════════════════════

    let resizeTimer;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
            fitZoom();
            render();
        }, 100);
    });

    // ═════════════════════════════════════════════════
    // INIT
    // ═════════════════════════════════════════════════

    function init() {
        // Set initial values
        state.diameter = parseInt(diameterSlider.value, 10);
        state.height = state.diameter;
        diameterValue.textContent = state.diameter;
        heightValue.textContent = state.height;

        // Initial fit & render
        setTimeout(() => {
            fitZoom();
            render();
        }, 50);
    }

    // Start
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
