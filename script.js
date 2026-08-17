// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-app.js";
import { getDatabase, ref, set, onValue, update, remove } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-database.js";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyBrg6Vx6KIcmI62J9NGrqmQLLVBs82ZMxQ",
  authDomain: "notepepp.firebaseapp.com",
  databaseURL: "https://notepepp-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "notepepp",
  storageBucket: "notepepp.firebasestorage.app",
  messagingSenderId: "369261230180",
  appId: "1:369261230180:web:1ca3366b2d62c4e8578771",
  measurementId: "G-16S87HQR8Q"
};
// Initialize the Database
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// ==========================================
// 1. HUB PAGE LOGIC (index.html)
// ==========================================
if (document.getElementById('board-grid')) {
    const boardsRef = ref(db, 'whiteboard_list');

    // Auto-sync boards across all users
    onValue(boardsRef, (snapshot) => {
        const data = snapshot.val() || {};
        console.log('onValue whiteboard_list snapshot:', data);
        const boards = Object.values(data);
        console.log('parsed boards:', boards);
        renderBoards(boards);
    }, (error) => {
        console.error('onValue whiteboard_list error:', error);
    });

    function renderBoards(boards) {
        console.log('renderBoards called with', boards);
        const grid = document.getElementById('board-grid');
        grid.innerHTML = ''; 

        boards.forEach(board => {
            const container = document.createElement('div');
            container.className = 'board-box-container';

            const link = document.createElement('a');
            link.href = `board.html?id=${board.id}&name=${encodeURIComponent(board.name)}`;
            link.className = 'board-box';
            link.innerHTML = `<h2>${board.name}</h2>`;

            container.appendChild(link);
            grid.appendChild(container);
        });
    }

    document.getElementById('add-board-btn').addEventListener('click', () => {
        const boardName = prompt("Enter a name for your new whiteboard:");
        if (boardName && boardName.trim() !== "") {
            const uniqueId = 'board_' + Date.now();
            set(ref(db, 'whiteboard_list/' + uniqueId), {
                id: uniqueId,
                name: boardName.trim()
            });
        }
    });
}

// ==========================================
// 2. WHITEBOARD LOGIC (board.html)
// ==========================================
if (document.getElementById('board-container')) {
    const urlParams = new URLSearchParams(window.location.search);
    const boardId = urlParams.get('id');
    const boardName = urlParams.get('name') || "Whiteboard";
    
    if (!boardId) window.location.href = 'index.html';

    document.getElementById('board-title').innerText = decodeURIComponent(boardName);

    const notesRef = ref(db, 'whiteboard_data/' + boardId);

    // Local DOM cache and debounce timers to avoid re-rendering on every keystroke
    const noteElements = {};
    const updateTimers = {};
    const DEBOUNCE_MS = 600;

    // Auto-sync notes across all users in real-time
    onValue(notesRef, (snapshot) => {
        const data = snapshot.val() || {};
        renderNotes(data);
    }, (error) => {
        console.error('onValue notesRef error:', error);
    });

    function createNoteElement(noteId, note) {
        const noteEl = document.createElement('div');
        noteEl.className = 'note' + (note.type === 'image' ? ' image-note' : '');

        // Delete Button
        const delBtn = document.createElement('button');
        delBtn.className = 'delete-btn';
        delBtn.innerText = '✕';
        delBtn.onclick = () => {
            remove(ref(db, `whiteboard_data/${boardId}/${noteId}`));
        };
        noteEl.appendChild(delBtn);

        if (note.type === 'text') {
            const textarea = document.createElement('textarea');
            textarea.value = note.content || '';
            textarea.placeholder = "Write something here...";

            // Debounced update to the database
            textarea.addEventListener('input', (e) => {
                if (updateTimers[noteId]) clearTimeout(updateTimers[noteId]);
                updateTimers[noteId] = setTimeout(() => {
                    update(ref(db, `whiteboard_data/${boardId}/${noteId}`), { content: textarea.value }).catch(err => console.error('update note error', err));
                    delete updateTimers[noteId];
                }, DEBOUNCE_MS);
            });

            // Flush pending update on blur
            textarea.addEventListener('blur', () => {
                if (updateTimers[noteId]) {
                    clearTimeout(updateTimers[noteId]);
                    update(ref(db, `whiteboard_data/${boardId}/${noteId}`), { content: textarea.value }).catch(err => console.error('update note error', err));
                    delete updateTimers[noteId];
                }
            });

            noteEl.appendChild(textarea);
            noteElements[noteId] = { el: noteEl, textarea };
        } else if (note.type === 'image') {
            const img = document.createElement('img');
            img.src = note.content;
            noteEl.appendChild(img);
            noteElements[noteId] = { el: noteEl };
        }

        // Apply color if present (or default pastel)
        try {
            const defaultHue = 50; // yellowish default
            const SAT = 60; // saturation for pastel
            const LIGHT = 85; // lightness for pastel
            const color = note.color || `hsl(${defaultHue}, ${SAT}%, ${LIGHT}%)`;
            noteEl.style.backgroundColor = color;
        } catch (e) { /* ignore */ }

        // Context menu for changing color by hue
        noteEl.addEventListener('contextmenu', (ev) => {
            ev.preventDefault();
            openColorPicker(ev.pageX, ev.pageY, noteId);
            return false;
        });

        return noteEl;
    }

    // Color picker UI (single floating instance)
    let colorPicker = null;
    const COLOR_SAT = 72; // percent (less washed)
    const COLOR_LIGHT = 78; // percent (slightly darker)
    const colorUpdateTimers = {};

    // Helpers: HSL <-> HEX
    function hslToRgb(h, s, l){
        s /= 100; l /= 100;
        const k = n => (n + h/30) % 12;
        const a = s * Math.min(l, 1 - l);
        const f = n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
        return [Math.round(255 * f(0)), Math.round(255 * f(8)), Math.round(255 * f(4))];
    }
    function rgbToHex(r,g,b){ return '#'+[r,g,b].map(x=>x.toString(16).padStart(2,'0')).join(''); }
    function hslToHex(h,s,l){ const [r,g,b]=hslToRgb(h,s,l); return rgbToHex(r,g,b); }

    function hexToRgb(hex){
        hex = hex.replace('#',''); if (hex.length===3) hex = hex.split('').map(c=>c+c).join('');
        const num = parseInt(hex,16); return [(num>>16)&255, (num>>8)&255, num&255];
    }
    function rgbToHsl(r,g,b){
        r/=255; g/=255; b/=255; const max=Math.max(r,g,b), min=Math.min(r,g,b); let h=0, s=0, l=(max+min)/2;
        if(max!==min){ const d=max-min; s = l>0.5? d/(2-max-min) : d/(max+min); switch(max){case r: h=(g-b)/d + (g<b?6:0); break; case g: h=(b-r)/d + 2; break; case b: h=(r-g)/d +4; break;} h*=60; }
        return [Math.round(h), Math.round(s*100), Math.round(l*100)];
    }
    function hexToHsl(hex){ const [r,g,b]=hexToRgb(hex); return rgbToHsl(r,g,b); }

    function openColorPicker(x, y, noteId) {
        if (!colorPicker) {
            colorPicker = document.createElement('div');
            colorPicker.style.position = 'absolute';
            colorPicker.style.padding = '8px';
            colorPicker.style.background = '#fff';
            colorPicker.style.border = '1px solid #ccc';
            colorPicker.style.borderRadius = '6px';
            colorPicker.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
            colorPicker.style.zIndex = 9999;

            const hueRange = document.createElement('input');
            hueRange.type = 'range';
            hueRange.min = 0; hueRange.max = 360; hueRange.value = 50;
            hueRange.style.width = '160px';

            const preview = document.createElement('div');
            preview.style.width = '28px'; preview.style.height = '28px'; preview.style.display = 'inline-block'; preview.style.marginLeft = '8px'; preview.style.verticalAlign = 'middle'; preview.style.borderRadius = '4px';

            const hexInput = document.createElement('input');
            hexInput.type = 'text'; hexInput.value = ''; hexInput.placeholder = '#rrggbb';
            hexInput.style.marginLeft = '8px'; hexInput.style.width = '84px';

            const closeBtn = document.createElement('button');
            closeBtn.textContent = 'Close';
            closeBtn.style.marginLeft = '8px';

            colorPicker.appendChild(hueRange);
            colorPicker.appendChild(preview);
            colorPicker.appendChild(hexInput);
            colorPicker.appendChild(closeBtn);

            // handle hue changes
            hueRange.addEventListener('input', () => {
                const h = parseInt(hueRange.value,10);
                const colHsl = `hsl(${h}, ${COLOR_SAT}%, ${COLOR_LIGHT}%)`;
                const colHex = hslToHex(h, COLOR_SAT, COLOR_LIGHT);
                preview.style.background = colHsl;
                hexInput.value = colHex;
                // debounce firebase update
                if (colorUpdateTimers[noteId]) clearTimeout(colorUpdateTimers[noteId]);
                colorUpdateTimers[noteId] = setTimeout(() => {
                    update(ref(db, `whiteboard_data/${boardId}/${noteId}`), { color: colHsl }).catch(err => console.error('color update error', err));
                    delete colorUpdateTimers[noteId];
                }, 200);
                const entry = noteElements[noteId]; if (entry && entry.el) entry.el.style.backgroundColor = colHsl;
            });

            // handle hex input (debounced)
            let hexTimer = null;
            hexInput.addEventListener('input', () => {
                const v = hexInput.value.trim();
                if (hexTimer) clearTimeout(hexTimer);
                hexTimer = setTimeout(() => {
                    try {
                        // normalize
                        const hex = v.startsWith('#')? v : '#'+v;
                        const [h,s,l] = hexToHsl(hex);
                        // keep saturation/lightness consistent with palette
                        const colHsl = `hsl(${h}, ${COLOR_SAT}%, ${COLOR_LIGHT}%)`;
                        preview.style.background = colHsl;
                        hueRange.value = h;
                        // persist
                        update(ref(db, `whiteboard_data/${boardId}/${noteId}`), { color: colHsl }).catch(err => console.error('color update error', err));
                        const entry = noteElements[noteId]; if (entry && entry.el) entry.el.style.backgroundColor = colHsl;
                    } catch (e) { /* invalid hex - ignore */ }
                }, 300);
            });

            closeBtn.addEventListener('click', () => { if (colorPicker && colorPicker.parentNode) colorPicker.parentNode.removeChild(colorPicker); colorPicker = null; });

            // clicking outside closes
            document.addEventListener('click', function onDocClick(ev) {
                if (!colorPicker) return;
                if (!colorPicker.contains(ev.target)) { if (colorPicker.parentNode) colorPicker.parentNode.removeChild(colorPicker); colorPicker=null; document.removeEventListener('click', onDocClick); }
            });
        }

        // position
        colorPicker.style.left = `${x}px`;
        colorPicker.style.top = `${y}px`;

        // set initial hue & hex from note
        const note = noteElements[noteId] && noteElements[noteId].el ? noteElements[noteId] : null;
        let startHue = 50;
        let startHex = '';
        if (note && note.el && note.el.style.backgroundColor) {
            const m = /hsl\((\d+),\s*(\d+)%.*,\s*(\d+)%\)/.exec(note.el.style.backgroundColor);
            if (m) startHue = parseInt(m[1],10);
            try { const [h,s,l] = hexToHsl(startHex = rgbToHex.apply(null, note.el.style.backgroundColor ? hslToRgb(startHue, COLOR_SAT, COLOR_LIGHT) : [255,255,255])); startHex = hslToHex(startHue, COLOR_SAT, COLOR_LIGHT); } catch(e) { startHex = hslToHex(startHue, COLOR_SAT, COLOR_LIGHT); }
        }
        const hueInput = colorPicker.querySelector('input[type="range"]');
        const preview = colorPicker.querySelector('div');
        const hexInput = colorPicker.querySelector('input[type="text"]');
        hueInput.value = startHue;
        const initHsl = `hsl(${startHue}, ${COLOR_SAT}%, ${COLOR_LIGHT}%)`;
        preview.style.background = initHsl;
        hexInput.value = hslToHex(startHue, COLOR_SAT, COLOR_LIGHT);

        document.body.appendChild(colorPicker);
    }

    function renderNotes(notesObject) {
        const container = document.getElementById('board-container');

        // Add or update notes without wiping the whole container (preserve focus)
        for (const noteId in notesObject) {
            const note = notesObject[noteId];

            if (noteElements[noteId]) {
                const entry = noteElements[noteId];
                if (note.type === 'text' && entry.textarea) {
                    const textarea = entry.textarea;
                    const newVal = note.content || '';
                    if (textarea.value !== newVal) {
                        const isFocused = document.activeElement === textarea;
                        let start = 0, end = 0;
                        if (isFocused) {
                            try { start = textarea.selectionStart; end = textarea.selectionEnd; } catch (e) { start = 0; end = 0; }
                        }
                        textarea.value = newVal;
                        if (isFocused) {
                            const len = textarea.value.length;
                            start = Math.min(start, len);
                            end = Math.min(end, len);
                            try { textarea.setSelectionRange(start, end); textarea.focus(); } catch (e) { /* ignore */ }
                        }
                    }
                } else if (note.type === 'image' && entry.el) {
                    const img = entry.el.querySelector('img');
                    if (img && img.src !== note.content) img.src = note.content;
                }

                // Update color if changed remotely
                if (note.color && entry.el && entry.el.style.backgroundColor !== note.color) {
                    entry.el.style.backgroundColor = note.color;
                }
            } else {
                const newEl = createNoteElement(noteId, note);
                container.appendChild(newEl);
            }
        }

        // Remove elements that no longer exist
        for (const existingId in Object.assign({}, noteElements)) {
            if (!notesObject.hasOwnProperty(existingId)) {
                const entry = noteElements[existingId];
                if (entry) {
                    if (updateTimers[existingId]) { clearTimeout(updateTimers[existingId]); delete updateTimers[existingId]; }
                    if (entry.el && entry.el.parentNode) entry.el.parentNode.removeChild(entry.el);
                    delete noteElements[existingId];
                }
            }
        }
    }

    // Add empty text note
    document.getElementById('add-text-btn').addEventListener('click', () => {
        const noteId = 'note_' + Date.now();
        const defaultColor = `hsl(50, 72%, 78%)`;
        set(ref(db, `whiteboard_data/${boardId}/${noteId}`), { 
            id: noteId, 
            type: 'text', 
            content: '',
            color: defaultColor
        });
    });

    // Add photo note
    document.getElementById('add-photo-input').addEventListener('change', function(e) {
        const file = this.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function(event) {
                const noteId = 'note_' + Date.now();
                const defaultColor = `hsl(50, 72%, 78%)`;
                set(ref(db, `whiteboard_data/${boardId}/${noteId}`), { 
                    id: noteId, 
                    type: 'image', 
                    content: event.target.result,
                    color: defaultColor
                });
            };
            reader.readAsDataURL(file);
        }
        this.value = ''; 
    });
}
