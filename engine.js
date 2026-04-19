// ==========================================================================
// STRICT CSS INJECTION 
// ==========================================================================
const uiFixesCSS = `
    /* ABSOLUTE HIDE: Removes rotation handles and dots when the pin is NOT actively selected */
    #canvas .pin:not(.is-selected) .pin-rotation-ring,
    #canvas .pin:not(.is-selected) .pin-rotate-dot { 
        opacity: 0 !important; 
        visibility: hidden !important;
        pointer-events: none !important; 
    }

    /* FIX STICKY DROPDOWN CUTOFF AND OVERLAP (Preserving Base CSS Flexbox) */
    .custom-sticky-card {
        flex-wrap: wrap !important;
    }
    #sticky-panel .sticky-dropdown.hidden {
        display: none !important;
    }
    #sticky-panel .sticky-dropdown:not(.hidden) {
        position: relative !important;
        left: 0 !important;
        top: 0 !important;
        width: 100% !important;
        margin-top: 10px !important;
        background: #0f172a !important;
        border: 1px solid #334155 !important;
        border-radius: 8px !important;
        padding: 10px !important;
        box-sizing: border-box !important;
        display: flex !important;
        flex-direction: column !important;
        gap: 10px !important;
    }

    /* GLOW EFFECT FOR PINS ON HOVER - Removed scale transform to protect base CSS rotation */
    #canvas .pin:hover .pin-visual,
    #canvas .pin.pin-hover-visible .pin-visual {
        box-shadow: 0 0 15px 4px var(--pin-color) !important;
        filter: drop-shadow(0 0 8px var(--pin-color)) brightness(1.2) !important;
        transition: all 0.2s ease-in-out !important;
        z-index: 99999 !important;
    }

    /* Prevent rectangles from glowing weirdly */
    #canvas .pin[data-shape="rectangle"]:hover .pin-visual,
    #canvas .pin[data-shape="rectangle"].pin-hover-visible .pin-visual {
        box-shadow: inset 0 0 10px 2px var(--pin-color), 0 0 15px 4px var(--pin-color) !important;
    }
    
    /* CARD GLOW WHEN PIN IS HOVERED ON CANVAS */
    .custom-image-pin-layout.is-hovered-from-canvas,
    .custom-sticky-card.is-hovered-from-canvas {
        box-shadow: 0 0 0 2px #38bdf8, 0 0 20px 5px rgba(56, 189, 248, 0.4) !important;
        transform: scale(1.02) !important;
        transition: all 0.2s ease-in-out !important;
        position: relative !important;
        z-index: 100 !important;
        background: #1e293b !important; 
        border-radius: 8px !important;
    }

    /* MOVE PIN HOVER TOOLTIP TEXT TO THE RIGHT SIDE TO PREVENT BLOCKING THE YELLOW HANDLE */
    #canvas .pin[data-note]:not(:has(.pin-rotate-dot:hover)):hover::before,
    #canvas .pin[data-note].pin-hover-visible::before {
        top: 50% !important;
        bottom: auto !important;
        left: 100% !important;
        transform: translateY(-50%) !important;
        margin-left: 15px !important;
        margin-bottom: 0 !important;
        z-index: 999999 !important;
    }
`;
if ($('#custom-ui-fixes').length === 0) {
    $('<style id="custom-ui-fixes">').text(uiFixesCSS).appendTo('head');
}

// ==========================================================================
// SECTION 1: GLOBAL VARIABLES & STATE MANAGEMENT
// ==========================================================================
let current = "0"; 
let isEditing = false; 
let noteHistory = []; 
let customClipboard = []; 
let cropperInstance = null; 
let currentZoom = 1; 

let searchResults = [];
let currentSearchIndex = -1;
let currentViewMode = 'single';

let savedSelection = null;
let lastSavedState = null;

let isDrawMode = false;
let isEraserMode = false;
let isDrawing = false;
let currentSvgPath = null;
let pathString = "";

// Colors
const COLORS = ['#ef4444', '#f97316', '#fde047', '#10b981', '#0ea5e9', '#1d4ed8', '#8b5cf6', '#64748b', '#94a3b8', '#e2e8f0', '#ffffff', '#0f172a'];

let lastMouseX = 150;
let lastMouseY = 150;

let activePinTabIdx = 0; 
let isPlacingText = false;
let isPlacingSticky = false;

let typingTimer;
const TYPING_DELAY = 800; 

function showToast(msg) {
    let toast = document.getElementById('toast-msg');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'toast-msg';
        toast.style.cssText = 'position:fixed; bottom:40px; left:50%; transform:translateX(-50%); background:rgba(15,23,42,0.95); color:white; padding:12px 24px; border-radius:30px; z-index:9999999; font-weight:bold; font-size:14px; box-shadow:0 4px 20px rgba(0,0,0,0.5); transition: opacity 0.3s; pointer-events:none;';
        document.body.appendChild(toast);
    }
    toast.innerText = msg;
    toast.style.opacity = '1';
    setTimeout(() => { toast.style.opacity = '0'; }, 3500);
}

// ==========================================================================
// SECTION 2: UTILITY & HELPER FUNCTIONS
// ==========================================================================
function getHighestZ() {
    let maxZ = 10;
    $(`#p-${current} .canvas-box, #p-${current} .pin`).each(function() {
        let z = parseInt($(this).css('z-index')) || 10;
        if (z > maxZ) maxZ = z;
    });
    return maxZ + 1;
}

function debouncedSaveHistory() {
    clearTimeout(typingTimer);
    typingTimer = setTimeout(() => { saveHistory(); }, TYPING_DELAY);
}

function saveSelection() {
    if (window.getSelection) {
        let sel = window.getSelection();
        if (sel.getRangeAt && sel.rangeCount) {
            savedSelection = sel.getRangeAt(0);
        }
    }
}

function restoreSelection() {
    if (savedSelection) {
        if (window.getSelection) {
            let sel = window.getSelection();
            sel.removeAllRanges();
            sel.addRange(savedSelection);
        }
    }
}

$(document).on('mousedown touchstart', function(e) {
    if (!$(e.target).closest('.content-area').length && window.getSelection) {
        if ($(e.target).closest('#context-menu').length > 0) return; 
        window.getSelection().removeAllRanges();
    }
});

$(document).on('keyup mouseup touchend', '.content-area', function() {
    saveSelection();
});

$(document).on('focus', '.content-area', function() {
    $(this).closest('.canvas-box').addClass('is-editing');
}).on('blur', '.content-area', function() {
    $(this).closest('.canvas-box').removeClass('is-editing');
});

document.addEventListener('selectionchange', () => {
    if (!isEditing) return;
    let selection = window.getSelection();
    if (selection.rangeCount > 0 && selection.anchorNode) {
        let parentEl = selection.anchorNode.nodeType === 3 ? selection.anchorNode.parentNode : selection.anchorNode;
        if ($(parentEl).closest('.content-area').length > 0) {
            savedSelection = selection.getRangeAt(0);
            
            let computedStyle = window.getComputedStyle(parentEl);
            let currentSize = computedStyle.fontSize; 
            let sizeInt = parseInt(currentSize);
            
            let $fontSizePicker = $('select[data-cmd="fontSize"]');
            if ($fontSizePicker.length > 0 && !isNaN(sizeInt)) {
                if ($fontSizePicker.find(`option[value="${sizeInt}"]`).length === 0) {
                    $fontSizePicker.append(`<option value="${sizeInt}">${sizeInt}</option>`);
                }
                $fontSizePicker.val(sizeInt);
            }
        }
    }
});

function format(command, value = null) {
    let $cells = $('.selected-cell');
    let selStr = window.getSelection().toString();

    if (command === 'align') {
        saveHistory();
        let alignMap = {
            topLeft:      { h: 'left',   v: 'top' },
            topCenter:    { h: 'center', v: 'top' },
            topRight:     { h: 'right',  v: 'top' },
            middleLeft:   { h: 'left',   v: 'middle' },
            middleCenter: { h: 'center', v: 'middle' },
            middleRight:  { h: 'right',  v: 'middle' },
            bottomLeft:   { h: 'left',   v: 'bottom' },
            bottomCenter: { h: 'center', v: 'bottom' },
            bottomRight:  { h: 'right',  v: 'bottom' }
        };
        
        let map = alignMap[value];
        if (map) {
            if ($cells.length > 0) {
                $cells.css({ 'text-align': map.h, 'vertical-align': map.v });
                $cells.find('*').css({ 'text-align': map.h });
            } else {
                let $activeBox = $('.selected-box').not(':has(table)'); 
                if ($activeBox.length > 0) {
                    let jcMap = { 'left': 'flex-start', 'center': 'center', 'right': 'flex-end' };
                    let aiMap = { 'top': 'flex-start', 'middle': 'center', 'bottom': 'flex-end' };
                    $activeBox.find('.content-area').css({
                        'display': 'flex',
                        'flex-direction': 'column',
                        'text-align': map.h,
                        'justify-content': aiMap[map.v],
                        'align-items': jcMap[map.h]
                    });
                    $activeBox.find('.content-area *').css('text-align', map.h);
                }
            }
        }
        return;
    }

    if ($cells.length > 0 && ($cells.length > 1 || selStr.length === 0)) {
        saveHistory();
        if (command === 'bold') {
            let isBold = $cells.first().css('font-weight') === '700' || $cells.first().css('font-weight') === 'bold';
            let targetWeight = isBold ? 'normal' : 'bold';
            $cells.css('font-weight', targetWeight);
            $cells.find('*').css('font-weight', targetWeight);
        } else if (command === 'italic') {
            let isItalic = $cells.first().css('font-style') === 'italic';
            let targetStyle = isItalic ? 'normal' : 'italic';
            $cells.css('font-style', targetStyle);
            $cells.find('*').css('font-style', targetStyle);
        } else if (command === 'underline') {
            let isUnderlined = ($cells.first().css('text-decoration') || '').includes('underline');
            let targetDeco = isUnderlined ? 'none' : 'underline';
            $cells.css('text-decoration', targetDeco);
            $cells.find('*').css('text-decoration', targetDeco);
        } else {
            $cells.each(function() {
                let range = document.createRange();
                range.selectNodeContents(this);
                let sel = window.getSelection();
                sel.removeAllRanges();
                sel.addRange(range);
                document.execCommand(command, false, value);
            });
            window.getSelection().removeAllRanges();
        }
        saveHistory();
        return;
    }

    restoreSelection();
    document.execCommand(command, false, value);
    saveHistory();
}

function applyFontSize(size) {
    saveHistory(); 

    let $cells = $('.selected-cell');
    let selStr = window.getSelection().toString();
    let $activeBox = $('.selected-box').not(':has(table)');

    if ($cells.length > 0 && ($cells.length > 1 || selStr.length === 0)) {
        $cells.css('font-size', size + 'px');
        $cells.find('*').css('font-size', ''); 
        return;
    }

    if ($activeBox.length > 0 && selStr.length === 0 && $cells.length === 0) {
        let $content = $activeBox.find('.content-area');
        $content.css('font-size', size + 'px');
        $content.find('*').css('font-size', ''); 
        $activeBox.css({'height': 'auto', 'min-height': '50px', 'overflow': 'visible'});
        return;
    }

    restoreSelection();
    document.execCommand("styleWithCSS", false, false); 
    document.execCommand("fontSize", false, "7"); 

    let fonts = document.querySelectorAll('font[size="7"]');
    fonts.forEach(el => {
        el.removeAttribute("size");
        el.style.fontSize = size + "px";
        $(el).find('*').css('font-size', '');
    });

    let spans = document.querySelectorAll('span');
    spans.forEach(el => {
        let fs = el.style.fontSize;
        if (fs === '-webkit-xxx-large' || fs === 'xxx-large' || fs === '48px') {
            el.style.fontSize = size + 'px';
            $(el).find('*').css('font-size', '');
        }
    });

    saveHistory(); 
}

function applyLineHeight(val) {
    let $cells = $('.selected-cell');
    let selStr = window.getSelection().toString();

    if ($cells.length > 0 && ($cells.length > 1 || selStr.length === 0)) {
        saveHistory();
        $cells.css('line-height', val);
        $cells.find('*').css('line-height', val);
        return;
    }

    restoreSelection();
    let selection = window.getSelection();
    if(selection.rangeCount > 0) {
        let node = selection.focusNode;
        if(node) {
            let $block = $(node).closest('div, li, .content-area');
            if($block.length) {
                $block.css('line-height', val);
                saveHistory();
            }
        }
    }
}

$(document).on('mousemove touchmove', function(e) {
    let isTouch = e.type.startsWith('touch');
    lastMouseX = isTouch ? e.originalEvent.touches[0].clientX : e.clientX;
    lastMouseY = isTouch ? e.originalEvent.touches[0].clientY : e.clientY;
});

function getPasteCoords() {
    let cvp = document.getElementById('canvas-viewport');
    let pageEl = document.getElementById('p-' + current);
    if (!cvp || !pageEl) return { x: 150, y: 150 };

    let rect = pageEl.getBoundingClientRect();
    let cvpRect = cvp.getBoundingClientRect();

    let screenCenterX = cvpRect.left + (cvpRect.width / 2);
    let screenCenterY = cvpRect.top + (cvpRect.height / 2);

    let localX = (screenCenterX - rect.left) / currentZoom - 50; 
    let localY = (screenCenterY - rect.top) / currentZoom - 50;

    return { x: Math.max(10, localX), y: Math.max(10, localY) };
}

function getScreenCenterCoords(boxWidth = 300, boxHeight = 150) {
    let cvp = document.getElementById('canvas-viewport');
    let pageEl = document.getElementById('p-' + current);
    if (!cvp || !pageEl) return { x: 50, y: 50 };

    let rect = pageEl.getBoundingClientRect();
    let viewportRect = cvp.getBoundingClientRect();

    let screenCenterX = viewportRect.left + (viewportRect.width / 2);
    let screenCenterY = viewportRect.top + (viewportRect.height / 2);

    let localX = (screenCenterX - rect.left) / currentZoom - (boxWidth / 2);
    let localY = (screenCenterY - rect.top) / currentZoom - (boxHeight / 2);

    let maxW = $(pageEl).width() || 816;
    let maxH = $(pageEl).height() || 1054;

    if (localX < 10) localX = 10;
    if (localY < 10) localY = 10;
    if (localX + boxWidth > maxW) localX = Math.max(10, maxW - boxWidth - 10);
    if (localY + boxHeight > maxH) localY = Math.max(10, maxH - boxHeight - 10);

    return { x: localX, y: localY };
}

function formatTime(seconds) {
    if(isNaN(seconds)) return "0:00";
    let m = Math.floor(seconds / 60);
    let s = Math.floor(seconds % 60);
    return m + ":" + (s < 10 ? "0" : "") + s;
}

function enforceBoundaries() {
    $('.canvas-box').each(function() {
        let $p = $(this).closest('.page');
        if (!$p.length) return;

        let pw = $p.width(); 
        let ph = $p.height();
        let left = parseFloat($(this).css('left')) || 0;
        let top = parseFloat($(this).css('top')) || 0;
        let w = $(this).outerWidth() || 50;
        let h = $(this).outerHeight() || 50;

        let newLeft = left;
        let newTop = top;

        if (left < 0) newLeft = 10;
        if (top < 0) newTop = 10;
        if (left + w > pw) newLeft = Math.max(10, pw - w - 10);
        if (top + h > ph) newTop = Math.max(10, ph - h - 10);

        if (newLeft !== left || newTop !== top) {
            $(this).css({ 'left': newLeft + 'px', 'top': newTop + 'px' });
        }
    });
}

// ==========================================================================
// SECTION 3: STORAGE, PERSISTENCE & FAST UNDO
// ==========================================================================
function getPageHTML() {
    let pageElement = document.getElementById('p-' + current);
    if (!pageElement) return { html: "", style: "" };
    let clone = pageElement.cloneNode(true);
    let dirtyElements = clone.querySelectorAll('.selected-box, .selected-cell, .pin-active-focus, .pin-text-visible, .pin-text-left, .pin-hover-visible, .is-editing-text, .is-rotating, .is-selected');
    dirtyElements.forEach(el => {
        el.classList.remove('selected-box', 'selected-cell', 'pin-active-focus', 'pin-text-visible', 'pin-text-left', 'pin-hover-visible', 'is-editing-text', 'is-rotating', 'is-selected');
        if (el.className.trim() === '') el.removeAttribute('class');
    });
    return { html: clone.innerHTML, style: pageElement.getAttribute('style') || "" };
}

function getFullCanvasHTML() {
    let canvasElement = document.getElementById('canvas');
    if (!canvasElement) return "";
    let clone = canvasElement.cloneNode(true);
    let menu = clone.querySelector('#context-menu');
    if (menu) menu.remove();
    let dirtyElements = clone.querySelectorAll('.selected-box, .selected-cell, .pin-active-focus, .pin-text-visible, .pin-text-left, .pin-hover-visible, .is-editing-text, .is-rotating, .is-selected');
    dirtyElements.forEach(el => {
        el.classList.remove('selected-box', 'selected-cell', 'pin-active-focus', 'pin-text-visible', 'pin-text-left', 'pin-hover-visible', 'is-editing-text', 'is-rotating', 'is-selected');
        if (el.className.trim() === '') el.removeAttribute('class');
    });
    return clone.innerHTML;
}

async function autoSaveToBrowser() {
    if ($('#canvas').html().length > 100) {
        try {
            await localforage.setItem(`nd_${LECTURE_ID}_canvas`, getFullCanvasHTML());
            await localforage.setItem(`nd_${LECTURE_ID}_nav`, $('#nav-list-container').html());
            await localforage.setItem(`nd_${LECTURE_ID}_pages`, totalPages);
            await localforage.setItem(`nd_${LECTURE_ID}_title`, $('#lecture-title').text());
            await localforage.setItem(`nd_${LECTURE_ID}_width`, parseInt($('#canvas').attr('data-width')) || 816); 
        } catch(e) {
            console.warn("Storage Limit Reached or Database Error.", e);
        }
    }
}

async function clearBrowserMemory() {
    if(confirm("⚠️ WARNING: This will delete your browser's auto-saved cache. (Your downloaded .html files are safe). Proceed?")) {
        await localforage.removeItem(`nd_${LECTURE_ID}_canvas`);
        await localforage.removeItem(`nd_${LECTURE_ID}_nav`);
        await localforage.removeItem(`nd_${LECTURE_ID}_pages`);
        await localforage.removeItem(`nd_${LECTURE_ID}_title`);
        await localforage.removeItem(`nd_${LECTURE_ID}_width`);
        location.reload();
    }
}

async function restoreFromBrowser() {
    try {
        let savedPages = await localforage.getItem(`nd_${LECTURE_ID}_pages`);
        if (savedPages && savedPages !== totalPages) {
            await localforage.removeItem(`nd_${LECTURE_ID}_canvas`);
            await localforage.removeItem(`nd_${LECTURE_ID}_nav`);
        }

        let $menu = $('#context-menu').detach();
        let savedCanvas = await localforage.getItem(`nd_${LECTURE_ID}_canvas`);
        let savedNav = await localforage.getItem(`nd_${LECTURE_ID}_nav`);
        let savedTitle = await localforage.getItem(`nd_${LECTURE_ID}_title`);
        let savedWidth = await localforage.getItem(`nd_${LECTURE_ID}_width`);

        if (savedCanvas && savedNav) {
            $('#canvas').html(savedCanvas);
            $('#nav-list-container').html(savedNav);
            if (savedTitle) {
                $('#lecture-title').text(savedTitle);
                document.title = savedTitle; 
            }
            if (savedWidth) {
                $('#canvas').attr('data-width', savedWidth);
                $('#canvas-w-cm').val(Math.round((savedWidth / 37.795) * 10) / 10);
            }
            showToast("🔄 Previous session restored.");
        }

        $('#canvas').append($menu);

        $('.pin').each(function() {
            if (!$(this).attr('style').includes('--pin-color')) {
                let bg = $(this).find('.pin-visual').css('background-color') || '#ef4444';
                if(bg === 'rgba(0, 0, 0, 0)' || bg === 'transparent') bg = '#ef4444';
                $(this)[0].style.setProperty('--pin-color', bg);
            }
        });

        $('.page').each(function() {
            let h = parseInt($(this).attr('data-page-height') || $(this).attr('data-height')) || 1054;
            $(this).attr('data-page-height', h);
            $(this).css('height', h + 'px');

            let w = parseInt($(this).attr('data-page-width')) || 816;
            $(this).css('width', w + 'px');

            if($(this).hasClass('active')) {
                $('#canvas-h-cm').val(Math.round((h / 37.795) * 10) / 10);
                $('#canvas-w-cm').val(Math.round((w / 37.795) * 10) / 10);
            }
        });

        enforceBoundaries();
        updateCanvasDimensions();
        setZoom(currentZoom);
    } catch(e) {
        console.warn("Error restoring from IndexedDB", e);
    }
}

function saveHistory() { 
    if (!lastSavedState) lastSavedState = getPageHTML();
    let currentState = getPageHTML(); 
    if (lastSavedState.html !== currentState.html || lastSavedState.style !== currentState.style) {
        noteHistory.push({ page: current, state: lastSavedState }); 
        if (noteHistory.length > 5) noteHistory.shift(); 
        $('#undo-btn').prop('disabled', false); 
    }
    lastSavedState = currentState;
}

function undo() { 
    if (noteHistory.length > 0) { 
        let prevState = noteHistory.pop(); 
        let $menu = $('#context-menu').detach(); 
        let $page = $(`#p-${prevState.page}`);
        $page.html(prevState.state.html); 
        $page.attr('style', prevState.state.style);
        $('#canvas').append($menu); 
        if(current !== prevState.page) goTo(prevState.page);
        lastSavedState = getPageHTML(); 
        if (noteHistory.length === 0) $('#undo-btn').prop('disabled', true); 
        refreshAnnotations(); 
        updateContextMenu(); 
        if (isEditing) { interact('.canvas-box').unset(); interact('.pin').unset(); toggleEdit(); toggleEdit(); } 
    } 
}

function showExportModal() { $('#export-modal-bg').show(); }

function printToPDF() {
    $('#export-modal-bg').hide();
    if (isEditing) toggleEdit();
    let wasDark = $('body').hasClass('dark');
    let wasScrollMode = currentViewMode === 'scroll';
    $('body').removeClass('dark');
    if (!wasScrollMode) $('#canvas').addClass('scroll-mode');
    setTimeout(() => {
        window.print();
        if (wasDark) $('body').addClass('dark');
        if (!wasScrollMode) $('#canvas').removeClass('scroll-mode');
    }, 500);
}

function saveNotebookToFile() {
    $('#export-modal-bg').hide();
    let wasEditing = isEditing;
    if (isEditing) toggleEdit(); 
    
    let documentClone = document.documentElement.cloneNode(true);
    let $clone = $(documentClone);

    let title = $('#lecture-title').text().trim() || "NoteDump_Saved";
    $clone.find('title').text(title);

    let fullHtml = "<!DOCTYPE html>\n" + documentClone.outerHTML;
    let blob = new Blob([fullHtml], { type: "text/html;charset=utf-8" });
    let link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = title + ".html";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    if (wasEditing) toggleEdit();
    showToast("💾 Notebook saved successfully!");
}

function saveReadOnlyNotebook() {
    $('#export-modal-bg').hide();
    let wasEditing = isEditing;
    if (isEditing) toggleEdit(); 
    let documentClone = document.documentElement.cloneNode(true);
    let $clone = $(documentClone);

    $clone.find('#edit-btn, .action-btn[title="Add Page"], .action-btn[title="Add Section"], #fab-container, #canvas-global-tools, .del-btn, .delete-page-btn, .sketch-del, .sticky-dropdown-tools, .ipc-bottom-row').remove(); 
    $clone.find('.drag-handle').removeClass('drag-handle'); 
    $clone.find('.pin-drag-handle').removeClass('pin-drag-handle'); 

    $clone.find('textarea').attr('readonly', true);
    $clone.find('[contenteditable="true"]').attr('contenteditable', 'false');

    let currentTitle = $('#lecture-title').text().trim() || "NoteDump_Saved";
    $clone.find('#lecture-title').text(currentTitle + " (Read Only)");
    $clone.find('title').text(currentTitle + " - Read Only");

    let fullHtml = "<!DOCTYPE html>\n" + documentClone.outerHTML;
    let blob = new Blob([fullHtml], { type: "text/html;charset=utf-8" });
    let link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = currentTitle + "_ReadOnly.html";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    if (wasEditing) toggleEdit(); 
    showToast("🔒 Read-Only Notebook saved successfully!");
}

// ==========================================================================
// SECTION 4: CANVAS MANAGEMENT, VIEWPORTS & NAVIGATION
// ==========================================================================
function updateCanvasDimensions() {
    if (currentViewMode === 'single') {
        let $cp = $(`#p-${current}`);
        let currW = parseInt($cp.attr('data-page-width')) || parseInt($cp.css('width')) || 816;
        let currH = parseInt($cp.attr('data-page-height')) || parseInt($cp.css('height')) || 1054;
        $('#canvas').attr('data-width', currW);
    } else {
        let maxW = 0;
        $('.page').each(function() {
            let w = parseInt($(this).attr('data-page-width')) || parseInt($(this).css('width')) || 816;
            if (w > maxW) maxW = w;
        });
        $('#canvas').attr('data-width', maxW);
    }
    setZoom(currentZoom);
}

function showLinesModal() { $('#lines-modal-bg').show(); }

function toggleLines() {
    let isActive = $('#global-lines-check').is(':checked');
    if (isActive) {
        applyLinesFromModal(true); 
    } else {
        saveHistory();
        $(`#p-${current}`).css('background-image', 'none');
    }
}

function applyLinesFromModal(skipHide = false) {
    saveHistory();
    if (!skipHide) $('#lines-modal-bg').hide();
    $('#global-lines-check').prop('checked', true);

    let useH = $('#lines-h-check').is(':checked');
    let useV = $('#lines-v-check').is(':checked');
    let cmH = parseFloat($('#lines-h-cm').val()) || 1.5;
    let cmV = parseFloat($('#lines-v-cm').val()) || 1.5;

    let pxH = Math.round(cmH * 37.795);
    let pxV = Math.round(cmV * 37.795);

    let $activePage = $(`#p-${current}`);

    if (!useH && !useV) {
        $activePage.css('background-image', 'none');
        return;
    }

    let svgPath = "";
    let bgW = useV ? pxV : 10;
    let bgH = useH ? pxH : 10;

    if (useH) svgPath += `<line x1="0" y1="${pxH-1}" x2="${bgW}" y2="${pxH-1}" stroke="%23cbd5e1" stroke-width="2" />`;
    if (useV) svgPath += `<line x1="${pxV-1}" y1="0" x2="${pxV-1}" y2="${bgH}" stroke="%23cbd5e1" stroke-width="2" />`;

    let svgUrl = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="${bgW}" height="${bgH}">${svgPath}</svg>`;

    $activePage.css({
        'background-image': `url('${svgUrl}')`,
        'background-size': `${bgW}px ${bgH}px`,
        'background-repeat': 'repeat'
    });
    showToast("Notebook guidelines applied!");
}

function applyCanvasSettings() {
    saveHistory();
    let wCm = parseFloat($('#canvas-w-cm').val()) || 21.6;
    let hCm = parseFloat($('#canvas-h-cm').val()) || 27.9;
    let applyAll = $('#uniform-height-check').is(':checked');

    let pxW = Math.round(wCm * 37.795);
    let pxH = Math.round(hCm * 37.795);

    let pages = applyAll ? $('.page') : $(`#p-${current}`);

    pages.each(function() {
        let $page = $(this);
        $page.attr('data-page-height', pxH).css('height', pxH + 'px');
        $page.attr('data-page-width', pxW).css('width', pxW + 'px');

        $page.children('.canvas-box, .pin').each(function() {
            let $el = $(this);
            let currentTop = parseFloat($el.css('top')) || 0;
            let currentLeft = parseFloat($el.css('left')) || 0;
            let elH = $el.outerHeight() || 50;
            let elW = $el.outerWidth() || 50;

            let newTop = currentTop;
            let newLeft = currentLeft;

            if (currentTop + elH > pxH && elH < pxH) { newTop = Math.max(0, pxH - elH - 5); }
            if (currentLeft + elW > pxW && elW < pxW) { newLeft = Math.max(0, pxW - elW - 5); }

            if (newTop !== currentTop || newLeft !== currentLeft) {
                $el.css({ top: newTop + 'px', left: newLeft + 'px', transform: 'translate(0px, 0px)' });
                $el.attr('data-x', 0); $el.attr('data-y', 0);
            }
        });
    });

    updateCanvasDimensions();
    autoSaveToBrowser();
    updateContextMenu();
}

function mergeNextPage() {
    let $nextLink = $(`#link-${current}`).nextAll('.nav-link').not('.nav-chapter').first();
    if (!$nextLink.length) return showToast("⚠️ No next page to merge!");

    saveHistory();
    let nextId = $nextLink.attr('id').replace('link-', '');
    let $currPage = $(`#p-${current}`);
    let $nextPage = $(`#p-${nextId}`);

    let currentH = parseInt($currPage.attr('data-page-height')) || 1054;
    let nextH = parseInt($nextPage.attr('data-page-height')) || 1054;

    let newH = currentH + nextH;
    $currPage.attr('data-page-height', newH).css('height', newH + 'px');
    $('#canvas-h-cm').val(Math.round((newH / 37.795) * 10) / 10);

    $nextPage.find('.canvas-box, .pin').each(function() {
        if ($(this).hasClass('pin') && $(this).parent().hasClass('canvas-box')) return; 
        let t = parseFloat($(this).css('top')) || 0;
        if ($(this).css('top').includes('%')) t = (parseFloat($(this).css('top')) / 100) * nextH; 
        $(this).css('top', (t + currentH) + 'px');
        $currPage.append($(this));
    });

    let $nextSvg = $nextPage.find('svg.draw-layer');
    if ($nextSvg.length > 0) {
        let currSvg = getPageSvg();
        let g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        g.setAttribute('transform', `translate(0, ${currentH})`);
        $nextSvg.find('.drawn-path').each(function() { g.appendChild(this); });
        if(g.childNodes.length > 0) currSvg.appendChild(g);
    }

    $nextPage.remove();
    $nextLink.remove();

    updateCanvasDimensions();
    autoSaveToBrowser();
    updateContextMenu();
    refreshAnnotations();
    showToast("📄 Pages Successfully Merged!");
}

function splitPage() {
    saveHistory();
    let $currPage = $(`#p-${current}`);
    let currH = parseInt($currPage.attr('data-page-height')) || 1054;
    let newH = Math.floor(currH / 2);

    $currPage.attr('data-page-height', newH).css('height', newH + 'px');

    let newId = "split_" + Date.now();
    let newNav = `<div class="nav-link" id="link-${newId}" onclick="goTo('${newId}')"><i class="fas fa-bars drag-handle"></i> <span class="nav-text" contenteditable="${isEditing}">Split Page</span><i class="fas fa-times delete-page-btn" onclick="deletePage('${newId}', event)" title="Delete Page"></i></div>`;

    let currW = parseInt($currPage.attr('data-page-width')) || 816;
    let newPage = `<div id="p-${newId}" class="page" data-page-width="${currW}" data-page-height="${newH}" style="width: ${currW}px; height: ${newH}px;"></div>`;

    $(`#link-${current}`).after(newNav); 
    $(`#p-${current}`).after(newPage);

    let $newPage = $(`#p-${newId}`);

    $currPage.find('.canvas-box, .pin').each(function() {
        if ($(this).hasClass('pin') && $(this).parent().hasClass('canvas-box')) return; 
        let t = parseFloat($(this).css('top')) || 0;
        if (t >= newH) {
            $(this).css('top', (t - newH) + 'px');
            $newPage.append($(this));
        }
    });

    let $svg = $currPage.find('svg.draw-layer');
    if ($svg.length > 0) {
        let newSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        newSvg.setAttribute('class', 'draw-layer');
        newSvg.setAttribute('style', 'position:absolute; top:0; left:0; width:100%; height:100%; pointer-events:none; z-index:90;');
        $newPage.append(newSvg);

        $svg.find('.drawn-path').each(function() {
            let bbox = this.getBBox();
            if (bbox.y >= newH) {
                let g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
                g.setAttribute('transform', `translate(0, -${newH})`);
                g.appendChild(this);
                newSvg.appendChild(g);
            }
        });
    }

    if (currentViewMode === 'single') $('#canvas-h-cm').val(Math.round((newH / 37.795) * 10) / 10);

    updateCanvasDimensions();
    autoSaveToBrowser();
    updateContextMenu();
    refreshAnnotations();
    showToast("✂️ Page Split in Half!");
}

function setViewMode(mode) {
    currentViewMode = mode;
    $('.view-btn').removeClass('active-view');
    $(`#btn-view-${mode}`).addClass('active-view');

    if(mode === 'scroll') {
        $('#canvas').addClass('scroll-mode');
        let $p = $(`#p-${current}`);
        if($p.length) {
            let cvp = document.getElementById('canvas-viewport');
            let offsetTop = $p[0].offsetTop * currentZoom;
            cvp.scrollTo({ top: offsetTop, behavior: 'auto' });
        }
    } else {
        $('#canvas').removeClass('scroll-mode');
        recenterViewport();
    }
    updateCanvasDimensions();
    updateContextMenu();
}

function toggleScrollMode() {
    setViewMode(currentViewMode === 'scroll' ? 'single' : 'scroll');
    showToast(currentViewMode === 'scroll' ? "📜 Scroll Mode Activated" : "📄 Single Page Mode Activated");
}

function skipBackward() {
    let $navLinks = $('.nav-link').not('.nav-chapter');
    let total = $navLinks.length;
    if (total === 0) return;
    let skipAmount = Math.max(1, Math.round(total * 0.20));
    let currentIndex = $navLinks.index($('#link-' + current));
    let targetIndex = Math.max(0, currentIndex - skipAmount);
    let targetId = $navLinks.eq(targetIndex).attr('id');
    if (targetId) goTo(targetId.replace('link-', ''));
}

function skipForward() {
    let $navLinks = $('.nav-link').not('.nav-chapter');
    let total = $navLinks.length;
    if (total === 0) return;
    let skipAmount = Math.max(1, Math.round(total * 0.20));
    let currentIndex = $navLinks.index($('#link-' + current));
    let targetIndex = Math.min(total - 1, currentIndex + skipAmount);
    let targetId = $navLinks.eq(targetIndex).attr('id');
    if (targetId) goTo(targetId.replace('link-', ''));
}

function prevPage() { 
    let prevId = $(`#link-${current}`).prevAll('.nav-link').not('.nav-chapter').first().attr('id'); 
    if (prevId) goTo(prevId.replace('link-', '')); 
}

function nextPage() { 
    let nextId = $(`#link-${current}`).nextAll('.nav-link').not('.nav-chapter').first().attr('id'); 
    if (nextId) goTo(nextId.replace('link-', '')); 
}

function goTo(id) {
    if (isEditing && id === current) return; 

    $('.nav-link').removeClass('active-nav');
    $('#link-' + id).addClass('active-nav');

    current = id.toString();

    updateContextMenu();
    refreshAnnotations();

    if(window.innerWidth <= 768 && !$('body').hasClass('notebook-mode')) { 
        $('#nav').addClass('closed'); 
        $('#nav-toggle i').css('transform', 'rotate(0deg)');
    } 

    let totalNav = $('.nav-link').not('.nav-chapter').length;
    let currentIndex = $('.nav-link').not('.nav-chapter').index($('#link-' + id)) + 1;
    $('#nb-page-indicator').text(`${currentIndex} / ${totalNav}`);

    if (currentViewMode === 'single') {
        $('.page').removeClass('active');
        $('#p-' + id).addClass('active');
        recenterViewport();
    } else {
        let $p = $(`#p-${id}`);
        if($p.length) {
            let cvp = document.getElementById('canvas-viewport');
            let offsetTop = $p[0].offsetTop * currentZoom;
            cvp.scrollTo({ top: offsetTop, behavior: 'smooth' });
        }
    }

    let currW = parseInt($(`#p-${current}`).attr('data-page-width')) || parseInt($(`#p-${current}`).css('width')) || 816;
    let currH = parseInt($(`#p-${current}`).attr('data-page-height')) || parseInt($(`#p-${current}`).css('height')) || 1054;
    $('#canvas-w-cm').val((currW / 37.795).toFixed(1));
    $('#canvas-h-cm').val((currH / 37.795).toFixed(1));

    updateCanvasDimensions();

    if(isEditing) { 
        interact('.canvas-box').unset(); 
        interact('.pin').unset(); 
        toggleEdit(); toggleEdit(); 
    }
}

function recenterViewport() {
    setTimeout(() => {
        let cvp = document.getElementById('canvas-viewport');
        if (cvp) {
            let canvasW = parseInt($('#canvas').attr('data-width')) || 816;
            let scaledW = canvasW * currentZoom;

            let targetScrollLeft = 300 + (scaledW / 2) - (cvp.clientWidth / 2);
            let targetScrollTop = 500;

            cvp.scrollTo({ top: targetScrollTop, left: targetScrollLeft, behavior: 'auto' });
        }
    }, 50);
}

function setZoom(v) { 
    currentZoom = parseFloat(v);
    $('#canvas').css('transform', `scale(${currentZoom})`); 

    let baseW = parseInt($('#canvas').attr('data-width')) || 816;
    let baseH = parseInt($('.page.active').attr('data-page-height')) || 1054;

    if ($('#canvas').hasClass('scroll-mode')) {
        baseH = 0;
        $('.page').each(function() {
            baseH += parseInt($(this).attr('data-page-height')) || 1054;
            baseH += 20; 
        });
    }

    let scaledW = baseW * currentZoom;
    let scaledH = baseH * currentZoom;

    $('#canvas-center-wrapper').css({
        'width': (scaledW + 100) + 'px',
        'height': (scaledH + 1600) + 'px', 
        'padding-top': '1200px',
        'padding-bottom': '400px',
        'padding-left': '50px',
        'padding-right': '50px'
    });

    $('#zoom-slider, #ns-zoom-slider').val(currentZoom); 
    $('#zoom-txt, #ns-zoom-txt').text(Math.round(currentZoom*100)+'%'); 
}

function toggleNotebookView() {
    $('body').toggleClass('notebook-mode');
    let isNotebook = $('body').hasClass('notebook-mode');

    let metaViewport = document.querySelector('meta[name="viewport"]');
    if (!metaViewport) {
        metaViewport = document.createElement('meta');
        metaViewport.name = "viewport";
        document.head.appendChild(metaViewport);
    }

    if (isNotebook) {
        if (isEditing) toggleEdit(); 
        $('#sticky-panel').removeClass('open');
        $('#pin-panel').removeClass('open');
        $('body').removeClass('panel-open');

        metaViewport.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=5.0, user-scalable=yes');
        showToast("📖 Notebook View Activated");
    } else {
        metaViewport.setAttribute('content', 'width=1200');
        showToast("🖥️ Desktop Editing View Activated");

        setTimeout(() => {
            updateCanvasDimensions();
            recenterViewport();
        }, 300);
    }
}

function toggleNav() {
    $('#nav').toggleClass('closed');
    let isClosed = $('#nav').hasClass('closed');
    $('#nav-toggle i').css('transform', isClosed ? 'rotate(180deg)' : 'rotate(0deg)');
}

function togglePanel(type) {
    if (type === 'sticky') {
        $('#pin-panel').removeClass('open');
        $('#sticky-panel').toggleClass('open');
    } else {
        $('#sticky-panel').removeClass('open');
        $('#pin-panel').toggleClass('open');
    }

    if ($('#sticky-panel').hasClass('open') || $('#pin-panel').hasClass('open')) {
        $('body').addClass('panel-open');
    } else {
        $('body').removeClass('panel-open');
    }
}

function deletePage(id, event) {
    event.stopPropagation();
    if (!confirm("Are you sure you want to delete this page? This cannot be undone.")) return;

    let $link = $(`#link-${id}`);
    let $page = $(`#p-${id}`);

    if ($('.nav-link').not('.nav-chapter').length <= 1) {
        showToast("⚠️ Cannot delete the last remaining page.");
        return;
    }

    saveHistory();

    if (current === id.toString()) {
        let prevId = $link.prevAll('.nav-link').not('.nav-chapter').first().attr('id');
        let nextId = $link.nextAll('.nav-link').not('.nav-chapter').first().attr('id');
        let targetId = prevId || nextId;
        if (targetId) goTo(targetId.replace('link-', ''));
    }

    $link.remove();
    $page.remove();
    autoSaveToBrowser();
    showToast("🗑️ Page deleted.");
}

// ==========================================================================
// SECTION 5: TOOLS (Search, Dashboards, BG Color, Image Crop)
// ==========================================================================
function toggleSearchBar() {
    $('#sidebar-search').slideToggle(200);
    $('#search-input').focus();
}

function closeSearchBar() {
    $('#sidebar-search').slideUp(200);
    $('#search-input').val('');
    removeHighlights();
}

function removeHighlights() {
    $('mark.search-hi').each(function() { $(this).replaceWith($(this).text()); });
    let canvas = document.getElementById('canvas');
    if(canvas) canvas.normalize();
    $('.pin').removeClass('pin-search-match active-pin-match');
    $('.nav-link').removeClass('search-match-nav');

    searchResults = [];
    currentSearchIndex = -1;
    $('#search-counter').text('0/0');
}

function highlightNode(node, regex) {
    let hasMatch = false;
    if (node.nodeType === 3) {
        let match; regex.lastIndex = 0;
        if ((match = regex.exec(node.data)) !== null) {
            let highlight = document.createElement('mark'); highlight.className = 'search-hi';
            let wordNode = node.splitText(match.index); wordNode.splitText(match[0].length);
            let wordClone = wordNode.cloneNode(true); highlight.appendChild(wordClone);
            wordNode.parentNode.replaceChild(highlight, wordNode); hasMatch = true;
        }
    } else if (node.nodeType === 1 && node.childNodes && !/(script|style|mark)/i.test(node.tagName)) {
        for (let i = node.childNodes.length - 1; i >= 0; i--) { 
            if(highlightNode(node.childNodes[i], regex)) { hasMatch = true; }
        }
    }
    return hasMatch;
}

function performSearch(query) {
    removeHighlights();
    if (!query || query.trim() === "") return;

    let regex = new RegExp("(" + query.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&') + ")", "gi");

    $('.page').each(function() {
        let pageId = $(this).attr('id').replace('p-', ''); let pageHasMatch = false;

        $(this).find('.content-area').each(function() { 
            if(highlightNode(this, regex)) pageHasMatch = true;
        });

        $(this).find('mark.search-hi').each(function() {
            searchResults.push({ pageId: pageId, el: $(this) });
            pageHasMatch = true;
        });

        $(this).find('.pin').each(function() {
            let note = $(this).attr('data-note') || "";
            if (note.match(regex)) { 
                pageHasMatch = true; 
                $(this).addClass('pin-search-match'); 
                searchResults.push({ pageId: pageId, el: $(this) });
            }
        });

        if (pageHasMatch) { 
            $(`#link-${pageId}`).addClass('search-match-nav'); 
        }
    });

    if (searchResults.length > 0) {
        $('#search-counter').text(`0/${searchResults.length}`);
    }
}

function focusMatch() {
    let match = searchResults[currentSearchIndex];
    $('#search-counter').text(`${currentSearchIndex + 1}/${searchResults.length}`);

    if (current !== match.pageId) { goTo(match.pageId); }

    $('.search-hi').removeClass('active-match');
    $('.pin-search-match').removeClass('active-pin-match');

    if (match.el.hasClass('search-hi')) match.el.addClass('active-match');
    else match.el.addClass('active-pin-match');

    let cvp = document.getElementById('canvas-viewport');
    let offsetTop = match.el.offset().top - $('#canvas').offset().top; 
    offsetTop = offsetTop * currentZoom;
    cvp.scrollTo({ top: offsetTop - (cvp.clientHeight / 2), behavior: 'smooth' });
}

function goToNextMatch() {
    if (searchResults.length === 0) return;
    currentSearchIndex = (currentSearchIndex + 1) % searchResults.length;
    focusMatch();
}

function goToPrevMatch() {
    if (searchResults.length === 0) return;
    currentSearchIndex = (currentSearchIndex - 1 + searchResults.length) % searchResults.length;
    focusMatch();
}

function startCrop() {
    let $img = $('.selected-box').find('img');
    if ($img.length === 0) return;
    $('#crop-target').attr('src', $img.attr('src'));
    $('#crop-modal').css('display', 'flex');
    cropperInstance = new Cropper(document.getElementById('crop-target'), { viewMode: 1, autoCropArea: 1, background: false });
}

function cancelCrop() { 
    $('#crop-modal').hide(); 
    if (cropperInstance) { cropperInstance.destroy(); cropperInstance = null; } 
}

function applyCrop() {
    if (!cropperInstance) return;
    let croppedDataUrl = cropperInstance.getCroppedCanvas().toDataURL('image/png');
    let $box = $('.selected-box');
    let $img = $box.find('img');
    saveHistory();
    let tempImg = new Image();
    tempImg.onload = function() {
        let ratio = tempImg.height / tempImg.width;
        let newHeight = $box.width() * ratio;
        $box.css('height', newHeight + 'px');
        $img.attr('src', croppedDataUrl);
        cancelCrop();
        updateContextMenu();
    };
    tempImg.src = croppedDataUrl;
}

function liveUpdateOpacity(alpha) {
    let $cells = $('.selected-cell');
    if ($cells.length > 0) {
        $cells.each(function() {
            let r=255, g=255, b=255;
            let savedRgb = $(this).attr('data-bg-rgb');
            if (savedRgb) {
                let pts = savedRgb.split(',');
                r=pts[0]; g=pts[1]; b=pts[2];
                $(this).css('background-color', `rgba(${r}, ${g}, ${b}, ${alpha})`);
            }
        });
        return;
    }

    $('.selected-box').each(function() {
        let $audio = $(this).find('.custom-audio-player');
        if ($audio.length > 0) {
            let savedRgb = $(this).attr('data-bg-rgb') || "14,165,233"; 
            let pts = savedRgb.split(',');
            $audio.find('.audio-play-btn, .audio-progress').css('background-color', `rgba(${pts[0]}, ${pts[1]}, ${pts[2]}, ${alpha})`);
        } else {
            let $img = $(this).find('img');
            if ($img.length > 0) {
                $img.css('opacity', alpha);
            } else {
                let r=255, g=255, b=255;
                let savedRgb = $(this).attr('data-bg-rgb');
                if (savedRgb) {
                    let pts = savedRgb.split(',');
                    r=pts[0]; g=pts[1]; b=pts[2];
                } else {
                    let bg = $(this).css('background-color');
                    if (bg !== 'transparent' && bg !== 'rgba(0, 0, 0, 0)') {
                        let match = bg.match(/\d+/g);
                        if(match && match.length >= 3) {
                            r=match[0]; g=match[1]; b=match[2];
                            $(this).attr('data-bg-rgb', `${r},${g},${b}`);
                        }
                    }
                }
                $(this).css('background-color', `rgba(${r}, ${g}, ${b}, ${alpha})`);
            }
        }
    });
}

function commitOpacity() {
    saveHistory();
}

function updateContextMenu() {
    let $sel = $('.selected-box');
    if($sel.length > 0 && isEditing) {
        $('#context-menu').css('display', 'flex');
        $('#context-menu').removeClass('is-vertical-menu');

        let hasTable = $sel.find('table').length > 0;
        let hasAudio = $sel.find('.custom-audio-player').length > 0;
        let $activeCell = $('.selected-cell').first();
        let hasImage = $sel.find('img').length > 0 && !hasTable; 

        // Apply new layout display rules
        if ($activeCell.length > 0 || hasTable) {
            $('.menu-table-tools').css('display', 'flex');
            $('.menu-img-tools').hide(); 
            $('.menu-text-tools, .menu-text-tools-color').css('display', 'flex'); 
            $('.menu-bg-tools').css('display', 'flex'); 
            $('.menu-align-tools').css('display', 'grid');
            $('.menu-transparency-tools').css('display', 'flex');
        } else if (hasImage) {
            $('.menu-table-tools').hide();
            $('.menu-text-tools, .menu-text-tools-color').hide(); 
            $('.menu-bg-tools').hide(); 
            $('.menu-align-tools').hide();
            $('.menu-img-tools').css('display', 'flex');
            $('.menu-transparency-tools').css('display', 'flex'); // Transparency slider active for images
        } else if (hasAudio) {
            $('.menu-table-tools').hide();
            $('.menu-img-tools').hide();
            $('.menu-text-tools, .menu-text-tools-color').css('display', 'flex'); 
            $('.menu-bg-tools').css('display', 'flex'); 
            $('.menu-align-tools').hide();
            $('.menu-transparency-tools').css('display', 'flex');
        } else {
            // Standard Text Block
            $('.menu-table-tools').hide();
            $('.menu-img-tools').hide();
            $('.menu-text-tools, .menu-text-tools-color').css('display', 'flex'); 
            $('.menu-bg-tools').css('display', 'flex'); 
            $('.menu-align-tools').css('display', 'grid');
            $('.menu-transparency-tools').css('display', 'flex');
        }

        // Contextual Color Labels
        if (hasAudio && $activeCell.length === 0) {
            $('.menu-text-tools-color').find('.color-swatch').first().parent().prev('span').html('Player<br>BG');
            $('.menu-bg-tools').find('.color-swatch').first().parent().prev('span').html('Button<br>Color');
        } else {
            $('.menu-text-tools-color').find('.color-swatch').first().parent().prev('span').html('Text<br>Color');
            $('.menu-bg-tools').find('.color-swatch').first().parent().prev('span').html('Background<br>Color');
        }

        let currentOp = 1;

        if ($activeCell.length > 0) {
            let bg = $activeCell.css('background-color');
            let parts = bg.match(/[\d.]+/g);
            if(parts && parts.length === 4) { currentOp = parts[3]; }
            else if(bg === 'transparent' || bg === 'rgba(0, 0, 0, 0)') { currentOp = 0; }
        } else {
            let $firstSel = $sel.first();
            if ($firstSel.find('img').length > 0 && !hasTable) {
                currentOp = $firstSel.find('img').css('opacity');
            } else if (hasAudio) {
                let bg = $firstSel.find('.audio-play-btn').css('background-color');
                let parts = bg.match(/[\d.]+/g);
                if(parts && parts.length === 4) { currentOp = parts[3]; }
            } else {
                let bg = $firstSel.css('background-color');
                let parts = bg.match(/[\d.]+/g);
                if(parts && parts.length === 4) { currentOp = parts[3]; }
                else if(bg === 'transparent' || bg === 'rgba(0, 0, 0, 0)') { currentOp = 0; }
            }
        }
        $('#transparency-slider').val(currentOp !== undefined ? currentOp : 1);

        let topPos = 999999; let leftPos = 999999;
        $sel.each(function() {
            let t = parseFloat($(this).css('top')) || 0; 
            let l = parseFloat($(this).css('left')) || 0;
            let ty = parseFloat($(this).attr('data-y')) || 0; 
            let tx = parseFloat($(this).attr('data-x')) || 0;

            let finalTop = t + ty;
            let finalLeft = l + tx;

            if(finalTop < topPos) topPos = finalTop; 
            if(finalLeft < leftPos) leftPos = finalLeft;
        });

        $('#context-menu').css({display: 'flex', top: '-9999px', left: '-9999px'});

        let cHeight = $('#context-menu').outerHeight() || 50;
        let cWidth = $('#context-menu').outerWidth() || 350;

        let cvp = document.getElementById('canvas-viewport');
        let vLeft = (cvp.scrollLeft) / currentZoom;
        let vRight = vLeft + (cvp.clientWidth / currentZoom);

        let finalMenuTop = topPos - cHeight - 15;
        let finalMenuLeft = leftPos + ($sel.outerWidth() / 2) - (cWidth / 2);

        if (finalMenuLeft < vLeft + 10) finalMenuLeft = vLeft + 10;
        if (finalMenuLeft + cWidth > vRight - 10) finalMenuLeft = vRight - cWidth - 10;

        $('#context-menu').css({top: finalMenuTop + 'px', left: finalMenuLeft + 'px'});
    } else { 
        $('#context-menu').hide(); 
    }
}

function changeLayer(direction) {
    saveHistory();
    let $siblings = $('.canvas-box').not('.selected-box');
    let targetZ = 10;

    if (direction > 0) {
        let maxZ = 10;
        $siblings.each(function() { 
            let z = parseInt($(this).css('z-index'));
            if (!isNaN(z)) { maxZ = Math.max(maxZ, z); }
        });
        targetZ = maxZ + 1; 
    } else {
        let minZ = 10;
        $siblings.each(function() { 
            let z = parseInt($(this).css('z-index'));
            if (!isNaN(z)) { minZ = Math.min(minZ, z); }
        });
        targetZ = minZ - 1; 
        if(targetZ < 1) targetZ = 1; 
    }

    $('.selected-box').css('z-index', targetZ);
}

function changeBoxStyle(property, value) {
    saveHistory(); 
    $('.selected-box').css(property, value);
}

// ==========================================================================
// SECTION 6: INSERT CONTENT (Pages, Text, Tables, Audio, Images)
// ==========================================================================
function addPageBelow() {
    saveHistory();
    let newId = "new_" + Date.now();
    let newNav = `<div class="nav-link" id="link-${newId}" onclick="goTo('${newId}')"><i class="fas fa-bars drag-handle"></i> <span class="nav-text" contenteditable="${isEditing}">New Blank Page</span><i class="fas fa-times delete-page-btn" onclick="deletePage('${newId}', event)" title="Delete Page"></i></div>`;

    let currW = parseInt($(`#p-${current}`).attr('data-page-width')) || 816;
    let currH = parseInt($(`#p-${current}`).attr('data-page-height')) || 1054;

    let newPage = `<div id="p-${newId}" class="page" data-page-width="${currW}" data-page-height="${currH}" style="width: ${currW}px; height: ${currH}px;"></div>`;

    $(`#link-${current}`).after(newNav); 
    $(`#p-${current}`).after(newPage); 
    goTo(newId);
}

function addChapterBelow() {
    saveHistory();
    let newId = "chap_" + Date.now();
    let newNav = `<div class="nav-link nav-chapter" id="link-${newId}" onclick="goTo('${newId}')"><i class="fas fa-bars drag-handle"></i> <span class="nav-text" contenteditable="${isEditing}">New Section</span><i class="fas fa-times delete-page-btn" onclick="deletePage('${newId}', event)" title="Delete Page"></i></div>`;

    let currW = parseInt($(`#p-${current}`).attr('data-page-width')) || 816;
    let currH = parseInt($(`#p-${current}`).attr('data-page-height')) || 1054;

    let newPage = `<div id="p-${newId}" class="page" data-page-width="${currW}" data-page-height="${currH}" style="width: ${currW}px; height: ${currH}px;">
        <div class="canvas-box selected-box" style="top:400px; left:100px; width:600px; max-width:600px; z-index:${getHighestZ()}; transform: translate(0px, 0px);">
            <div class="del-btn" onclick="$(this).parent().remove(); updateContextMenu();">X</div>
            <div class="content-area" contenteditable="true" style="font-size: 48px; font-weight: bold; text-align: center; word-wrap: break-word; white-space: pre-wrap; overflow-wrap: break-word;">Section Title</div>
        </div>
    </div>`;

    $(`#link-${current}`).after(newNav); 
    $(`#p-${current}`).after(newPage); 

    goTo(newId); 
    if (!isEditing) { toggleEdit(); }
}

function activateTextPlacement(e) {
    if (e) { e.preventDefault(); e.stopPropagation(); }
    setTimeout(() => {
        isPlacingText = true;
        $('#canvas').addClass('text-placement-active');
        showToast("📝 Tap anywhere on the page to place text.");
        if (window.innerWidth <= 768 || (document.querySelector('meta[name="viewport"]') && document.querySelector('meta[name="viewport"]').content.includes('1200'))) {
            $('#canvas-global-tools').hide(); 
        }
    }, 150);
}

function dropStickyNote(e) {
    if (e) { e.preventDefault(); e.stopPropagation(); }
    setTimeout(() => {
        isPlacingSticky = true;
        $('#canvas').addClass('text-placement-active');
        showToast("📍 Tap anywhere on the page to place your sticky note.");
        $('.floating-panel').removeClass('open');
        $('body').removeClass('panel-open');
        if (window.innerWidth <= 768 || (document.querySelector('meta[name="viewport"]') && document.querySelector('meta[name="viewport"]').content.includes('1200'))) {
            $('#canvas-global-tools').hide();
        }
    }, 150);
}

function addTableCenter() {
    $('#table-modal-bg').show();
}

function confirmAddTable() {
    $('#table-modal-bg').hide();
    let rows = parseInt($('#table-rows-input').val()) || 3;
    let cols = parseInt($('#table-cols-input').val()) || 3;

    saveHistory();
    let coords = getScreenCenterCoords(350, 150);

    let percW = (100 / cols).toFixed(2) + '%';
    let percH = (100 / rows).toFixed(2) + '%';

    let tableHtml = `<table style="width:100%; height:100%; table-layout: fixed; border-collapse: collapse; font-size:12px; margin:0; padding:0;">`;

    tableHtml += `<colgroup>`;
    for(let c=0; c<cols; c++){
        tableHtml += `<col style="width:${percW};">`;
    }
    tableHtml += `</colgroup><tbody>`;

    for(let r=0; r<rows; r++){
        tableHtml += `<tr style="height:${percH};">`;
        for(let c=0; c<cols; c++){
            tableHtml += `<td style="border: 1px solid #cbd5e1; padding: 4px 6px; word-break: break-word; white-space: pre-wrap; vertical-align: top; overflow:hidden;"><br></td>`;
        }
        tableHtml += `</tr>`;
    }
    tableHtml += `</tbody></table>`;

    $(`#p-${current}`).append(`
        <div class="canvas-box selected-box" style="top:${coords.y}px;left:${coords.x}px;width:350px; height:150px; background:white; z-index:${getHighestZ()}; transform: translate(0px, 0px); display:flex; flex-direction:column;">
            <div class="del-btn" onclick="$(this).parent().remove(); updateContextMenu();">X</div>
            <div class="content-area" contenteditable="true" style="width:100%; height:100%; outline:none;">${tableHtml}</div>
        </div>
    `); 

    updateContextMenu();
}

function selectTableRow() {
    let $cell = $('.selected-cell').first();
    if($cell.length === 0) return showToast("Click a cell first!");
    $cell.closest('tr').find('td, th').addClass('selected-cell');
    updateContextMenu();
}

function selectTableCol() {
    let $cell = $('.selected-cell').first();
    if($cell.length === 0) return showToast("Click a cell first!");
    let idx = $cell[0].cellIndex;
    let $table = $cell.closest('table');
    $table.find('tr').each(function() {
        $(this).children().eq(idx).addClass('selected-cell');
    });
    updateContextMenu();
}

let tableActionLock = false;
function executeTableAction(actionFn) {
    if (tableActionLock) return;
    tableActionLock = true;
    setTimeout(() => { tableActionLock = false; }, 100);
    actionFn();
}

window.addTableRow = function() {
    executeTableAction(() => {
        saveHistory();
        let $cell = $('.selected-cell').first();
        if($cell.length === 0) return showToast("Click a cell first!");
        let $row = $cell.closest('tr');
        let cols = $row.children('td, th').length;
        let newTr = `<tr>`;
        for(let i=0; i<cols; i++) newTr += `<td style="border: 1px solid #cbd5e1; padding: 4px 6px; word-break: break-word; white-space: pre-wrap; vertical-align: top; overflow:hidden;"><br></td>`;
        newTr += `</tr>`;
        $row.after(newTr);
        equalizeTable();
    });
};

window.addTableCol = function() {
    executeTableAction(() => {
        saveHistory();
        let $cell = $('.selected-cell').first();
        if($cell.length === 0) return showToast("Click a cell first!");
        let idx = $cell[0].cellIndex;
        let $table = $cell.closest('table');
        $table.find('tr').each(function() {
            $(this).children().eq(idx).after(`<td style="border: 1px solid #cbd5e1; padding: 4px 6px; word-break: break-word; white-space: pre-wrap; vertical-align: top; overflow:hidden;"><br></td>`);
        });
        equalizeTable();
    });
};

window.delTableRow = function() {
    executeTableAction(() => {
        saveHistory();
        let $cell = $('.selected-cell').first();
        if($cell.length === 0) return showToast("Click a cell first!");
        $cell.closest('tr').remove();
        equalizeTable();
        updateContextMenu();
    });
};

window.delTableCol = function() {
    executeTableAction(() => {
        saveHistory();
        let $cell = $('.selected-cell').first();
        if($cell.length === 0) return showToast("Click a cell first!");
        let idx = $cell[0].cellIndex;
        let $table = $cell.closest('table');
        $table.find('col').eq(idx).remove();
        $table.find('tr').each(function() {
            $(this).children().eq(idx).remove();
        });
        equalizeTable();
        updateContextMenu();
    });
};

window.equalizeTable = function() {
    executeTableAction(() => {
        saveHistory();
        let $box = $('.selected-box').first();
        let $table = $box.find('table');
        if($table.length === 0) return;

        let maxCols = 0;
        let numRows = $table.find('tr').length;

        $table.find('tr').each(function() {
            let cols = 0;
            $(this).children('td, th').each(function() {
                cols += parseInt($(this).attr('colspan')) || 1;
            });
            if(cols > maxCols) maxCols = cols;
        });

        if (maxCols === 0 || numRows === 0) return;

        let percW = (100 / maxCols).toFixed(4) + '%';

        $table.removeAttr('style').css({
            'table-layout': 'fixed', 'width': '100%', 'height': '100%',
            'border-collapse': 'collapse', 'font-size': '12px', 'margin': '0', 'padding': '0'
        });

        let colgroupHtml = "";
        for(let c=0; c<maxCols; c++) colgroupHtml += `<col style="width:${percW};">`;

        $table.find('colgroup').remove();
        $table.prepend(`<colgroup>${colgroupHtml}</colgroup>`);

        $table.find('td, th').each(function() {
            $(this).css({
                'border': '1px solid #cbd5e1', 'padding': '4px 6px',
                'word-break': 'break-word', 'white-space': 'pre-wrap', 'vertical-align': 'top',
                'overflow': 'hidden', 'position': 'relative'
            });
        });
        showToast("Table dimensions updated & equalized!");
    });
};

window.mergeTableCells = function() {
    executeTableAction(() => {
        saveHistory();
        let $cells = $('.selected-cell');
        if($cells.length < 2) return showToast("Select at least 2 cells to merge (Drag to select cells)");

        let $table = $cells.first().closest('table');
        let minR = 9999, maxR = -1, minC = 9999, maxC = -1;

        $cells.each(function() {
            let r = $(this).closest('tr')[0].rowIndex;
            let c = $(this)[0].cellIndex;
            let rSpan = parseInt($(this).attr('rowspan')) || 1;
            let cSpan = parseInt($(this).attr('colspan')) || 1;
            if(r < minR) minR = r;
            if(r + rSpan - 1 > maxR) maxR = r + rSpan - 1;
            if(c < minC) minC = c;
            if(c + cSpan - 1 > maxC) maxC = c + cSpan - 1;
        });

        let targetRspan = maxR - minR + 1;
        let targetCspan = maxC - minC + 1;
        let $targetCell = $table.find('tr').eq(minR).children().eq(minC);

        let combinedHtml = "";
        $cells.each(function() {
            let html = $(this).html();
            if(html && html !== "<br>") combinedHtml += "<div>" + html + "</div>";
            if($(this)[0] !== $targetCell[0]) $(this).remove();
        });

        $targetCell.attr('rowspan', targetRspan).attr('colspan', targetCspan).html(combinedHtml || "");
        $cells.removeClass('selected-cell');
        $targetCell.addClass('selected-cell');
        showToast("Cells merged!");
    });
};

function addImgCenter() { 
    let i = document.createElement('input'); i.type = 'file'; i.accept = 'image/*'; 
    i.onchange = e => { 
        let r = new FileReader(); r.readAsDataURL(e.target.files[0]); 
        r.onload = ev => { 
            saveHistory(); 
            let $cell = $('.selected-cell').first();

            if ($cell.length > 0) {
                $cell.append(`<div style="width:100%; height:auto;"><img src="${ev.target.result}" style="max-width:100%; height:auto; object-fit:contain; border-radius:4px; display:block; margin:auto;"></div>`);
            } else {
                let coords = getScreenCenterCoords(300, 200);
                $(`#p-${current}`).append(`<div class="canvas-box selected-box" style="top:${coords.y}px;left:${coords.x}px;width:300px;z-index:${getHighestZ()};transform: translate(0px, 0px);"><div class="del-btn" onclick="$(this).parent().remove(); updateContextMenu();">X</div><img src="${ev.target.result}" style="width:100%"></div>`); 
            }
            if(isEditing) { toggleEdit(); toggleEdit(); } 
            updateContextMenu(); 
        }; 
    }; 
    i.click(); 
}

function addAudioCenter() {
    let i = document.createElement('input'); i.type = 'file'; i.accept = 'audio/*';
    i.onchange = e => {
        let r = new FileReader(); r.readAsDataURL(e.target.files[0]);
        r.onload = ev => {
            saveHistory();
            let coords = getScreenCenterCoords(350, 50); 
            let audioHtml = `
                <div class="custom-audio-player">
                    <button class="audio-play-btn" onclick="togglePlay(this)" data-state="paused"><i class="fas fa-play"></i></button>
                    <div class="audio-track" onclick="seekAudio(event, this)">
                        <div class="audio-progress"></div>
                    </div>
                    <span class="audio-time">0:00</span>
                    <button class="audio-skip-btn" onclick="skipAudio(this, -5)" title="Backward 5s"><i class="fas fa-undo-alt"></i></button>
                    <button class="audio-skip-btn" onclick="skipAudio(this, 5)" title="Forward 5s"><i class="fas fa-redo-alt"></i></button>
                    <button class="audio-speed-btn" onclick="toggleSpeed(this)" title="Playback Speed">1x</button>
                    <audio src="${ev.target.result}" style="display:none;" ontimeupdate="updateAudioUI(this)" onloadedmetadata="initAudioUI(this)" onended="resetAudioUI(this)"></audio>
                </div>
            `;
            $(`#p-${current}`).append(`<div class="canvas-box selected-box" style="top:${coords.y}px;left:${coords.x}px;width:350px;height:auto;z-index:${getHighestZ()};transform: translate(0px, 0px);"><div class="del-btn" onclick="$(this).parent().remove(); updateContextMenu();">X</div>${audioHtml}</div>`);
            if(isEditing) { toggleEdit(); toggleEdit(); }
            updateContextMenu();
        };
    };
    i.click();
}

function skipAudio(btn, amount) {
    let audio = $(btn).siblings('audio')[0];
    audio.currentTime = Math.max(0, Math.min(audio.currentTime + amount, audio.duration));
}

function toggleSpeed(btn) {
    let audio = $(btn).siblings('audio')[0];
    let speeds = [1, 1.5, 2, 0.5]; 
    let currentSpeed = audio.playbackRate || 1;
    let nextIndex = (speeds.indexOf(currentSpeed) + 1) % speeds.length;
    let nextSpeed = speeds[nextIndex] || 1;
    audio.playbackRate = nextSpeed;
    $(btn).text(nextSpeed + 'x');
}

function togglePlay(btn) {
    let audio = $(btn).siblings('audio')[0];
    let icon = $(btn).find('i');
    if (audio.paused) {
        audio.play();
        icon.removeClass('fa-play').addClass('fa-pause');
    } else {
        audio.pause();
        icon.removeClass('fa-pause').addClass('fa-play');
    }
}
function updateAudioUI(audio) {
    let pct = (audio.currentTime / audio.duration) * 100;
    $(audio).siblings('.audio-track').find('.audio-progress').css('width', pct + '%');
    $(audio).siblings('.audio-time').text(formatTime(audio.currentTime));
}
function initAudioUI(audio) {
    $(audio).siblings('.audio-time').text(formatTime(audio.duration));
}
function resetAudioUI(audio) {
    let btn = $(audio).siblings('.audio-play-btn');
    btn.find('i').removeClass('fa-pause').addClass('fa-play');
    $(audio).siblings('.audio-track').find('.audio-progress').css('width', '0%');
    $(audio).siblings('.audio-time').text(formatTime(audio.duration));
}
function seekAudio(e, track) {
    let audio = $(track).siblings('audio')[0];
    let rect = track.getBoundingClientRect();
    let clickX = (e.clientX || e.originalEvent.touches[0].clientX) - rect.left;
    let pct = clickX / rect.width;
    audio.currentTime = pct * audio.duration;
}

// ==========================================================================
// SECTION 7: PINS & ANNOTATIONS SYSTEM
// ==========================================================================
function addPinToSelectedImage() {
    saveHistory();
    let $box = $('.selected-box').first();
    if ($box.length === 0 || $box.find('img').length === 0) {
        return showToast("⚠️ Image pins can only be added to images!");
    }

    let highestOrder = -1;
    $(`#p-${current} .pin`).each(function() {
        let o = parseInt($(this).attr('data-order')) || 0;
        if (o > highestOrder) highestOrder = o;
    });

    $box.append(`
        <div class="pin" data-type="pin" data-shape="marker" data-note="Image Pin" data-angle="0" data-scale="1" data-order="${highestOrder + 1}" style="top:50%; left:50%; width:32px; height:32px; margin-top:-16px; margin-left:-16px; transform: translate(0px, 0px); opacity:1; --pin-color: #ef4444;">
            <div class="pin-rotator-group" style="transform: rotate(0deg) scale(1);">
                <div class="pin-rotation-ring">
                    <div class="pin-rotate-dot" title="Drag to freely rotate pin"></div>
                </div>
                <div class="pin-visual"></div>
            </div>
        </div>
    `);
    refreshAnnotations();
    if(!$('#pin-panel').hasClass('open')) togglePanel('pin');
}

let isRotatingPin = false;
let activePinToRotate = null;
let lockedCenterX = 0;
let lockedCenterY = 0;

$(document).on('mousedown touchstart', '.pin', function(e) {
    if (!isEditing) return;
    if ($(e.target).hasClass('pin-rotate-dot')) return; 

    $('.pin').removeClass('is-selected');
    $(this).addClass('is-selected');
});

$(document).on('mousedown touchstart', function(e) {
    if ($(e.target).closest('.pin').length === 0) {
        $('.pin').removeClass('is-selected');
    }
});

$(document).on('mousedown touchstart', '.pin-rotate-dot', function(e) {
    e.preventDefault();
    e.stopImmediatePropagation(); 

    isRotatingPin = true;
    activePinToRotate = $(this).closest('.pin');

    $('.pin').removeClass('is-selected');
    activePinToRotate.addClass('is-selected');
    activePinToRotate.addClass('is-rotating');

    // LOCK CENTER PIVOT TO STOP THE EXPANDING BOUNDING BOX RUNAWAY BUG
    let rect = activePinToRotate[0].getBoundingClientRect();
    lockedCenterX = rect.left + (rect.width / 2);
    lockedCenterY = rect.top + (rect.height / 2);
});

$(document).on('mousemove touchmove', function(e) {
    if(isRotatingPin && activePinToRotate) {
        e.preventDefault(); 

        let isTouch = e.type.startsWith('touch');
        let clientX = isTouch ? e.originalEvent.touches[0].clientX : e.clientX;
        let clientY = isTouch ? e.originalEvent.touches[0].clientY : e.clientY;

        // CALCULATE BASED ON LOCKED CENTER COORDINATES
        let angle = Math.atan2(clientY - lockedCenterY, clientX - lockedCenterX) * (180 / Math.PI);
        
        let visualAngle = angle + 90;

        activePinToRotate.attr('data-angle', visualAngle);

        let currentScale = parseFloat(activePinToRotate.attr('data-scale')) || 1;
        activePinToRotate.find('.pin-rotator-group').css('transform', `rotate(${visualAngle}deg) scale(${currentScale})`);
    }
});

$(document).on('mouseup touchend', function(e) {
    if(isRotatingPin) {
        isRotatingPin = false;
        if(activePinToRotate) activePinToRotate.removeClass('is-rotating');
        activePinToRotate = null;
        debouncedSaveHistory();
        refreshAnnotations();
    }
});

function getPinEl(origIdx) { return $(`#p-${current} .pin`).eq(origIdx); }

function updatePinAngle(origIdx, val) {
    debouncedSaveHistory();
    let $pin = getPinEl(origIdx);
    $pin.attr('data-angle', val);
    let currentScale = parseFloat($pin.attr('data-scale')) || 1;
    $pin.find('.pin-rotator-group').css('transform', `rotate(${val}deg) scale(${currentScale})`);
}

function updatePinStyle(origIdx, property, value) {
    debouncedSaveHistory(); 
    let $pin = getPinEl(origIdx);
    let $visual = $pin.find('.pin-visual');
    let type = $pin.attr('data-type');

    if(property === 'size') { 
        let s = parseInt(value);
        
        if (type === 'sticky') {
            $pin.attr('data-scale', 1);
            $pin.css({ width: s + 'px', height: s + 'px', marginTop: -(s/2) + 'px', marginLeft: -(s/2) + 'px', transform: 'none' });
            $pin.find('.pin-rotator-group').css({'transform': 'none', 'width': '100%', 'height': '100%'});
            $visual.css({'width': '100%', 'height': '100%', 'transform': 'none'});
        } else if (type === 'pin') {
            if ($pin.attr('data-shape') === 'rectangle') {
                let currentH = parseInt($pin.css('height')) || 24;
                $pin.css({width: s + 'px', height: currentH + 'px'}); 
            } else {
                let scaleVal = s / 32; 
                $pin.attr('data-scale', scaleVal);
                let currentAngle = parseFloat($pin.attr('data-angle')) || 0;
                $pin.find('.pin-rotator-group').css('transform', `rotate(${currentAngle}deg) scale(${scaleVal})`);
            }
        } else {
            let scaleVal = s / 32; 
            $pin.attr('data-scale', scaleVal);
            $pin.find('.pin-rotator-group').css('transform', `scale(${scaleVal})`);
            $visual.css({width: '24px', height: '24px'}); 
        }
    } else if (property === 'opacity') {
        $visual.css('opacity', value);
    } else if (property === 'background') {
        $pin[0].style.setProperty('--pin-color', value);
    }
}

function updatePinText(origIdx, newText) { 
    debouncedSaveHistory(); 
    getPinEl(origIdx).attr('data-note', newText); 
}

function togglePinShape(origIdx) {
    debouncedSaveHistory();
    let $pin = getPinEl(origIdx);
    let currentShape = $pin.attr('data-shape') || 'square';
    let nextShape = currentShape === 'square' ? 'circle' : (currentShape === 'circle' ? 'triangle' : 'square');
    $pin.attr('data-shape', nextShape);

    let $btn = $(`#btn-shape-${origIdx} i`);
    $btn.removeClass('fa-square fa-circle fa-caret-up');
    if (nextShape === 'square') $btn.addClass('fa-square');
    else if (nextShape === 'circle') $btn.addClass('fa-circle');
    else if (nextShape === 'triangle') $btn.addClass('fa-caret-up');
}

function toggleImagePinShape(origIdx) {
    debouncedSaveHistory();
    let $pin = getPinEl(origIdx);
    let currentShape = $pin.attr('data-shape') || 'marker';
    let nextShape = 'marker';
    let iconClass = 'fa-map-marker-alt';

    if (currentShape === 'marker') { 
        nextShape = 'arrow'; iconClass = 'fa-location-arrow'; 
        $pin.css({width: '32px', height: '32px', marginTop: '-16px', marginLeft: '-16px'});
    }
    else if (currentShape === 'arrow') { 
        nextShape = 'rectangle'; iconClass = 'fa-vector-square'; 
        let currentScale = parseFloat($pin.attr('data-scale')) || 1;
        let rectWidth = Math.max(140, currentScale * 32); 
        $pin.css({width: rectWidth + 'px', height: '24px', marginTop: '0', marginLeft: '0'});
        $pin.attr('data-angle', 0);
        $pin.find('.pin-rotator-group').css('transform', 'rotate(0deg) scale(1)');
    }
    else { 
        nextShape = 'marker'; iconClass = 'fa-map-marker-alt'; 
        let currentScale = parseFloat($pin.attr('data-scale')) || 1;
        $pin.css({width: '32px', height: '32px', marginTop: '-16px', marginLeft: '-16px'});
        $pin.find('.pin-rotator-group').css('transform', `rotate(0deg) scale(${currentScale})`);
    }

    $pin.attr('data-shape', nextShape);
    $pin.removeClass('pin-resize-target'); 

    let $btn = $(`#btn-img-shape-${origIdx} i`);
    $btn.removeClass('fa-map-marker-alt fa-location-arrow fa-vector-square').addClass(iconClass);

    refreshAnnotations();
}

function addListToPin(origIdx, prefix) {
    debouncedSaveHistory();
    let $pin = getPinEl(origIdx);
    let ta = document.getElementById(`pin-text-${origIdx}`);
    if (!ta) return;

    let currentNote = ta.value;
    let newNote = currentNote + (currentNote.length > 0 && !currentNote.endsWith('\n') ? '\n' : '') + prefix;

    $pin.attr('data-note', newNote);
    ta.value = newNote;
    ta.focus();
    ta.selectionStart = ta.selectionEnd = ta.value.length;
}

function togglePinDropdown(idx) {
    let $dropdown = $(`#pin-dropdown-${idx}`);
    let isHidden = $dropdown.hasClass('hidden');
    $('.sticky-dropdown').addClass('hidden'); 
    if (isHidden) {
        $dropdown.removeClass('hidden');
    }
}

function switchTabToBox($box) {
    if ($box.find('.pin[data-type="pin"]').length > 0) {
        let boxes = [];
        $('.canvas-box').has('.pin[data-type="pin"]').each(function() { boxes.push(this); });
        let orderedParents = $(`#p-${current} .canvas-box`).toArray();
        boxes.sort((a,b) => orderedParents.indexOf(a) - orderedParents.indexOf(b));

        let matchIdx = boxes.indexOf($box[0]);
        if (matchIdx !== -1 && matchIdx !== activePinTabIdx) {
            activePinTabIdx = matchIdx;
            $('.pin-tab-btn').eq(matchIdx).trigger('click');
        }
    }
}

function focusPin(origIdx) { getPinEl(origIdx).addClass('pin-hover-visible'); }
function unfocusPin(origIdx) { getPinEl(origIdx).removeClass('pin-hover-visible'); }
function deletePin(origIdx) { saveHistory(); getPinEl(origIdx).remove(); refreshAnnotations(); }

function getAnnotations() {
    let annos = [];
    $(`#p-${current} .pin`).each(function(i) { 
        if (!$(this).attr('data-order')) $(this).attr('data-order', i);
        $(this).attr('data-list-idx', i); 

        let offset = $(this).offset(); 
        let $vis = $(this).find('.pin-visual'); 
        let type = $(this).attr('data-type') || 'pin'; 
        let angle = $(this).attr('data-angle') || '0';
        let shape = $(this).attr('data-shape') || 'square';

        let op = parseFloat($vis.css('opacity'));
        if (isNaN(op)) op = 1;

        let pColor = $(this)[0].style.getPropertyValue('--pin-color') || '#ef4444';

        let size = $(this).width();
        let scale = parseFloat($(this).attr('data-scale')) || 1;
        if (type === 'pin' && shape !== 'rectangle') size = scale * 32;
        
        if (type === 'sticky') {
            size = $(this).width(); 
            if (!size || size < 15) size = 32;
        }

        annos.push({ 
            el: $(this),
            originalIndex: i, 
            order: parseInt($(this).attr('data-order')),
            y: offset ? offset.top : 0, 
            note: $(this).attr('data-note'), 
            color: pColor, 
            size: Math.round(size), 
            opacity: op,
            angle: angle,
            type: type,
            shape: shape
        }); 
    });

    annos.sort((a, b) => a.order - b.order); 
    return annos;
}

function groupPinsData(annosArray) {
    let groupedData = { images: new Map(), sticky: [] };
    let orderedImageParents = $(`#p-${current} .canvas-box`);

    annosArray.forEach((pinData) => {
        if (pinData.type === 'sticky') {
            groupedData.sticky.push(pinData);
            return;
        }

        let $pin = pinData.el;
        let parentBox = $pin.closest('.canvas-box'); 
        let parentElement = parentBox[0];

        if (!parentElement) parentElement = document.getElementById(`p-${current}`);

        if (!groupedData.images.has(parentElement)) {
            let idx = orderedImageParents.index(parentBox);
            groupedData.images.set(parentElement, { imageIdx: idx + 1, pins: [] });
        }
        groupedData.images.get(parentElement).pins.push(pinData);
    });
    return groupedData;
}

function refreshAnnotations() {
    let annosArr = getAnnotations(); 
    let groupedData = groupPinsData(annosArr);

    let $header = $('#pin-panel-header');
    let $headerTitle = $header.find('h3');
    let $closeBtn = $header.find('.close-panel-btn');
    $header.empty().append($headerTitle, $closeBtn);

    $headerTitle.html('<i class="fas fa-shapes"></i> Annotations');

    $('.pin-panel-tools').remove(); 
    let $toolsRow = $('<div class="pin-panel-tools"></div>');
    $header.after($toolsRow);

    let isVisible = !$('#canvas').hasClass('hide-pins');
    let $visBtn = $(`<button class="smaller-button cursor-button" title="Toggle visibility of all pins"><i class="fas ${isVisible ? 'fa-eye' : 'fa-eye-slash'}"></i> # Toggle</button>`);
    $visBtn.click(() => {
        let v = $('#canvas').hasClass('hide-pins');
        $('#canvas').toggleClass('hide-pins', !v);
        $visBtn.find('i').toggleClass('fa-eye', !v).toggleClass('fa-eye-slash', v);
    });
    $toolsRow.append($visBtn);

    let $panelBody = $('#pin-list-container');
    $panelBody.empty(); 

    let numImages = groupedData.images.size;
    if(!numImages) {
        $toolsRow.css('justify-content', 'center');
        $panelBody.html("<p style='text-align:center; font-size:10px; color:#64748b; padding:10px;'>No annotations on this page.<br><br>Click an image and use the Blue Pin button to add one.</p>");
    } else {
        $toolsRow.css('justify-content', 'flex-start');

        if (activePinTabIdx >= numImages) activePinTabIdx = 0;
        let hasMultipleImages = numImages > 1;
        let paneIndexCounter = 0;

        let $tabsRow = $('<div class="pin-tabs-row"></div>');
        $toolsRow.append($tabsRow);

        let sortedParents = Array.from(groupedData.images.keys()).sort((a, b) => {
            let pinsA = groupedData.images.get(a).pins;
            let minA = Math.min(...pinsA.map(p => p.order));
            let pinsB = groupedData.images.get(b).pins;
            let minB = Math.min(...pinsB.map(p => p.order));
            return minA - minB;
        });

        sortedParents.forEach((parentElement) => {
            let imgData = groupedData.images.get(parentElement);
            let imagePins = imgData.pins;

            if (hasMultipleImages) {
                let $tab = $(`<button class="pin-tab-btn ${paneIndexCounter === activePinTabIdx ? 'active' : ''}">${paneIndexCounter+1}</button>`);
                let idx = paneIndexCounter; 
                $tab.click(() => {
                    activePinTabIdx = idx;
                    $('.pin-tab-btn').removeClass('active');
                    $tab.addClass('active');
                    $('.pin-list-group-pane').hide();
                    $(`#pin-pane-${idx}`).show();
                });
                $tabsRow.append($tab);
            }

            let $listPane = $(`<div id="pin-pane-${paneIndexCounter}" class="pin-list-group-pane ${paneIndexCounter === activePinTabIdx ? '' : 'hidden'}" style="${hasMultipleImages ? 'padding-top:10px;' : ''}"></div>`);
            $panelBody.append($listPane);

            let displayNumCounter = 0;
            imagePins.forEach((p) => {
                displayNumCounter++; 
                let displayNum = displayNumCounter;

                let hex = "ef4444"; 
                let rgbMatch = p.color.match(/\d+/g);
                if(rgbMatch && rgbMatch.length >= 3) {
                    hex = rgbMatch.slice(0,3).map(x => parseInt(x).toString(16).padStart(2, '0')).join('');
                } else if (p.color.startsWith('#')) {
                    hex = p.color.substring(1);
                }
                let safeNote = p.note ? p.note.replace(/"/g, '&quot;') : "";

                let shapeIcon = p.shape === 'arrow' ? 'fa-location-arrow' : (p.shape === 'rectangle' ? 'fa-vector-square' : 'fa-map-marker-alt');
                let placeholderTxt = p.shape === 'rectangle' ? 'Redaction / Block Note...' : 'Pin Note...';

                let isRect = p.shape === 'rectangle';
                let sliderHtml = isRect ? 
                    `<span style="font-size:10px; font-style:italic; color:#94a3b8; margin-left: 8px;">Use corner handle on canvas to resize</span>` :
                    `<input type="range" min="15" max="300" value="${p.size}" class="sexy-slider" oninput="updatePinStyle(${p.originalIndex}, 'size', this.value)">`;

                let cardStr = `
                    <div id="anno-card-${p.originalIndex}" class="custom-image-pin-layout" data-orig-idx="${p.originalIndex}" onmouseenter="focusPin(${p.originalIndex})" onmouseleave="unfocusPin(${p.originalIndex})">
                        <div class="ipc-top-row">
                            <div class="ipc-left-col ipc-tool-item">
                                <div class="sketch-btn sketch-num pin-drag-handle" title="Drag to reorder" style="background:#1e293b; color:white; width:28px; height:28px; border-radius:4px;">#${displayNum}</div>
                                <label class="sketch-color-wrap pin-tool-item" title="Color" style="background-color: #${hex}; border-radius:50%; width:28px; height:28px;">
                                    <input type="color" value="#${hex}" onchange="updatePinStyle(${p.originalIndex}, 'background', this.value)">
                                </label>
                                <button id="btn-img-shape-${p.originalIndex}" class="sketch-btn" onclick="toggleImagePinShape(${p.originalIndex})" title="Change Shape" style="width:28px; height:28px; background:#1e293b;"><i class="fas ${shapeIcon}"></i></button>
                            </div>
                            <div class="ipc-right-col" style="display:flex; flex-direction:column; justify-content:space-between;">
                                <textarea id="pin-text-${p.originalIndex}" class="sketch-textarea" oninput="updatePinText(${p.originalIndex}, this.value)" placeholder="${placeholderTxt}" style="flex-grow:1; margin-bottom:6px; min-height:45px;">${p.note}</textarea>

                                <div class="ipc-bottom-row ipc-tool-item" style="display: flex; gap: 6px; align-items: center; margin-top: auto;">
                                    <div class="ipc-size-bar" style="flex:1; background:${isRect ? '#334155' : '#1e293b'}; padding: 0 10px; border-radius: 6px; display: flex; align-items: center; gap: 8px; height:28px;">
                                        <span style="font-size:10px; font-weight:bold; color:#cbd5e1; text-transform:uppercase;">Size</span>
                                        ${sliderHtml}
                                    </div>
                                    <button class="sketch-btn sketch-del" onclick="deletePin(${p.originalIndex})" title="Delete Pin" style="width:28px; height:28px; background:#ef4444; flex-shrink:0;"><i class="fas fa-times"></i></button>
                                </div>
                            </div>
                        </div>
                    </div>`;

                $listPane.append(cardStr);
            });

            new Sortable($listPane[0], {
                animation: 150, handle: '.pin-drag-handle', fallbackOnBody: true, swapThreshold: 0.65,
                onEnd: function () {
                    saveHistory();
                    let allAnnos = $(`#p-${current} .pin`).toArray();
                    let globalOrderCounter = 0;
                    $('.pin-list-group-pane').each(function() {
                        $(this).find('.custom-image-pin-layout').each(function() {
                            let oldIdx = parseInt($(this).attr('data-orig-idx'));
                            $(allAnnos[oldIdx]).attr('data-order', globalOrderCounter);
                            globalOrderCounter++;
                        });
                    });
                    refreshAnnotations(); 
                }
            });
            paneIndexCounter++;
        });
    }

    let $stickyPanelBody = $('#sticky-list-container');
    $stickyPanelBody.empty();

    if (groupedData.sticky.length === 0) {
        $stickyPanelBody.html("<p style='text-align:center; font-size:10px; color:#64748b; padding:10px;'>No sticky notes on this page.</p>");
    } else {
        let displayNumCounter = 0;
        groupedData.sticky.forEach((p) => {
            displayNumCounter++;
            let hex = "fde047";
            let rgbMatch = p.color.match(/\d+/g);
            if(rgbMatch && rgbMatch.length >= 3) {
                hex = rgbMatch.slice(0,3).map(x => parseInt(x).toString(16).padStart(2, '0')).join('');
            } else if (p.color.startsWith('#')) {
                hex = p.color.substring(1);
            }
            let safeNote = p.note ? p.note.replace(/"/g, '&quot;') : "";

            let shapeIcon = p.shape === 'circle' ? 'fa-circle' : (p.shape === 'triangle' ? 'fa-caret-up' : 'fa-square');

            let cardStr = `
                <div id="anno-card-${p.originalIndex}" class="custom-sticky-card" data-orig-idx="${p.originalIndex}" onmouseenter="focusPin(${p.originalIndex})" onmouseleave="unfocusPin(${p.originalIndex})">

                    <div class="sticky-left-col pin-tool-item">
                        <div class="sketch-btn sketch-num pin-drag-handle" title="Drag to reorder" style="background:#1e293b; color:white;">#${displayNumCounter}</div>
                        <label class="sketch-color-wrap" title="Color" style="background-color: #${hex};">
                            <input type="color" value="#${hex}" onchange="updatePinStyle(${p.originalIndex}, 'background', this.value)">
                        </label>
                        <button class="sketch-btn" style="background:#1e293b;" onclick="togglePinDropdown(${p.originalIndex})" title="Options"><i class="fas fa-chevron-right"></i></button>
                        <button class="sketch-btn sketch-del" onclick="deletePin(${p.originalIndex})" title="Delete"><i class="fas fa-times"></i></button>
                    </div>

                    <div class="sticky-right-col">
                        <div class="sticky-textarea-container">
                            <textarea id="pin-text-${p.originalIndex}" class="sketch-textarea" oninput="updatePinText(${p.originalIndex}, this.value)" placeholder="Note content...">${p.note}</textarea>
                        </div>
                    </div>

                    <div id="pin-dropdown-${p.originalIndex}" class="sticky-dropdown hidden">
                        <div class="sticky-dropdown-tools">
                            <button class="sketch-btn" onclick="addListToPin(${p.originalIndex}, '1. ')" title="Numbered List"><i class="fas fa-list-ol"></i></button>
                            <button class="sketch-btn" onclick="addListToPin(${p.originalIndex}, '• ')" title="Bullet List"><i class="fas fa-list-ul"></i></button>
                            <button id="btn-shape-${p.originalIndex}" class="sketch-btn" onclick="togglePinShape(${p.originalIndex})" title="Change Shape"><i class="fas ${shapeIcon}"></i></button>
                        </div>
                        <div class="sc-size">
                            <span>Size</span>
                            <input type="range" min="15" max="250" value="${p.size}" class="sexy-slider" oninput="updatePinStyle(${p.originalIndex}, 'size', this.value)">
                        </div>
                    </div>

                </div>`;
            $stickyPanelBody.append(cardStr);
        });

        new Sortable($stickyPanelBody[0], {
            animation: 150, handle: '.pin-drag-handle', fallbackOnBody: true,
            onEnd: function () {
                saveHistory();
                let allAnnos = $(`#p-${current} .pin`).toArray();
                let stickyOrderOffset = 10000;
                $stickyPanelBody.find('.custom-sticky-card').each(function(i) {
                    let oldIdx = parseInt($(this).attr('data-orig-idx'));
                    $(allAnnos[oldIdx]).attr('data-order', stickyOrderOffset + i);
                });
                refreshAnnotations();
            }
        });
    }
}

// ==========================================================================
// PIN TO CARD HOVER LINKING & SCROLLING
// ==========================================================================
$(document).on('mouseenter', '#canvas .pin', function() {
    let origIdx = $(`#p-${current} .pin`).index(this);
    let $card = $(`#anno-card-${origIdx}`);
    if ($card.length) {
        $card.addClass('is-hovered-from-canvas');
        
        let $container = $card.closest('.pin-list-group-pane, #sticky-list-container, #pin-list-container');
        if ($container.length && $container.is(':visible')) {
            let cardTop = $card.position().top;
            let containerScroll = $container.scrollTop();
            let containerHeight = $container.height();
            
            if (cardTop < 0 || cardTop > containerHeight - $card.height()) {
                $container.stop().animate({
                    scrollTop: containerScroll + cardTop - (containerHeight / 2) + ($card.height() / 2)
                }, 200);
            }
        }
    }
}).on('mouseleave', '#canvas .pin', function() {
    let origIdx = $(`#p-${current} .pin`).index(this);
    $(`#anno-card-${origIdx}`).removeClass('is-hovered-from-canvas');
});

// ==========================================================================
// SECTION 8: DRAWING & SVG SYSTEM
// ==========================================================================
function toggleEraserMode() {
    if(!isEditing) return;
    isEraserMode = !isEraserMode;
    $('#eraser-btn').toggleClass('draw-active', isEraserMode);

    if (isEraserMode) {
        isDrawMode = false;
        $('#draw-btn').removeClass('draw-active');
        $('#canvas').addClass('drawing-active');
        $('.canvas-box, .pin').css('pointer-events', 'none'); 
        showToast("🧹 Eraser active: Swipe over pen strokes to delete them.");
    } else {
        $('#canvas').removeClass('drawing-active');
        $('.canvas-box, .pin').css('pointer-events', 'auto');
    }
}

function toggleDrawMode() {
    if(!isEditing) return;
    isDrawMode = !isDrawMode;
    $('#draw-btn').toggleClass('draw-active', isDrawMode);

    if (isDrawMode) {
        isEraserMode = false;
        $('#eraser-btn').removeClass('draw-active');
        $('#canvas').addClass('drawing-active');
        $('.canvas-box, .pin').css('pointer-events', 'none'); 
    } else {
        $('#canvas').removeClass('drawing-active');
        $('.canvas-box, .pin').css('pointer-events', 'auto');
    }
}

function getPageSvg() {
    let $page = $(`#p-${current}`);
    let $svg = $page.find('svg.draw-layer');
    if ($svg.length === 0) {
        let svgHtml = `<svg class="draw-layer" style="position:absolute; top:0; left:0; width:100%; height:100%; pointer-events:none; z-index:90;"></svg>`;
        $page.append(svgHtml);
        $svg = $page.find('svg.draw-layer');
    }
    return $svg[0];
}

// ==========================================================================
// SECTION 9: CORE EDITING LISTENERS & INTERACT.JS
// ==========================================================================
function toggleEdit() {
    isEditing = !isEditing; 
    $('#edit-btn').toggleClass('active-view', isEditing);
    $('#canvas').toggleClass('edit-active'); 
    $('body').toggleClass('edit-active', isEditing);

    if(isEditing) {
        $('#canvas-global-tools').css('display', 'flex');
    } else {
        $('#canvas-global-tools').hide();
        isPlacingText = false;
        isPlacingSticky = false;
        $('#canvas').removeClass('text-placement-active');
        isDrawMode = false;
        isEraserMode = false;
        $('#draw-btn').removeClass('draw-active');
        $('#eraser-btn').removeClass('draw-active');
        $('#canvas').removeClass('drawing-active');
        $('.canvas-box, .pin').css('pointer-events', 'auto');
    }

    $('.content-area').attr('contenteditable', isEditing); 
    $('.nav-text').attr('contenteditable', isEditing); 

    updateContextMenu();

    if(isEditing) {

        interact('.canvas-box').on('tap', function (event) {
            if (!isEditing) return;
            let $box = $(event.currentTarget);
            if(!event.shiftKey) { $('.canvas-box').removeClass('selected-box'); }
            $box.addClass('selected-box');
            updateContextMenu();
            event.preventDefault();
        });

        interact('.canvas-box').resizable({ 
            edges: { right: true, bottom: true }, margin: 15,
            listeners: { 
                start: saveHistory, 
                move(event) {
                    let target = event.target; 
                    let x = (parseFloat(target.getAttribute('data-x')) || 0); 
                    let y = (parseFloat(target.getAttribute('data-y')) || 0);

                    let currentW = parseFloat(target.style.width) || target.offsetWidth;
                    let currentH = parseFloat(target.style.height) || target.offsetHeight;

                    let newW = currentW + (event.deltaRect.width / currentZoom);
                    let newH = currentH + (event.deltaRect.height / currentZoom);

                    target.style.width = newW + 'px'; 

                    let audioPlayer = target.querySelector('.custom-audio-player');
                    if (audioPlayer) {
                        if (newW < 120) { 
                            audioPlayer.classList.add('compact-mode');
                            target.style.height = newW + 'px'; 
                        } else {
                            audioPlayer.classList.remove('compact-mode');
                            target.style.height = 'auto';
                        }
                    } else {
                        target.style.height = newH + 'px';
                    }

                    x += (event.deltaRect.left / currentZoom); 
                    y += (event.deltaRect.top / currentZoom);

                    target.style.transform = `translate(${x}px, ${y}px)`; 
                    target.setAttribute('data-x', x); 
                    target.setAttribute('data-y', y);

                    updateContextMenu();
                }
            }
        }).draggable({ 
            modifiers: [],
            ignoreFrom: '.audio-play-btn, .audio-track, .audio-skip-btn, .audio-speed-btn, .is-editing-text, .content-area, td, th, .pin, .pin-rotation-ring, .pin-rotate-dot, .del-btn',
            listeners: { 
                start: saveHistory, 
                move(event) {
                    let x = (parseFloat(event.target.getAttribute('data-x')) || 0) + (event.dx / currentZoom); 
                    let y = (parseFloat(event.target.getAttribute('data-y')) || 0) + (event.dy / currentZoom);
                    event.target.style.transform = `translate(${x}px, ${y}px)`; 
                    event.target.setAttribute('data-x', x); 
                    event.target.setAttribute('data-y', y);
                    updateContextMenu();
                } 
            }
        });

        interact('.pin[data-shape="rectangle"]').resizable({
            edges: { right: true, bottom: true },
            margin: 15,
            listeners: {
                start: saveHistory,
                move(event) {
                    let target = event.target;
                    let currentW = parseFloat(target.style.width) || target.offsetWidth;
                    let currentH = parseFloat(target.style.height) || target.offsetHeight;

                    let newW = currentW + (event.deltaRect.width / currentZoom);
                    let newH = currentH + (event.deltaRect.height / currentZoom);

                    target.style.width = newW + 'px';
                    target.style.height = newH + 'px';
                }
            }
        });

        interact('.pin').draggable({ 
            ignoreFrom: '.pin-rotate-dot', 
            listeners: { 
                start: saveHistory, 
                move(event) {
                    let x = (parseFloat(event.target.getAttribute('data-x')) || 0) + (event.dx / currentZoom); 
                    let y = (parseFloat(event.target.getAttribute('data-y')) || 0) + (event.dy / currentZoom);
                    event.target.style.transform = `translate(${x}px, ${y}px)`; 
                    event.target.setAttribute('data-x', x); 
                    event.target.setAttribute('data-y', y);
                }, 
                end: function(event) {
                    let $pin = $(event.target);
                    if ($pin.parent().hasClass('canvas-box')) {
                        let currentLeft = parseFloat($pin[0].style.left) || 0;
                        let currentTop = parseFloat($pin[0].style.top) || 0;
                        let dx = parseFloat($pin.attr('data-x')) || 0;
                        let dy = parseFloat($pin.attr('data-y')) || 0;

                        let boxW = $pin.parent().width();
                        let boxH = $pin.parent().height();

                        let pxLeft = $pin[0].style.left.includes('%') ? (currentLeft / 100) * boxW : currentLeft;
                        let pxTop = $pin[0].style.top.includes('%') ? (currentTop / 100) * boxH : currentTop;

                        let newPxLeft = pxLeft + dx;
                        let newPxTop = pxTop + dy;

                        $pin.css({
                            left: ((newPxLeft / boxW) * 100).toFixed(4) + '%',
                            top: ((newPxTop / boxH) * 100).toFixed(4) + '%',
                            transform: 'translate(0px, 0px)'
                        });
                        $pin.attr('data-x', 0).attr('data-y', 0);
                    }
                    refreshAnnotations();
                }
            }
        });

    } else { 
        interact('.canvas-box').unset(); 
        interact('.pin').unset(); 
        interact('.pin[data-shape="rectangle"]').unset();
        $('.canvas-box').removeClass('selected-box'); 
        updateContextMenu();
    }
}

// ==========================================================================
// SECTION 10: INITIALIZATION & GLOBAL EVENTS
// ==========================================================================
function processCustomPaste(pastedText) {
    try {
        let parsed = JSON.parse(pastedText);
        if (parsed.noteDumpClipboard && parsed.items) {
            saveHistory();
            $('.canvas-box').removeClass('selected-box');
            $('.pin').removeClass('is-selected');

            let highestZ = getHighestZ();
            let highestOrder = -1;
            $(`#p-${current} .pin`).each(function() {
                let o = parseInt($(this).attr('data-order')) || 0;
                if (o > highestOrder) highestOrder = o;
            });

            parsed.items.forEach((item, idx) => {
                let $newBox = $(item.html);
                $newBox.attr('data-x', 0);
                $newBox.attr('data-y', 0);
                $newBox.css({ top: item.absY + 'px', left: item.absX + 'px', transform: 'translate(0px, 0px)', zIndex: highestZ + idx });
                $newBox.removeAttr('id');
                $newBox.find('[id]').removeAttr('id');

                if (item.isPin) {
                    highestOrder++;
                    $newBox.attr('data-order', highestOrder);
                    $newBox.removeClass('pin-text-visible pin-hover-visible');
                    $newBox.addClass('is-selected');
                    $(`#p-${current}`).append($newBox);
                } else {
                    $newBox.addClass('selected-box');
                    $(`#p-${current}`).append($newBox);
                }
            });
            if (parsed.items.some(i => i.isPin)) refreshAnnotations();
            updateContextMenu();
            showToast("📥 Items Pasted!");
        }
    } catch(err) { console.error("Clipboard parsing error:", err); }
}

$(document).ready(async function() {

    let $lectureTitle = $('#lecture-title');
    if ($lectureTitle.length) {
        let updateTitle = () => { 
            let txt = $lectureTitle.text().trim();
            if(txt && txt !== "NoteDump_Saved") {
                document.title = txt; 
            }
        };
        $lectureTitle.on('input', updateTitle);
        updateTitle();
        let observer = new MutationObserver(updateTitle);
        observer.observe($lectureTitle[0], { childList: true, characterData: true, subtree: true });
    }

    await restoreFromBrowser(); 
    lastSavedState = getPageHTML(); 

    if ($('#canvas-global-tools').length) {
        $('#page-color-btn').remove(); 

        let pageColorHtml = `<button id="page-color-btn" class="action-btn" title="Page Background Color" style="display:inline-flex; align-items:center; justify-content:center; padding: 4px 10px; background: transparent; border: none; cursor: pointer; color: inherit;"><i class="fas fa-fill-drip"></i></button>`;
        
        let $splitBtn = $('#canvas-global-tools').find('button, div, span').filter(function() {
            return $(this).text().trim().toLowerCase() === 'split' || ($(this).attr('onclick') || '').includes('splitPage');
        }).last();

        if ($splitBtn.length) {
            $splitBtn.after(pageColorHtml);
        } else {
            $('#canvas-global-tools').append(pageColorHtml);
        }

        let customPaletteModal = `
        <div id="recolor-modal-bg" style="display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.5); z-index:9999999; align-items:center; justify-content:center; flex-direction:column;">
            <div style="background:#1e293b; padding:20px; border-radius:12px; width:300px; box-shadow:0 10px 40px rgba(0,0,0,0.5); border:1px solid #334155; text-align:center;">
                <h3 style="color:white; margin-top:0; font-family:sans-serif; margin-bottom:15px; font-size:16px;">Page Background Color</h3>
                <div id="recolor-grid" style="display:grid; grid-template-columns:repeat(4, 1fr); gap:10px; margin-bottom:15px;"></div>
                <label style="color:#94a3b8; font-size:12px; display:block; margin-bottom:5px; text-align:left;">Custom Hex</label>
                <input type="color" id="recolor-custom-hex" style="width:100%; height:40px; border:none; border-radius:6px; cursor:pointer; background:none;">
                <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:15px;">
                    <button onclick="$('#recolor-modal-bg').css('display', 'none')" style="background:#334155; color:white; border:none; padding:8px 16px; border-radius:6px; cursor:pointer;">Close</button>
                </div>
            </div>
        </div>`;
        if ($('#recolor-modal-bg').length === 0) {
            $('body').append(customPaletteModal);
        }

        let paletteHtml = "";
        COLORS.forEach(c => {
            paletteHtml += `<div class="color-swatch" style="background:${c}; width:100%; padding-top:100%; border-radius:6px; cursor:pointer;" onclick="applyPageRecolor('${c}')"></div>`;
        });
        $('#recolor-grid').html(paletteHtml);
    }

    window.applyPageRecolor = function(hex) {
        let r = parseInt(hex.slice(1, 3), 16) || 255;
        let g = parseInt(hex.slice(3, 5), 16) || 255;
        let b = parseInt(hex.slice(5, 7), 16) || 255;
        $('#p-' + current).css('background-color', `rgba(${r},${g},${b},1)`).attr('data-bg-rgb', `${r},${g},${b}`);
        saveHistory();
        $('#recolor-modal-bg').css('display', 'none');
    };

    $(document).on('click', '#page-color-btn, .fa-fill-drip', function(e) {
        e.preventDefault();
        e.stopPropagation();
        $('#recolor-modal-bg').css('display', 'flex'); 
    });

    $(document).on('input change', '#recolor-custom-hex', function() {
        applyPageRecolor($(this).val());
    });

    $(document).on('mousedown', '.ctx-btn, select, .color-swatch, .action-btn, button[data-cmd]', function(e) {
        if(!$(this).is('select') && !$(this).is('input') && !$(this).is('#page-opacity-slider') && !$(this).is('#page-color-btn') && !$(this).is('.fa-fill-drip')) {
            e.preventDefault(); 
        }
    });

    $(document).on('change', 'select[data-cmd="fontName"]', function() {
        let val = $(this).val();
        let $cells = $('.selected-cell');
        let selStr = window.getSelection().toString();
        
        if ($cells.length > 0 && ($cells.length > 1 || selStr.length === 0)) {
            $cells.css('font-family', val);
            $cells.find('*').css('font-family', '');
            saveHistory();
            return;
        }
        document.execCommand('fontName', false, val);
        saveHistory();
    });

    $(document).on('change', 'select[data-cmd="fontSize"]', function() {
        applyFontSize($(this).val());
    });

    $(document).on('change', 'select[data-cmd="lineHeight"]', function() {
        applyLineHeight($(this).val());
    });

    $(document).on('click', '[title="Move Up"], .fa-angle-double-up', function(e) { e.preventDefault(); changeLayer(1); });
    $(document).on('click', '[title="Move Down"], .fa-angle-double-down', function(e) { e.preventDefault(); changeLayer(-1); });

    $(document).on('input', '#transparency-slider', function() { liveUpdateOpacity($(this).val()); });
    $(document).on('change', '#transparency-slider', function() { commitOpacity(); });

    let colorHtml = "";
    COLORS.forEach(c => { colorHtml += `<div class="color-swatch" style="background:${c};" data-color="${c}" onmousedown="event.preventDefault();"></div>`; });

    $('#text-color-grid, #bg-color-grid').html(colorHtml);
    $('.menu-text-tools-color > div').each(function() {
        if ($(this).attr('id') === 'text-color-grid') $(this).html(colorHtml);
    });
    $('.menu-bg-tools > div').each(function() {
        if ($(this).attr('id') === 'bg-color-grid') $(this).html(colorHtml);
    });

    $(document).on('click', '.menu-text-tools-color .color-swatch', function(e) { 
        e.preventDefault();
        let hex = $(this).attr('data-color');
        let $cells = $('.selected-cell');
        let selStr = window.getSelection().toString();

        let $box = $('.selected-box');
        let $audio = $box.find('.custom-audio-player');

        if ($audio.length > 0) {
            let r = parseInt(hex.slice(1, 3), 16);
            let g = parseInt(hex.slice(3, 5), 16);
            let b = parseInt(hex.slice(5, 7), 16);
            let currentOp = $('#transparency-slider').val() || 1;
            $audio.css('background-color', `rgba(${r},${g},${b},${currentOp})`);
            $box.attr('data-player-bg', `${r},${g},${b}`);
            saveHistory();
            return;
        }

        if ($cells.length === 1 && selStr.length > 0) {
            document.execCommand('styleWithCSS', false, true);
            document.execCommand('foreColor', false, hex);
            saveHistory();
            return;
        }

        if ($cells.length > 0) {
            $cells.each(function() {
                let range = document.createRange();
                range.selectNodeContents(this);
                let sel = window.getSelection();
                sel.removeAllRanges();
                sel.addRange(range);
                document.execCommand('styleWithCSS', false, true);
                document.execCommand('foreColor', false, hex);
            });
            window.getSelection().removeAllRanges();
            saveHistory();
            return;
        }

        restoreSelection();
        document.execCommand('styleWithCSS', false, true);
        document.execCommand('foreColor', false, hex);
        saveHistory();
    });

    $(document).on('click', '.menu-bg-tools .color-swatch', function(e) { 
        e.preventDefault();
        let hex = $(this).attr('data-color');
        let r = parseInt(hex.slice(1, 3), 16);
        let g = parseInt(hex.slice(3, 5), 16);
        let b = parseInt(hex.slice(5, 7), 16);

        let currentOp = $('#transparency-slider').val() || 1;
        if (currentOp == 0) { currentOp = 1; $('#transparency-slider').val(1); }

        saveHistory();
        let $cells = $('.selected-cell');
        if ($cells.length > 0) {
            $cells.attr('data-bg-rgb', `${r},${g},${b}`);
            $cells.css('background-color', `rgba(${r},${g},${b},${currentOp})`);
        } else {
            let $box = $('.selected-box');
            let $audio = $box.find('.custom-audio-player');
            if ($audio.length > 0) {
                $audio.find('.audio-play-btn, .audio-progress').css('background-color', `rgba(${r},${g},${b},${currentOp})`);
                $box.attr('data-bg-rgb', `${r},${g},${b}`); 
            } else {
                $box.attr('data-bg-rgb', `${r},${g},${b}`);
                changeBoxStyle('background-color', `rgba(${r},${g},${b},${currentOp})`);
            }
        }
    });

    interact('.fa-arrows-alt, .drag-handle-btn, .menu-text-tools button:first-child').draggable({
        listeners: {
            start(event) { saveHistory(); },
            move(event) {
                let $sel = $('.selected-box');
                if ($sel.length === 0) return;
                $sel.each(function() {
                    let target = this;
                    let x = (parseFloat(target.getAttribute('data-x')) || 0) + (event.dx / currentZoom);
                    let y = (parseFloat(target.getAttribute('data-y')) || 0) + (event.dy / currentZoom);
                    target.style.transform = `translate(${x}px, ${y}px)`;
                    target.setAttribute('data-x', x);
                    target.setAttribute('data-y', y);
                });
                updateContextMenu();
            },
            end(event) { refreshAnnotations(); }
        }
    });

    $(document).on('mousemove touchmove', '.drawn-path', function(e) {
        if (isEraserMode && (e.buttons === 1 || e.type === 'touchmove')) {
            saveHistory();
            $(this).remove();
        }
    });

    $(document).on('mousedown touchstart', '.drawn-path', function(e) {
        if (isEraserMode) {
            saveHistory();
            $(this).remove();
            e.preventDefault();
        }
    });

    $(document).on('mousedown touchstart', function(e) {
        let isTouch = e.type.startsWith('touch');
        let clientX = isTouch ? e.originalEvent.touches[0].clientX : e.clientX;
        let clientY = isTouch ? e.originalEvent.touches[0].clientY : e.clientY;

        if (isPlacingSticky) {
            let $page = $(e.target).closest('.page');
            if ($page.length === 0) $page = $(`#p-${current}`);

            let rect = $page[0].getBoundingClientRect();
            let x = (clientX - rect.left) / currentZoom;
            let y = (clientY - rect.top) / currentZoom;

            isPlacingSticky = false;
            $('#canvas').removeClass('text-placement-active');

            if (window.innerWidth <= 768 || (document.querySelector('meta[name="viewport"]') && document.querySelector('meta[name="viewport"]').content.includes('1200'))) {
                setTimeout(() => togglePanel('sticky'), 300);
            }

            saveHistory();
            let highestOrder = -1;
            $(`#p-${current} .pin`).each(function() {
                let o = parseInt($(this).attr('data-order')) || 0;
                if (o > highestOrder) highestOrder = o;
            });
            $page.append(`
                <div class="pin" data-type="sticky" data-shape="square" data-note="New Sticky Note" data-angle="0" data-order="${highestOrder + 1}" style="top:${y}px;left:${x}px; margin-top:-16px; margin-left:-16px; width:32px; height:32px; transform: translate(0px, 0px); opacity:1; --pin-color: #fde047;">
                    <div class="pin-rotator-group" style="transform: rotate(0deg); width:100%; height:100%;">
                        <div class="pin-visual" style="width:100%; height:100%;"></div>
                    </div>
                </div>
            `);

            refreshAnnotations(); 
            if(!$('#sticky-panel').hasClass('open') && window.innerWidth > 768) togglePanel('sticky');

            e.preventDefault();
            return;
        }

        if (isPlacingText) {
            let $page = $(e.target).closest('.page');
            if ($page.length === 0) $page = $(`#p-${current}`);

            let rect = $page[0].getBoundingClientRect();
            let x = (clientX - rect.left) / currentZoom;
            let y = (clientY - rect.top) / currentZoom;

            isPlacingText = false;
            $('#canvas').removeClass('text-placement-active');

            if ((window.innerWidth <= 768 || (document.querySelector('meta[name="viewport"]') && document.querySelector('meta[name="viewport"]').content.includes('1200'))) && isEditing) {
                $('#canvas-global-tools').css('display', 'flex'); 
            }

            saveHistory();
            $('.canvas-box').removeClass('selected-box');
            $page.append(`<div class="canvas-box selected-box" style="top:${y}px;left:${x}px;width:200px; height:auto; z-index:${getHighestZ()}; background:transparent; transform: translate(0px, 0px);"><div class="del-btn" onclick="$(this).parent().remove(); updateContextMenu();">X</div><div class="content-area" contenteditable="true" style="width: 100%; height: 100%; box-sizing: border-box; word-break: break-word; white-space: pre-wrap; outline:none;">New Text</div></div>`);
            updateContextMenu();
            e.preventDefault();
            return;
        }

        if (!isEditing) return;

        if ($(e.target).closest('.canvas-box').length > 0) {
            let $box = $(e.target).closest('.canvas-box');
            
            if ($(e.target).closest('table').length === 0) {
                $('.canvas-box table td, .canvas-box table th').removeClass('selected-cell');
            }

            if(!e.shiftKey && !$box.hasClass('selected-box')) { $('.canvas-box').removeClass('selected-box'); }
            $box.addClass('selected-box');
            updateContextMenu();

            if ($(e.target).closest('.content-area, .audio-play-btn, .audio-track, .pin-rotate-dot, #page-color-btn, #page-color-popup').length > 0) { return; }
            if(!$(e.target).is(':focus')) { e.preventDefault(); }
            return;
        }

        if ($(e.target).is('#canvas, .page, .page-grid-overlay')) {
            $('.canvas-box').removeClass('selected-box');
            $('.canvas-box table td, .canvas-box table th').removeClass('selected-cell');
            updateContextMenu();
        }

        if (isDrawMode && !isEraserMode) {
            if ($(e.target).closest('.tool-group, #nav, .floating-panel').length > 0) return;

            isDrawing = true;
            let rect = $(`#p-${current}`)[0].getBoundingClientRect();
            let x = (clientX - rect.left) / currentZoom;
            let y = (clientY - rect.top) / currentZoom;

            pathString = `M ${x} ${y}`;
            let color = $('#draw-color').val() || '#ef4444';
            let size = $('#draw-size').val() || 3;

            let svg = getPageSvg();
            let path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            path.setAttribute('d', pathString);
            path.setAttribute('stroke', color);
            path.setAttribute('stroke-width', size);
            path.setAttribute('fill', 'none');
            path.setAttribute('stroke-linecap', 'round');
            path.setAttribute('stroke-linejoin', 'round');
            path.setAttribute('class', 'drawn-path');
            path.style.pointerEvents = "auto"; 

            svg.appendChild(path);
            currentSvgPath = path;

            e.preventDefault(); 
        }
    });

    $(document).on('mousemove touchmove', function(e) {
        if (!isDrawing || !currentSvgPath) return;
        let isTouch = e.type.startsWith('touch');
        let clientX = isTouch ? e.originalEvent.touches[0].clientX : e.clientX;
        let clientY = isTouch ? e.originalEvent.touches[0].clientY : e.clientY;

        let rect = $(`#p-${current}`)[0].getBoundingClientRect();
        let x = (clientX - rect.left) / currentZoom;
        let y = (clientY - rect.top) / currentZoom;

        pathString += ` L ${x} ${y}`;
        currentSvgPath.setAttribute('d', pathString);
    });

    $(document).on('mouseup touchend', function(e) {
        if (isDrawing) {
            isDrawing = false;
            currentSvgPath = null;
            saveHistory();
        }
    });

    $(window).on('keydown', function(e) {
        let isTyping = $(e.target).is('textarea, [contenteditable="true"]:focus, input:focus');

        if (isTyping && e.key === 'Tab') {
            e.preventDefault();
            document.execCommand('insertHTML', false, '&emsp;&emsp;');
            return;
        }

        if (e.ctrlKey && e.key.toLowerCase() === 'a') { 
            let $focusedCell = $(e.target).closest('td, th');
            if ($focusedCell.length > 0) {
                e.preventDefault(); 
                $focusedCell.closest('table').find('td, th').addClass('selected-cell');
                updateContextMenu();
                return;
            } else if (!isTyping) {
                e.preventDefault(); 
                $(`#p-${current} .canvas-box`).addClass('selected-box'); 
                $(`#p-${current} .pin`).addClass('is-selected');
                updateContextMenu(); 
                return;
            }
        }

        if (e.ctrlKey && e.key.toLowerCase() === 's') { e.preventDefault(); showExportModal(); return; }

        if (e.ctrlKey && e.key.toLowerCase() === 'f') {
            e.preventDefault();
            if ($('#nav').hasClass('closed')) toggleNav();
            $('#sidebar-search').slideDown(200);
            $('#search-input').focus(); 
            return;
        }

        if (e.ctrlKey && e.key.toLowerCase() === 'd') {
            e.preventDefault();
            $('body').toggleClass('dark');
            return;
        }

        if (e.ctrlKey && e.key.toLowerCase() === 'z') { 
            if (isTyping) {
                setTimeout(saveHistory, 100); 
                return;
            } else {
                e.preventDefault(); undo(); return; 
            }
        }

        if (!isTyping && e.which == 37) { prevPage(); e.preventDefault(); }
        if (!isTyping && e.which == 39) { nextPage(); e.preventDefault(); }

        if (isEditing) {
            if (e.ctrlKey && e.key.toLowerCase() === 'c' && !isTyping) { 
                customClipboard = []; 
                $('.selected-box, .pin.is-selected').each(function() { 
                    let $el = $(this);
                    let x = parseFloat($el.css('left')) || 0;
                    let y = parseFloat($el.css('top')) || 0;
                    let tx = parseFloat($el.attr('data-x')) || 0;
                    let ty = parseFloat($el.attr('data-y')) || 0;

                    customClipboard.push({
                        html: $el[0].outerHTML,
                        isPin: $el.hasClass('pin'),
                        absX: x + tx,
                        absY: y + ty
                    }); 
                });

                if(customClipboard.length > 0) {
                    let clipData = JSON.stringify({ noteDumpClipboard: true, items: customClipboard });
                    if (navigator.clipboard && window.isSecureContext) {
                        navigator.clipboard.writeText(clipData);
                    } else {
                        let tempInput = document.createElement("textarea");
                        tempInput.value = clipData;
                        document.body.appendChild(tempInput);
                        tempInput.select();
                        document.execCommand("copy");
                        document.body.removeChild(tempInput);
                    }
                    showToast("📋 Copied " + customClipboard.length + " item(s)");
                }
            }
        }
    });

    $(document).on('paste', function(e) {
        if (!isEditing) return;

        let clipboardData = (e.originalEvent || e).clipboardData;
        let pastedText = clipboardData.getData('text/plain') || clipboardData.getData('Text');
        let pastedHtml = clipboardData.getData('text/html');
        let items = clipboardData.items;

        if (!pastedText && pastedHtml) {
            let tempDiv = document.createElement('div');
            tempDiv.innerHTML = pastedHtml;
            pastedText = tempDiv.innerText || tempDiv.textContent || "";
        }

        let imageFile = null;
        for (let i = 0; i < items.length; i++) {
            if (items[i].type.indexOf("image") === 0) {
                imageFile = items[i].getAsFile();
                break;
            }
        }

        if (pastedText && pastedText.includes('"noteDumpClipboard":true')) {
            e.preventDefault();
            processCustomPaste(pastedText);
            return;
        }

        let isTyping = $(e.target).is('textarea, [contenteditable="true"]:focus, input:focus');

        if (isTyping) {
            e.preventDefault();

            if (imageFile) {
                let r = new FileReader();
                r.onload = ev => {
                    document.execCommand('insertImage', false, ev.target.result);
                };
                r.readAsDataURL(imageFile);
            } else if (pastedText) {
                document.execCommand('insertText', false, pastedText.trim());
            }
            return;
        }

        let coords = getPasteCoords();

        if (pastedHtml && pastedHtml.includes('<table')) {
            let temp = $('<div>').html(pastedHtml);
            let $table = temp.find('table').first();
            if ($table.length > 0) {
                e.preventDefault(); saveHistory(); $('.canvas-box').removeClass('selected-box');
                $table.css({width: '100%', height: '100%', tableLayout: 'fixed', borderCollapse: 'collapse', fontSize: '12px'});
                $table.find('td, th').css({border: '1px solid #cbd5e1', padding: '4px 6px', wordWrap: 'break-word', overflowWrap: 'break-word', whiteSpace: 'pre-wrap', verticalAlign: 'top', resize: 'none', overflow: 'hidden', position: 'relative'});

                $(`#p-${current}`).append(`<div class="canvas-box selected-box" style="top:${coords.y}px;left:${coords.x}px;width:400px; height:150px; background:white; z-index:${getHighestZ()}; transform: translate(0px, 0px); display:flex; flex-direction:column;"><div class="del-btn" onclick="$(this).parent().remove(); updateContextMenu();">X</div><div class="content-area" contenteditable="true" style="flex-grow:1; width:100%; height:100%; outline:none;">${$table[0].outerHTML}</div></div>`);
                equalizeTable();
                updateContextMenu();
                return;
            }
        }

        if (imageFile) {
            e.preventDefault();
            let r = new FileReader();
            r.onload = ev => {
                saveHistory();
                $('.canvas-box').removeClass('selected-box');
                $(`#p-${current}`).append(`<div class="canvas-box selected-box" style="top:${coords.y}px;left:${coords.x}px;width:300px;max-width:calc(800px - ${coords.x}px);z-index:${getHighestZ()};transform: translate(0px, 0px);"><div class="del-btn" onclick="$(this).parent().remove(); updateContextMenu();">X</div><img src="${ev.target.result}" style="width:100%"></div>`);
                updateContextMenu();
            };
            r.readAsDataURL(imageFile);
            return;
        }

        if (pastedHtml && pastedHtml.includes('<img')) {
            let temp = $('<div>').html(pastedHtml);
            let $img = temp.find('img').first();
            let src = $img.attr('src');
            
            if ($img.length > 0 && src && !src.startsWith('file:///')) {
                e.preventDefault(); saveHistory(); $('.canvas-box').removeClass('selected-box');
                $(`#p-${current}`).append(`<div class="canvas-box selected-box" style="top:${coords.y}px;left:${coords.x}px;width:300px;max-width:calc(800px - ${coords.x}px);z-index:${getHighestZ()};transform: translate(0px, 0px);"><div class="del-btn" onclick="$(this).parent().remove(); updateContextMenu();">X</div><img src="${src}" style="width:100%"></div>`);
                updateContextMenu();
                return;
            }
        }

        if (pastedText && pastedText.trim() !== "") {
            e.preventDefault(); saveHistory(); $('.canvas-box').removeClass('selected-box');
            let safeText = $('<div>').text(pastedText).html().replace(/\n/g, '<br>');
            $(`#p-${current}`).append(`<div class="canvas-box selected-box" style="top:${coords.y}px;left:${coords.x}px;width:300px;max-width:calc(800px - ${coords.x}px);z-index:${getHighestZ()};background-color:transparent;transform: translate(0px, 0px);"><div class="del-btn" onclick="$(this).parent().remove(); updateContextMenu();">X</div><div class="content-area" contenteditable="true" style="width: 100%; height: 100%; box-sizing: border-box; word-break: break-word; white-space: pre-wrap; overflow-wrap: break-word;">${safeText}</div></div>`);
            updateContextMenu();
        }
    });

    let tblMgr = { 
        active: false, isRow: false, isCol: false, 
        start: 0, $c1: null, $c2: null, $row: null, 
        w1: 0, w2: 0, h1: 0, tW: 0 
    };

    function normalizeTable($t) {
        if ($t.attr('data-norm') === 'true') return;
        $t.css({ 'table-layout': 'fixed', 'width': '100%', 'border-collapse': 'collapse' });
        $t.find('td, th').css({ 'width': '', 'position': 'relative' }); 
        
        let cols = 0;
        $t.find('tr').first().children().each(function() { cols += parseInt($(this).attr('colspan')||1); });
        
        if (cols > 0 && $t.find('colgroup').length === 0) {
            let cg = '<colgroup>';
            for(let i=0; i<cols; i++) cg += `<col style="width:${100/cols}%">`;
            cg += '</colgroup>';
            $t.prepend(cg);
        }
        $t.attr('data-norm', 'true');
    }

    $(document).on('mouseenter', '.canvas-box table', function() {
        if(isEditing) normalizeTable($(this));
    });

    $(document).on('mousemove', '.canvas-box table', function(e) {
        if (!isEditing || tblMgr.active || tblDrag.active) return;
        let $td = $(e.target).closest('td, th');
        if (!$td.length) return;

        let rect = $td[0].getBoundingClientRect();
        let nearR = (rect.right - e.clientX) >= 0 && (rect.right - e.clientX) <= 6;
        let nearB = (rect.bottom - e.clientY) >= 0 && (rect.bottom - e.clientY) <= 6;

        $(this).css('cursor', 'auto');
        $(this).find('.res-c, .res-r').removeClass('res-c res-r');

        if (nearR && $td.next().length) {
            $(this).css('cursor', 'col-resize');
            $td.addClass('res-c');
        } else if (nearB && $td.parent().next().length) {
            $(this).css('cursor', 'row-resize');
            $td.addClass('res-r');
        }
    });

    let tblDrag = {
        active: false,
        startX: 0, startY: 0,
        startCell: null,
        $table: null,
        $contentArea: null
    };

    $(document).on('mousedown', '.canvas-box table td, .canvas-box table th', function(e) {
        if (!isEditing) return;
        
        if ($(this).hasClass('res-c') || $(this).hasClass('res-r')) {
            let $t = $(this).closest('table');
            if ($(this).hasClass('res-c')) {
                e.preventDefault(); e.stopPropagation();
                normalizeTable($t);
                tblMgr.active = true; tblMgr.isCol = true; tblMgr.start = e.clientX;
                let idx = this.cellIndex;
                tblMgr.$c1 = $t.find('col').eq(idx);
                tblMgr.$c2 = $t.find('col').eq(idx + 1);
                tblMgr.tW = $t.width();
                tblMgr.w1 = parseFloat(tblMgr.$c1[0].style.width) || (100/$t.find('col').length);
                tblMgr.w2 = parseFloat(tblMgr.$c2[0].style.width) || (100/$t.find('col').length);
                $t.closest('.canvas-box')[0].draggable = false; 
                return;
            } 
            if ($(this).hasClass('res-r')) {
                e.preventDefault(); e.stopPropagation();
                tblMgr.active = true; tblMgr.isRow = true; tblMgr.start = e.clientY;
                tblMgr.$row = $(this).parent();
                tblMgr.h1 = tblMgr.$row.height();
                return;
            }
        }

        tblDrag.startX = e.clientX;
        tblDrag.startY = e.clientY;
        tblDrag.startCell = this;
        tblDrag.$table = $(this).closest('table');
        tblDrag.$contentArea = $(this).closest('.content-area');
        tblDrag.active = false;

        if (!e.shiftKey) {
            tblDrag.$table.find('.selected-cell').removeClass('selected-cell');
        }
        $(this).addClass('selected-cell');
        updateContextMenu();
    });

    $(document).on('mousemove', function(e) {
        if (tblMgr.active) {
            if (tblMgr.isCol) {
                let dx = ((e.clientX - tblMgr.start) / tblMgr.tW) * 100;
                let nW1 = tblMgr.w1 + dx; let nW2 = tblMgr.w2 - dx;
                if (nW1 > 3 && nW2 > 3) {
                    tblMgr.$c1.css('width', nW1 + '%');
                    tblMgr.$c2.css('width', nW2 + '%');
                }
            } else if (tblMgr.isRow) {
                let dy = (e.clientY - tblMgr.start) / currentZoom;
                let nH = tblMgr.h1 + dy;
                if (nH > 15) tblMgr.$row.css('height', nH + 'px');
            }
            return;
        }

        if (isEditing && tblDrag.startCell) {
            
            if (!tblDrag.active) {
                let $hoveredCell = $(e.target).closest('td, th');
                if ($hoveredCell.length && $hoveredCell[0] !== tblDrag.startCell && $hoveredCell.closest('table')[0] === tblDrag.$table[0]) {
                    tblDrag.active = true;
                    tblDrag.$contentArea.attr('contenteditable', 'false'); 
                    if (window.getSelection) window.getSelection().removeAllRanges();
                }
            }

            if (tblDrag.active) {
                let $hoveredCell = $(e.target).closest('td, th');
                if ($hoveredCell.length && $hoveredCell.closest('table')[0] === tblDrag.$table[0]) {
                    let r1 = tblDrag.startCell.parentNode.rowIndex;
                    let c1 = tblDrag.startCell.cellIndex;
                    let r2 = $hoveredCell[0].parentNode.rowIndex;
                    let c2 = $hoveredCell[0].cellIndex;

                    let minR = Math.min(r1, r2); let maxR = Math.max(r1, r2);
                    let minC = Math.min(c1, c2); let maxC = Math.max(c1, c2);

                    tblDrag.$table.find('td, th').removeClass('selected-cell');
                    tblDrag.$table.find('tr').each(function() {
                        let r = this.rowIndex;
                        if (r >= minR && r <= maxR) {
                            $(this).children().each(function() {
                                let c = this.cellIndex;
                                if (c >= minC && c <= maxC) {
                                    $(this).addClass('selected-cell');
                                }
                            });
                        }
                    });
                }
            }
        }
    });

    $(document).on('mouseup', function() {
        if (tblMgr.active) {
            tblMgr.active = false; tblMgr.isCol = false; tblMgr.isRow = false;
            $('.canvas-box table').css('cursor', 'auto');
            $('.res-c, .res-r').removeClass('res-c res-r');
            saveHistory();
        }

        if (tblDrag.startCell) {
            if (tblDrag.active) {
                tblDrag.$contentArea.attr('contenteditable', 'true');
            }
            tblDrag.startCell = null;
            tblDrag.active = false;
            tblDrag.$table = null;
            tblDrag.$contentArea = null;
            updateContextMenu();
        }
    });

    document.addEventListener('wheel', function(e) {
        if (e.ctrlKey || e.metaKey) {
            e.preventDefault(); 
            let cvp = document.getElementById('canvas-viewport');
            if(!cvp) return;

            let zoomMultiplier = Math.exp(e.deltaY * -0.005);
            let newZoom = currentZoom * zoomMultiplier; 
            if(newZoom < 0.2) newZoom = 0.2;
            if(newZoom > 5) newZoom = 5;

            let rect = cvp.getBoundingClientRect();
            let pointerX = e.clientX - rect.left;
            let pointerY = e.clientY - rect.top;

            let targetCanvasX = (pointerX + cvp.scrollLeft) / currentZoom;
            let targetCanvasY = (pointerY + cvp.scrollTop) / currentZoom;

            setZoom(newZoom);

            cvp.scrollLeft = (targetCanvasX * newZoom) - pointerX;
            cvp.scrollTop = (targetCanvasY * newZoom) - pointerY;
        }
    }, { passive: false });

    document.addEventListener('gesturestart', function (e) { e.preventDefault(); });
    document.addEventListener('gesturechange', function (e) {
        e.preventDefault();
        let cvp = document.getElementById('canvas-viewport');
        if(!cvp) return;

        let newZoom = currentZoom * e.scale;
        if(newZoom < 0.2) newZoom = 0.2;
        if(newZoom > 5) newZoom = 5;

        let rect = cvp.getBoundingClientRect();
        let pointerX = e.clientX - rect.left;
        let pointerY = e.clientY - rect.top;

        let targetCanvasX = (pointerX + cvp.scrollLeft) / currentZoom;
        let targetCanvasY = (pointerY + cvp.scrollTop) / currentZoom;

        setZoom(newZoom);

        cvp.scrollLeft = (targetCanvasX * newZoom) - pointerX;
        cvp.scrollTop = (targetCanvasY * newZoom) - pointerY;
    });
    document.addEventListener('gestureend', function (e) { e.preventDefault(); });

    let cvp2 = document.getElementById('canvas-viewport');
    if (cvp2) {
        let isPinching = false; let initialDistance = null; let initialZoom = 1;
        let pinchScreenX = 0; let pinchScreenY = 0; let targetCanvasX = 0; let targetCanvasY = 0;

        cvp2.addEventListener('touchstart', function(e) {
            if (e.touches.length === 2) {
                isPinching = true;
                initialDistance = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
                initialZoom = currentZoom;

                let rect = cvp2.getBoundingClientRect();
                pinchScreenX = ((e.touches[0].clientX + e.touches[1].clientX) / 2) - rect.left;
                pinchScreenY = ((e.touches[0].clientY + e.touches[1].clientY) / 2) - rect.top;

                targetCanvasX = (pinchScreenX + cvp2.scrollLeft) / initialZoom;
                targetCanvasY = (pinchScreenY + cvp2.scrollTop) / initialZoom;
            }
        }, {passive: false, capture: true});

        cvp2.addEventListener('touchmove', function(e) {
            if (e.touches.length === 2 && isPinching) {
                e.preventDefault(); 
                e.stopPropagation(); 

                let currentDistance = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
                let newZoom = initialZoom * (currentDistance / initialDistance);
                if(newZoom < 0.2) newZoom = 0.2;
                if(newZoom > 5) newZoom = 5;
                setZoom(newZoom);

                let rect = cvp2.getBoundingClientRect();
                let currentPinchX = ((e.touches[0].clientX + e.touches[1].clientX) / 2) - rect.left;
                let currentPinchY = ((e.touches[0].clientY + e.touches[1].clientY) / 2) - rect.top;

                cvp2.scrollLeft = (targetCanvasX * newZoom) - currentPinchX;
                cvp2.scrollTop = (targetCanvasY * newZoom) - currentPinchY;
            }
        }, {passive: false, capture: true});

        cvp2.addEventListener('touchend', function(e) { 
            if (e.touches.length < 2) isPinching = false; 
        }, {passive: false, capture: true});
    }

    goTo("0");
    recenterViewport();
});
