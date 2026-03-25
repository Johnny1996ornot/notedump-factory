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
let lastSavedState = "";

let isDrawMode = false;
let isDrawing = false;
let currentSvgPath = null;
let pathString = "";

const COLORS = ['#ef4444', '#f97316', '#fde047', '#10b981', '#0ea5e9', '#4f46e5', '#8b5cf6', '#64748b', '#94a3b8', '#e2e8f0', '#ffffff', '#0f172a'];

let lastMouseX = 150;
let lastMouseY = 150;

let activePinTabIdx = 0; 
let isDraggingTable = false;

let isPlacingText = false;
let isPlacingSticky = false;

let typingTimer;
const TYPING_DELAY = 800; 

// ==========================================================================
// SECTION 2: UTILITY & HELPER FUNCTIONS
// ==========================================================================
function getHighestZ() {
    let maxZ = 100;
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

$(document).on('keyup mouseup', '.content-area', function() {
    saveSelection();
});

function format(command, value = null) {
    restoreSelection();
    document.execCommand(command, false, value);
    saveHistory();
}

function applyFontSize(size) {
    restoreSelection();
    document.execCommand("fontSize", false, "7");
    let fontElements = document.getElementsByTagName("font");
    for (let i = 0, len = fontElements.length; i < len; ++i) {
        if (fontElements[i].size == "7") {
            fontElements[i].removeAttribute("size");
            fontElements[i].style.fontSize = size + "px";
        }
    }
    saveHistory();
}

function applyLineHeight(val) {
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

$(document).on('mousemove', function(e) {
    lastMouseX = e.clientX;
    lastMouseY = e.clientY;
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

// ==========================================================================
// SECTION 3: STORAGE, PERSISTENCE & EXPORT
// ==========================================================================
function cleanCanvasForSave() {
    let $menu = $('#context-menu').detach();
    let rawHtml = document.getElementById('canvas').innerHTML;
    $('#canvas').append($menu);

    return rawHtml.replace(/ selected-box| selected-cell| pin-active-focus| pin-text-visible| pin-text-left| pin-hover-visible| is-editing-text| is-rotating| is-selected/g, '');
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

async function autoSaveToBrowser() {
    if ($('#canvas').html().length > 100) {
        try {
            await localforage.setItem(`nd_${LECTURE_ID}_canvas`, cleanCanvasForSave());
            await localforage.setItem(`nd_${LECTURE_ID}_nav`, $('#nav-list-container').html());
            await localforage.setItem(`nd_${LECTURE_ID}_pages`, totalPages);
            await localforage.setItem(`nd_${LECTURE_ID}_title`, $('#lecture-title').text());
            await localforage.setItem(`nd_${LECTURE_ID}_width`, parseInt($('#canvas').attr('data-width')) || 816); 
        } catch(e) {
            console.warn("Storage Limit Reached or Database Error.", e);
        }
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
            if (savedTitle) $('#lecture-title').text(savedTitle);
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

        updateCanvasDimensions();
        setZoom(currentZoom);
        bindAudioEvents(); 
    } catch(e) {
        console.warn("Error restoring from IndexedDB", e);
    }
}

function saveHistory() { 
    if (!lastSavedState) lastSavedState = cleanCanvasForSave();
    let currentState = cleanCanvasForSave(); 
    if (lastSavedState !== currentState) {
        noteHistory.push(lastSavedState); 
        if (noteHistory.length > 10) noteHistory.shift(); 
        $('#undo-btn').prop('disabled', false); 
    }
    lastSavedState = currentState;
}

function undo() { 
    if (noteHistory.length > 0) { 
        let $menu = $('#context-menu').detach(); 
        let prevState = noteHistory.pop(); 
        $('#canvas').html(prevState); 
        $('#canvas').append($menu); 
        lastSavedState = cleanCanvasForSave(); 
        if (noteHistory.length === 0) $('#undo-btn').prop('disabled', true); 
        refreshAnnotations(); updateContextMenu(); 
        bindAudioEvents();
        if (isEditing) { 
            interact('.canvas-box').unset(); 
            interact('.pin').unset(); 
            toggleEdit(); toggleEdit(); 
        } 
    } 
}

function showExportModal() {
    $('#export-modal-bg').show();
}

function printToPDF() {
    $('#export-modal-bg').hide();
    if (isEditing) toggleEdit();

    let wasDark = $('body').hasClass('dark');
    let wasScrollMode = currentViewMode === 'scroll';

    $('body').removeClass('dark');
    if (!wasScrollMode) {
        $('#canvas').addClass('scroll-mode');
    }

    setTimeout(() => {
        window.print();
        if (wasDark) $('body').addClass('dark');
        if (!wasScrollMode) {
            $('#canvas').removeClass('scroll-mode');
        }
    }, 500);
}

function saveNotebookToFile() {
    $('#export-modal-bg').hide();

    let wasEditing = isEditing;
    if (isEditing) toggleEdit();

    let documentClone = document.documentElement.cloneNode(true);

    let fullHtml = "<!DOCTYPE html>\n" + documentClone.outerHTML;
    let blob = new Blob([fullHtml], { type: "text/html;charset=utf-8" });
    let link = document.createElement("a");
    link.href = URL.createObjectURL(blob);

    let title = $('#lecture-title').text().trim() || "NoteDump_Saved";
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
    if (isEditing) toggleEdit(); // Force into view mode

    let documentClone = document.documentElement.cloneNode(true);
    let $clone = $(documentClone);

    // Strip out all editing capabilities
    $clone.find('#edit-btn').remove(); 
    $clone.find('.action-btn[title="Add Page"]').remove();
    $clone.find('.action-btn[title="Add Section"]').remove();
    $clone.find('#fab-container').remove(); 
    $clone.find('#canvas-global-tools').remove();
    $clone.find('.del-btn').remove(); 
    $clone.find('.delete-page-btn').remove(); 
    $clone.find('.drag-handle').removeClass('drag-handle'); 
    $clone.find('.pin-drag-handle').removeClass('pin-drag-handle'); 
    $clone.find('.sketch-del').remove(); 
    $clone.find('.sticky-dropdown-tools').remove();
    $clone.find('.ipc-bottom-row').remove(); 

    // Make text areas readonly in the clone
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

function applyCanvasSettings() {
    saveHistory();
    let wCm = parseFloat($('#canvas-w-cm').val()) || 21.6;
    let hCm = parseFloat($('#canvas-h-cm').val()) || 27.9;
    let grid = $('#grid-select').val();
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

            if (currentTop + elH > pxH) { newTop = Math.max(0, pxH - elH - 5); }
            if (currentLeft + elW > pxW) { newLeft = Math.max(0, pxW - elW - 5); }

            if (newTop !== currentTop || newLeft !== currentLeft) {
                $el.css({ top: newTop + 'px', left: newLeft + 'px', transform: 'translate(0px, 0px)' });
                $el.attr('data-x', 0); $el.attr('data-y', 0);
            }
        });

        $page.find('.page-grid-overlay').remove();
        if (grid !== "0") {
            let overlay = `<div class="page-grid-overlay grid-div-${grid}">`;
            let cells = parseInt(grid);
            for(let i=0; i<cells; i++) overlay += `<div class="grid-cell"></div>`;
            overlay += `</div>`;
            $page.prepend(overlay);
        }
    });

    updateCanvasDimensions();
    autoSaveToBrowser();
    updateContextMenu();
}

function changeCanvasHeight(delta) {
    let currentH = parseFloat($('#canvas-h-cm').val()) || 27.9;
    $('#canvas-h-cm').val((currentH + (delta > 0 ? 3 : -3)).toFixed(1));
    applyCanvasSettings();
}

function changeCanvasWidth(delta) {
    let currentW = parseFloat($('#canvas-w-cm').val()) || 21.6;
    $('#canvas-w-cm').val((currentW + (delta > 0 ? 3 : -3)).toFixed(1));
    applyCanvasSettings();
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
        if ($(this).css('top').includes('%')) {
            t = (parseFloat($(this).css('top')) / 100) * nextH; 
        }
        $(this).css('top', (t + currentH) + 'px');
        $currPage.append($(this));
    });

    let $nextSvg = $nextPage.find('svg.draw-layer');
    if ($nextSvg.length > 0) {
        let currSvg = getPageSvg();
        let g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        g.setAttribute('transform', `translate(0, ${currentH})`);

        $nextSvg.find('.drawn-path').each(function() {
            g.appendChild(this);
        });
        if(g.childNodes.length > 0) {
            currSvg.appendChild(g);
        }
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

    if (currentViewMode === 'single') {
        $('#canvas-h-cm').val(Math.round((newH / 37.795) * 10) / 10);
    }

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
        let wrapper = document.getElementById('canvas-center-wrapper');
        let canvas = document.getElementById('canvas');
        if (cvp && wrapper && canvas) {
            let canvasW = parseInt($(canvas).attr('data-width')) || 816;
            let scaledW = canvasW * currentZoom;

            let targetScrollLeft = 400 + (scaledW / 2) - (cvp.clientWidth / 2);
            let targetScrollTop = 90; 

            cvp.scrollLeft = targetScrollLeft;
            cvp.scrollTop = targetScrollTop;
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
        'width': scaledW + 'px',
        'height': scaledH + 'px'
    });

    $('#zoom-slider, #ns-zoom-slider').val(currentZoom); 
    $('#zoom-txt, #ns-zoom-txt').text(Math.round(currentZoom*100)+'%'); 
}

function toggleNotebookView() {
    $('body').toggleClass('notebook-mode');
    let isNotebook = $('body').hasClass('notebook-mode');

    if (isNotebook) {
        if (isEditing) toggleEdit(); 
        $('#sticky-panel').removeClass('open');
        $('#pin-panel').removeClass('open');
        $('body').removeClass('panel-open');
        showToast("📖 Notebook View Activated");
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
// SECTION 5: TOOLS (Search, Image Crop, Context Menu, BG Color)
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

        let hasTable = $sel.find('table').length > 0;
        let hasAudio = $sel.find('.custom-audio-player').length > 0;
        let $activeCell = $('.selected-cell').first();
        let hasImage = $sel.find('img').length > 0 && !hasTable; 

        if ($activeCell.length > 0 || hasTable) {
            $('.menu-table-tools').css('display', 'flex');
            $('.menu-img-tools').hide(); 
            $('.menu-text-tools').css('display', 'flex'); 
            $('.menu-bg-tools').css('display', 'flex'); 
        } else if (hasImage) {
            $('.menu-table-tools').hide();
            $('.menu-text-tools').hide(); 
            $('.menu-bg-tools').hide(); // Hide background tools for images
            $('.menu-img-tools').css('display', 'flex');
        } else if (hasAudio) {
            $('.menu-table-tools').hide();
            $('.menu-img-tools').hide();
            $('.menu-text-tools').hide(); 
            $('.menu-bg-tools').css('display', 'flex'); 
        } else {
            $('.menu-table-tools').hide();
            $('.menu-img-tools').hide();
            $('.menu-text-tools').css('display', 'flex'); 
            $('.menu-bg-tools').css('display', 'flex'); 
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

        let vTop = (cvp.scrollTop - 150) / currentZoom;
        let vLeft = (cvp.scrollLeft - 400) / currentZoom;
        let vRight = vLeft + (cvp.clientWidth / currentZoom);

        let canvasW = parseInt($('#canvas').attr('data-width')) || 816;
        let finalMenuTop = topPos - cHeight - 15;
        let finalMenuLeft = leftPos;

        if (finalMenuLeft < vLeft + 10) finalMenuLeft = vLeft + 10;
        if (finalMenuLeft + cWidth > vRight - 10) finalMenuLeft = vRight - cWidth - 10;
        if (finalMenuLeft + cWidth > canvasW) finalMenuLeft = canvasW - cWidth - 5;

        if (finalMenuTop < vTop + 10) {
            let maxBottom = 0;
            $sel.each(function() {
                let t = parseFloat($(this).css('top')) || 0;
                let ty = parseFloat($(this).attr('data-y')) || 0;
                let h = $(this).outerHeight();
                if (t + ty + h > maxBottom) maxBottom = t + ty + h;
            });
            finalMenuTop = maxBottom + 15;
        }

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

function activateTextPlacement() {
    isPlacingText = true;
    $('#canvas').addClass('text-placement-active');
    showToast("Click anywhere on the page to place your text.");
}

function dropStickyNote() {
    isPlacingSticky = true;
    $('#canvas').addClass('text-placement-active');
    showToast("📍 Click anywhere on the page to drop your sticky note.");
}

function addAudioCenter() { 
    let i = document.createElement('input'); i.type = 'file'; i.accept = 'audio/*'; 
    i.onchange = e => { 
        let file = e.target.files[0];
        if (!file) return;

        let r = new FileReader(); 
        r.readAsDataURL(file); 
        r.onload = ev => { 
            saveHistory(); 
            let coords = getScreenCenterCoords(350, 55);

            let $newAudioContainer = $(`
                <div class="canvas-box selected-box" style="top:${coords.y}px; left:${coords.x}px; width:350px; height:55px; padding:0; z-index:${getHighestZ()}; transform: translate(0px, 0px); border-radius:30px;">
                    <div class="del-btn" onclick="$(this).parent().remove(); updateContextMenu();">X</div>
                    <div class="custom-audio-player">
                        <button class="audio-play-btn"><i class="fas fa-play"></i></button>
                        <div class="audio-track"><div class="audio-progress"></div></div>
                        <span class="audio-time">0:00</span>
                        <div class="audio-expanded-controls">
                            <button class="audio-skip-btn" data-skip="-10" title="Back 10s"><i class="fas fa-undo"></i></button>
                            <button class="audio-skip-btn" data-skip="10" title="Forward 10s"><i class="fas fa-redo"></i></button>
                            <button class="audio-speed-btn" title="Playback Speed">1x</button>
                        </div>
                        <audio src="${ev.target.result}" style="display:none;"></audio>
                    </div>
                </div>
            `);

            $(`#p-${current}`).append($newAudioContainer); 

            $newAudioContainer.find('audio').on('loadedmetadata', function() {
                $(this).siblings('.audio-time').text('0:00 / ' + formatTime(this.duration));
            });

            if(isEditing) { toggleEdit(); toggleEdit(); } 
            updateContextMenu(); 
        }; 
    }; 
    i.click(); 
}

$(document).on('click', '.audio-skip-btn', function(e) {
    e.stopPropagation();
    let audio = $(this).closest('.custom-audio-player').find('audio')[0];
    if (audio) audio.currentTime += parseFloat($(this).attr('data-skip'));
});

$(document).on('click', '.audio-speed-btn', function(e) {
    e.stopPropagation();
    let audio = $(this).closest('.custom-audio-player').find('audio')[0];
    if (!audio) return;
    let speeds = [1, 1.25, 1.5, 2];
    let nextSpeed = speeds[(speeds.indexOf(audio.playbackRate) + 1) % speeds.length] || 1;
    audio.playbackRate = nextSpeed;
    $(this).text(nextSpeed + 'x');
});

$(document).on('click', '.audio-play-btn', function(e) {
    e.stopPropagation(); 
    let $player = $(this).closest('.custom-audio-player');
    let audio = $player.find('audio')[0];
    let $icon = $(this).find('i');

    if (audio.paused) {
        $('audio').each(function(){ 
            if(this !== audio) {
                this.pause(); 
                $(this).siblings('.audio-play-btn').find('i').removeClass('fa-pause').addClass('fa-play'); 
            }
        });
        audio.play();
        $icon.removeClass('fa-play').addClass('fa-pause');
    } else {
        audio.pause();
        $icon.removeClass('fa-pause').addClass('fa-play');
    }
});

$(document).on('click', '.audio-track', function(e) {
    e.stopPropagation();
    let audio = $(this).siblings('audio')[0];
    if (audio && audio.duration) {
        let pct = e.offsetX / $(this).width();
        audio.currentTime = pct * audio.duration;
        $(this).find('.audio-progress').css('width', (pct * 100) + '%');
    }
});

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
    let idx = $cell.index();
    let $table = $cell.closest('table');
    $table.find('tr').each(function() {
        $(this).children().eq(idx).addClass('selected-cell');
    });
    updateContextMenu();
}

function addTableRow() {
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
}

function addTableCol() {
    saveHistory();
    let $cell = $('.selected-cell').first();
    if($cell.length === 0) return showToast("Click a cell first!");
    let idx = $cell.index();
    let $table = $cell.closest('table');
    $table.find('tr').each(function() {
        $(this).children().eq(idx).after(`<td style="border: 1px solid #cbd5e1; padding: 4px 6px; word-break: break-word; white-space: pre-wrap; vertical-align: top; overflow:hidden;"><br></td>`);
    });
    equalizeTable();
}

function delTableRow() {
    saveHistory();
    let $cell = $('.selected-cell').first();
    if($cell.length === 0) return showToast("Click a cell first!");
    $cell.closest('tr').remove();
    equalizeTable();
    updateContextMenu();
}

function delTableCol() {
    saveHistory();
    let $cell = $('.selected-cell').first();
    if($cell.length === 0) return showToast("Click a cell first!");
    let idx = $cell.index();
    let $table = $cell.closest('table');
    $table.find('tr').each(function() {
        $(this).children().eq(idx).remove();
    });
    equalizeTable();
    updateContextMenu();
}

function equalizeTable() {
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
    let percH = (100 / numRows).toFixed(4) + '%';

    // Force strict table layout and strip bad inline styles
    $table.removeAttr('style').css({
        'table-layout': 'fixed',
        'width': '100%',
        'height': '100%',
        'border-collapse': 'collapse',
        'font-size': '12px',
        'margin': '0',
        'padding': '0'
    });

    let colgroupHtml = "";
    for(let c=0; c<maxCols; c++){
        colgroupHtml += `<col style="width:${percW};">`;
    }

    $table.find('colgroup').remove();
    $table.prepend(`<colgroup>${colgroupHtml}</colgroup>`);

    $table.find('tr').css('height', percH);

    // Aggressively force cells to obey math
    $table.find('td, th').each(function() {
        $(this).css({
            'width': percW,
            'height': percH,
            'border': '1px solid #cbd5e1',
            'padding': '4px 6px',
            'word-break': 'break-word',
            'white-space': 'pre-wrap',
            'vertical-align': 'top',
            'overflow': 'hidden',
            'resize': 'none'
        });
    });

    showToast("Table dimensions updated & equalized!");
}

function mergeTableCells() {
    saveHistory();
    let $cells = $('.selected-cell');
    if($cells.length < 2) return showToast("Select at least 2 cells to merge (Hold Shift and Click cells)");

    let $table = $cells.first().closest('table');
    let minR = 9999, maxR = -1, minC = 9999, maxC = -1;

    $cells.each(function() {
        let r = $(this).closest('tr').index();
        let c = $(this).index();
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
}

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
                $(`#p-${current}`).append(`<div class="canvas-box selected-box" style="top:${coords.y}px;left:${coords.x}px;width:300px;max-width:calc(800px - ${coords.x}px);z-index:${getHighestZ()};transform: translate(0px, 0px);"><div class="del-btn" onclick="$(this).parent().remove(); updateContextMenu();">X</div><img src="${ev.target.result}" style="width:100%"></div>`); 
            }
            if(isEditing) { toggleEdit(); toggleEdit(); } 
            updateContextMenu(); 
        }; 
    }; 
    i.click(); 
}

// ==========================================================================
// SECTION 7: PINS & ANNOTATIONS SYSTEM
// ==========================================================================
function addPinToSelectedImage() {
    saveHistory();
    let $box = $('.selected-box').first();
    if ($box.length === 0) return;

    let highestOrder = -1;
    $(`#p-${current} .pin`).each(function() {
        let o = parseInt($(this).attr('data-order')) || 0;
        if (o > highestOrder) highestOrder = o;
    });

    $box.append(`
        <div class="pin" data-type="pin" data-shape="marker" data-note="Image Pin" data-angle="0" data-order="${highestOrder + 1}" style="top:50%; left:50%; width:32px; height:32px; margin-top:-16px; margin-left:-16px; transform: translate(0px, 0px); opacity:1; --pin-color: #ef4444;">
            <div class="pin-rotator-group" style="transform: rotate(0deg);">
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
});

$(document).on('mousemove touchmove', function(e) {
    if(isRotatingPin && activePinToRotate) {
        e.preventDefault(); 

        let clientX = e.clientX || (e.originalEvent.touches && e.originalEvent.touches[0].clientX);
        let clientY = e.clientY || (e.originalEvent.touches && e.originalEvent.touches[0].clientY);

        let rect = activePinToRotate[0].getBoundingClientRect();

        let centerX = rect.left + (rect.width / 2);
        let centerY = rect.top + (rect.height / 2); 

        let angle = Math.atan2(clientY - centerY, clientX - centerX) * (180 / Math.PI);
        let visualAngle = angle + 90;

        activePinToRotate.attr('data-angle', visualAngle);
        activePinToRotate.find('.pin-rotator-group').css('transform', `rotate(${visualAngle}deg)`);
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
    $pin.find('.pin-rotator-group').css('transform', `rotate(${val}deg)`);
}

function updatePinStyle(origIdx, property, value) {
    debouncedSaveHistory(); 
    let $pin = getPinEl(origIdx);
    let $visual = $pin.find('.pin-visual');

    if(property === 'size') { 
        let s = parseInt(value);
        if ($pin.attr('data-type') === 'pin') {
            $pin.css({width: s + 'px', height: s + 'px', marginTop: -(s/2) + 'px', marginLeft: -(s/2) + 'px'}); 
        } else {
            $visual.css({width: s + 'px', height: s + 'px'}); 
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

    if (currentShape === 'marker') { nextShape = 'arrow'; iconClass = 'fa-location-arrow'; }
    else if (currentShape === 'arrow') { nextShape = 'triangle'; iconClass = 'fa-caret-up'; }
    else { nextShape = 'marker'; iconClass = 'fa-map-marker-alt'; }

    $pin.attr('data-shape', nextShape);

    let $btn = $(`#btn-img-shape-${origIdx} i`);
    $btn.removeClass('fa-map-marker-alt fa-location-arrow fa-caret-up').addClass(iconClass);
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

$(document).on('click', function(e) {
    if (!$(e.target).closest('.sticky-left-col').length && !$(e.target).closest('.sticky-dropdown').length) {
        $('.sticky-dropdown').addClass('hidden');
    }
});

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

function focusPin(origIdx) { getPinEl(origIdx).addClass('pin-active-focus'); }
function unfocusPin(origIdx) { getPinEl(origIdx).removeClass('pin-active-focus'); }
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

        annos.push({ 
            el: $(this),
            originalIndex: i, 
            order: parseInt($(this).attr('data-order')),
            y: offset ? offset.top : 0, 
            note: $(this).attr('data-note'), 
            color: pColor, 
            size: $(this).width(), 
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
        $panelBody.html("<p style='text-align:center; font-size:10px; color:#64748b; padding:10px;'>No image pins on this page.<br><br>Click an image and use the Blue Pin button to add one.</p>");
    } else {
        $toolsRow.css('justify-content', 'flex-start');

        if (activePinTabIdx >= numImages) activePinTabIdx = 0;
        let hasMultipleImages = numImages > 1;
        let paneIndexCounter = 0;

        let $tabsRow = $('<div class="pin-tabs-row"></div>');
        $toolsRow.append($tabsRow);

        let orderedParents = $(`#p-${current} .canvas-box`).toArray();
        let sortedParents = Array.from(groupedData.images.keys()).sort((a,b) => orderedParents.indexOf(a) - orderedParents.indexOf(b));

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

                let shapeIcon = p.shape === 'arrow' ? 'fa-location-arrow' : (p.shape === 'triangle' ? 'fa-caret-up' : 'fa-map-marker-alt');

                let cardStr = `
                    <div id="anno-card-${p.originalIndex}" class="custom-image-pin-layout" data-orig-idx="${p.originalIndex}" title="${safeNote}" onmouseenter="focusPin(${p.originalIndex})" onmouseleave="unfocusPin(${p.originalIndex})">
                        <div class="ipc-top-row">
                            <div class="ipc-left-col ipc-tool-item">
                                <div class="sketch-btn sketch-num pin-drag-handle" title="Drag to reorder" style="background:#1e293b; color:white; width:28px; height:28px; border-radius:4px;">#${displayNum}</div>
                                <label class="sketch-color-wrap pin-tool-item" title="Color" style="background-color: #${hex}; border-radius:50%; width:28px; height:28px;">
                                    <input type="color" value="#${hex}" onchange="updatePinStyle(${p.originalIndex}, 'background', this.value)">
                                </label>
                                <button id="btn-img-shape-${p.originalIndex}" class="sketch-btn" onclick="toggleImagePinShape(${p.originalIndex})" title="Change Shape" style="width:28px; height:28px; background:#1e293b;"><i class="fas ${shapeIcon}"></i></button>
                            </div>
                            <div class="ipc-right-col" style="display:flex; flex-direction:column; justify-content:space-between;">
                                <textarea id="pin-text-${p.originalIndex}" class="sketch-textarea" oninput="updatePinText(${p.originalIndex}, this.value)" placeholder="Image Pin Note..." style="flex-grow:1; margin-bottom:6px; min-height:45px;">${p.note}</textarea>

                                <div class="ipc-bottom-row ipc-tool-item" style="display: flex; gap: 6px; align-items: center; margin-top: auto;">
                                    <div class="ipc-size-bar" style="flex:1; background:#1e293b; padding: 0 10px; border-radius: 6px; display: flex; align-items: center; gap: 8px; height:28px;">
                                        <span style="font-size:10px; font-weight:bold; color:#cbd5e1; text-transform:uppercase;">Size</span>
                                        <input type="range" min="15" max="100" value="${p.size}" class="sexy-slider" oninput="updatePinStyle(${p.originalIndex}, 'size', this.value)">
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
                <div id="anno-card-${p.originalIndex}" class="custom-sticky-card" data-orig-idx="${p.originalIndex}" title="${safeNote}" onmouseenter="focusPin(${p.originalIndex})" onmouseleave="unfocusPin(${p.originalIndex})">

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
// SECTION 8: DRAWING & SVG SYSTEM
// ==========================================================================
function toggleDrawMode() {
    if(!isEditing) return;
    isDrawMode = !isDrawMode;
    $('#draw-btn').toggleClass('draw-active', isDrawMode);

    if (isDrawMode) {
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
        $('#draw-btn').removeClass('draw-active');
        $('#canvas').removeClass('drawing-active');
        $('.canvas-box, .pin').css('pointer-events', 'auto');
    }

    $('.content-area').attr('contenteditable', isEditing); 
    $('.nav-text').attr('contenteditable', isEditing); 

    refreshAnnotations();
    updateContextMenu();

    if(isEditing) {
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

                    target.style.width = (currentW + (event.deltaRect.width / currentZoom)) + 'px'; 
                    target.style.height = (currentH + (event.deltaRect.height / currentZoom)) + 'px';

                    x += (event.deltaRect.left / currentZoom); 
                    y += (event.deltaRect.top / currentZoom);

                    target.style.transform = `translate(${x}px, ${y}px)`; 
                    target.setAttribute('data-x', x); 
                    target.setAttribute('data-y', y);

                    if ($(target).find('.custom-audio-player').length > 0) {
                        if (currentW < 280) {
                            $(target).find('.custom-audio-player').addClass('mid-player');
                        } else {
                            $(target).find('.custom-audio-player').removeClass('mid-player');
                        }
                        if (currentW < 160) {
                            $(target).find('.custom-audio-player').addClass('mini-player');
                        } else {
                            $(target).find('.custom-audio-player').removeClass('mini-player');
                        }
                    }

                    updateContextMenu();
                }
            }
        }).draggable({ 
            modifiers: [ interact.modifiers.restrictRect({ restriction: '#canvas', endOnly: false }) ],
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
                }, end: refreshAnnotations 
            }
        });

        interact('.pin').draggable({ 
            modifiers: [ interact.modifiers.restrictRect({ restriction: 'parent', endOnly: false }) ],
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
                        let pinRect = $pin[0].getBoundingClientRect();
                        let boxRect = $pin.parent()[0].getBoundingClientRect();

                        let relLeft, relTop;
                        if ($pin.attr('data-type') === 'pin') {
                            let pinCenterX = pinRect.left + (pinRect.width / 2);
                            let pinCenterY = pinRect.top + (pinRect.height / 2);
                            relLeft = pinCenterX - boxRect.left;
                            relTop = pinCenterY - boxRect.top;
                        } else {
                            relLeft = pinRect.left - boxRect.left;
                            relTop = pinRect.top - boxRect.top;
                        }

                        let percLeft = (relLeft / boxRect.width) * 100;
                        let percTop = (relTop / boxRect.height) * 100;

                        $pin.css({ transform: 'translate(0px, 0px)', left: percLeft + '%', top: percTop + '%' });
                        $pin.attr('data-x', 0).attr('data-y', 0);
                    }
                    refreshAnnotations(); 
                }
            }
        });
    } else { 
        interact('.canvas-box').unset(); 
        interact('.pin').unset(); 
        $('.canvas-box').removeClass('selected-box'); 
        updateContextMenu();
    }
}

function syncListSizes() {
    $('.content-area li').each(function() {
        let $font = $(this).find('font').first();
        if ($font.length && $font.attr('size')) {
            let sz = $font.attr('size');
            let pxMap = {'1':'12px','2':'14px','3':'16px','4':'18px','5':'24px','6':'32px','7':'48px'};
            if(pxMap[sz]) $(this).css('font-size', pxMap[sz]);
        } else {
            let $span = $(this).find('span').first();
            if ($span.length && $span.css('font-size')) {
                $(this).css('font-size', $span.css('font-size'));
            }
        }
    });
}

// ==========================================================================
// SECTION 10: INITIALIZATION & GLOBAL EVENTS
// ==========================================================================
$(document).ready(async function() {
    await restoreFromBrowser(); 
    lastSavedState = cleanCanvasForSave(); 

    $(document).on('keydown', '.sketch-textarea', function(e) {
        if (e.key === 'Enter') {
            let ta = this;
            let start = ta.selectionStart;
            let val = ta.value;

            let lineStart = val.lastIndexOf('\n', start - 1) + 1;
            let currentLine = val.substring(lineStart, start);

            let numMatch = currentLine.match(/^(\s*)(\d+)\.\s(.*)$/);
            let bulletMatch = currentLine.match(/^(\s*)(•\s)(.*)$/);

            if (numMatch) {
                e.preventDefault();
                let spaces = numMatch[1];
                let currentNum = parseInt(numMatch[2]);
                let textAfter = numMatch[3];

                if (textAfter.trim() === '') {
                    ta.value = val.substring(0, lineStart) + val.substring(start);
                    ta.selectionStart = ta.selectionEnd = lineStart;
                } else {
                    let nextPrefix = '\n' + spaces + (currentNum + 1) + '. ';
                    ta.value = val.substring(0, start) + nextPrefix + val.substring(ta.selectionEnd);
                    ta.selectionStart = ta.selectionEnd = start + nextPrefix.length;
                }
                $(ta).trigger('input');
            } else if (bulletMatch) {
                e.preventDefault();
                let spaces = bulletMatch[1];
                let textAfter = bulletMatch[3];

                if (textAfter.trim() === '') {
                    ta.value = val.substring(0, lineStart) + val.substring(start);
                    ta.selectionStart = ta.selectionEnd = lineStart;
                } else {
                    let nextPrefix = '\n' + spaces + '• ';
                    ta.value = val.substring(0, start) + nextPrefix + val.substring(ta.selectionEnd);
                    ta.selectionStart = ta.selectionEnd = start + nextPrefix.length;
                }
                $(ta).trigger('input');
            }
        }
    });

    setInterval(() => {
        $('audio').each(function() {
            if (!this.paused) {
                let duration = this.duration || 1;
                let pct = (this.currentTime / duration) * 100;
                if(isNaN(pct) || !isFinite(pct)) pct = 0;
                $(this).siblings('.audio-track').find('.audio-progress').css('width', pct + '%');

                let timeText = formatTime(this.currentTime) + (this.duration ? ' / ' + formatTime(this.duration) : '');
                $(this).siblings('.audio-time').text(timeText);
            }
        });
    }, 250);

    setInterval(autoSaveToBrowser, 30000); 

    interact('.draggable-nav').draggable({
        listeners: {
            move(event) {
                let target = event.target;
                let x = (parseFloat(target.getAttribute('data-x')) || 0) + event.dx;
                let y = (parseFloat(target.getAttribute('data-y')) || 0) + event.dy;
                target.style.transform = `translate(${x}px, ${y}px)`;
                target.setAttribute('data-x', x);
                target.setAttribute('data-y', y);
            }
        }
    });

    interact('#menu-drag-handle').draggable({
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

    $(document).on('mouseenter', '.pin', function() {
        let idx = $(this).attr('data-list-idx');
        let $card = $(`#anno-card-${idx}`);
        $('.sketch-pin-card, .custom-sticky-card, .custom-image-pin-layout').removeClass('highlight-card');

        if ($card.length) {
            $card.addClass('highlight-card');
        }

        let viewportWidth = $('#canvas-viewport').width();
        let pinRect = this.getBoundingClientRect();
        let viewportRect = document.getElementById('canvas-viewport').getBoundingClientRect();
        let pinXFromViewport = pinRect.left - viewportRect.left;

        if (pinXFromViewport + 220 > viewportWidth) {
            $(this).addClass('pin-text-left');
        } else {
            $(this).removeClass('pin-text-left');
        }
        $(this).addClass('pin-hover-visible');
    });

    $(document).on('mouseleave', '.pin', function() {
        $('.sketch-pin-card, .custom-sticky-card, .custom-image-pin-layout').removeClass('highlight-card');
        $(this).removeClass('pin-hover-visible pin-text-left');
    });

    if (window.innerWidth <= 768) { 
        if (window.innerWidth <= 840) setZoom(window.innerWidth / 840);
        if (!$('body').hasClass('notebook-mode')) toggleNotebookView(); 
    }

    $(window).on('resize', function() { 
        if (window.innerWidth <= 840) setZoom(window.innerWidth / 840); 
    });

    $(window).on('blur', function() { customClipboard = []; });

    $('#search-input, #ns-search-input').on('input', function() { 
        let val = $(this).val();
        if(this.id === 'search-input') $('#ns-search-input').val(val);
        else $('#search-input').val(val);
        performSearch(val); 
    });

    $('#search-input, #ns-search-input').on('keydown', function(e) {
        if (e.key === 'Enter') { e.preventDefault(); goToNextMatch(); }
    });

    $('.nav-link').each(function() {
        let id = $(this).attr('id').replace('link-', '');
        if ($(this).find('.delete-page-btn').length === 0) {
            $(this).append(`<i class="fas fa-times delete-page-btn" onclick="deletePage('${id}', event)" title="Delete Page"></i>`);
        }
    });

    let navList = document.getElementById('nav-list-container');
    if (navList) {
        new Sortable(navList, {
            animation: 150, 
            handle: '.drag-handle',
            fallbackOnBody: true,
            swapThreshold: 0.65,
            onEnd: function (evt) {
                saveHistory(); 
                let newOrder = [];
                $('#nav-list-container .nav-link').each(function() { newOrder.push($(this).attr('id').replace('link-', '')); });
                newOrder.forEach(id => { $('#canvas').append($(`#p-${id}`)); });
                autoSaveToBrowser(); 
            }
        });
    }

    let colorHtml = "";
    COLORS.forEach(c => { colorHtml += `<div class="color-swatch" style="background:${c};" data-color="${c}" onmousedown="event.preventDefault();"></div>`; });
    $('#text-color-grid, #bg-color-grid').html(colorHtml);

    $(document).on('click', '#text-color-grid .color-swatch', function(e) { 
        e.preventDefault();
        restoreSelection();
        document.execCommand('styleWithCSS', false, true);
        document.execCommand('foreColor', false, $(this).attr('data-color'));
        saveHistory();
    });

    $(document).on('click', '#bg-color-grid .color-swatch', function(e) { 
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

    $(document).on('input', '.content-area', syncListSizes);

    $(document).on('input', '.content-area, .sketch-textarea', function() {
        clearTimeout(typingTimer);
        typingTimer = setTimeout(function() {
            saveHistory();
        }, TYPING_DELAY);
    });

    $(document).on('focusin', '.content-area', function() {
        $(this).addClass('is-editing-text');
        if (!lastSavedState) lastSavedState = cleanCanvasForSave();
    });

    $(document).on('focusout', '.content-area', function() {
        $(this).removeClass('is-editing-text');
        clearTimeout(typingTimer); 
        saveHistory(); 
    });

    $(document).on('click', '.pin', function(e) {
        if (isPlacingSticky) return;
        e.stopPropagation();
        let isVisible = $(this).hasClass('pin-text-visible');
        $('.pin').removeClass('pin-text-visible pin-text-left pin-hover-visible');
        if (!isVisible) { $(this).addClass('pin-text-visible'); }
    });

    $(document).on('click', function(e) {
        if (isPlacingSticky) return;
        $('.pin').removeClass('pin-text-visible pin-text-left pin-hover-visible');
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
                updateContextMenu(); 
                return;
            }
        }

        if (e.ctrlKey && e.key.toLowerCase() === 's') { e.preventDefault(); showExportModal(); return; }
        if (e.ctrlKey && e.key.toLowerCase() === 'f') {
            e.preventDefault();
            if (window.innerWidth <= 768) { toggleNav(); }
            $('#search-input').focus(); return;
        }
        if (e.ctrlKey && e.key.toLowerCase() === 'z' && !isTyping) { e.preventDefault(); undo(); return; }
        if (!isTyping && e.which == 37) { prevPage(); e.preventDefault(); }
        if (!isTyping && e.which == 39) { nextPage(); e.preventDefault(); }

        if (isEditing) {
            if (e.ctrlKey && e.key.toLowerCase() === 'c' && !isTyping) { 
                customClipboard = []; 
                $('.selected-box').each(function() { customClipboard.push($(this)[0].outerHTML); }); 
            }
            if (e.ctrlKey && e.key.toLowerCase() === 'v' && !isTyping) {
                if(customClipboard.length > 0) {
                    e.preventDefault(); saveHistory(); $('.canvas-box').removeClass('selected-box'); 

                    let coords = getPasteCoords();

                    customClipboard.forEach((htmlStr, idx) => {
                        let $newBox = $(htmlStr);
                        $newBox.attr('data-x', 0);
                        $newBox.attr('data-y', 0);

                        let placeX = coords.x + (idx * 20);
                        let placeY = coords.y + (idx * 20);

                        $newBox.css({ top: placeY + 'px', left: placeX + 'px', transform: 'translate(0px, 0px)' });
                        $newBox.addClass('selected-box'); $(`#p-${current}`).append($newBox);
                    });
                    updateContextMenu();
                }
            }
        }
    });

    $(document).on('paste', function(e) {
        if (!isEditing) return;
        let isTyping = $(e.target).is('textarea, [contenteditable="true"]:focus, input:focus');
        if (isTyping) return; 

        let items = (e.originalEvent || e).clipboardData.items;
        let pastedImage = false;
        let coords = getPasteCoords();

        let pastedHtml = (e.originalEvent || e).clipboardData.getData('text/html');
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

        for (let i = 0; i < items.length; i++) {
            if (items[i].type.indexOf("image") === 0) {
                e.preventDefault();
                let file = items[i].getAsFile();
                let r = new FileReader();
                r.onload = ev => {
                    saveHistory();
                    $('.canvas-box').removeClass('selected-box');
                    $(`#p-${current}`).append(`<div class="canvas-box selected-box" style="top:${coords.y}px;left:${coords.x}px;width:300px;max-width:calc(800px - ${coords.x}px);z-index:${getHighestZ()};transform: translate(0px, 0px);"><div class="del-btn" onclick="$(this).parent().remove(); updateContextMenu();">X</div><img src="${ev.target.result}" style="width:100%"></div>`);
                    updateContextMenu();
                };
                r.readAsDataURL(file);
                pastedImage = true; break;
            }
        }

        if (!pastedImage) {
            let pastedText = (e.originalEvent || e).clipboardData.getData('text/plain');
            if (pastedText && pastedText.trim() !== "") {
                e.preventDefault(); saveHistory(); $('.canvas-box').removeClass('selected-box');
                let safeText = $('<div>').text(pastedText).html().replace(/\n/g, '<br>');
                $(`#p-${current}`).append(`<div class="canvas-box selected-box" style="top:${coords.y}px;left:${coords.x}px;width:300px;max-width:calc(800px - ${coords.x}px);z-index:${getHighestZ()};background-color:transparent;transform: translate(0px, 0px);"><div class="del-btn" onclick="$(this).parent().remove(); updateContextMenu();">X</div><div class="content-area" contenteditable="true" style="width: 100%; height: 100%; box-sizing: border-box; word-break: break-word; white-space: pre-wrap; overflow-wrap: break-word;">${safeText}</div></div>`);
                updateContextMenu();
            }
        }
    });

    $(document).on('mousedown', '.canvas-box table td, .canvas-box table th', function(e) {
        if(!isEditing) return;
        e.stopPropagation(); 
        isDraggingTable = true;
        if(!e.shiftKey && !e.ctrlKey && !e.metaKey) {
            $(this).closest('table').find('td, th').removeClass('selected-cell');
        }
        $(this).addClass('selected-cell');

        let $box = $(this).closest('.canvas-box');
        if(!$box.hasClass('selected-box')) {
            $('.canvas-box').removeClass('selected-box');
            $box.addClass('selected-box');
        }

        if ($(this).closest('.canvas-box').find('.pin').length > 0) {
            switchTabToBox($box);
        }

        updateContextMenu();
    });

    $(document).on('mouseenter', '.canvas-box table td, .canvas-box table th', function(e) {
        if(!isEditing || !isDraggingTable) return;
        $(this).addClass('selected-cell');
    });

    $(document).on('mouseup', function() {
        isDraggingTable = false;
    });

    $(document).on('mousedown', function(e) {
        if (isPlacingSticky) {
            let $page = $(e.target).closest('.page');
            if ($page.length === 0) $page = $(`#p-${current}`);

            let rect = $page[0].getBoundingClientRect();
            let x = (e.clientX - rect.left) / currentZoom;
            let y = (e.clientY - rect.top) / currentZoom;

            isPlacingSticky = false;
            $('#canvas').removeClass('text-placement-active');

            saveHistory();
            let highestOrder = -1;
            $(`#p-${current} .pin`).each(function() {
                let o = parseInt($(this).attr('data-order')) || 0;
                if (o > highestOrder) highestOrder = o;
            });
            $page.append(`
                <div class="pin" data-type="sticky" data-shape="square" data-note="Sticky Note" data-angle="0" data-order="${highestOrder + 1}" style="top:${y}px;left:${x}px; margin-top:-12px; margin-left:-12px; transform: translate(0px, 0px); opacity:1; --pin-color: #fde047;">
                    <div class="pin-rotator-group" style="transform: rotate(0deg);">
                        <div class="pin-visual"></div>
                    </div>
                </div>
            `);
            refreshAnnotations();
            if(!$('#sticky-panel').hasClass('open')) togglePanel('sticky');
            e.preventDefault();
            return;
        }

        if (isPlacingText) {
            let $page = $(e.target).closest('.page');
            if ($page.length === 0) $page = $(`#p-${current}`);

            let rect = $page[0].getBoundingClientRect();
            let x = (e.clientX - rect.left) / currentZoom;
            let y = (e.clientY - rect.top) / currentZoom;

            isPlacingText = false;
            $('#canvas').removeClass('text-placement-active');

            saveHistory();
            $('.canvas-box').removeClass('selected-box');
            $page.append(`<div class="canvas-box selected-box" style="top:${y}px;left:${x}px;width:200px; height:auto; z-index:${getHighestZ()}; background:transparent; transform: translate(0px, 0px);"><div class="del-btn" onclick="$(this).parent().remove(); updateContextMenu();">X</div><div class="content-area" contenteditable="true" style="width:100%; height:100%; box-sizing:border-box; word-break:break-word; white-space:pre-wrap; outline:none;">New Text</div></div>`);
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

            if ($box.find('.pin').length > 0) {
                switchTabToBox($box);
            }

            let $ca = $box.find('.content-area');
            if ($ca.length > 0) {
                let computedSize = window.getComputedStyle($ca[0]).fontSize;
                if (computedSize) {
                    let pxVal = Math.round(parseFloat(computedSize));
                    let select = document.getElementById('font-size-select');
                    if (select) {
                        let optionExists = Array.from(select.options).some(opt => opt.value == pxVal);
                        if (!optionExists) {
                            $(select).find('.dynamic-opt').remove();
                            $(select).append(`<option value="${pxVal}" class="dynamic-opt">${pxVal}</option>`);
                        }
                        select.value = pxVal;
                    }
                }
            }

            updateContextMenu();
            if ($(e.target).closest('.content-area, .audio-play-btn, .audio-track, .audio-skip-btn, .audio-speed-btn, .pin-rotate-dot, .pin-rotation-ring').length > 0) { return; }
            if(!$(e.target).is(':focus')) { e.preventDefault(); }
            return;
        }

        if ($(e.target).is('#canvas, .page, .page-grid-overlay')) {
            $('.canvas-box').removeClass('selected-box');
            $('.canvas-box table td, .canvas-box table th').removeClass('selected-cell');
            updateContextMenu();
        }

        if (isDrawMode) {
            if ($(e.target).closest('.tool-group, #nav, .floating-panel').length > 0) return;

            isDrawing = true;
            let rect = $(`#p-${current}`)[0].getBoundingClientRect();
            let x = (e.clientX - rect.left) / currentZoom;
            let y = (e.clientY - rect.top) / currentZoom;

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

    $('.canvas-box').each(function() {
        if ($(this).find('.del-btn').length === 0) {
            $(this).prepend('<div class="del-btn" onclick="saveHistory(); $(this).parent().remove(); updateContextMenu();">X</div>');
        }
    });

    $(document).on('mousemove', function(e) {
        if (!isDrawing || !currentSvgPath) return;
        let rect = $(`#p-${current}`)[0].getBoundingClientRect();
        let x = (e.clientX - rect.left) / currentZoom;
        let y = (e.clientY - rect.top) / currentZoom;

        pathString += ` L ${x} ${y}`;
        currentSvgPath.setAttribute('d', pathString);
    });

    $(document).on('mouseup', function(e) {
        if (isDrawing) {
            isDrawing = false;
            currentSvgPath = null;
            saveHistory();
        }
    });

    $(document).on('dblclick', '.drawn-path', function(e) {
        if(isEditing && isDrawMode) {
            $(this).remove();
            saveHistory();
        }
    });

    document.addEventListener('wheel', function(e) {
        if (e.ctrlKey || e.metaKey) {
            e.preventDefault(); 

            let cvp = document.getElementById('canvas-viewport');
            if(!cvp) return;

            let zoomDelta = e.deltaY * -0.005; 
            let newZoom = currentZoom * (1 + zoomDelta); 
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

    let cvp = document.getElementById('canvas-viewport');
    if (cvp) {
        let isPinching = false; let initialDistance = null; let initialZoom = 1;
        let pinchScreenX = 0; let pinchScreenY = 0; let targetCanvasX = 0; let targetCanvasY = 0;

        cvp.addEventListener('touchstart', function(e) {
            if (e.touches.length === 2) {
                isPinching = true;
                initialDistance = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
                initialZoom = currentZoom;
                pinchScreenX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
                pinchScreenY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
                let rect = cvp.getBoundingClientRect();
                targetCanvasX = (pinchScreenX + cvp.scrollLeft - rect.left) / initialZoom;
                targetCanvasY = (pinchScreenY + cvp.scrollTop - rect.top) / initialZoom;
            }
        }, {passive: false});

        cvp.addEventListener('touchmove', function(e) {
            if (e.touches.length === 2 && isPinching) {
                e.preventDefault(); 
                let currentDistance = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
                let newZoom = initialZoom * (currentDistance / initialDistance);
                if(newZoom < 0.2) newZoom = 0.2;
                if(newZoom > 5) newZoom = 5;
                setZoom(newZoom);
                let rect = cvp.getBoundingClientRect();
                cvp.scrollLeft = (targetCanvasX * newZoom) - pinchScreenX + rect.left;
                cvp.scrollTop = (targetCanvasY * newZoom) - pinchScreenY + rect.top;
            }
        }, {passive: false});

        cvp.addEventListener('touchend', function(e) { if (e.touches.length < 2) isPinching = false; });
    }

    goTo("0");
    recenterViewport();
});
