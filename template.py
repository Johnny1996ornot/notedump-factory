def get_template(total_pages):
    with open('style.css', 'r') as f:
        css = f.read()
    with open('engine.js', 'r') as f:
        js = f.read()

    return f"""
<html>
<head>
    <style>{css}</style>
    <script src="https://code.jquery.com/jquery-3.6.0.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/interactjs/dist/interact.min.js"></script>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css">
</head>
<body>
    <div id="nav"><button onclick="$('body').toggleClass('dark')"><i class="fas fa-moon"></i></button><hr>{{{{NAV_LINKS}}}}</div>
    <div id="main-stage">
        <div id="toolbar">
            <button id="edit-btn" onclick="toggleEdit()"><i class="fas fa-edit"></i> Edit</button>
            <div class="edit-tools" style="display:none;">
                <button id="undo-btn" onclick="undo()" disabled><i class="fas fa-undo"></i></button>
                <select onchange="format('fontName', this.value)"><option value="Arial">Arial</option><option value="Georgia">Georgia</option><option value="Times New Roman">Times New Roman</option></select>
                <select onchange="format('fontSize', this.value)">
                    <option value="">Size</option>
                    <option value="1">Smallest</option>
                    <option value="2">Small</option>
                    <option value="3">Normal</option>
                    <option value="4">Large</option>
                    <option value="5">Huge</option>
                    <option value="6">Giant</option>
                    <option value="7">Maximum</option>
                </select>
                <button onclick="format('bold')"><i class="fas fa-bold"></i></button>
                <button onclick="format('italic')"><i class="fas fa-italic"></i></button>
                <button onclick="format('insertUnorderedList')"><i class="fas fa-list-ul"></i></button>
                <button onclick="format('insertOrderedList')"><i class="fas fa-list-ol"></i></button>
                <button onclick="addImg()">+ Img</button>
                <button onclick="addText()">+ Text</button>
            </div>
            <button onclick="$('body').toggleClass('notes-hidden')"><i class="fas fa-columns"></i> Sidebar</button>
            <div style="margin-left:auto; display:flex; align-items:center; gap:5px;">
                <input type="range" min="0.5" max="2" step="0.1" value="1" oninput="setZoom(this.value)">
                <span id="zoom-txt" style="font-size:10px;">100%</span>
            </div>
        </div>
        <div id="workspace">
            <div id="canvas-viewport"><div id="canvas">{{{{SLIDE_CONTENT}}}}</div></div>
            <div id="workbench">
                <div class="tab-headers">
                    <button class="tab-btn active-tab" onclick="switchTab('note-tab')">Notes</button>
                    <button class="tab-btn" onclick="switchTab('pin-list')">Pins</button>
                </div>
                <div id="note-tab" class="tab-content active-tab"><div id="note-main" contenteditable="true" oninput="saveNote(current)" placeholder="Start typing notes..."></div></div>
                <div id="pin-list" class="tab-content">
                    <button onclick="dropPin()" style="width:100%; margin-bottom:10px; background:#ea4335; color:white; border:none; padding:8px; border-radius:4px; cursor:pointer;">+ Drop New Pin</button>
                    <div id="pin-list-container"></div>
                </div>
            </div>
        </div>
    </div>
    <script>
        const totalPages = {total_pages};
        {js}
    </script>
</body>
</html>
"""
