# template.py - The "Final Academic Canvas" Blueprint
BOOK_TEMPLATE = """
<html>
<head>
    <script src="https://code.jquery.com/jquery-3.6.0.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/interactjs/dist/interact.min.js"></script>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css">
    <style>
        :root { --bg: #f0f2f5; --text: #1a1a1a; --side: #263238; --note-bg: #ffffff; --page-bg: #ffffff; }
        .dark { --bg: #0b0b0b; --text: #eeeeee; --side: #000000; --note-bg: #1e1e1e; --page-bg: #121212; }

        body { font-family: 'Segoe UI', sans-serif; display: flex; margin: 0; background: var(--bg); color: var(--text); height: 100vh; overflow: hidden; transition: 0.3s; }
        #nav { width: 180px; background: var(--side); color: white; padding: 15px; overflow-y: auto; flex-shrink: 0; transition: 0.3s; }
        .nav-link { padding: 12px; cursor: pointer; border-bottom: 1px solid #455a64; font-size: 14px; text-align: center; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
        .nav-link.active-nav { background: #4285f4; }

        #main-stage { flex-grow: 1; display: flex; flex-direction: column; overflow: hidden; }
        #toolbar { background: #f8f9fa; padding: 10px 15px; border-bottom: 1px solid #ddd; display: flex; gap: 8px; align-items: center; color: black; z-index: 1000; flex-wrap: wrap; }

        #workspace { display: flex; flex-grow: 1; overflow: hidden; position: relative; }
        #canvas-viewport { flex-grow: 2; overflow: auto; background: var(--page-bg); position: relative; }
        #canvas { padding: 50px; position: relative; min-height: 1200px; transform-origin: top left; transition: transform 0.1s ease; }

        #workbench { width: 320px; background: var(--note-bg); border-left: 1px solid #ccc; padding: 20px; display: flex; flex-direction: column; color: var(--text); transition: 0.3s; }
        .notes-hidden #workbench { display: none; }

        .page { display: none; position: relative; width: 100%; height: 100%; }
        .active { display: block; }

        /* MOVABLE CANVAS BOXES */
        .canvas-box { position: absolute; min-width: 50px; min-height: 30px; padding: 5px; touch-action: none; box-sizing: border-box; }
        .edit-active .canvas-box { border: 1px dashed #4285f4; cursor: move; }
        .canvas-box img { width: 100%; height: 100%; display: block; pointer-events: none; }
        .canvas-box .content-area { width: 100%; height: 100%; outline: none; word-wrap: break-word; }
        .del-btn { position: absolute; top: -10px; right: -10px; background: #ff4b4b; color: white; border-radius: 50%; width: 22px; height: 22px; display: none; justify-content: center; align-items: center; cursor: pointer; z-index: 100; }
        .edit-active .del-btn { display: flex; }

        /* SQUARE PINS */
        .pin { width: 18px; height: 18px; background: #ea4335; border-radius: 50%; position: absolute; cursor: move; z-index: 99; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3); }
        .pin:hover::after { 
            content: attr(data-note); position: absolute; left: 25px; top: -5px; 
            background: #333; color: #fff; padding: 12px; border-radius: 6px; 
            font-size: 13px; width: 240px; white-space: normal; line-height: 1.5; z-index: 1000; box-shadow: 0 4px 12px rgba(0,0,0,0.4);
        }

        /* STICKY NOTE MODAL */
        #sticky-modal { display: none; position: fixed; z-index: 2000; left: 0; top: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.8); align-items: center; justify-content: center; }
        .modal-body { background: #1e1e1e; color: white; padding: 25px; border-radius: 12px; width: 420px; box-shadow: 0 8px 24px rgba(0,0,0,0.5); }
        .modal-body textarea { width: 100%; height: 120px; background: #2c2c2c; border: 1px solid #444; color: white; padding: 10px; border-radius: 8px; margin: 15px 0; font-family: inherit; font-size: 14px; }

        button, select { cursor: pointer; padding: 6px 12px; border-radius: 4px; border: 1px solid #ccc; background: white; font-size: 13px; display: flex; align-items: center; gap: 5px; }
        .edit-tools { display: none; border-left: 2px solid #ddd; padding-left: 10px; gap: 6px; align-items: center; }
        #note-main { flex-grow: 1; background: transparent; border: 1px solid #ddd; color: inherit; margin-top: 15px; outline: none; padding: 10px; overflow-y: auto; font-size: 14px; }

        .zoom-label { font-size: 11px; font-weight: bold; color: #666; }
    </style>
    <script>
        let current = 0;
        let isEditing = false;
        let zoomScale = 1.0;
        const totalPages = {{TOTAL_PAGES}};

        $(document).keydown(function(e) {
            if (document.activeElement.tagName === "TEXTAREA" || document.activeElement.id === "note-main" || document.activeElement.getAttribute("contenteditable") === "true") return;
            if (e.keyCode == 37) { if(current > 0) goTo(current - 1); } 
            else if (e.keyCode == 39) { if(current < totalPages - 1) goTo(current + 1); }
        });

        function toggleNotes() { $('body').toggleClass('notes-hidden'); }
        function changeZoom(val) { zoomScale = val; $('#canvas').css('transform', `scale(${val})`); $('#zoom-txt').text(Math.round(val * 100) + '%'); }

        function toggleEdit() {
            isEditing = !isEditing;
            $('#edit-btn').css('background', isEditing ? '#4285f4' : 'white').css('color', isEditing ? 'white' : 'black');
            $('.edit-tools').css('display', isEditing ? 'flex' : 'none');
            $('#canvas').toggleClass('edit-active');
            $('.content-area').attr('contenteditable', isEditing);

            if (isEditing) { 
                interact('.canvas-box').resizable({ edges: { left: true, right: true, bottom: true, top: true },
                    listeners: { move (event) { Object.assign(event.target.style, { width: `${event.rect.width}px`, height: `${event.rect.height}px` }); }}
                }).draggable({ listeners: { move (event) {
                    let x = (parseFloat(event.target.getAttribute('data-x')) || 0) + event.dx;
                    let y = (parseFloat(event.target.getAttribute('data-y')) || 0) + event.dy;
                    event.target.style.transform = `translate(${x}px, ${y}px)`;
                    event.target.setAttribute('data-x', x);
                    event.target.setAttribute('data-y', y);
                }}});
                interact('.pin').draggable({ listeners: { move (event) {
                    let x = (parseFloat(event.target.getAttribute('data-x')) || 0) + event.dx;
                    let y = (parseFloat(event.target.getAttribute('data-y')) || 0) + event.dy;
                    event.target.style.transform = `translate(${x}px, ${y}px)`;
                    event.target.setAttribute('data-x', x);
                    event.target.setAttribute('data-y', y);
                }}});
            } else { interact('.canvas-box').unset(); interact('.pin').unset(); }
        }

        function format(cmd, val = null) { document.execCommand(cmd, false, val); }
        function goTo(id) { saveNote(current); $('.page').removeClass('active'); $('#p-' + id).addClass('active'); $('.nav-link').removeClass('active-nav'); $('.nav-link').eq(id).addClass('active-nav'); current = id; document.getElementById('note-main').innerHTML = localStorage.getItem('notedump-note-' + current) || ""; }
        function saveNote(id) { localStorage.setItem('notedump-note-' + id, document.getElementById('note-main').innerHTML); }
        function openSticky() { $('#sticky-modal').css('display', 'flex'); $('#sticky-text').focus(); }
        function closeSticky() { $('#sticky-modal').hide(); $('#sticky-text').val(''); }
        function confirmSticky() {
            let n = $('#sticky-text').val(); if(!n) return;
            let p = $('<div class="pin" data-note="'+n+'"></div>');
            p.css({top: '100px', left: '100px'}); $("#p-" + current).append(p);
            closeSticky(); if(isEditing) { toggleEdit(); toggleEdit(); }
        }
        function addText() {
            let b = $('<div class="canvas-box" style="top:150px; left:150px; width:250px; height:120px;"><div class="del-btn" onclick="$(this).parent().remove()">X</div><div class="content-area" contenteditable="true">New Box</div></div>');
            $("#p-" + current).append(b);
            if(isEditing) { toggleEdit(); toggleEdit(); }
        }
        function addImg() {
            let url = prompt("Enter Image URL:"); if(!url) return;
            let b = $('<div class="canvas-box" style="top:200px; left:200px; width:300px;"><div class="del-btn" onclick="$(this).parent().remove()">X</div><img src="'+url+'"></div>');
            $("#p-" + current).append(b);
            if(isEditing) { toggleEdit(); toggleEdit(); }
        }
        $(document).ready(() => { document.getElementById('note-main').innerHTML = localStorage.getItem('notedump-note-0') || ""; });
    </script>
</head>
<body>
    <div id="sticky-modal"><div class="modal-body"><h3>Sticky Note</h3><textarea id="sticky-text" placeholder="Observation paragraphs..."></textarea>
    <div style="display:flex; justify-content:flex-end; gap:10px;"><button onclick="closeSticky()">Cancel</button><button onclick="confirmSticky()" style="background:#4285f4; color:white; border:none;">OK</button></div></div></div>

    <div id="nav"><button onclick="$('body').toggleClass('dark')"><i class="fas fa-moon"></i></button><hr><h3>Pages</h3>{{NAV_LINKS}}</div>

    <div id="main-stage">
        <div id="toolbar">
            <button id="edit-btn" onclick="toggleEdit()"><i class="fas fa-edit"></i> Edit Page</button>
            <div class="edit-tools">
                <select onchange="format('fontName', this.value)"><option value="Arial">Arial</option><option value="Times New Roman">Times New Roman</option><option value="Georgia">Georgia</option></select>
                <select onchange="format('fontSize', this.value)"><option value="3">Size</option><option value="1">Small</option><option value="5">Large</option><option value="7">Huge</option></select>
                <button onclick="format('bold')"><b>B</b></button><button onclick="format('italic')"><i>I</i></button><button onclick="format('underline')"><u>U</u></button>
                <button onclick="format('justifyLeft')"><i class="fas fa-align-left"></i></button><button onclick="format('justifyCenter')"><i class="fas fa-align-center"></i></button>
                <select onchange="format('foreColor', this.value)"><option value="black">Black</option><option value="red">Red</option><option value="blue">Blue</option></select>
                <button onclick="addText()"><i class="fas fa-plus"></i> Text</button><button onclick="addImg()"><i class="fas fa-image"></i> Img</button>
                <button onclick="openSticky()"><i class="fas fa-sticky-note"></i> Pin</button>
            </div>
            <button onclick="toggleNotes()"><i class="fas fa-columns"></i> Toggle Notes</button>
            <div style="margin-left:auto; display:flex; align-items:center; gap:8px;">
                <span class="zoom-label">ZOOM:</span>
                <input type="range" min="0.5" max="2" step="0.1" value="1" oninput="changeZoom(this.value)">
                <span id="zoom-txt" style="font-size:11px; width:35px;">100%</span>
            </div>
        </div>
        <div id="workspace">
            <div id="canvas-viewport"><div id="canvas">{{SLIDE_CONTENT}}</div></div>
            <div id="workbench"><b>Student Notes</b><div id="note-main" contenteditable="true" oninput="saveNote(current)" placeholder="Observations..."></div></div>
        </div>
    </div>
</body>
</html>
"""
