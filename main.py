let current = "0"; 
let isEditing = false; 
let noteHistory = []; // FIX: Renamed from 'history' to prevent browser crash!
let customClipboard = []; 
let cropperInstance = null; 
let currentZoom = 1; 

let chaptersData = [];
let allPagesMap = {};
let searchResults = [];
let currentSearchIndex = -1;

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
        localStorage.setItem(`nd_${LECTURE_ID}_height`, $('#canvas').height()); 
    }
}

function restoreFromBrowser() {
    let savedCanvas = localStorage.getItem(`nd_${LECTURE_ID}_canvas`);
    let savedNav = localStorage.getItem(`nd_${LECTURE_ID}_nav`);
    let savedTitle = localStorage.getItem(`nd_${LECTURE_ID}_title`);
    let savedHeight = localStorage.getItem(`nd_${LECTURE_ID}_height`);

    if (savedCanvas && savedNav) {
        $('#canvas').html(savedCanvas);
        $('#nav-list-container').html(savedNav);
        if (savedTitle) $('#lecture-title').text(savedTitle);
        if (savedHeight) $('#canvas').css('height', savedHeight + 'px');
        totalPages = parseInt(localStorage.getItem(`nd_${LECTURE_ID}_pages`)) || totalPages;
        showToast("🔄 Previous session restored.");
    }
}

function changeCanvasHeight(delta) {
    saveHistory();
    let currentH = $('#canvas').height() || 1000;
    let newH = currentH + delta;
    if (newH < 500) newH = 500; 
    $('#canvas').css('height', newH + 'px');
    autoSaveToBrowser();
    updateContextMenu();
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
    let $icon = $('#left-toggle i');
    if (window.innerWidth <= 768) {
        $sb.toggleClass('mobile-open');
        $icon.attr('class', $sb.hasClass('mobile-open') ? 'fas fa-chevron-left' : 'fas fa-chevron-right');
    } else {
        $sb.toggleClass('closed');
        $icon.attr('class', $sb.hasClass('closed') ? 'fas fa-chevron-right' : 'fas fa-chevron-left');
    }
}

function toggleRightPanel() {
    let $rp = $('#notebook-right-panel');
    let $icon = $('#right-toggle i');
    if (window.innerWidth <= 768) {
        $rp.toggleClass('mobile-open');
        $icon.attr('class', $rp.hasClass('mobile-open') ? 'fas fa-chevron-right' : 'fas fa-chevron-left');
    } else {
        $rp.toggleClass('closed');
        $icon.attr('class', $rp.hasClass('closed') ? 'fas fa-chevron-left' : 'fas fa-chevron-right');
    }
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
    $('.page').removeClass('active');
    $('#p-' + id).addClass('active');

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

    match.el[0].scrollIntoView({ block: 'center', inline: 'center', behavior: 'smooth' });
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

    let cvp = document.getElementById('canvas-viewport');

    cvp.addEventListener('wheel', function(e) {
        if (e.ctrlKey) {
            e.preventDefault();
            let zoomDelta = e.deltaY * -0.01;
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

    let navList = document.getElementById('nav-list-container');
    if (navList) {
        new Sortable(navList, {
            animation: 150, handle: '.drag-handle',
            onEnd: function (evt) {
                saveHistory(); 
                let newOrder = [];
                $('#nav-list-container .nav-link').each(function() { newOrder.push($(this).attr('id').replace('link-', '')); });
                newOrder.forEach(id => { $('#canvas').append($(`#p-${id}`)); });
                initNotebookSidebar(); autoSaveToBrowser(); 
            }
        });
    }

    $(document).on('click', function(e) {
        if ($('body').hasClass('notebook-mode')) {
            if ($(e.target).closest('#notebook-sidebar, #notebook-right-panel, .pin, .canvas-box, .panel-toggle').length > 0) return; 
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
