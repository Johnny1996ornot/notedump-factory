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
    <script src="https://cdnjs.cloudflare.com/ajax/libs/localforage/1.10.0/localforage.min.js"></script>
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

    <div id="export-modal-bg" style="display:none; position:fixed; top:0; left:0; width:100vw; height:100vh; background:rgba(0,0,0,0.8); z-index:999998;">
        <div id="export-modal" class="crop-modal-content" style="position:fixed; top:50%; left:50%; transform:translate(-50%, -50%); width:320px; height:auto; z-index:999999; text-align:center;">
            <h3 style="margin-top:0; color:#0f172a;">Export Options</h3>
            <p style="font-size:13px; color:#64748b; margin-bottom: 20px;">Choose how you want to save your notebook.</p>
            <div style="display:flex; flex-direction:column; gap:10px;">
                <button onclick="saveNotebookToFile()" style="background:#4f46e5; color:white; padding:12px; border:none; border-radius:6px; cursor:pointer; font-weight:bold; display:flex; align-items:center; justify-content:center; gap:8px;"><i class="fas fa-code"></i> Save as Interactive HTML</button>
                <button onclick="saveReadOnlyNotebook()" style="background:#10b981; color:white; padding:12px; border:none; border-radius:6px; cursor:pointer; font-weight:bold; display:flex; align-items:center; justify-content:center; gap:8px;"><i class="fas fa-lock"></i> Save as Read-Only HTML</button>
                <button onclick="printToPDF()" style="background:#ef4444; color:white; padding:12px; border:none; border-radius:6px; cursor:pointer; font-weight:bold; display:flex; align-items:center; justify-content:center; gap:8px;"><i class="fas fa-file-pdf"></i> Print / Save as PDF</button>
                <button onclick="$('#export-modal-bg').hide()" style="background:#94a3b8; color:white; padding:10px; border:none; border-radius:6px; cursor:pointer; margin-top:5px;">Cancel</button>

                <button onclick="clearBrowserMemory()" style="background:#b91c1c; color:white; padding:10px; border:none; border-radius:6px; cursor:pointer; margin-top:20px; font-size:12px; font-weight:bold; display:flex; align-items:center; justify-content:center; gap:6px;"><i class="fas fa-trash-alt"></i> Clear Auto-Save Memory</button>
            </div>
        </div>
    </div>

    <div id="crop-modal">
        <div class="crop-modal-content">
            <h3 style="margin-top:0; color:#0f172a;">Crop Image</h3>
            <div style="flex-grow:1; overflow:hidden; background:#f1f5f9; display:flex; justify-content:center; align-items:center; border-radius: 8px;">
                <img id="crop-target" src="" style="max-width:100%; max-height:100%;">
            </div>
            <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:15px;">
                <button onclick="cancelCrop()" style="background:#94a3b8; color:white; padding:8px 16px; border:none; border-radius:4px; cursor:pointer;">Cancel</button>
                <button onclick="applyCrop()" style="background:#10b981; color:white; padding:8px 16px; border:none; border-radius:4px; cursor:pointer; font-weight:bold;">Apply Crop</button>
            </div>
        </div>
    </div>

    <div id="table-modal-bg" style="display:none; position:fixed; top:0; left:0; width:100vw; height:100vh; background:rgba(0,0,0,0.8); z-index:999998;">
        <div class="crop-modal-content" style="position:fixed; top:50%; left:50%; transform:translate(-50%, -50%); width:300px; height:auto; z-index:999999; text-align:center;">
            <h3 style="margin-top:0; color:#0f172a;">Create Table</h3>
            <div style="display:flex; justify-content: space-around; margin: 20px 0;">
                <div>
                    <label style="display:block; color:#64748b; font-size:12px; margin-bottom:5px; font-weight:bold;">Columns</label>
                    <input type="number" id="table-cols-input" value="3" min="1" max="15" style="width:70px; padding:8px; border-radius:4px; border:1px solid #cbd5e1; text-align:center; font-size:16px;">
                </div>
                <div>
                    <label style="display:block; color:#64748b; font-size:12px; margin-bottom:5px; font-weight:bold;">Rows</label>
                    <input type="number" id="table-rows-input" value="3" min="1" max="50" style="width:70px; padding:8px; border-radius:4px; border:1px solid #cbd5e1; text-align:center; font-size:16px;">
                </div>
            </div>
            <div style="display:flex; justify-content:flex-end; gap:10px;">
                <button onclick="$('#table-modal-bg').hide()" style="background:#94a3b8; color:white; padding:8px 16px; border:none; border-radius:4px; cursor:pointer;">Cancel</button>
                <button onclick="confirmAddTable()" style="background:#4f46e5; color:white; padding:8px 16px; border:none; border-radius:4px; cursor:pointer; font-weight:bold;">Drop Table</button>
            </div>
        </div>
    </div>

    <div id="nav">
        <div id="nav-toggle" onclick="toggleNav()"><i class="fas fa-caret-left" id="nav-toggle-icon"></i></div>
        <button class="mobile-only-btn" style="width:100%; margin-bottom:10px; justify-content:center; background:#1e293b;" onclick="toggleNav()"><i class="fas fa-times"></i> Close Pages</button>

        <div class="nav-icon-grid">
            <button class="icon-btn notebook-toggle-btn" onclick="toggleNotebookView()" title="Enter Notebook View"><i class="fas fa-book-open"></i></button>
            <button class="icon-btn" onclick="$('body').toggleClass('dark')" title="Toggle Night Mode"><i class="fas fa-moon"></i></button>
            <button class="icon-btn" onclick="toggleScrollMode()" title="Toggle Scroll Mode"><i class="fas fa-scroll"></i></button>
            <button class="icon-btn" id="edit-btn" onclick="toggleEdit()" title="Toggle Edit Mode"><i class="fas fa-edit"></i></button>
        </div>

        <div id="lecture-title" contenteditable="true" title="Click to rename file">{{{{VISIBLE_TITLE}}}}</div>

        <div class="nav-icon-grid" style="margin-bottom: 12px;">
            <button onclick="showExportModal()" class="icon-btn action-btn" title="Export Notebook Options"><i class="fas fa-download"></i></button>
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
                <button onclick="closeSearchBar()" style="color:#ef4444;"><i class="fas fa-times"></i></button>
            </div>
        </div>

        <hr style="border-color: #334155; margin: 10px 0; width: 100%;">
        <div id="nav-list-container">
            {{{{NAV_LINKS}}}}
        </div>
    </div>

    <div id="main-stage">
        <div id="workspace">

            <div id="canvas-global-tools" style="display:none;">

                <div class="tools-column" style="flex: 2;">
                    <div class="tool-group" style="justify-content: center; gap: 4px;">
                        <button class="ctx-btn" onmousedown="event.preventDefault();" onclick="addImgCenter()"><i class="fas fa-image"></i> Img</button>
                        <div class="separator" style="height:18px; margin: 0 4px;"></div>
                        <button class="ctx-btn" onmousedown="event.preventDefault();" onclick="addAudioCenter()"><i class="fas fa-music"></i> Audio</button>
                        <div class="separator" style="height:18px; margin: 0 4px;"></div>
                        <button class="ctx-btn" onmousedown="event.preventDefault();" onclick="addTableCenter()"><i class="fas fa-table"></i> Table</button>
                        <div class="separator" style="height:18px; margin: 0 4px;"></div>
                        <button class="ctx-btn" onmousedown="event.preventDefault();" onclick="activateTextPlacement()"><i class="fas fa-font"></i> Text</button>
                    </div>

                    <div style="display: flex; gap: 12px;">
                        <div class="tool-group" style="flex: 1; justify-content: center;">
                            <i class="fas fa-border-all" style="color:#475569; font-size:12px; margin-right:6px;"></i>
                            <span style="font-size:11px; font-weight:bold; margin-right:6px;">Grid:</span>
                            <select id="grid-select" class="ctx-select" onchange="applyCanvasSettings()" style="min-width: 65px;">
                                <option value="0">Off</option>
                                <option value="2">2 Grid</option>
                                <option value="3">3 Grid</option>
                                <option value="4">4 Grid</option>
                                <option value="6">6 Grid</option>
                                <option value="8">8 Grid</option>
                            </select>
                        </div>
                        <div class="tool-group" style="flex: 2; justify-content: center;">
                            <button class="ctx-btn" id="draw-btn" onclick="toggleDrawMode()"><i class="fas fa-pen-nib"></i> Draw</button>
                            <div class="separator" style="height:18px; margin: 0 6px;"></div>
                            <input type="color" id="draw-color" value="#ef4444" style="width:22px; height:22px; border:none; padding:0; cursor:pointer;">
                            <input type="range" id="draw-size" min="1" max="20" value="3" style="width:60px; height:4px; margin:0 8px; cursor:pointer;">
                        </div>
                    </div>
                </div>

                <div class="tools-column" style="flex: 1;">
                    <div class="tool-group" style="justify-content: center; padding: 6px 16px;">
                        <span style="font-size:12px; font-weight:bold; margin-right:12px;">Size:</span>
                        <span style="font-weight:bold; font-size:11px; margin-right:6px;">W</span>
                        <input type="number" id="canvas-w-cm" value="21.6" step="3" style="width:50px; text-align:center; padding: 4px;" onchange="applyCanvasSettings()">
                        <span style="font-weight:bold; font-size:11px; margin-left:14px; margin-right:6px;">H</span>
                        <input type="number" id="canvas-h-cm" value="27.9" step="3" style="width:50px; text-align:center; padding: 4px;" onchange="applyCanvasSettings()">
                    </div>
                    <div class="tool-group" style="justify-content: center; gap: 4px; padding: 6px 12px;">
                        <button class="ctx-btn" style="border:none; background:transparent; font-size: 11px;" onclick="mergeNextPage()" title="Merge with Page Below"><i class="fas fa-link"></i> Merge</button>
                        <div class="separator" style="height:18px; margin: 0 4px;"></div>
                        <button class="ctx-btn" style="border:none; background:transparent; font-size: 11px;" onclick="splitPage()" title="Split Page in Half"><i class="fas fa-cut"></i> Split</button>
                    </div>
                </div>

                <div class="tool-group tools-tall-action" onclick="document.getElementById('uniform-height-check').click();" title="Apply size to all pages">
                    <input type="checkbox" id="uniform-height-check" style="margin-bottom:8px; cursor:pointer; transform:scale(1.3);" onchange="applyCanvasSettings()">
                    <span style="font-size:11px; white-space:nowrap;">Apply<br>to all</span>
                </div>

                <div class="tool-group tools-tall-action" onclick="undo()" style="min-width: 60px;">
                    <button class="ctx-btn" id="undo-btn" disabled style="border:none; background:transparent; padding:0; flex-direction:column; gap:6px;">
                        <i class="fas fa-undo" style="font-size: 20px; margin: 0;"></i>
                        <span style="font-weight:bold; font-size: 11px;">Undo</span>
                    </button>
                </div>
            </div>

            <div id="canvas-viewport">
                <div id="canvas-center-wrapper">
                    <div id="canvas">
                        {{{{SLIDE_CONTENT}}}}

                        <div id="context-menu" style="display:none; position:absolute; flex-direction:column; gap:4px; padding:8px 10px; border-radius:8px; background:white; border: 1px solid #cbd5e1; box-shadow: 0 4px 15px rgba(0,0,0,0.3); z-index:10000;">

                            <div class="menu-text-tools" style="display:flex; gap:4px; align-items:center; background: #f8fafc; padding: 4px; border-radius: 4px; border: 1px solid #e2e8f0;">
                                <select class="ctx-select" style="width: 75px;" onchange="format('fontName', this.value)">
                                    <option value="Arial">Arial</option><option value="Georgia">Georgia</option><option value="Times">Times</option>
                                </select>

                                <select class="ctx-select" id="font-size-select" style="width: 55px;" onchange="applyFontSize(this.value)" title="Font Size">
                                    <option value="" disabled hidden>Size</option>
                                    <option value="8">8</option><option value="10">10</option><option value="11">11</option>
                                    <option value="12">12</option><option value="14">14</option><option value="16">16</option>
                                    <option value="18">18</option><option value="20">20</option><option value="24">24</option>
                                    <option value="28">28</option><option value="32">32</option><option value="36">36</option>
                                    <option value="40">40</option><option value="48">48</option><option value="56">56</option>
                                    <option value="64">64</option><option value="72">72</option><option value="96">96</option>
                                    <option value="120">120</option><option value="144">144</option><option value="200">200</option>
                                    <option value="250">250</option><option value="300">300</option><option value="400">400</option>
                                    <option value="500">500</option>
                                </select>
                                <span style="font-size:10px; color:#64748b; font-weight:bold; margin-right:4px;">px</span>

                                <div class="separator" style="height:16px; margin: 0 2px;"></div>

                                <i class="fas fa-arrows-alt-v" style="color:#64748b; font-size:10px; margin-left:4px;"></i>
                                <select class="ctx-select" onchange="applyLineHeight(this.value)" title="Line Spacing" style="width: 58px; margin-left:2px; padding: 2px 4px;">
                                    <option value="" disabled hidden selected>Spc</option>
                                    <option value="1">1.0</option>
                                    <option value="1.15">1.15</option>
                                    <option value="1.5">1.5</option>
                                    <option value="2">2.0</option>
                                </select>

                                <div class="separator" style="height:16px; margin: 0 2px;"></div>
                                <button class="ctx-btn" onmousedown="event.preventDefault();" onclick="format('bold')" title="Bold"><i class="fas fa-bold"></i></button>
                                <button class="ctx-btn" onmousedown="event.preventDefault();" onclick="format('italic')" title="Italic"><i class="fas fa-italic"></i></button>
                                <button class="ctx-btn" onmousedown="event.preventDefault();" onclick="format('underline')" title="Underline"><i class="fas fa-underline"></i></button>
                                <div class="separator" style="height:16px; margin: 0 2px;"></div>
                                <button class="ctx-btn" onmousedown="event.preventDefault();" onclick="format('justifyLeft')" title="Align Left"><i class="fas fa-align-left"></i></button>
                                <button class="ctx-btn" onmousedown="event.preventDefault();" onclick="format('justifyCenter')" title="Align Center"><i class="fas fa-align-center"></i></button>
                                <button class="ctx-btn" onmousedown="event.preventDefault();" onclick="format('justifyRight')" title="Align Right"><i class="fas fa-align-right"></i></button>
                                <button class="ctx-btn" onmousedown="event.preventDefault();" onclick="format('justifyFull')" title="Justify"><i class="fas fa-align-justify"></i></button>
                                <div class="separator" style="height:16px; margin: 0 2px;"></div>
                                <button class="ctx-btn" onmousedown="event.preventDefault();" onclick="format('insertUnorderedList')" title="Bullet List"><i class="fas fa-list-ul"></i></button>
                                <button class="ctx-btn" onmousedown="event.preventDefault();" onclick="format('insertOrderedList')" title="Numbered List"><i class="fas fa-list-ol"></i></button>
                            </div>

                            <div style="display:flex; gap:6px; align-items:center; padding: 2px;">
                                <div id="menu-drag-handle" title="Drag to move element" style="cursor: move; padding: 4px 6px; color: white; background:#4f46e5; border-radius:4px; margin-right:4px;"><i class="fas fa-arrows-alt"></i></div>

                                <button class="ctx-btn" onmousedown="event.preventDefault();" onclick="changeLayer(1)" title="Move to Front"><i class="fas fa-angle-double-up"></i></button>
                                <button class="ctx-btn" onmousedown="event.preventDefault();" onclick="changeLayer(-1)" title="Move to Back"><i class="fas fa-angle-double-down"></i></button>
                                <div class="separator" style="height:16px;"></div>

                                <div class="menu-text-tools" style="display:flex; gap:6px; align-items:center;">
                                    <span style="font-size:9px; font-weight:bold; color:#64748b; text-align:right; line-height:1.2; margin-left:4px;">Text<br>Color</span>
                                    <div class="color-grid" id="text-color-grid" title="Text Color"></div>
                                </div>

                                <div class="separator menu-bg-tools" style="height:24px; margin: 0 8px; background:#cbd5e1; width:1px;"></div>

                                <div class="menu-bg-tools" style="display:flex; gap:6px; align-items:center;">
                                    <span style="font-size:9px; font-weight:bold; color:#64748b; text-align:right; line-height:1.2;">Background<br>Color</span>
                                    <div class="color-grid" id="bg-color-grid" title="Background Color"></div>
                                </div>

                                <div class="separator menu-bg-tools" style="height:24px; margin: 0 8px; background:#cbd5e1; width:1px;"></div>

                                <div style="display:flex; flex-direction:column; gap:5px; align-items:center; margin: 0 8px;" title="Object Background Transparency">
                                    <span style="font-size:9px; font-weight:bold; color:#64748b; margin-bottom:4px; letter-spacing:1px;">TRANSPARENCY</span>
                                    <input type="range" id="transparency-slider" min="0" max="1" step="0.1" value="1" style="width:65px; height:4px; margin:0; cursor:pointer;" oninput="liveUpdateOpacity(this.value)" onchange="commitOpacity()">
                                </div>

                                <div class="menu-img-tools" style="display:none; align-items:center; margin-left: 10px; gap: 8px;">
                                    <button class="ctx-btn" onmousedown="event.preventDefault();" onclick="addPinToSelectedImage()" style="background:#4f46e5; color:white; font-weight:bold; border:none; padding: 6px 14px; font-size:12px;"><i class="fas fa-map-marker-alt" style="margin-right: 6px;"></i> Pin</button>
                                    <button class="ctx-btn" onmousedown="event.preventDefault();" onclick="startCrop()" style="background:#ef4444; color:white; font-weight:bold; border:none; padding: 6px 14px; font-size:12px;"><i class="fas fa-crop-alt" style="margin-right: 6px;"></i> Crop</button>
                                </div>
                            </div>

                            <div class="menu-table-tools" style="display:none; gap:6px; align-items:center; background: #f1f5f9; padding: 4px; border-radius: 4px; border: 1px solid #e2e8f0; margin-top:2px;">
                                <span style="font-size:10px; font-weight:bold; color:#64748b; margin-right:4px;">TABLE:</span>

                                <button class="ctx-btn" onmousedown="event.preventDefault();" onclick="selectTableRow()" title="Select Entire Row" style="color:#0ea5e9; font-weight:bold;"><i class="fas fa-arrows-alt-h" style="margin-right:3px;"></i>Row</button>
                                <button class="ctx-btn" onmousedown="event.preventDefault();" onclick="selectTableCol()" title="Select Entire Column" style="color:#0ea5e9; font-weight:bold;"><i class="fas fa-arrows-alt-v" style="margin-right:3px;"></i>Col</button>
                                <div class="separator" style="height:16px;"></div>

                                <button class="ctx-btn" onmousedown="event.preventDefault();" onclick="addTableRow()" title="Add Row Below"><i class="fas fa-grip-lines" style="margin-right:3px;"></i>+R</button>
                                <button class="ctx-btn" onmousedown="event.preventDefault();" onclick="addTableCol()" title="Add Column Right"><i class="fas fa-grip-lines-vertical" style="margin-right:3px;"></i>+C</button>
                                <div class="separator" style="height:16px;"></div>
                                <button class="ctx-btn" onmousedown="event.preventDefault();" onclick="delTableRow()" title="Delete Selected Row" style="color:#ef4444;"><i class="fas fa-trash" style="margin-right:3px;"></i>-R</button>
                                <button class="ctx-btn" onmousedown="event.preventDefault();" onclick="delTableCol()" title="Delete Selected Column" style="color:#ef4444;"><i class="fas fa-trash" style="margin-right:3px;"></i>-C</button>
                                <div class="separator" style="height:16px;"></div>
                                <button class="ctx-btn" onmousedown="event.preventDefault();" onclick="equalizeTable()" title="Make Rows/Cols Equal"><i class="fas fa-equals"></i></button>
                                <button class="ctx-btn" onmousedown="event.preventDefault();" onclick="mergeTableCells()" title="Merge Selected Cells (Shift+Click to select)"><i class="fas fa-compress-arrows-alt"></i></button>
                            </div>

                        </div>

                    </div>
                </div>
            </div>

            <div id="fab-container">
                <button class="fab-btn" onclick="togglePanel('sticky')" title="Sticky Notes"><i class="fas fa-sticky-note"></i></button>
                <button class="fab-btn" onclick="togglePanel('pin')" title="Image Pins"><i class="fas fa-map-marker-alt"></i></button>
            </div>

            <div id="sticky-panel" class="floating-panel">
                <div class="fw-header">
                    <h3 style="margin:0; font-size:14px; color:var(--text); flex-grow:1;"><i class="fas fa-sticky-note"></i> Sticky Notes</h3>
                    <button class="close-panel-btn" onclick="togglePanel('sticky')" title="Close Panel"><i class="fas fa-times"></i></button>
                </div>
                <div class="panel-body" style="padding-top: 15px;">
                    <div style="display:flex; gap:10px; margin-bottom: 15px; padding: 0 15px;">
                        <button onclick="dropStickyNote()" style="background:#fde047; color:#1e293b; border:none; padding:8px; border-radius:4px; cursor:pointer; flex-grow:1; font-weight:bold; box-shadow:0 2px 5px rgba(0,0,0,0.1);">+ Drop Sticky Note</button>
                    </div>
                    <div id="sticky-list-container"></div>
                </div>
            </div>

            <div id="pin-panel" class="floating-panel">
                <div id="pin-panel-header" class="fw-header">
                    <h3 style="margin:0; font-size:14px; color:var(--text); flex-grow:1;"><i class="fas fa-map-marker-alt"></i> Image Pins</h3>
                    <button class="close-panel-btn" onclick="togglePanel('pin')" title="Close Panel"><i class="fas fa-times"></i></button>
                </div>
                <div id="pin-panel-tools" class="pin-panel-tools"></div>
                <div id="pin-list-container" class="panel-body" style="padding-top: 15px;"></div>
            </div>

        </div>
    </div>
    <script>
        let totalPages = {total_pages};
        const LECTURE_ID = "{{{{STORAGE_ID}}}}";
        {js_engine}
    </script>
</body>
</html>
"""
