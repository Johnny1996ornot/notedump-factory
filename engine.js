let current = "0"; 
let isEditing = false; 
let noteHistory = []; 
let customClipboard = []; 
let cropperInstance = null; 
let currentZoom = 1; 

let chaptersData = [];
let allPagesMap = {};
let searchResults = [];
let currentSearchIndex = -1;
let currentViewMode = 'single';

let savedSelection = null;

const COLORS = ['#FF5252', '#FF9800', '#FFEB3B', '#4CAF50', '#2196F3', '#9C27B0', '#795548', '#BCAAA4', '#9E9E9E', '#E0E0E0', '#FFFFFF', '#000000'];

function cleanCanvasForSave() {
    let $c = $('#canvas').clone();
    $c.find('mark.search-hi').each(function() { $(this).replaceWith($(this).text()); });
    $c.find('.pin').removeClass('pin-search-match pin-active-focus active-pin-match');
    return $c.html();
}

function autoSaveToBrowser() {
    if ($('#canvas').html().length > 100) {
        localStorage.setItem(`nd_${LECTURE_ID}_canvas`, cleanCanvasForSave());
        localStorage.setItem(`nd_${LECTURE_ID}_nav`, $('#nav-list-container').html());
        localStorage.setItem(`nd_${LECTURE_ID}_pages`, totalPages);
        localStorage.setItem(`nd_${LECTURE_ID}_title`, $('#lecture-title').text());
        localStorage.setItem(`nd_${LECTURE_ID}_width`, parseInt($('#canvas').attr('data-width')) || 800); 
    }
}

function restoreFromBrowser() {
    let savedCanvas = localStorage.getItem(`nd_${LECTURE_ID}_canvas`);
    let savedNav = localStorage.getItem(`nd_${LECTURE_ID}_nav`);
    let savedTitle = localStorage.getItem(`nd_${LECTURE_ID}_title`);
    let savedWidth = localStorage.getItem(`nd_${LECTURE_ID}_width`);

    if (savedCanvas && savedNav) {
        $('#canvas').html(savedCanvas);
        $('#nav-list-container').html(savedNav);
        if (savedTitle) $('#lecture-title').text(savedTitle);

        if (savedWidth) {
            $('#canvas').attr('data-width', savedWidth);
            $('#canvas').css('width', savedWidth + 'px');
        } else {
            $('#canvas').attr('data-width', '800');
            $('#canvas').css('width', '800px');
        }

        totalPages = parseInt(localStorage.getItem(`nd_${LECTURE_ID}_pages`)) || totalPages;
        showToast("🔄 Previous session restored.");
    } else {
        $('#canvas').attr('data-width', '800');
        $('#canvas').css('width', '800px');
    }

    $('.page').each(function() {
        let h = parseInt($(this).attr('data-page-height') || $(this).attr('data-height')) || 1000;
        $(this).attr('data-page-height', h);
        $(this).css('height', h + 'px');
    });

    let activeH = parseInt($('.page.active').attr('data-page-height')) || 1000;
    $('#canvas').css('height', activeH + 'px');
    setZoom(currentZoom);
}

function changeCanvasHeight(delta) {
    saveHistory();
    let isUniform = $('#uniform-height-check').is(':checked');
    let pages = isUniform ? $('.page') : $(`#p-${current}`);

    pages.each(function() {
        let currentH = parseInt($(this).attr('data-page-height')) || 1000;
        let newH = currentH + delta;
        if (newH < 500) newH = 500; 

        $(this).attr('data-page-height', newH);
        $(this).css('height', newH + 'px');
    });

    if (currentViewMode === 'single') {
        let activeH = parseInt($(`#p-${current}`).attr('data-page-height')) || 1000;
        $('#canvas').css('height', activeH + 'px');
    }

    autoSaveToBrowser();
    updateContextMenu();
    setZoom(currentZoom); 
}

function changeCanvasWidth(delta) {
    saveHistory();
    let currentW = parseInt($('#canvas').attr('data-width')) || 800;
    let newW = currentW + delta;
    if (newW < 400) newW = 400; 

    $('#canvas').attr('data-width', newW);
    $('#canvas').css('width', newW + 'px');

    autoSaveToBrowser();
    updateContextMenu();
    setZoom(currentZoom); 
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

    initNotebookSidebar();
    autoSaveToBrowser();
    showToast("🗑️ Page deleted.");
}

function initNotebookSidebar() {
    chaptersData = [];
    allPagesMap = {};
    let currentChapter = { id: 'default', title: 'Uncategorized', pages: [] };
    let pageIndex = 1;

    $('#nav-list-container > div').each(function() {
        if ($(this).hasClass('nav-chapter')) {
            if (currentChapter.id === 'default' && currentChapter.pages.length > 0) {
                chaptersData.push(currentChapter);
            } else if (currentChapter.id !== 'default') {
                chaptersData.push(currentChapter);
            }
            let chapTitle = $(this).find('.nav-text').text();
            let chapId = $(this).attr('id').replace('link-', '');
            currentChapter = { id: chapId, title: chapTitle, pages: [] };
        } else if ($(this).hasClass('nav-link')) {
            let pageId = $(this).attr('id').replace('link-', '');
            currentChapter.pages.push({ id: pageId, index: pageIndex });
            allPagesMap[pageId] = currentChapter.id;
            pageIndex++;
        }
    });

    if (currentChapter.pages.length > 0 || currentChapter.id !== 'default') {
        chaptersData.push(currentChapter);
    }

    $('#ns-title').text($('#lecture-title').text());

    if (chaptersData.length <= 1 && chaptersData[0].id === 'default') {
        $('#ns-chapter-select').hide();
    } else {
        let opts = "";
        chaptersData.forEach(c => {
            opts += `<option value="${c.id}">Chapter: ${c.title}</option>`;
        });
        $('#ns-chapter-select').html(opts).show();
    }

    let activeChap = allPagesMap[current] || chaptersData[0].id;
    $('#ns-chapter-select').val(activeChap);
    renderNotebookStack(activeChap);
}

function renderNotebookStack(chapId) {
    let chap = chaptersData.find(c => c.id === chapId);
    if (!chap) return;

    let html = "";
    chap.pages.forEach((p, i) => {
        let zIndex = chap.pages.length - i;
        let activeClass = (p.id === current) ? "active-ns-card" : "";
        html += `<div class="ns-page-card ${activeClass}" style="z-index:${zIndex};" onclick="goTo('${p.id}')">
                    Page ${p.index}
                 </div>`;
    });
    $('#ns-page-stack').html(html);

    if (searchResults && searchResults.length > 0) {
        searchResults.forEach(match => {
            $(`.ns-page-card[onclick="goTo('${match.pageId}')"]`).addClass('search-match-nav');
        });
    }
}

function toggleLeftPanel() {
    let $sb = $('#notebook-sidebar');
    if (window.innerWidth <= 768) {
        $sb.toggleClass('mobile-open');
    } else {
        $sb.toggleClass('closed');
    }
}

function toggleRightPanel() {
    let $rp = $('#notebook-right-panel');
    if (window.innerWidth <= 768) {
        $rp.toggleClass('mobile-open');
    } else {
        $rp.toggleClass('closed');
    }
}

function setViewMode(mode) {
    currentViewMode = mode;
    $('.view-btn').removeClass('active-view');
    $(`#btn-view-${mode}`).addClass('active-view');

    if(mode === 'scroll') {
        $('#canvas').addClass('scroll-mode');
        $('#canvas').css('height', 'auto'); 
        let $p = $(`#p-${current}`);
        if($p.length) {
            let cvp = document.getElementById('canvas-viewport');
            let offsetTop = $p[0].offsetTop * currentZoom;
            cvp.scrollTo({ top: offsetTop, behavior: 'auto' });
        }
    } else {
        $('#canvas').removeClass('scroll-mode');
        let pageH = parseInt($(`#p-${current}`).attr('data-page-height')) || 1000;
        $('#canvas').css('height', pageH + 'px');

        let cvp = document.getElementById('canvas-viewport');
        cvp.scrollTop = 0;
        cvp.scrollLeft = 0;
    }
    updateContextMenu();
    setZoom(currentZoom);
}

function toggleScrollMode() {
    setViewMode(currentViewMode === 'scroll' ? 'single' : 'scroll');
    showToast(currentViewMode === 'scroll' ? "📜 Scroll Mode Activated" : "📄 Single Page Mode Activated");
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

    saveNote(current); 

    $('.nav-link').removeClass('active-nav');
    $('#link-' + id).addClass('active-nav');

    current = id.toString();
    $('#note-main').html(localStorage.getItem(`nd_${LECTURE_ID}_note_` + current) || "");

    updateContextMenu();
    refreshPinList();
    $('#nav').removeClass('mobile-open'); 

    let newChap = allPagesMap[current];
    if (newChap && $('#ns-chapter-select').val() !== newChap) {
        $('#ns-chapter-select').val(newChap);
        renderNotebookStack(newChap);
    } else {
        $('.ns-page-card').removeClass('active-ns-card');
        $(`.ns-page-card[onclick="goTo('${current}')"]`).addClass('active-ns-card');
    }

    if (window.innerWidth <= 768 && $('#notebook-sidebar').hasClass('mobile-open')) {
        toggleLeftPanel();
    }

    if (currentViewMode === 'single') {
        $('.page').removeClass('active');
        $('#p-' + id).addClass('active');
        let pageH = parseInt($(`#p-${current}`).attr('data-page-height')) || 1000;
        $('#canvas').css('height', pageH + 'px');
    } else {
        let $p = $(`#p-${id}`);
        if($p.length) {
            let cvp = document.getElementById('canvas-viewport');
            let offsetTop = $p[0].offsetTop * currentZoom;
            cvp.scrollTo({ top: offsetTop, behavior: 'smooth' });
        }
    }

    if(isEditing) { toggleEdit(); toggleEdit(); }
}

function toggleNotebookView() {
    $('body').toggleClass('notebook-mode');
    let isNotebook = $('body').hasClass('notebook-mode');

    if (isNotebook) {
        if (isEditing) toggleEdit(); 
        initNotebookSidebar(); 
        showToast("📖 Notebook View Activated");
    }
}

function removeHighlights() {
    $('mark.search-hi').each(function() { $(this).replaceWith($(this).text()); });
    let canvas = document.getElementById('canvas');
    if(canvas) canvas.normalize();
    $('.pin').removeClass('pin-search-match active-pin-match');
    $('.nav-link, .ns-page-card').removeClass('search-match-nav');

    searchResults = [];
    currentSearchIndex = -1;
    $('#search-counter, #ns-search-counter').text('0/0');
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
            highlightNode(this, regex); 
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
            $(`.ns-page-card[onclick="goTo('${pageId}')"]`).addClass('search-match-nav');
        }
    });

    if (searchResults.length > 0) {
        $('#search-counter, #ns-search-counter').text(`0/${searchResults.length}`);
    }
}

function focusMatch() {
    let match = searchResults[currentSearchIndex];
    $('#search-counter, #ns-search-counter').text(`${currentSearchIndex + 1}/${searchResults.length}`);

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

function updateContextMenu() {
    let $sel = $('.selected-box');
    if($sel.length > 0 && isEditing) {
        $('#format-toolbar').css('display', 'flex');

        let hasImage = $sel.find('img').length > 0;
        if (hasImage) {
            $('.menu-text-tools').hide(); 
            $('.menu-img-tools').css('display', 'flex');
        } else {
            $('.menu-text-tools').css('display', 'flex'); 
            $('.menu-img-tools').hide();
        }
    } else { 
        $('#format-toolbar').hide(); 
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

function updateBgOpacity(alpha) {
    $('.selected-box').each(function() {
        let bg = $(this).css('background-color');
        if (bg === 'transparent' || bg === 'rgba(0, 0, 0, 0)') {
            $(this).css('background-color', `rgba(255, 255, 255, ${alpha})`); 
        } else {
            let rgb = bg.match(/\d+/g);
            if (rgb && rgb.length >= 3) {
                $(this).css('background-color', `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alpha})`);
            }
        }
    });
    saveHistory();
}

function addPageBelow() {
    saveHistory();
    let newId = "new_" + Date.now();
    let newNav = `<div class="nav-link" id="link-${newId}" onclick="goTo('${newId}')"><i class="fas fa-bars drag-handle"></i> <span class="nav-text" contenteditable="${isEditing}">New Blank Page</span><i class="fas fa-times delete-page-btn" onclick="deletePage('${newId}', event)" title="Delete Page"></i></div>`;
    let newPage = `<div id="p-${newId}" class="page" data-page-height="1000" style="height: 1000px;"></div>`;

    $(`#link-${current}`).after(newNav); $(`#p-${current}`).after(newPage); 
    goTo(newId); initNotebookSidebar();
}

function addChapterBelow() {
    saveHistory();
    let newId = "chap_" + Date.now();
    let newNav = `<div class="nav-link nav-chapter" id="link-${newId}" onclick="goTo('${newId}')"><i class="fas fa-bars drag-handle"></i> <span class="nav-text" contenteditable="${isEditing}">New Chapter</span><i class="fas fa-times delete-page-btn" onclick="deletePage('${newId}', event)" title="Delete Page"></i></div>`;

    let newPage = `<div id="p-${newId}" class="page" data-page-height="1000" style="height: 1000px;">
        <div class="canvas-box selected-box" style="top:400px; left:100px; width:600px; max-width:600px; z-index:100; transform: translate(0px, 0px);">
            <div class="del-btn" onclick="$(this).parent().remove(); updateContextMenu();">X</div>
            <div class="content-area" contenteditable="true" style="font-size: 48px; font-weight: bold; text-align: center; word-wrap: break-word; white-space: pre-wrap; overflow-wrap: break-word;">Chapter Title</div>
        </div>
    </div>`;

    $(`#link-${current}`).after(newNav); 
    $(`#p-${current}`).after(newPage); 

    goTo(newId); 
    initNotebookSidebar();
    if (!isEditing) { toggleEdit(); }
}

function togglePinLink(index) {
    saveHistory();
    let pinsArr = getSortedPins();
    let $pin = pinsArr[index].el;

    let isLinked = $pin.parent().hasClass('canvas-box');
    let pinRect = $pin[0].getBoundingClientRect();

    if (isLinked) {
        let $page = $(`#p-${current}`); let pageRect = $page[0].getBoundingClientRect(); $page.append($pin);
        let relTop = (pinRect.top - pageRect.top) / currentZoom; let relLeft = (pinRect.left - pageRect.left) / currentZoom;
        $pin.css({ transform: 'translate(0px, 0px)', top: relTop + 'px', left: relLeft + 'px' });
        $pin.attr('data-x', 0).attr('data-y', 0); showToast("📌 Pin Unlinked (Locked to Background)");
    } else {
        $pin.hide(); let el = document.elementFromPoint(pinRect.left + (pinRect.width/2), pinRect.top + (pinRect.height/2)); $pin.show();
        let $targetBox = $(el).closest('.canvas-box');
        if ($targetBox.length > 0) {
            let boxRect = $targetBox[0].getBoundingClientRect(); $targetBox.append($pin);
            let relTop = (pinRect.top - boxRect.top) / currentZoom; let relLeft = (pinRect.left - boxRect.left) / currentZoom;
            $pin.css({ transform: 'translate(0px, 0px)', top: relTop + 'px', left: relLeft + 'px' });
            $pin.attr('data-x', 0).attr('data-y', 0); showToast("🔗 Pin Linked! (Will move with image)");
        } else { 
            showToast("⚠️ Drag the pin over an image first to link it."); 
        }
    }
    refreshPinList();
}

function dropPin() {
    saveHistory();
    let $target = $('.selected-box').length > 0 ? $('.selected-box') : $(`#p-${current}`);

    let highestOrder = -1;
    $(`#p-${current} .pin`).each(function() {
        let o = parseInt($(this).attr('data-order')) || 0;
        if (o > highestOrder) highestOrder = o;
    });

    $target.append(`
        <div class="pin" data-note="Label" data-state="dot" data-order="${highestOrder + 1}" style="top:30px;left:50%; margin-left:-12px; transform: translate(0px, 0px); opacity:1;">
            <div class="pin-visual" style="background:#ea4335;"></div>
        </div>
    `);
    refreshPinList(); 
    if(isEditing) { toggleEdit(); toggleEdit(); }
}

function cyclePinShape(index) {
    saveHistory();
    let pinsArr = getSortedPins();
    let $pin = pinsArr[index].el;

    let states = ['dot', 'up', 'right', 'down', 'left']; 
    let currentState = $pin.attr('data-state') || 'dot';

    let nextIndex = (states.indexOf(currentState) + 1) % states.length; 
    let nextState = states[nextIndex];

    $pin.attr('data-state', nextState); 
    refreshPinList();
}

function updatePinStyle(index, property, value) {
    saveHistory(); 
    let pinsArr = getSortedPins();
    let $pin = pinsArr[index].el;
    let $visual = $pin.find('.pin-visual');

    if(property === 'size') { 
        $visual.css({width: value + 'px', height: value + 'px'}); 
        $pin.css({width: value + 'px', height: value + 'px'}); 
    } else if (property === 'opacity') {
        $pin.css('opacity', value);
    } else { 
        $visual.css(property, value); 
    }
}

function updatePinText(index, newText) { 
    saveHistory(); 
    let pinsArr = getSortedPins();
    pinsArr[index].el.attr('data-note', newText); 
}

function focusPin(index) { 
    let pinsArr = getSortedPins();
    if(pinsArr[index]) pinsArr[index].el.addClass('pin-active-focus'); 
}

function unfocusPin(index) { 
    let pinsArr = getSortedPins();
    if(pinsArr[index]) pinsArr[index].el.removeClass('pin-active-focus'); 
}

function deletePin(index) { 
    saveHistory(); 
    let pinsArr = getSortedPins();
    pinsArr[index].el.remove(); 
    refreshPinList(); 
}

function getSortedPins() {
    let pins = [];
    $(`#p-${current} .pin`).each(function(i) { 
        if (!$(this).attr('data-order')) $(this).attr('data-order', i);

        let offset = $(this).offset(); 
        let $vis = $(this).find('.pin-visual'); 
        let state = $(this).attr('data-state') || 'dot';
        let isLinked = $(this).parent().hasClass('canvas-box');

        let op = parseFloat($(this).css('opacity'));
        if (isNaN(op)) op = 1;

        pins.push({ 
            el: $(this),
            originalIndex: i, 
            order: parseInt($(this).attr('data-order')),
            y: offset ? offset.top : 0, 
            note: $(this).attr('data-note'), 
            color: $vis.css('background-color'), 
            size: $vis.width(), 
            opacity: op,
            state: state, 
            isLinked: isLinked 
        }); 
    });

    pins.sort((a, b) => a.order - b.order); 
    return pins;
}

function refreshPinList() {
    let pins = getSortedPins();
    let h = pins.length ? "" : "<p style='text-align:center; font-size:10px; color:#888;'>No pins.</p>";

    pins.forEach((p, i) => { 
        let hex = p.color.match(/\d+/g).map(x => parseInt(x).toString(16).padStart(2, '0')).join('');
        let iconClass = "fa-caret-up";
        let iconRotation = "0deg";

        if(p.state === 'dot') iconClass = "fa-circle";
        if(p.state === 'right') iconRotation = "90deg";
        if(p.state === 'down') iconRotation = "180deg";
        if(p.state === 'left') iconRotation = "270deg";

        let iconStyle = (p.state !== 'dot') ? `transform: rotate(${iconRotation}); transition: 0.2s;` : "";
        let linkIcon = p.isLinked ? "fa-link" : "fa-unlink"; 
        let linkColor = p.isLinked ? "#4CAF50" : "inherit"; 
        let linkTitle = p.isLinked ? "Unlink from Image" : "Link to Image underneath";

        let safeNote = p.note ? p.note.replace(/"/g, '&quot;') : "";

        h += `
            <div class="sketch-pin-card" data-orig-idx="${p.originalIndex}" title="${safeNote}" onmouseenter="focusPin(${i})" onmouseleave="unfocusPin(${i})">
                <div class="pin-card-left">
                    <div class="sketch-btn sketch-num pin-drag-handle" title="Drag to reorder" style="width:100%; padding:0; justify-content:center; cursor: grab;">#${i+1}</div>

                    <label class="sketch-color-wrap pin-tool-item" title="Color">
                        <input type="color" value="#${hex}" onchange="updatePinStyle(${i}, 'background', this.value)">
                    </label>
                    <button class="sketch-btn pin-tool-item" style="width:100%; padding:0; justify-content:center;" onclick="cyclePinShape(${i})" title="Cycle Pointer Direction">
                        <i class="fas ${iconClass}" style="${iconStyle}"></i>
                    </button>
                    <button class="sketch-btn pin-tool-item" style="width:100%; padding:0; justify-content:center; color:${linkColor};" onclick="togglePinLink(${i})" title="${linkTitle}">
                        <i class="fas ${linkIcon}"></i>
                    </button>
                </div>
                <div class="pin-card-right">
                    <textarea class="sketch-textarea" style="flex-grow:1; margin:0;" oninput="updatePinText(${i}, this.value)" placeholder="Label">${p.note}</textarea>

                    <div class="pin-card-bottom pin-tool-item" style="display: flex; gap: 4px;">
                        <div class="sketch-btn sketch-size-wrap" title="Size" style="flex:1;">
                            Size <input type="range" min="10" max="60" value="${p.size}" oninput="updatePinStyle(${i}, 'size', this.value)">
                        </div>
                        <div class="sketch-btn sketch-size-wrap" title="Opacity" style="flex:1;">
                            Opac <input type="range" min="0.1" max="1" step="0.1" value="${p.opacity}" oninput="updatePinStyle(${i}, 'opacity', this.value)">
                        </div>
                        <button class="sketch-btn sketch-del" onclick="deletePin(${i})" title="Delete">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                </div>
            </div>`; 
    });

    $('#pin-list-container').html(h);

    if (window.pinSortable) window.pinSortable.destroy();
    let pinContainer = document.getElementById('pin-list-container');
    if (pinContainer) {
        window.pinSortable = new Sortable(pinContainer, {
            animation: 150,
            handle: '.pin-drag-handle',
            fallbackOnBody: true, 
            swapThreshold: 0.65,
            onEnd: function (evt) {
                saveHistory();
                let $page = $(`#p-${current}`);
                let allCurrentPins = $page.find('.pin').toArray();

                $('#pin-list-container .sketch-pin-card').each(function(index) {
                    let oldIdx = parseInt($(this).attr('data-orig-idx'));
                    let pinEl = allCurrentPins[oldIdx];
                    $(pinEl).attr('data-order', index);
                    $page.append(pinEl);
                });

                refreshPinList();
            }
        });
    }
}

function toggleEdit() {
    isEditing = !isEditing; 
    $('#edit-btn').toggleClass('active-view', isEditing);
    $('.edit-tools').css('display', isEditing ? 'flex' : 'none');
    $('#canvas').toggleClass('edit-active'); 
    $('body').toggleClass('edit-active', isEditing);

    $('.content-area').attr('contenteditable', isEditing); 
    $('.nav-text').attr('contenteditable', isEditing); 

    refreshPinList();

    if(isEditing) {
        interact('.canvas-box').resizable({ 
            edges: { right: true, bottom: true }, margin: 15,
            listeners: { 
                start: saveHistory, 
                move(event) {
                    let target = event.target; 
                    let x = (parseFloat(target.getAttribute('data-x')) || 0); 
                    let y = (parseFloat(target.getAttribute('data-y')) || 0);

                    // Divide the delta by currentZoom to stop cursor drifting
                    let currentW = parseFloat(target.style.width) || target.offsetWidth;
                    let currentH = parseFloat(target.style.height) || target.offsetHeight;

                    target.style.width = (currentW + (event.deltaRect.width / currentZoom)) + 'px'; 
                    target.style.height = (currentH + (event.deltaRect.height / currentZoom)) + 'px';

                    x += (event.deltaRect.left / currentZoom); 
                    y += (event.deltaRect.top / currentZoom);

                    target.style.transform = `translate(${x}px, ${y}px)`; 
                    target.setAttribute('data-x', x); 
                    target.setAttribute('data-y', y);
                    updateContextMenu();
                }
            }
        }).draggable({ 
            modifiers: [ interact.modifiers.restrictRect({ restriction: '#canvas', endOnly: false }) ],
            ignoreFrom: '.content-area',
            listeners: { 
                start: saveHistory, 
                move(event) {
                    let x = (parseFloat(event.target.getAttribute('data-x')) || 0) + (event.dx / currentZoom); 
                    let y = (parseFloat(event.target.getAttribute('data-y')) || 0) + (event.dy / currentZoom);
                    event.target.style.transform = `translate(${x}px, ${y}px)`; 
                    event.target.setAttribute('data-x', x); 
                    event.target.setAttribute('data-y', y);
                    updateContextMenu();
                }, end: refreshPinList 
            }
        });

        interact('.pin').draggable({ 
            modifiers: [ interact.modifiers.restrictRect({ restriction: '#canvas', endOnly: false }) ],
            listeners: { 
                start: saveHistory, 
                move(event) {
                    let x = (parseFloat(event.target.getAttribute('data-x')) || 0) + (event.dx / currentZoom); 
                    let y = (parseFloat(event.target.getAttribute('data-y')) || 0) + (event.dy / currentZoom);
                    event.target.style.transform = `translate(${x}px, ${y}px)`; 
                    event.target.setAttribute('data-x', x); 
                    event.target.setAttribute('data-y', y);
                }, end: refreshPinList 
            }
        });
    } else { 
        interact('.canvas-box').unset(); interact('.pin').unset(); $('.canvas-box').removeClass('selected-box'); updateContextMenu();
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

$(document).on('selectionchange', function() {
    let sel = window.getSelection();
    if (sel.rangeCount > 0) {
        let $node = $(sel.anchorNode);
        if ($node.closest('.content-area').length > 0) {
            savedSelection = sel.getRangeAt(0);
        }
    }
});

function restoreSelection() {
    if (savedSelection) {
        let sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(savedSelection);
    }
}

function format(c, v=null) { 
    restoreSelection(); 
    document.execCommand(c, false, v); 
    syncListSizes(); 
    saveHistory(); 
}

function saveHistory() { 
    noteHistory.push(cleanCanvasForSave()); 
    if (noteHistory.length > 15) noteHistory.shift(); 
    $('#undo-btn').prop('disabled', false); 
}
function undo() { 
    if (noteHistory.length > 0) { 
        $('#canvas').html(noteHistory.pop()); 
        if (noteHistory.length === 0) $('#undo-btn').prop('disabled', true); 
        refreshPinList(); updateContextMenu(); 
        if (isEditing) { toggleEdit(); toggleEdit(); } 
    } 
}

function saveNote(id) { localStorage.setItem(`nd_${LECTURE_ID}_note_`+id, $('#note-main').html()); }
function switchTab(t) { $('.tab-btn').removeClass('active-tab'); $('.tab-content').removeClass('active-tab'); $(`.tab-btn[onclick*="${t}"]`).addClass('active-tab'); $('#'+t).addClass('active-tab'); }

function addText() { saveHistory(); $(`#p-${current}`).append(`<div class="canvas-box selected-box" style="top:150px;left:150px;width:300px;max-width:calc(800px - 150px);z-index:100;background-color:rgba(255,255,255,0.8);transform: translate(0px, 0px);"><div class="del-btn" onclick="$(this).parent().remove(); updateContextMenu();">X</div><div class="content-area" contenteditable="true" style="word-wrap: break-word; white-space: pre-wrap; overflow-wrap: break-word;">New Label</div></div>`); if(isEditing) { toggleEdit(); toggleEdit(); } updateContextMenu(); }
function addImg() { let i = document.createElement('input'); i.type = 'file'; i.accept = 'image/*'; i.onchange = e => { let r = new FileReader(); r.readAsDataURL(e.target.files[0]); r.onload = ev => { saveHistory(); $(`#p-${current}`).append(`<div class="canvas-box selected-box" style="top:200px;left:200px;width:300px;max-width:calc(800px - 200px);z-index:10;transform: translate(0px, 0px);"><div class="del-btn" onclick="$(this).parent().remove(); updateContextMenu();">X</div><img src="${ev.target.result}" style="width:100%"></div>`); if(isEditing) { toggleEdit(); toggleEdit(); } updateContextMenu(); }; }; i.click(); }

function saveNotebookToFile() {
    saveHistory();
    if(isEditing) toggleEdit(); 

    $('#context-menu').hide();
    $('.canvas-box').removeClass('selected-box');
    removeHighlights(); 

    let currentHTML = "<!DOCTYPE html>\n<html>\n" + document.documentElement.innerHTML + "\n</html>";
    let blob = new Blob([currentHTML], { type: 'text/html' });
    let url = URL.createObjectURL(blob);
    let a = document.createElement('a');

    a.href = url;
    let customName = $('#lecture-title').text().trim().replace(/\.pptx?$/i, '');
    if (!customName) customName = "NoteDump_Lecture";

    a.download = customName + ".html";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showToast("💾 Final Notebook Exported!");
}

$(document).ready(function() {
    restoreFromBrowser(); 
    setInterval(autoSaveToBrowser, 3000); 
    initNotebookSidebar();

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
                initNotebookSidebar(); autoSaveToBrowser(); 
            }
        });
    }

    let colorHtml = "";
    COLORS.forEach(c => { colorHtml += `<div class="color-swatch" style="background:${c};" data-color="${c}"></div>`; });
    $('#text-color-grid, #bg-color-grid').html(colorHtml);

    $('#text-color-grid .color-swatch').click(function() { 
        restoreSelection();
        document.execCommand('foreColor', false, $(this).attr('data-color'));
        saveHistory();
    });
    $('#bg-color-grid .color-swatch').click(function() { changeBoxStyle('background-color', $(this).attr('data-color')); });

    $(document).on('input', '.content-area', syncListSizes);

    let isMenuDragging = false; let menuDragStartX = 0; let menuDragStartY = 0;

    $(document).on('mousedown', '#menu-drag-handle', function(e) {
        if(!isEditing) return;
        e.preventDefault(); isMenuDragging = true; menuDragStartX = e.clientX; menuDragStartY = e.clientY;

        $('.selected-box').each(function() {
            $(this).data('base-tx', parseFloat($(this).attr('data-x')) || 0);
            $(this).data('base-ty', parseFloat($(this).attr('data-y')) || 0);
            $(this).data('base-left', parseFloat($(this).css('left')) || 0);
            $(this).data('base-top', parseFloat($(this).css('top')) || 0);
        });
    });

    $(document).on('mousemove', function(e) {
        if(!isMenuDragging) return;

        let dx = (e.clientX - menuDragStartX) / currentZoom;
        let dy = (e.clientY - menuDragStartY) / currentZoom;
        let canvasW = $('#canvas').width();
        let canvasH = $('#canvas').height();

        $('.selected-box').each(function() {
            let nx = $(this).data('base-tx') + dx; 
            let ny = $(this).data('base-ty') + dy;
            let baseLeft = $(this).data('base-left');
            let baseTop = $(this).data('base-top');
            let bw = $(this).outerWidth();
            let bh = $(this).outerHeight();

            let targetAbsX = baseLeft + nx;
            let targetAbsY = baseTop + ny;

            if (targetAbsX < 0) { nx = -baseLeft; }
            if (targetAbsY < 0) { ny = -baseTop; }
            if (targetAbsX + bw > canvasW) { nx = canvasW - bw - baseLeft; }
            if (targetAbsY + bh > canvasH) { ny = canvasH - bh - baseTop; }

            $(this).css('transform', `translate(${nx}px, ${ny}px)`);
            $(this).attr('data-x', nx); 
            $(this).attr('data-y', ny);
        });
        updateContextMenu();
    });

    $(document).on('mouseup', function(e) { if (isMenuDragging) { isMenuDragging = false; saveHistory(); } });

    $(window).on('keydown', function(e) {
        let isTyping = $(e.target).is('textarea, [contenteditable="true"]:focus, input:focus');

        if (isTyping && e.key === 'Tab') {
            e.preventDefault();
            document.execCommand('insertHTML', false, '&emsp;&emsp;');
            return;
        }

        if (e.ctrlKey && e.key.toLowerCase() === 's') { e.preventDefault(); saveNotebookToFile(); return; }
        if (e.ctrlKey && e.key.toLowerCase() === 'f') {
            e.preventDefault();
            if (window.innerWidth <= 768) { $('#nav').addClass('mobile-open'); $('#workbench').removeClass('mobile-open'); }
            $('#search-input').focus(); return;
        }
        if (e.ctrlKey && e.key.toLowerCase() === 'z' && !isTyping) { e.preventDefault(); undo(); return; }
        if (!isTyping && e.which == 37) { prevPage(); e.preventDefault(); }
        if (!isTyping && e.which == 39) { nextPage(); e.preventDefault(); }

        if (isEditing) {
            if (e.ctrlKey && e.key.toLowerCase() === 'a' && !isTyping) { e.preventDefault(); $(`#p-${current} .canvas-box`).addClass('selected-box'); updateContextMenu(); }
            if (e.ctrlKey && e.key.toLowerCase() === 'c' && !isTyping) { customClipboard = []; $('.selected-box').each(function() { customClipboard.push($(this)[0].outerHTML); }); }
            if (e.ctrlKey && e.key.toLowerCase() === 'v' && !isTyping) {
                if(customClipboard.length > 0) {
                    e.preventDefault(); saveHistory(); $('.canvas-box').removeClass('selected-box'); 
                    customClipboard.forEach(htmlStr => {
                        let $newBox = $(htmlStr);
                        let currentTop = parseFloat($newBox.css('top')) || 100;
                        let currentLeft = parseFloat($newBox.css('left')) || 100;
                        $newBox.css({ top: (currentTop + 20) + 'px', left: (currentLeft + 20) + 'px' });
                        $newBox.addClass('selected-box'); $(`#p-${current}`).append($newBox);
                    });
                    toggleEdit(); toggleEdit(); updateContextMenu();
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

        for (let i = 0; i < items.length; i++) {
            if (items[i].type.indexOf("image") === 0) {
                e.preventDefault();
                let file = items[i].getAsFile();
                let r = new FileReader();
                r.onload = ev => {
                    saveHistory();
                    $('.canvas-box').removeClass('selected-box');
                    $(`#p-${current}`).append(`<div class="canvas-box selected-box" style="top:200px;left:200px;width:300px;max-width:calc(800px - 200px);z-index:10;transform: translate(0px, 0px);"><div class="del-btn" onclick="$(this).parent().remove(); updateContextMenu();">X</div><img src="${ev.target.result}" style="width:100%"></div>`);
                    if(isEditing) { toggleEdit(); toggleEdit(); }
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
                $(`#p-${current}`).append(`<div class="canvas-box selected-box" style="top:150px;left:150px;width:300px;max-width:calc(800px - 150px);z-index:100;background-color:rgba(255,255,255,0.8);transform: translate(0px, 0px);"><div class="del-btn" onclick="$(this).parent().remove(); updateContextMenu();">X</div><div class="content-area" contenteditable="true" style="word-wrap: break-word; white-space: pre-wrap; overflow-wrap: break-word;">${safeText}</div></div>`);
                if(isEditing) { toggleEdit(); toggleEdit(); }
                updateContextMenu();
            }
        }
    });

    $(document).on('mousedown', '.canvas-box', function(e) {
        if(!isEditing) return;
        if(!e.shiftKey && !$(this).hasClass('selected-box')) { $('.canvas-box').removeClass('selected-box'); }
        $(this).addClass('selected-box');
        updateContextMenu();
        if ($(e.target).closest('.content-area').length > 0) { return; }
        if(!$(e.target).is(':focus')) { e.preventDefault(); }
    });

    $(document).on('mousedown', '#canvas', function(e) {
        if ($(e.target).is('#canvas, .page, img')) {
            $('.canvas-box').removeClass('selected-box');
            updateContextMenu();
        }
    });

    $('.canvas-box').each(function() {
        if ($(this).find('.del-btn').length === 0) {
            $(this).prepend('<div class="del-btn" onclick="saveHistory(); $(this).parent().remove(); updateContextMenu();">X</div>');
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
            if(newZoom > 3) newZoom = 3;

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
                if(newZoom > 3) newZoom = 3;
                setZoom(newZoom);
                let rect = cvp.getBoundingClientRect();
                cvp.scrollLeft = (targetCanvasX * newZoom) - pinchScreenX + rect.left;
                cvp.scrollTop = (targetCanvasY * newZoom) - pinchScreenY + rect.top;
            }
        }, {passive: false});

        cvp.addEventListener('touchend', function(e) { if (e.touches.length < 2) isPinching = false; });
    }

    $(document).on('click', function(e) {
        if ($('body').hasClass('notebook-mode')) {
            if ($(e.target).closest('#notebook-sidebar, #notebook-right-panel, #notebook-floating-nav, .pin, .canvas-box, .panel-toggle').length > 0) return; 
            let w = window.innerWidth;
            if (e.clientX < w * 0.25) { prevPage(); } 
            else if (e.clientX > w * 0.75) { nextPage(); }
        }
    });

    goTo("0");
});

function setZoom(v) { 
    currentZoom = parseFloat(v);
    $('#canvas').css('transform', `scale(${currentZoom})`); 

    let baseW = parseInt($('#canvas').attr('data-width')) || 800;
    let scaledW = baseW * currentZoom;
    let offsetW = baseW - scaledW;
    $('#canvas').css('margin-right', `-${offsetW}px`);

    if (!$('#canvas').hasClass('scroll-mode')) {
        let baseH = parseInt($('.page.active').attr('data-page-height')) || parseInt($('#canvas').attr('data-height')) || 1000;
        let scaledH = baseH * currentZoom;
        let offsetH = baseH - scaledH;
        $('#canvas').css('margin-bottom', `-${offsetH}px`);
    } else {
        $('#canvas').css('margin-bottom', '0px');
    }

    $('#zoom-slider, #ns-zoom-slider').val(currentZoom); 
    $('#zoom-txt, #ns-zoom-txt').text(Math.round(currentZoom*100)+'%'); 
}

function showToast(message) {
    let $toast = $('#toast-notification');
    if($toast.length === 0) {
        $('body').append('<div id="toast-notification" class="toast" style="position:fixed; bottom:20px; left:50%; transform:translateX(-50%); background:#333; color:white; padding:10px 20px; border-radius:5px; z-index:10000; display:none;"></div>');
        $toast = $('#toast-notification');
    }
    $toast.text(message).fadeIn(200).delay(2000).fadeOut(200);
}
