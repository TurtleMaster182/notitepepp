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

        return noteEl;
    }

    function renderNotes(notesObject) {
        const container = document.getElementById('board-container');

        // Add or update notes without wiping the whole container (preserve focus)
        for (const noteId in notesObject) {
            const note = notesObject[noteId];

            if (noteElements[noteId]) {
                const entry = noteElements[noteId];
                if (note.type === 'text' && entry.textarea) {
                    // Update only if not focused by the user
                    if (document.activeElement !== entry.textarea && entry.textarea.value !== (note.content || '')) {
                        entry.textarea.value = note.content || '';
                    }
                } else if (note.type === 'image' && entry.el) {
                    const img = entry.el.querySelector('img');
                    if (img && img.src !== note.content) img.src = note.content;
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
        set(ref(db, `whiteboard_data/${boardId}/${noteId}`), { 
            id: noteId, 
            type: 'text', 
            content: '' 
        });
    });

    // Add photo note
    document.getElementById('add-photo-input').addEventListener('change', function(e) {
        const file = this.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function(event) {
                const noteId = 'note_' + Date.now();
                set(ref(db, `whiteboard_data/${boardId}/${noteId}`), { 
                    id: noteId, 
                    type: 'image', 
                    content: event.target.result 
                });
            };
            reader.readAsDataURL(file);
        }
        this.value = ''; 
    });
}
