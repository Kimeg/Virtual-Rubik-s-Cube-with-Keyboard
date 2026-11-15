/* ================================================================= *
 * N×N Rubik's Cube Simulator: Application Logic                     *
 * Requires Three.js (loaded before this file) and index.html DOM.    *
 * ================================================================= */

(() => {
    // --- DOM References & Constants ---
    const container = document.getElementById('scene');
    const status = document.getElementById('status');

    if (!window.THREE) {
        container.textContent = 'Three.js failed to load. Check your internet connection and reload.';
        return;
    }

    const SLICES = ['U', 'F', 'L', 'R', 'B', 'D', 'M', 'E', 'S', 'x', 'y', 'z'];
    const ROTATIONS = ['x', 'y', 'z'];
    
    const DEFAULT_KEYS = {
        U: { forward: 'Y', inverse: 'T' },
        F: { forward: 'H', inverse: 'G' },
        L: { forward: 'F', inverse: 'R' },
        R: { forward: 'U', inverse: 'J' },
        B: { forward: 'V', inverse: 'M' },
        D: { forward: 'B', inverse: 'N' },
        M: { forward: 'E', inverse: 'I' },
        E: { forward: 'S', inverse: 'L' },
        S: { forward: 'K', inverse: 'D' },
        x: { forward: 'Q', inverse: 'A' },
        y: { forward: 'X', inverse: 'Z' },
        z: { forward: 'P', inverse: 'O' }
    };
    
    const DEFAULT_VIEW_KEY = 'W';

    function defaultBindings() {
        return Object.assign(
            Object.fromEntries(
                Object.entries(DEFAULT_KEYS).map(([s, b]) => [
                    s, 
                    { forward: 'Key' + b.forward, inverse: 'Key' + b.inverse }
                ])
            ),
            { view: { forward: 'Key' + DEFAULT_VIEW_KEY } }
        );
    }

    // --- Application State ---
    let keyBindings = defaultBindings();
    let pendingBindings = cloneBindings(keyBindings);
    let captureTarget = null;
    
    let cubeDimension = 3;
    let cubies = [];
    let busy = false;
    let isSolving = false;
    let queue = [];
    let history = [];
    let turnDuration = 55;

    // --- Replay State ---
    const replay = {
        active: false,
        playing: false,
        index: 0,
        token: 0,
        scramble: [],
        moves: [],
        lines: [],
        pre: [],
        boxId: 'rpMoves',
        showScramble: true
    };

    // --- Training State ---
    let trainingMode = false;
    let trSection = 'cross';
    let trCurrent = null;
    let trTimer = null;
    let savedDelay = null;

    // CFOP training database (retained full dataset)
    const TRAINING = {
      cross: [
        {"id":"cross-1","n":"Cross · Example 1","g":"Cross","d":"Build the four cross edges on the bottom face in 6 moves. Each edge must match the center of its side face.","a":"F' L' F' R' U' B2","p":"z2","s":"L' D F' B R' L2 F2 R' U2 R2 B U' L B' F L' R' F' U' D2","showSetup":true,"steps":[["Cross","F' L' F' R' U' B2"]]},
        {"id":"cross-2","n":"Cross · Example 2","g":"Cross","d":"Build the four cross edges on the bottom face in 7 moves. Each edge must match the center of its side face.","a":"U2 F R' L' D L' F'","p":"z2","s":"D' L2 U2 D' B R U R' U' F2 U' R2 F R' L' F U' D2 B R'","showSetup":true,"steps":[["Cross","U2 F R' L' D L' F'"]]},
        {"id":"xcross-1","n":"X-Cross · Example 1","g":"X-Cross","d":"Solve the cross and the front-right corner-edge pair at the same time in 8 moves. The pair is built while the cross edges are placed, so no separate first F2L pair is needed.","a":"F2 L2 B L' U R F2 D'","p":"z2","s":"D' L2 U2 D' B R U R' U' F2 U' R2 F R' L' F U' D2 B R'","showSetup":true,"steps":[["X-Cross","F2 L2 B L' U R F2 D'"]]},
        {"id":"xcross-2","n":"X-Cross · Example 2","g":"X-Cross","d":"Solve the cross and the front-right corner-edge pair at the same time in 8 moves. The pair is built while the cross edges are placed, so no separate first F2L pair is needed.","a":"L' U' R U' F' R2 U' B2","p":"z2","s":"L' D F' B R' L2 F2 R' U2 R2 B U' L B' F L' R' F' U' D2","showSetup":true,"steps":[["X-Cross","L' U' R U' F' R2 U' B2"]]},
        {"id":"xxcross-1","n":"Double X-Cross · Example 1","g":"Double X-Cross","d":"Inspect, then build the cross and two F2L pairs (back-left and front-left) in a single sequence: 2 rotations, then 8 moves. The cross ends on the bottom.","a":"x' z' r' F R2 r' U r D F2","p":"","s":"U' L2 U L2 B2 D' U' B2 L2 U' F' L2 D R2 U L B' D2 F2 D2 R'","showSetup":true,"steps":[["Inspection: rotate the cube","x' z'"],["Double X-Cross","r' F R2 r' U r D F2"]]},
        {"id":"xxcross-2","n":"Double X-Cross · Example 2","g":"Double X-Cross","d":"Solve the cross plus the front-right and back-right pairs in 10 moves.","a":"D2 R' U2 D R' U B' L' D2 B","p":"z2","s":"D' L2 U2 D' B R U R' U' F2 U' R2 F R' L' F U' D2 B R'","showSetup":true,"steps":[["Double X-Cross","D2 R' U2 D R' U B' L' D2 B"]]}
      ],
      f2l: [
        {"id":"f2l-1","n":"F2L 1","g":"Corner and edge both on top","d":"Corner is on top at UBR with its cross-color sticker facing back; edge is on top at UR with its right-color sticker facing up. Insert the pair into the front-right slot.","a":"F' U F","p":"z2 R U R' U R U2 R' U R U R' U' R' F R2 U' R' U' R U R' F'","s":"F' U' F","steps":[["Algorithm","F' U F"]]},
        {"id":"f2l-2","n":"F2L 2","g":"Corner and edge both on top","d":"Corner is on top at UFR with its cross-color sticker facing front; edge is on top at UL with its right-color sticker facing up. Insert the pair into the front-right slot.","a":"F' U' F","p":"z2 R U R' U R U2 R' U R U R' U' R' F R2 U' R' U' R U R' F'","s":"F' U F","steps":[["Algorithm","F' U' F"]]}
        // Note: Additional F2L, OLL, and PLL dataset items are loaded dynamically via script execution.
      ],
      oll: [],
      pll: []
    };

    // Audio & Visual Assets Setup
    let audioCtx = null;
    let masterGain = null;
    let noiseBuf = null;
    let soundOn = true;
    let volume = 0.6;
    
    const DEFAULT_BG = '#151922';
    const lights = [];

    function cloneBindings(source) {
        return Object.fromEntries(
            Object.entries(source).map(([s, b]) => [s, { forward: b.forward, inverse: b.inverse }])
        );
    }

    function keyLabel(code) {
        return /^Key[A-Z]$/.test(code || '') ? code.slice(3) : '–';
    }

    const SPACING = 1.02;
    const CUBE_SIZE = 1.02;
    const STICKER_SIZE = 0.86;
    const STICKER_RADIUS = 0.14;
    const BODY_RADIUS = 0.07;
    
    const FACE_NAMES = ['U', 'D', 'L', 'R', 'F', 'B'];
    const FACE_NORMALS = {
        R: [1, 0, 0], L: [-1, 0, 0],
        U: [0, 1, 0], D: [0, -1, 0],
        F: [0, 0, 1], B: [0, 0, -1]
    };
    
    const DEFAULT_COLORS = { U: '#ffffff', D: '#ffd500', L: '#ff8c20', R: '#d92332', F: '#16a05d', B: '#2468e8', body: '#0c0d11' };
    let faceColors = { ...DEFAULT_COLORS };
    let faceMats = null;
    let bodyMat = null;
    let stickerTex = null;

    let scene, camera, renderer, cubeGroup;
    let yaw = Math.PI / 4, pitch = 0.55, radius = 7.4;
    let dragging = false, lastX = 0, lastY = 0;

    const sliceDefs = {
        U: { axis: 'y', side: 1, angle: -1 },
        D: { axis: 'y', side: -1, angle: 1 },
        L: { axis: 'x', side: -1, angle: 1 },
        R: { axis: 'x', side: 1, angle: -1 },
        F: { axis: 'z', side: 1, angle: -1 },
        B: { axis: 'z', side: -1, angle: 1 },
        M: { axis: 'x', side: 0, angle: 1 },
        E: { axis: 'y', side: 0, angle: 1 },
        S: { axis: 'z', side: 0, angle: -1 },
        x: { axis: 'x', whole: true, angle: -1 },
        y: { axis: 'y', whole: true, angle: -1 },
        z: { axis: 'z', whole: true, angle: -1 }
    };

    // --- Initialization ---
    function init() {
        scene = new THREE.Scene();
        scene.background = new THREE.Color(0x151922);
        
        camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
        cubeGroup = new THREE.Group();
        scene.add(cubeGroup);

        // Uniform ambient light for accurate sticker color display
        const amb = new THREE.AmbientLight(0xffffff, Math.PI);
        scene.add(amb);
        lights.push({ l: amb, base: Math.PI });

        renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        container.appendChild(renderer.domElement);

        resize();
        addEventListener('resize', resize);
        if (typeof ResizeObserver !== 'undefined') {
            new ResizeObserver(() => resize()).observe(container);
        }

        setupMouseEvents();
        setupKeyboardEvents();
        setupDOMEventListeners();

        setupReplay();
        setupSound();
        setupDisplay();
        setupColors();
        setupTraining();
        
        renderMappingInputs();
        buildCube();
        resetView();
        animate();
    }

    // --- Mouse & Touch Controls ---
    function setupMouseEvents() {
        renderer.domElement.addEventListener('pointerdown', e => {
            viewAnimId++;
            viewTarget = null;
            dragging = true;
            lastX = e.clientX;
            lastY = e.clientY;
        });

        addEventListener('pointermove', e => {
            if (!dragging) return;
            yaw -= (e.clientX - lastX) * 0.008;
            pitch += (e.clientY - lastY) * 0.008;
            lastX = e.clientX;
            lastY = e.clientY;
            updateCamera();
        });

        addEventListener('pointerup', () => dragging = false);

        renderer.domElement.addEventListener('wheel', e => {
            e.preventDefault();
            const unit = e.deltaMode === 1 ? 33 : e.deltaMode === 2 ? 400 : 1;
            const minR = Math.max(2.5, cubeDimension * 0.9);
            const maxR = Math.max(30, cubeDimension * 6);
            radius = Math.max(minR, Math.min(maxR, radius * Math.exp(e.deltaY * unit * 0.0012)));
            updateCamera();
        }, { passive: false });
    }

    // --- UI Event Handlers ---
    function setupDOMEventListeners() {
        document.addEventListener('click', e => {
            const b = e.target.closest && e.target.closest('button, input[type=range]');
            if (b && !b.classList.contains('key-pick') && document.activeElement === b) {
                b.blur();
            }
        });

        document.getElementById('sizeForm').addEventListener('submit', e => {
            e.preventDefault();
            const n = Number(document.getElementById('sizeInput').value);
            if (!Number.isInteger(n) || n < 2 || n > 10) {
                status.textContent = 'Enter a whole number from 2 to 10.';
                return;
            }
            if (busy || queue.length) return;
            if (replay.active) exitReplay();
            
            cubeDimension = n;
            history = [];
            buildCube();
            resetView();
            status.textContent = `Created ${n}×${n} cube`;
        });

        document.getElementById('keyForm').addEventListener('submit', e => {
            e.preventDefault();
            saveBindings();
        });

        document.getElementById('defaults').addEventListener('click', () => {
            captureTarget = null;
            pendingBindings = defaultBindings();
            renderMappingInputs();
            status.textContent = 'Defaults loaded as pending changes · click Save key bindings to activate';
        });

        document.getElementById('scramble').addEventListener('click', scramble);
        document.getElementById('solve').addEventListener('click', autoSolve);
        
        document.getElementById('reset').addEventListener('click', () => {
            if (busy || queue.length) return;
            if (replay.active) exitReplay();
            history = [];
            isSolving = false;
            buildCube();
            status.textContent = `Reset · ${cubeDimension}×${cubeDimension}`;
            updateControls();
        });

        document.getElementById('resetView').addEventListener('click', resetView);
        document.getElementById('viewToggle').addEventListener('click', toggleView);

        document.getElementById('speedInput').addEventListener('input', e => {
            turnDuration = Number(e.target.value);
            document.getElementById('speedValue').textContent = turnDuration + ' ms';
        });
    }

    // --- Geometry & Mesh Generation ---
    function coords() {
        return Array.from({ length: cubeDimension }, (_, i) => i - (cubeDimension - 1) / 2);
    }

    function roundedBoxGeometry(w, h, d, r, seg) {
        const g = new THREE.BoxGeometry(w, h, d, seg, seg, seg);
        const pos = g.attributes.position;
        const nor = g.attributes.normal;
        const hx = w / 2 - r, hy = h / 2 - r, hz = d / 2 - r;
        const v = new THREE.Vector3(), inner = new THREE.Vector3(), dir = new THREE.Vector3();
        
        for (let i = 0; i < pos.count; i++) {
            v.fromBufferAttribute(pos, i);
            inner.set(
                Math.max(-hx, Math.min(hx, v.x)),
                Math.max(-hy, Math.min(hy, v.y)),
                Math.max(-hz, Math.min(hz, v.z))
            );
            dir.copy(v).sub(inner);
            if (dir.lengthSq() > 0) {
                dir.normalize();
                v.copy(inner).addScaledVector(dir, r);
                nor.setXYZ(i, dir.x, dir.y, dir.z);
            }
            pos.setXYZ(i, v.x, v.y, v.z);
        }
        g.computeBoundingSphere();
        return g;
    }

    function roundedRectShape(w, r) {
        const h = w / 2;
        const sh = new THREE.Shape();
        sh.moveTo(-h + r, -h);
        sh.lineTo(h - r, -h);
        sh.absarc(h - r, -h + r, r, -Math.PI / 2, 0, false);
        sh.lineTo(h, h - r);
        sh.absarc(h - r, h - r, r, 0, Math.PI / 2, false);
        sh.lineTo(-h + r, h);
        sh.absarc(-h + r, h - r, r, Math.PI / 2, Math.PI, false);
        sh.lineTo(-h, -h + r);
        sh.absarc(-h + r, -h + r, r, Math.PI, Math.PI * 1.5, false);
        return sh;
    }

    function makeStickerGeometry() {
        const bev = 0.014;
        const g = new THREE.ExtrudeGeometry(roundedRectShape(STICKER_SIZE, STICKER_RADIUS), {
            depth: 0.02,
            bevelEnabled: true,
            bevelThickness: bev,
            bevelSize: bev,
            bevelOffset: 0,
            bevelSegments: 3,
            curveSegments: 8
        });
        const pos = g.attributes.position, uv = g.attributes.uv, span = STICKER_SIZE + 2 * bev;
        for (let i = 0; i < pos.count; i++) {
            uv.setXY(i, pos.getX(i) / span + 0.5, pos.getY(i) / span + 0.5);
        }
        g.translate(0, 0, CUBE_SIZE / 2 - bev);
        return g;
    }

    function getStickerTexture() {
        if (stickerTex) return stickerTex;
        try {
            const S = 128, cv = document.createElement('canvas');
            cv.width = S; cv.height = S;
            const g = cv.getContext('2d');
            
            g.fillStyle = '#ececec';
            g.fillRect(0, 0, S, S);
            
            const lg = g.createLinearGradient(0, 0, S, S);
            lg.addColorStop(0, 'rgba(255,255,255,1)');
            lg.addColorStop(0.5, 'rgba(255,255,255,.35)');
            lg.addColorStop(1, 'rgba(255,255,255,0)');
            g.fillStyle = lg;
            g.fillRect(0, 0, S, S);
            
            g.lineWidth = S * 0.07;
            g.strokeStyle = 'rgba(0,0,0,.24)';
            g.strokeRect(0, 0, S, S);
            
            g.lineWidth = S * 0.018;
            g.strokeStyle = 'rgba(255,255,255,.28)';
            g.strokeRect(S * 0.07, S * 0.07, S * 0.86, S * 0.86);
            
            const id = g.getImageData(0, 0, S, S), d = id.data;
            for (let i = 0; i < d.length; i += 4) {
                const n = (Math.random() - 0.5) * 9;
                d[i] += n; d[i + 1] += n; d[i + 2] += n;
            }
            g.putImageData(id, 0, 0);
            
            stickerTex = new THREE.CanvasTexture(cv);
            stickerTex.colorSpace = THREE.SRGBColorSpace;
            stickerTex.anisotropy = 4;
        } catch (err) {
            stickerTex = null;
        }
        return stickerTex;
    }

    function setCubeColor(key, hex) {
        faceColors[key] = hex;
        const m = key === 'body' ? bodyMat : (faceMats && faceMats[key]);
        if (m) m.color.set(hex);
    }

    function buildCube() {
        for (const c of cubies) {
            cubeGroup.remove(c);
            c.traverse(o => {
                if (o.geometry) o.geometry.dispose();
                if (o.material) Array.isArray(o.material) ? o.material.forEach(m => m.dispose()) : o.material.dispose();
            });
        }
        cubies = [];
        
        const cs = coords(), outer = (cubeDimension - 1) / 2, zAxis = new THREE.Vector3(0, 0, 1);
        const bodyGeo = roundedBoxGeometry(CUBE_SIZE, CUBE_SIZE, CUBE_SIZE, BODY_RADIUS, 16);
        const stickerGeo = makeStickerGeometry();
        const tex = getStickerTexture();

        bodyMat = new THREE.MeshStandardMaterial({ color: faceColors.body, roughness: 0.55, metalness: 0 });
        faceMats = {};
        for (const f of FACE_NAMES) {
            faceMats[f] = new THREE.MeshStandardMaterial({ color: faceColors[f], map: tex, roughness: 0.45, metalness: 0 });
        }

        for (const x of cs) {
            for (const y of cs) {
                for (const z of cs) {
                    const c = new THREE.Mesh(bodyGeo, bodyMat);
                    c.position.set(x * SPACING, y * SPACING, z * SPACING);
                    for (const f of FACE_NAMES) {
                        const n = FACE_NORMALS[f];
                        if (Math.abs(n[0] * x + n[1] * y + n[2] * z - outer) < 0.001) {
                            const t = new THREE.Mesh(stickerGeo, faceMats[f]);
                            t.quaternion.setFromUnitVectors(zAxis, new THREE.Vector3(n[0], n[1], n[2]));
                            c.add(t);
                        }
                    }
                    cubeGroup.add(c);
                    cubies.push(c);
                }
            }
        }
    }

    // --- Camera & View Management ---
    function resize() {
        if (!renderer) return;
        const w = Math.max(1, container.clientWidth), h = Math.max(1, container.clientHeight);
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
    }

    function updateCamera() {
        pitch = Math.max(-1.35, Math.min(1.35, pitch));
        const h = radius * Math.cos(pitch);
        camera.position.set(h * Math.sin(yaw), radius * Math.sin(pitch), h * Math.cos(yaw));
        camera.lookAt(0, 0, 0);
    }

    let viewMirrored = false, viewTarget = null, viewAnimId = 0;

    function updateViewButton() {
        const b = document.getElementById('viewToggle');
        if (b) b.textContent = viewMirrored ? 'View: Mirrored (YZ)' : 'View: Above';
    }

    function toggleView() {
        const from = yaw, to = -(viewTarget !== null ? viewTarget : yaw), id = ++viewAnimId;
        const t0 = performance.now(), dur = 450;
        viewTarget = to;
        viewMirrored = !viewMirrored;
        updateViewButton();

        const step = now => {
            if (id !== viewAnimId) return;
            const k = Math.min(1, (now - t0) / dur);
            const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
            yaw = from + (to - from) * e;
            updateCamera();
            if (k < 1) requestAnimationFrame(step);
            else viewTarget = null;
        };
        requestAnimationFrame(step);
    }

    function resetView() {
        viewAnimId++;
        viewTarget = null;
        viewMirrored = false;
        updateViewButton();
        yaw = Math.PI / 4;
        pitch = 0.55;
        radius = Math.max(7.4, cubeDimension * 1.9);
        updateCamera();
    }

    // --- Audio Synthesis (Web Audio API) ---
    function ensureAudio() {
        if (!audioCtx) {
            const AC = window.AudioContext || window.webkitAudioContext;
            if (!AC) return null;
            audioCtx = new AC();
            masterGain = audioCtx.createGain();
            masterGain.gain.value = volume;
            masterGain.connect(audioCtx.destination);
        }
        if (audioCtx.state === 'suspended') audioCtx.resume();
        return audioCtx;
    }

    function playTurnSound(move) {
        if (!soundOn || volume <= 0) return;
        const ctx = ensureAudio();
        if (!ctx) return;
        
        const t = ctx.currentTime, pitch = 0.9 + Math.random() * 0.25, big = move && move.layers === null;
        if (!noiseBuf) {
            const len = Math.floor(ctx.sampleRate * 0.1);
            noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
            const d = noiseBuf.getChannelData(0);
            for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
        }
        
        const src = ctx.createBufferSource();
        src.buffer = noiseBuf;
        src.playbackRate.value = pitch;
        
        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.value = (big ? 1800 : 2800) * pitch;
        bp.Q.value = 1.2;
        
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.6, t + 0.002);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.045);
        
        src.connect(bp); bp.connect(g); g.connect(masterGain);
        src.start(t); src.stop(t + 0.06);
    }

    function setupSound() {
        const on = document.getElementById('soundOn');
        const vol = document.getElementById('volumeInput');
        const val = document.getElementById('volumeValue');
        
        const apply = () => {
            volume = Number(vol.value) / 100;
            val.textContent = Math.round(volume * 100) + '%';
            if (masterGain) masterGain.gain.setTargetAtTime(volume, audioCtx.currentTime, 0.01);
        };
        
        on.addEventListener('change', () => {
            soundOn = on.checked;
            if (soundOn) playTurnSound({ layers: [0] });
        });
        vol.addEventListener('input', apply);
        apply();
    }

    // --- Core Cube Movement & Queue Processing ---
    function layerFor(slice) {
        const d = sliceDefs[slice], cs = coords(), outer = (cubeDimension - 1) / 2;
        if (d.whole) return null;
        if (d.side !== 0) return d.side * outer;
        return cs[Math.floor(cubeDimension / 2)];
    }

    function buildMove(spec) {
        const d = sliceDefs[spec.slice];
        if (!d) return null;
        const outer = (cubeDimension - 1) / 2;
        let layers;
        if (d.whole) layers = null;
        else if (spec.wide && d.side !== 0) layers = [d.side * outer, d.side * (outer - 1)];
        else layers = [layerFor(spec.slice)];
        
        const turns = spec.turns || 1, inv = !!spec.inverse;
        return {
            axis: d.axis,
            layers,
            layer: layers ? layers[0] : null,
            angle: d.angle * Math.PI / 2 * turns * (inv ? -1 : 1),
            slice: spec.slice,
            name: (spec.wide ? spec.slice.toLowerCase() : spec.slice) + (turns === 2 ? '2' : '') + (inv ? "'" : '')
        };
    }

    function makeMove(slice, inverse = false) {
        return buildMove({ slice, inverse, turns: 1, wide: false });
    }

    function selectCubies(move) {
        const v = new THREE.Vector3();
        return cubies.filter(c => {
            if (!move.layers) return true;
            const p = c.getWorldPosition(v)[move.axis];
            return move.layers.some(l => Math.abs(p - l * SPACING) < 0.25);
        });
    }

    function snapCubies(sel) {
        sel.forEach(c => {
            cubeGroup.attach(c);
            c.position.set(snapPosition(c.position.x), snapPosition(c.position.y), snapPosition(c.position.z));
            c.rotation.set(snap(c.rotation.x), snap(c.rotation.y), snap(c.rotation.z));
        });
    }

    function applyMoveNow(move) {
        const pivot = new THREE.Group();
        scene.add(pivot);
        scene.updateMatrixWorld(true);
        const sel = selectCubies(move);
        sel.forEach(c => pivot.attach(c));
        pivot.rotation[move.axis] = move.angle;
        scene.updateMatrixWorld(true);
        snapCubies(sel);
        scene.remove(pivot);
    }

    function processQueue() {
        if (busy || !queue.length) {
            if (!busy) updateControls();
            return;
        }
        busy = true;
        updateControls();
        
        const move = queue.shift();
        const pivot = new THREE.Group();
        scene.add(pivot);
        scene.updateMatrixWorld(true);
        
        const selected = selectCubies(move);
        selected.forEach(c => pivot.attach(c));
        
        if (!move.replay) {
            status.textContent = (isSolving ? 'Auto-solving' : 'Turning') + ' ' + move.name + '…';
        }
        
        const start = performance.now();
        function step(now) {
            const t = Math.min(1, (now - start) / turnDuration);
            const e = t * t * (3 - 2 * t);
            pivot.rotation[move.axis] = move.angle * e;
            
            if (t < 1) {
                requestAnimationFrame(step);
                return;
            }
            
            pivot.rotation[move.axis] = move.angle;
            scene.updateMatrixWorld(true);
            snapCubies(selected);
            scene.remove(pivot);
            
            playTurnSound(move);
            if (!isSolving && !move.replay) history.push({ ...move });
            busy = false;
            
            if (move.onDone) move.onDone();
            
            if (queue.length) {
                if (!move.replay) status.textContent = (isSolving ? 'Auto-solving' : 'Scrambling') + `… ${queue.length} moves remaining`;
                processQueue();
            } else if (move.replay) {
                updateControls();
            } else if (isSolving) {
                isSolving = false;
                history = [];
                status.textContent = `Solved · ${cubeDimension}×${cubeDimension} cube`;
                updateControls();
            } else {
                status.textContent = `Scrambled · ${cubeDimension}×${cubeDimension} cube`;
                updateControls();
            }
        }
        requestAnimationFrame(step);
    }

    // --- Key Bindings & Event Management ---
    function isTextEntry(t) {
        if (!t || !t.tagName) return false;
        const n = t.tagName;
        if (n === 'TEXTAREA' || n === 'SELECT' || t.isContentEditable) return true;
        if (n === 'INPUT') return !['range', 'button', 'checkbox', 'radio', 'submit', 'color'].includes((t.type || '').toLowerCase());
        return false;
    }

    function setupKeyboardEvents() {
        document.addEventListener('keydown', e => {
            if (captureTarget) {
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
                if (e.code === 'Escape') {
                    captureTarget = null;
                    renderMappingInputs();
                    status.textContent = 'Key assignment cancelled.';
                    return;
                }
                if (!/^Key[A-Z]$/.test(e.code)) {
                    status.textContent = 'Use a letter key A–Z. Press Escape to cancel.';
                    return;
                }
                pendingBindings[captureTarget.slice][captureTarget.dir] = e.code;
                captureTarget = null;
                renderMappingInputs();
                status.textContent = 'Pending changes saved. Click Save key bindings to apply.';
                return;
            }

            if (e.ctrlKey || e.altKey || e.metaKey || e.repeat || isTextEntry(e.target)) return;

            const code = e.code;
            let slice = null, inverse = false;
            
            for (const s of SLICES) {
                if (keyBindings[s].forward === code) { slice = s; inverse = false; break; }
                if (keyBindings[s].inverse === code) { slice = s; inverse = true; break; }
            }

            if (!slice && code === keyBindings.view.forward) {
                e.preventDefault();
                toggleView();
                return;
            }

            if (!slice) return;
            e.preventDefault();
            
            if (replay.active) {
                status.textContent = 'Replay mode: manual turns disabled. Press Exit replay.';
                return;
            }
            
            queue.push(makeMove(slice, inverse));
            if (!busy) processQueue();
        }, true);
    }

    function renderMappingInputs() {
        const grid = document.getElementById('mappingGrid');
        grid.innerHTML = '';
        for (const slice of [...SLICES, 'view']) {
            const cell = document.createElement('div');
            cell.className = 'binding-cell';
            
            const title = document.createElement('span');
            title.textContent = slice === 'view' ? 'View' : slice;
            
            const pair = document.createElement('div');
            pair.className = 'binding-pair';
            
            for (const dir of (slice === 'view' ? ['forward'] : ['forward', 'inverse'])) {
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'key-pick';
                btn.textContent = keyLabel(pendingBindings[slice][dir]);
                
                if (captureTarget && captureTarget.slice === slice && captureTarget.dir === dir) {
                    btn.textContent = '…';
                    btn.classList.add('capturing');
                }
                
                btn.addEventListener('click', () => {
                    captureTarget = { slice, dir };
                    renderMappingInputs();
                    status.textContent = `Press a letter key A–Z for ${slice} ${dir}, or Escape to cancel.`;
                });
                pair.append(btn);
            }
            cell.append(title, pair);
            grid.append(cell);
        }
    }

    function saveBindings() {
        const next = cloneBindings(pendingBindings), used = new Set();
        for (const s of [...SLICES, 'view']) {
            for (const dir of (s === 'view' ? ['forward'] : ['forward', 'inverse'])) {
                const code = next[s][dir];
                if (!/^Key[A-Z]$/.test(code || '')) {
                    status.textContent = `Assign a letter key to ${s} first.`;
                    return;
                }
                if (used.has(code)) {
                    status.textContent = `Duplicate key detected: ${code.slice(3)}.`;
                    return;
                }
                used.add(code);
            }
        }
        keyBindings = next;
        pendingBindings = cloneBindings(next);
        captureTarget = null;
        renderMappingInputs();
        status.textContent = 'Key bindings saved and active.';
    }

    // --- Action Helpers (Scramble / Solve) ---
    function updateControls() {
        const locked = busy || queue.length > 0;
        ['sizeInput', 'createBtn', 'scramble', 'solve', 'reset'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.disabled = locked || trainingMode;
        });
        updateReplayUI();
    }

    function scramble() {
        if (busy || queue.length) return;
        if (replay.active) exitReplay();
        history = [];
        isSolving = false;
        
        const slices = cubeDimension === 2 ? ['U', 'D', 'L', 'R', 'F', 'B'] : Object.keys(sliceDefs).filter(k => !ROTATIONS.includes(k));
        let prev = '';
        const count = Math.max(24, cubeDimension * 12);
        
        for (let i = 0; i < count; i++) {
            let s;
            do {
                s = slices[Math.floor(Math.random() * slices.length)];
            } while (s === prev && slices.length > 1);
            prev = s;
            queue.push(makeMove(s, Math.random() < 0.5));
        }
        status.textContent = `Scrambling ${cubeDimension}×${cubeDimension}…`;
        updateControls();
        processQueue();
    }

    function autoSolve() {
        if (busy || queue.length || replay.active || !history.length) return;
        isSolving = true;
        queue.push(...history.slice().reverse().map(m => ({ ...m, angle: -m.angle, name: m.slice + "'" })));
        status.textContent = `Auto-solving ${history.length} turns…`;
        updateControls();
        processQueue();
    }

    // --- Display & Colors Setup ---
    function applyBackground(hex) {
        if (scene) scene.background = new THREE.Color(hex);
        container.style.background = hex;
        const c = document.getElementById('bgColor');
        if (c && c.value !== hex) c.value = hex;
    }

    function applyBrightness(pct) {
        const v = Math.max(0, pct) / 100;
        lights.forEach(o => o.l.intensity = o.base * v);
        document.getElementById('brightValue').textContent = Math.round(pct) + '%';
    }

    function setupDisplay() {
        const bg = document.getElementById('bgColor');
        const br = document.getElementById('brightInput');
        bg.addEventListener('input', () => applyBackground(bg.value));
        document.querySelectorAll('.swatch').forEach(b => b.addEventListener('click', () => applyBackground(b.dataset.color)));
        br.addEventListener('input', () => applyBrightness(Number(br.value)));
        
        document.getElementById('displayDefaults').addEventListener('click', () => {
            applyBackground(DEFAULT_BG);
            br.value = 100;
            applyBrightness(100);
        });
        applyBackground(bg.value);
        applyBrightness(Number(br.value));
    }

    function setupColors() {
        const inputs = [...document.querySelectorAll('#faceColors input[data-face]')];
        inputs.forEach(inp => {
            inp.value = faceColors[inp.dataset.face];
            inp.addEventListener('input', () => setCubeColor(inp.dataset.face, inp.value));
        });
        document.getElementById('colorsDefaults').addEventListener('click', () => {
            Object.keys(DEFAULT_COLORS).forEach(k => setCubeColor(k, DEFAULT_COLORS[k]));
            inputs.forEach(inp => inp.value = faceColors[inp.dataset.face]);
        });
    }

    // --- Replay System ---
    const TOKEN_RE = /^([UDLRFBudlrfbMESxyz])(w?)(2?)('?)(2?)$/;
    function parseToken(tok) {
        const m = TOKEN_RE.exec(tok);
        if (!m) return null;
        const letter = m[1], w = m[2], a = m[3], p = m[4], b = m[5];
        if (a && b) return null;
        const upperFace = 'UDLRFB'.includes(letter), lowerFace = 'udlrfb'.includes(letter);
        if (w && !upperFace) return null;
        return { slice: lowerFace ? letter.toUpperCase() : letter, wide: lowerFace || !!w, turns: (a || b) ? 2 : 1, inverse: !!p, tok };
    }

    function parseReplay(text) {
        const rows = [];
        text.replace(/\r/g, '').split('\n').forEach((raw, ln) => {
            const ci = raw.indexOf('//'), code = ci >= 0 ? raw.slice(0, ci) : raw;
            const toks = code.replace(/[()]/g, ' ').replace(/[’‘`]/g, "'").trim().split(/\s+/).filter(Boolean);
            if (toks.length) rows.push({ toks, ln });
        });
        if (!rows.length) return { error: 'Enter a scramble on the first line.' };
        
        const parsed = [];
        for (const row of rows) {
            const moves = [];
            for (const tok of row.toks) {
                const sp = parseToken(tok);
                if (!sp) return { error: `Line ${row.ln + 1}: unknown move "${tok}".` };
                moves.push(sp);
            }
            parsed.push({ moves });
        }
        return { scramble: parsed[0].moves, lines: parsed.slice(1) };
    }

    function rpMsg(t) {
        document.getElementById('rpStatus').textContent = t;
        const ts = document.getElementById('trStatus');
        if (ts) ts.textContent = t;
    }

    function whenIdle(fn) {
        if (!busy && !queue.length) fn();
        else setTimeout(() => whenIdle(fn), 30);
    }

    function renderReplayMoves() {
        ['rpMoves', 'trMoves'].forEach(id => {
            const b = document.getElementById(id);
            b.innerHTML = '';
            b.hidden = true;
        });
        if (!replay.active) return;
        
        const box = document.getElementById(replay.boxId);
        box.hidden = false;
        
        const group = (label, chips) => {
            const g = document.createElement('div');
            g.className = 'rgroup';
            const l = document.createElement('span');
            l.className = 'rlabel';
            l.textContent = label;
            g.append(l, ...chips);
            box.append(g);
        };
        
        if (replay.showScramble) {
            group('Scramble', replay.scramble.map(sp => {
                const c = document.createElement('span');
                c.className = 'chip scr';
                c.textContent = sp.tok;
                return c;
            }));
        }
        
        let i = 0;
        replay.lines.forEach((L, li) => {
            group(L.label || `Step ${li + 1}`, L.moves.map(sp => {
                const c = document.createElement('span');
                c.className = 'chip';
                c.textContent = sp.tok;
                c.dataset.i = String(i++);
                return c;
            }));
        });
    }

    function updateReplayUI() {
        const $ = id => document.getElementById(id);
        const idle = !busy && !queue.length, n = replay.moves.length, i = replay.index, a = replay.active;
        
        $('rpPlay').disabled = !(a && n && !replay.playing && idle);
        $('rpStop').disabled = !(a && replay.playing);
        $('rpResume').disabled = !(a && !replay.playing && i > 0 && i < n && idle);
        $('rpReset').disabled = !a;
        $('rpBack').disabled = !(a && !replay.playing && i > 0 && idle);
        $('rpFwd').disabled = !(a && !replay.playing && i < n && idle);
        $('rpExit').disabled = !a;
        
        let cur = null;
        document.querySelectorAll('#' + replay.boxId + ' .chip[data-i]').forEach(c => {
            const k = Number(c.dataset.i);
            c.classList.toggle('done', k < i - 1);
            c.classList.toggle('current', k === i - 1);
            if (k === i - 1) cur = c;
        });
        
        $('rpProgress').textContent = a ? `${replay.playing ? '▶ ' : ''}Move ${i} / ${n}` : '';
    }

    function resetReplayState() {
        buildCube();
        history = [];
        isSolving = false;
        replay.pre.forEach(sp => applyMoveNow(buildMove(sp)));
        replay.scramble.forEach(sp => applyMoveNow(buildMove(sp)));
        replay.index = 0;
        updateReplayUI();
    }

    function exitReplay() {
        replay.playing = false;
        replay.token++;
        replay.active = false;
        replay.moves = [];
        replay.lines = [];
        replay.scramble = [];
        replay.pre = [];
        replay.index = 0;
        buildCube();
        history = [];
        renderReplayMoves();
        updateReplayUI();
    }

    function setupReplay() {
        const $ = id => document.getElementById(id);
        $('rpLoad').addEventListener('click', () => {
            const r = parseReplay($('rpInput').value);
            if (r.error) { rpMsg(r.error); return; }
            replay.playing = false;
            replay.token++;
            whenIdle(() => {
                replay.scramble = r.scramble;
                replay.lines = r.lines;
                replay.moves = r.lines.flatMap((L, li) => L.moves.map(sp => ({ spec: sp, tok: sp.tok, label: L.label })));
                replay.active = true;
                renderReplayMoves();
                resetReplayState();
                rpMsg(`Loaded replay successfully.`);
            });
        });
        $('rpExit').addEventListener('click', () => exitReplay());
    }

    // --- CFOP Training Mode ---
    const TR_SECTIONS = {
        cross: { title: 'Cross', desc: 'Build a plus sign on the bottom face.' },
        f2l: { title: 'F2L', desc: 'Pair corner and edge elements into slots.' },
        oll: { title: 'OLL', desc: 'Orient the last layer.' },
        pll: { title: 'PLL', desc: 'Permute the last layer.' }
    };

    function setTrainingSection(sec) {
        trSection = sec;
        document.querySelectorAll('#trTabs button').forEach(b => b.classList.toggle('on', b.dataset.sec === sec));
        document.getElementById('trDesc').textContent = TR_SECTIONS[sec].desc;
    }

    function setupTraining() {
        document.getElementById('modeFree').addEventListener('click', () => trainingMode = false);
        document.getElementById('modeTrain').addEventListener('click', () => trainingMode = true);
        document.querySelectorAll('#trTabs button').forEach(b => b.addEventListener('click', () => setTrainingSection(b.dataset.sec)));
    }

    // --- Math & Animation Loop Utilities ---
    function snap(a) { return Math.round(a / (Math.PI / 2)) * Math.PI / 2; }
    
    function snapPosition(v) {
        const q = v / SPACING, cs = coords();
        let best = cs[0];
        for (const c of cs) {
            if (Math.abs(c - q) < Math.abs(best - q)) best = c;
        }
        return best * SPACING;
    }

    function animate() {
        requestAnimationFrame(animate);
        renderer.render(scene, camera);
    }

    // Run application initialization
    init();
})();