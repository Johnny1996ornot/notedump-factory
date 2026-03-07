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

    <div id="notebook-floating-nav">
        <div class="nf-left">
            <button class="nf-btn" onclick="toggleLeftPanel()" title="Toggle Chapters"><i class="fas fa-bars"></i></button>
            <button class="nf-btn" onclick="prevPage()" title="Previous Page"><i class="fas fa-arrow-left"></i></button>
        </div>
        <div class="nf-right">
            <button class="nf-btn" onclick="nextPage()" title="Next Page"><i class="fas fa-arrow-right"></i></button>
            <button class="nf-btn" onclick="toggleRightPanel()" title="Settings"><i class="fas fa-sliders-h"></i></button>
            <button class="nf-btn exit-circle-btn" onclick="toggleNotebookView()" title="Exit Notebook View"><i class="fas fa-times"></i></button>
        </div>
    </div>

    <div id="notebook-sidebar">
        <div class="ns-content">
            <div id="ns-title" class="ns-box">{{{{LECTURE_ID}}}}</div>
            <select id="ns-chapter-select" class="ns-box" onchange="renderNotebookStack(this.value)"></select>
            <div id="ns-page-stack"></div>
        </div>
    </div>

    <div id="notebook-right-panel">
        <div class="right-panel-section">
            <label>View Mode</label>
            <div style="display:flex; gap:5px; background:#113f52; padding:5px; border-radius:8px;">
                <button id="btn-view-single" class="view-btn active-view" onclick="setViewMode('single')">Single</button>
                <button id="btn-view-scroll" class="view-btn" onclick="setViewMode('scroll')">Scroll</button>
            </div>
        </div>

        <div class="right-panel-section">
            <div class="search-container modern-search">
                <i class="fas fa-search" style="color:#666;"></i>
                <input type="text" id="ns-search-input" placeholder="Search (Enter)...">
                <span id="ns-search-counter" class="search-counter-text">0/0</span>
                <div class="search-nav-btns">
                    <button onclick="goToPrevMatch()" title="Previous Match"><i class="fas fa-chevron-up"></i></button>
                    <button onclick="goToNextMatch()" title="Next Match (Enter)"><i class="fas fa-chevron-down"></i></button>
                </div>
            </div>
        </div>

        <div class="right-panel-section right-zoom-container">
            <label>Zoom Canvas</label>
            <div style="display:flex; align-items:center; gap:8px;">
                <input type="range" id="ns-zoom-slider" min="0.2" max="3" step="0.05" value="1" oninput="setZoom(this.value)">
                <span id="ns-zoom-txt" style="color:white; font-size:12px; font-weight:bold;">100%</span>
            </div>
        </div>
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
        <button class="mobile-only-btn" style="width:100%; margin-bottom:10px; justify-content:center; background:#444;" onclick="$('#nav').removeClass('mobile-open')"><i class="fas fa-times"></i> Close Pages</button>

        <div id="lecture-title" contenteditable="true" title="Click to rename file">{{{{LECTURE_ID}}}}</div>

        <div class="nav-btn-grid">
            <button onclick="saveNotebookToFile()" title="Export Final Copy (Ctrl+S)">
                <i class="fas fa-download"></i>
                <span>Export<br>Notebook</span>
            </button>
            <button onclick="addPageBelow()" title="Insert Blank Page">
                <i class="fas fa-file-medical"></i>
                <span>Add<br>Page</span>
            </button>
            <button onclick="addChapterBelow()" title="Insert New Chapter">
                <i class="fas fa-bookmark"></i>
                <span>Add<br>Chapter</span>
            </button>
        </div>

        <div class="search-container">
            <i class="fas fa-search" style="color:#aaa;"></i>
            <input type="text" id="search-input" placeholder="Search (Enter)...">
            <span id="search-counter" class="search-counter-text">0/0</span>
            <div class="search-nav-btns">
                <button onclick="goToPrevMatch()" title="Previous Match"><i class="fas fa-chevron-up"></i></button>
                <button onclick="goToNextMatch()" title="Next Match (Enter)"><i class="fas fa-chevron-down"></i></button>
            </div>
        </div>

        <hr style="border-color: #455a64; margin: 10px 0; width: 100%;">
        <div id="nav-list-container">
            {{{{NAV_LINKS}}}}
        </div>
    </div>

    <div id="main-stage">
        <div id="toolbar">
            <button class="mobile-only-btn" onclick="$('#nav').toggleClass('mobile-open'); $('#workbench').removeClass('mobile-open');"><i class="fas fa-bars"></i> Pages</button>
            <button class="mobile-only-btn" onclick="$('#workbench').toggleClass('mobile-open'); $('#nav').removeClass('mobile-open');" style="background:#ea4335;"><i class="fas fa-pen"></i> Notes</button>

            <div class="edit-tools" style="display:none; align-items:center; gap:6px;">
                <button class="tb-btn" id="undo-btn" onclick="undo()" disabled><i class="fas fa-undo"></i></button>

                <button class="tb-btn" onclick="format('insertUnorderedList')" title="Bullet List"><i class="fas fa-list-ul"></i></button>
                <button class="tb-btn" onclick="format('insertOrderedList')" title="Numbered List"><i class="fas fa-list-ol"></i></button>

                <div class="separator"></div>
                <button class="tb-btn text-action" onclick="addImg()"><i class="fas fa-image"></i> Img</button>
                <button class="tb-btn text-action" onclick="addText()"><i class="fas fa-font"></i> Text</button>

                <div class="separator"></div>
                <button class="tb-btn size-action" onclick="changeCanvasWidth(100)" title="Increase Canvas Width"><i class="fas fa-arrows-alt-h"></i> +W</button>
                <button class="tb-btn size-action-neg" onclick="changeCanvasWidth(-100)" title="Decrease Canvas Width"><i class="fas fa-compress-arrows-alt"></i> -W</button>
                <button class="tb-btn size-action" onclick="changeCanvasHeight(250)" title="Increase Page Height"><i class="fas fa-arrows-alt-v"></i> +H</button>
                <button class="tb-btn size-action-neg" onclick="changeCanvasHeight(-250)" title="Decrease Page Height"><i class="fas fa-compress-arrows-alt"></i> -H</button>
                <label style="font-size: 10px; display: flex; align-items: center; gap: 4px; cursor: pointer; color: #666; font-weight: bold; white-space: nowrap;">
                    <input type="checkbox" id="uniform-height-check"> Apply Height to All
                </label>
            </div>

            <div style="margin-left:auto; display:flex; align-items:center; gap:6px; flex-wrap:nowrap;">
                <button class="tb-btn icon-btn" id="edit-btn" onclick="toggleEdit()" title="Toggle Edit Mode"><i class="fas fa-edit"></i></button>
                <button class="tb-btn icon-btn" onclick="toggleScrollMode()" title="Toggle Scroll Mode"><i class="fas fa-scroll"></i></button>
                <button class="tb-btn icon-btn desktop-only" onclick="$('body').toggleClass('notes-hidden')" title="Toggle Sidebar Notes"><i class="fas fa-columns"></i></button>
                <button class="tb-btn icon-btn" onclick="$('body').toggleClass('dark')" title="Toggle Night Mode"><i class="fas fa-moon"></i></button>
                <button class="tb-btn icon-btn notebook-toggle-btn" onclick="toggleNotebookView()" title="Enter Notebook View"><i class="fas fa-book-open"></i></button>
            </div>
        </div>

        <div id="format-toolbar" style="display:none; background:#ffffff; border-bottom:1px solid #eaeaea; padding:6px 15px; flex-wrap:wrap; justify-content:flex-start; gap:8px; align-items:center; z-index:999; box-shadow: 0 2px 5px rgba(0,0,0,0.03);">

            <div class="menu-text-tools" style="display:flex; gap:4px; align-items:center;">
                <select class="ctx-select" style="width: 80px;" onchange="format('fontName', this.value)">
                    <option value="Arial">Arial</option><option value="Georgia">Georgia</option><option value="Times">Times</option>
                </select>
                <select class="ctx-select" style="width: 55px;" onchange="format('fontSize', this.value)">
                    <option value="" disabled selected hidden>Size</option>
                    <option value="1">XS</option><option value="3">Med</option><option value="5">L</option><option value="6">XL</option><option value="7">XXL</option>
                </select>
                <div class="separator" style="height:16px; margin: 0 2px;"></div>
                <button class="ctx-btn" onclick="format('bold')" title="Bold"><i class="fas fa-bold"></i></button>
                <button class="ctx-btn" onclick="format('italic')" title="Italic"><i class="fas fa-italic"></i></button>
                <button class="ctx-btn" onclick="format('underline')" title="Underline"><i class="fas fa-underline"></i></button>
                <div class="separator" style="height:16px; margin: 0 2px;"></div>
                <button class="ctx-btn" onclick="format('justifyLeft')" title="Align Left"><i class="fas fa-align-left"></i></button>
                <button class="ctx-btn" onclick="format('justifyCenter')" title="Align Center"><i class="fas fa-align-center"></i></button>
                <button class="ctx-btn" onclick="format('justifyRight')" title="Align Right"><i class="fas fa-align-right"></i></button>

                <div class="separator" style="height:16px; margin: 0 2px;"></div>
                <div style="font-size:9px; font-weight:bold; color:#666; margin-right:2px;">TEXT</div>
                <div class="color-grid" id="text-color-grid" title="Text Color"></div>
            </div>

            <div class="separator menu-text-tools" style="height:16px; margin: 0 2px;"></div>

            <div style="display:flex; gap:4px; align-items:center;">
                <div style="font-size:9px; font-weight:bold; color:#666; margin-right:2px;">BG</div>
                <div class="color-grid" id="bg-color-grid" title="Background Color"></div>

                <div style="display:flex; flex-direction:column; gap:6px; align-items:center; margin-left:12px;" title="Background Transparency">
                    <span style="font-size:9px; font-weight:bold; color:#666;">TRANSPARENCY</span>
                    <input type="range" min="0" max="1" step="0.1" value="0.8" style="width:60px; height:4px; margin:0; cursor:pointer;" oninput="updateBgOpacity(this.value)">
                </div>
            </div>

            <div class="separator" style="height:16px; margin: 0 2px;"></div>

            <div style="display:flex; gap:4px; align-items:center;">
                <button class="ctx-btn" onclick="changeLayer(1)" title="Move to Front"><i class="fas fa-angle-double-up"></i></button>
                <button class="ctx-btn" onclick="changeLayer(-1)" title="Move to Back"><i class="fas fa-angle-double-down"></i></button>
            </div>

            <div class="menu-img-tools" style="display:none; align-items:center; margin-left: 6px;">
                <button class="ctx-btn" onclick="startCrop()" style="background:#ea4335; color:white; font-weight:bold; border:none; padding: 4px 10px;"><i class="fas fa-crop-alt"></i> Crop</button>
            </div>

        </div>

        <div id="workspace">
            <div id="canvas-viewport">
                <div id="canvas-center-wrapper">
                    <div id="canvas">
                        {{{{SLIDE_CONTENT}}}}
                    </div>
                </div>
            </div>
            <div id="workbench">
                <button class="mobile-only-btn" style="width:100%; justify-content:center; background:#444; border-radius:0;" onclick="$('#workbench').removeClass('mobile-open')"><i class="fas fa-times"></i> Close Notes</button>
                <div class="tab-headers">
                    <button class="tab-btn active-tab" onclick="switchTab('note-tab')">Notes</button>
                    <button class="tab-btn" onclick="switchTab('pin-list-tab')">Pins</button>
                </div>
                <div id="note-tab" class="tab-content active-tab"><div id="note-main" contenteditable="true" oninput="saveNote(current)" placeholder="Start typing notes..."></div></div>
                <div id="pin-list-tab" class="tab-content">
                    <div style="display:flex; gap:10px; margin-bottom: 15px;">
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
