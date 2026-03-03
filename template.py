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

    <div id="notebook-sidebar">
        <button id="left-toggle" class="panel-toggle" onclick="toggleLeftPanel()">
            <i class="fas fa-chevron-left"></i>
        </button>
        <div class="ns-content">
            <div id="ns-title" class="ns-box">{{{{LECTURE_ID}}}}</div>
            <select id="ns-chapter-select" class="ns-box" onchange="renderNotebookStack(this.value)"></select>
            <div id="ns-page-stack"></div>
        </div>
    </div>

    <div id="notebook-right-panel">
        <button id="right-toggle" class="panel-toggle" onclick="toggleRightPanel()">
            <i class="fas fa-chevron-right"></i>
        </button>
        
        <button class="right-panel-btn exit-btn" onclick="toggleNotebookView()">
            <i class="fas fa-times-circle"></i> Exit Notebook View
        </button>
        
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

            <button id="edit-btn" class="tb-btn" onclick="toggleEdit()"><i class="fas fa-edit"></i> Edit</button>
            
            <div class="edit-tools" style="display:none;">
                <button class="tb-btn" id="undo-btn" onclick="undo()" disabled><i class="fas fa-undo"></i></button>
                
                <select class="tb-select" style="width: 80px;" onchange="format('fontName', this.value)">
                    <option value="Arial">Arial</option><option value="Georgia">Georgia</option><option value="Times">Times</option>
                </select>
                <select class="tb-select" style="width: 60px;" onchange="format('fontSize', this.value)">
                    <option value="" disabled selected hidden>Size</option>
                    <option value="1">XS</option><option value="3">Med</option><option value="6">XL</option><option value="7">XXL</option>
                </select>
                
                <button class="tb-btn" onclick="format('bold')" title="Bold"><i class="fas fa-bold"></i></button>
                <button class="tb-btn" onclick="format('italic')" title="Italic"><i class="fas fa-italic"></i></button>
                <button class="tb-btn" onclick="format('insertUnorderedList')" title="Bullet List"><i class="fas fa-list-ul"></i></button>
                <button class="tb-btn" onclick="format('insertOrderedList')" title="Numbered List"><i class="fas fa-list-ol"></i></button>
                
                <div class="separator"></div>
                <button class="tb-btn" onclick="format('justifyLeft')" title="Align Left"><i class="fas fa-align-left"></i></button>
                <button class="tb-btn" onclick="format('justifyCenter')" title="Align Center"><i class="fas fa-align-center"></i></button>
                
                <div class="separator"></div>
                <button class="tb-btn text-action" onclick="addImg()"><i class="fas fa-image"></i> Img</button>
                <button class="tb-btn text-action" onclick="addText()"><i class="fas fa-font"></i> Text</button>
                
                <div class="separator"></div>
                <button class="tb-btn size-action" onclick="changeCanvasHeight(250)" title="Increase
