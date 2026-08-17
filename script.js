// ==========================================
// 1. HUB PAGE LOGIC (index.html)
// ==========================================
if (document.getElementById('board-grid')) {
    
    let boards = JSON.parse(localStorage.getItem('whiteboard_list')) || [
        { id: 'Brainstorming', name: 'Brainstorming' },
        { id: 'To-Do', name: 'To-Do List' }
    ];

    function saveBoards() {
        localStorage.setItem('whiteboard_list', JSON.stringify(boards));
    }

    function renderBoards() {
        const grid = document.getElementById('board-grid');
        grid.innerHTML = ''; // Clear grid

        boards.forEach(board => {
            const container = document.createElement('div');
            container.className = 'board-box-container';

            const link = document.createElement('a');
            link.href = `board.html?id=${board.id}`;
            link.className = 'board-box';
            link.innerHTML = `<h2>${board.name}</h2>`;

            // No delete button generated here anymore!

            container.appendChild(link);
            grid.appendChild(container);
        });
    }

    document.getElementById('add-board-btn').addEventListener('click', () => {
        const boardName = prompt("Enter a name for your new whiteboard:");
        if (boardName && boardName.trim() !== "") {
            const uniqueId = 'board_' + Date.now();
            boards.push({ id: uniqueId, name: boardName.trim() });
            saveBoards();
            renderBoards();
        }
    });

    renderBoards();
}

// ... Keep your existing WHITEBOARD LOGIC (board.html) below this ...
// ==========================================
// 2. WHITEBOARD LOGIC (board.html)
// ==========================================
if (document.getElementById('board-container')) {
    
    // Get the board ID from the URL
    const urlParams = new URLSearchParams(window.location.search);
    let boardId = urlParams.get('id');
    
    // If someone tries to open board.html without an ID, send them back to the hub
    if (!boardId) {
        window.location.href = 'index.html';
    }

    // Attempt to find the board's friendly name to display in the title
    const boardsList = JSON.parse(localStorage.getItem('whiteboard_list')) || [];
    const currentBoard = boardsList.find(b => b.id === boardId);
    const boardName = currentBoard ? currentBoard.name : decodeURIComponent(boardId);
    
    document.getElementById('board-title').innerText = boardName;

    // Storage key for this specific board's notes
    const storageKey = 'whiteboard_data_' + boardId;
    let notes = JSON.parse(localStorage.getItem(storageKey)) || [];

    function saveNotes() {
        localStorage.setItem(storageKey, JSON.stringify(notes));
    }

    function renderNotes() {
        const container = document.getElementById('board-container');
        container.innerHTML = ''; 

        notes.forEach(note => {
            const noteEl = document.createElement('div');
            noteEl.className = 'note' + (note.type === 'image' ? ' image-note' : '');
            
            const delBtn = document.createElement('button');
            delBtn.className = 'delete-btn';
            delBtn.innerText = '✕';
            delBtn.onclick = () => {
                notes = notes.filter(n => n.id !== note.id); 
                saveNotes();
                renderNotes(); 
            };
            noteEl.appendChild(delBtn);

            if (note.type === 'text') {
                const textarea = document.createElement('textarea');
                textarea.value = note.content;
                textarea.placeholder = "Write something here...";
                
                textarea.oninput = (e) => {
                    note.content = e.target.value;
                    saveNotes();
                };
                noteEl.appendChild(textarea);
            } 
            else if (note.type === 'image') {
                const img = document.createElement('img');
                img.src = note.content;
                noteEl.appendChild(img);
            }
            
            container.appendChild(noteEl);
        });
    }

    document.getElementById('add-text-btn').addEventListener('click', () => {
        notes.push({ id: Date.now(), type: 'text', content: '' });
        saveNotes();
        renderNotes();
    });

    document.getElementById('add-photo-input').addEventListener('change', function(e) {
        const file = this.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function(event) {
                notes.push({ 
                    id: Date.now(), 
                    type: 'image', 
                    content: event.target.result 
                });
                saveNotes();
                renderNotes();
            };
            reader.readAsDataURL(file);
        }
        this.value = ''; 
    });

    renderNotes();
}