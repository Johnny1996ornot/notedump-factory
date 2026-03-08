def get_template(total_pages):
    with open('style.css', 'r') as f:
        css = f.read()
    with open('engine.js', 'r') as f:
        js_engine = f.read()

    return f"""
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>NoteDump Lecture</title>
    <style>{css}</style>
    <script src="https://code.jquery.com/jquery-3.6.0.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/interactjs/dist/interact.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/sortablejs@latest/Sortable.min.js"></script>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/cropperjs/1.5.13/cropper.min.css">
    <script src="https://cdnjs.cloudflare.com/ajax/libs/cropperjs/1.5.13/cropper.min.js"></script>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css">
</head>
<body>

    <div id="nb-exit-container">
        <button onclick="toggleNotebookView()" title="Exit Notebook View"><i class="fas fa-times"></i></button>
    </div>

    <div id="nb-draggable-nav" class="draggable-nav">
        <button onclick="skipBackward()" title="Skip Backward (20%)"><i class="fas fa-angle-double-left"></i></button>
        <button onclick="prevPage()" title="Previous Page"><i class="fas fa-angle-left"></i></button>
        <span id="nb-page-indicator">1 / 1</span>
        <button onclick="nextPage()" title="Next Page"><i class="fas fa-angle-right"></i></button>
        <button onclick="skipForward()" title="Skip Forward (20%)"><i class="fas fa-angle-double-right"></i></button>
    </div>

    <div id="crop-modal">
        <div class="crop-modal-content">
            <h3 style="margin-top:0; color:#333;">Crop Image</h3>
            <div style="flex-grow:1; overflow:hidden; background:#eee; display:flex; justify-content:center; align-items:center;">
                <img id="crop-target" src="" style="max-width:100%; max-height:100%;">
            </div>
            <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:15px;">
                <button onclick="cancelCrop()" style="background:#888; color:white; padding:8px 16px; border:none; border-radius:4px; cursor:pointer;">Cancel</button>
                <button onclick="applyCrop()" style="background:#4CAF50; color:white; padding:8px 16px; border:none; border-radius:4px; cursor:pointer; font-weight:bold;">Apply Crop</button>
            </div>
        </div>
    </div>

    <div id="nav">
        <div id="nav-toggle" onclick="toggleNav()">
            <i class="fas fa-caret-left" id="nav-toggle-icon"></i>
        </div>

        <button class="mobile-only-btn" style="width:100%; margin-bottom:10px; justify-content:center; background:#444;" onclick="toggleNav()"><i class="fas fa-times"></i> Close Pages</button>

        <div class="nav-icon-grid">
            <button class="icon-btn notebook-toggle-btn" onclick="toggleNotebookView()" title="Enter Notebook View"><i class="fas fa-book-open"></i></button>
            <button class="icon-btn" onclick="$('body').toggleClass('dark')" title="Toggle Night Mode"><i class="fas fa-moon"></i></button>
            <button class="icon-btn" onclick="toggleScrollMode()" title="Toggle Scroll Mode"><i class="fas fa-scroll"></i></button>
            <button class="icon-btn" id="edit-btn" onclick="toggleEdit()" title="Toggle Edit Mode"><i class="fas fa-edit"></i></button>
        </div>

        <div id="lecture-title" contenteditable="true" title="Click to rename file">{{{{LECTURE_ID}}}}</div>

        <div class="nav-icon-grid" style="margin-bottom: 12px;">
            <button onclick="saveNotebookToFile()" class="icon-btn action-btn" title="Export Notebook"><i class="fas fa-download"></i></button>
            <button onclick="addPageBelow()" class="icon-btn action-btn" title="Add Page"><i class="fas fa-file-medical"></i></button>
            <button onclick="addChapterBelow()" class="icon-btn action-btn" title="Add Section"><i class="fas fa-bookmark"></i></button>
            <button onclick="toggleSearchBar()" class="icon-btn action-btn" title="Search"><i class="fas fa-search"></i></button>
        </div>

        <div class="search-container sidebar-search" id="sidebar-search">
            <input type="text" id="search-input" placeholder="Search...">
            <span id="search-counter" class="search-counter-text">0/0</span>
            <div class="search-nav-btns">
                <button onclick="goToPrevMatch()"><i class="fas fa-chevron-up"></i></button>
                <button onclick="goToNextMatch()"><i class="fas fa-chevron-down"></i></button>
                <button onclick="toggleSearchBar()" style="color:#ff4b4b;"><i class="fas fa-times"></i></button>
            </div>
        </div>

        <hr style="border-color: #455a64; margin: 10px 0; width: 100%;">
        <div id="nav-list-container">
            {{{{NAV_LINKS}}}}
        </div>
    </div>

    <div id="main-stage">

        <div id="workspace">

            <div id="canvas-global-tools" style="display:none;">
                <button class="ctx-btn" id="undo-btn" onclick="undo()" disabled title="Undo"><i class="fas fa-undo"></i></button>
                <div class="separator" style="height:16px; margin: 0 4px;"></div>
                <button class="ctx-btn" onclick="addImg()" title="Add Image"><i class="fas fa-image"></i> Img</button>
                <button class="ctx-btn" onclick="addText()" title="Add Text"><i class="fas fa-font"></i> Text</button>
                <div class="separator" style="height:16px; margin: 0 4px;"></div>
                <button class="ctx-btn" onclick="changeCanvasWidth(100)" title="Increase Canvas Width">+W</button>
                <button class="ctx-btn" onclick="changeCanvasWidth(-100)" title="Decrease Canvas Width">-W</button>
                <button class="ctx-btn" onclick="changeCanvasHeight(250)" title="Increase Page Height">+H</button>
                <button class="ctx-btn" onclick="changeCanvasHeight(-250)" title="Decrease Page Height">-H</button>
                <label style="font-size: 10px; display: flex; align-items: center; gap: 4px; cursor: pointer; color: #666; font-weight: bold; white-space: nowrap; margin-left: 4px;">
                    <input type="checkbox" id="uniform-height-check" style="margin:0;"> Apply All
                </label>
            </div>

            <div id="canvas-viewport">
                <div id="canvas-center-wrapper">
                    <div id="canvas">
                        {{{{SLIDE_CONTENT}}}}

                        <div id="context-menu" style="display:none; position:absolute; flex-direction:column; gap:4px; padding:6px; border-radius:8px; background:white; border: 1px solid #ccc; box-shadow: 0 4px 15px rgba(0,0,0,0.3); z-index:10000;">
                            <div class="menu-text-tools" style="display:flex; gap:4px; align-items:center; background: #f8f9fa; padding: 4px; border-radius: 4px; border: 1px solid #eee;">
                                <select class="ctx-select" style="width: 75px;" onchange="format('fontName', this.value)">
                                    <option value="Arial">Arial</option><option value="Georgia">Georgia</option><option value="Times">Times</option>
                                </select>
                                <select class="ctx-select" style="width: 55px;" onchange="format('fontSize', this.value)">
                                    <option value="" disabled selected hidden>Size</option>
                                    <option value="1">XS</option><option value="3">Med</option><option value="6">XL</option><option value="7">XXL</option>
                                </select>
                                <div class="separator" style="height:16px; margin: 0 2px;"></div>
                                <button class="ctx-btn" onmousedown="event.preventDefault();" onclick="format('bold')" title="Bold"><i class="fas fa-bold"></i></button>
                                <button class="ctx-btn" onmousedown="event.preventDefault();" onclick="format('italic')" title="Italic"><i class="fas fa-italic"></i></button>
                                <button class="ctx-btn" onmousedown="event.preventDefault();" onclick="format('underline')" title="Underline"><i class="fas fa-underline"></i></button>
                                <div class="separator" style="height:16px; margin: 0 2px;"></div>
                                <button class="ctx-btn" onmousedown="event.preventDefault();" onclick="format('justifyLeft')" title="Align Left"><i class="fas fa-align-left"></i></button>
                                <button class="ctx-btn" onmousedown="event.preventDefault();" onclick="format('justifyCenter')" title="Align Center"><i class="fas fa-align-center"></i></button>
                                <button class="ctx-btn" onmousedown="event.preventDefault();" onclick="format('justifyRight')" title="Align Right"><i class="fas fa-align-right"></i></button>
                            </div>

                            <div style="display:flex; gap:6px; align-items:center; padding: 2px;">
                                <div id="menu-drag-handle" title="Drag to move element" style="cursor: move; padding: 0 4px; color: #4285f4;"><i class="fas fa-arrows-alt"></i></div>
                                <button class="ctx-btn" onmousedown="event.preventDefault();" onclick="changeLayer(1)" title="Move to Front"><i class="fas fa-angle-double-up"></i></button>
                                <button class="ctx-btn" onmousedown="event.preventDefault();" onclick="changeLayer(-1)" title="Move to Back"><i class="fas fa-angle-double-down"></i></button>
                                <div class="separator" style="height:16px;"></div>

                                <div class="menu-text-tools" style="display:flex; gap:6px; align-items:center;">
                                    <div class="color-grid" id="text-color-grid" title="Text Color"></div>
                                    <div class="separator" style="height:16px;"></div>
                                </div>

                                <div class="color-grid" id="bg-color-grid" title="Background Color"></div>
                                <div class="separator" style="height:16px;"></div>

                                <div style="display:flex; flex-direction:column; gap:2px; align-items:center;" title="Object Transparency">
                                    <span style="font-size:8px; font-weight:bold; color:#666;">TRANSPARENCY</span>
                                    <input type="range" id="transparency-slider" min="0.1" max="1" step="0.1" value="1" style="width:40px; height:4px; margin:0; cursor:pointer;" oninput="liveUpdateOpacity(this.value)" onchange="commitOpacity()">
                                </div>

                                <div class="menu-img-tools" style="display:none; align-items:center; margin-left: 6px;">
                                    <button class="ctx-btn" onmousedown="event.preventDefault();" onclick="startCrop()" style="background:#ea4335; color:white; font-weight:bold; border:none;"><i class="fas fa-crop-alt"></i> Crop</button>
                                </div>
                            </div>
                        </div>

                    </div>
                </div>
            </div>

            <div id="fab-container">
                <button class="fab-btn" onclick="togglePanel('note')" title="Open Notes"><i class="fas fa-pen"></i></button>
                <button class="fab-btn" onclick="togglePanel('pin')" title="Open Pins"><i class="fas fa-thumbtack"></i></button>
            </div>

            <div id="note-panel" class="floating-panel">
                <div class="fw-header">
                    <h3 style="margin:0; font-size:14px; color:var(--text); flex-grow:1;"><i class="fas fa-pen"></i> Notes</h3>
                    <button class="close-panel-btn" onclick="togglePanel('note')" title="Close Panel"><i class="fas fa-times"></i></button>
                </div>
                <div class="panel-body">
                    <div id="note-main" contenteditable="true" oninput="saveNote(current)" placeholder="Start typing notes..."></div>
                </div>
            </div>

            <div id="pin-panel" class="floating-panel">
                <div class="fw-header">
                    <h3 style="margin:0; font-size:14px; color:var(--text); flex-grow:1;"><i class="fas fa-thumbtack"></i> Pins</h3>
                    <button class="close-panel-btn" onclick="togglePanel('pin')" title="Close Panel"><i class="fas fa-times"></i></button>
                </div>
                <div class="panel-body" style="padding-top: 15px;">
                    <div style="display:flex; gap:10px; margin-bottom: 15px; padding: 0 15px;">
                        <button onclick="dropPin()" style="background:#ea4335; color:white; border:none; padding:8px; border-radius:4px; cursor:pointer; flex-grow:1; font-weight:bold;">+ Drop Pin</button>
                        <button onclick="$('#canvas').toggleClass('hide-pins')" style="background:#555; color:white; border:none; padding:8px; border-radius:4px; cursor:pointer;" title="Hide all pins from the page"><i class="fas fa-eye-slash"></i></button>
                    </div>
                    <div id="pin-list-container"></div>
                </div>
            </div>

        </div>
    </div>
    <script>
        let totalPages = {total_pages};
        const LECTURE_ID = "{{{{LECTURE_ID}}}}";
        {js_engine}
    </script>
</body>
</html>
"""
