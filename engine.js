let current = 0; let isEditing = false; let history = []; 

function goTo(id) {
    saveNote(current); 
    $('.page').removeClass('active');
    $('#p-' + id).addClass('active');
    $('.nav-link').removeClass('active-nav');
    $('#link-' + id).addClass('active-nav');
    current = id;
    $('#note-main').html(localStorage.getItem('n-' + current) || "");
    refreshPinList();
    if(isEditing) { toggleEdit(); toggleEdit(); }
}

$(document).ready(function() {
    $(window).on('keydown', function(e) {
        if ($(e.target).is('textarea, [contenteditable="true"], input')) return;
        if (e.which == 37 && current > 0) { goTo(current - 1); e.preventDefault(); }
        if (e.which == 39 && current < totalPages - 1) { goTo(current + 1); e.preventDefault(); }
    });

    $(document).on('mouseenter', '.pin', function() {
        let index = $(this).index(`#p-${current} .pin`);
        $('.pin-item').eq(index).addClass('pin-highlight');
    }).on('mouseleave', '.pin', function() {
        $('.pin-item').removeClass('pin-highlight');
    });

    goTo(0);
});

function dropPin() {
    saveHistory();
    $(`#p-${current}`).append(`<div class="pin" data-note="New Observation" style="top:100px;left:100px;background:#ea4335;width:20px;height:20px;"></div>`);
    refreshPinList();
    if(isEditing) { toggleEdit(); toggleEdit(); }
}

function updatePinStyle(index, property, value) {
    saveHistory();
    let target = $(`#p-${current} .pin`).eq(index);
    if(property === 'size') {
        target.css({width: value + 'px', height: value + 'px'});
    } else {
        target.css(property, value);
    }
}

function updatePinText(index, newText) {
    saveHistory();
    $(`#p-${current} .pin`).eq(index).attr('data-note', newText);
}

function refreshPinList() {
    let pins = [];
    $(`#p-${current} .pin`).each(function() { 
        let offset = $(this).offset();
        pins.push({ y: offset ? offset.top : 0, note: $(this).attr('data-note'), color: $(this).css('background-color'), size: $(this).width() }); 
    });
    pins.sort((a, b) => a.y - b.y);
    let h = pins.length ? "" : "<p style='text-align:center; font-size:10px; color:#888;'>No pins.</p>";
    pins.forEach((p, i) => { 
        let hex = p.color.match(/\d+/g).map(x => parseInt(x).toString(16).padStart(2, '0')).join('');
        h += `<div class="pin-item">
                <div style="display:flex; justify-content:space-between;"><b>#${i+1}</b> <span style="cursor:pointer; color:#ff4b4b;" onclick="deletePin(${i})">Delete</span></div>
                <textarea class="pin-note-edit" oninput="updatePinText(${i}, this.value)">${p.note}</textarea>
                <div class="pin-controls">
                    <span class="pin-control-label">COLOR:</span><input type="color" value="#${hex}" onchange="updatePinStyle(${i}, 'background', this.value)" style="width:25px;height:20px;border:none;padding:0;background:none;">
                    <span class="pin-control-label">SIZE:</span><input type="range" min="10" max="50" value="${p.size}" oninput="updatePinStyle(${i}, 'size', this.value)" style="width:60px;">
                </div>
              </div>`; 
    });
    $('#pin-list-container').html(h);
}

function deletePin(index) { saveHistory(); $(`#p-${current} .pin`).eq(index).remove(); refreshPinList(); }

function toggleEdit() {
    isEditing = !isEditing; $('#edit-btn').toggleClass('btn-active', isEditing);
    $('.edit-tools').css('display', isEditing ? 'flex' : 'none');
    $('#canvas').toggleClass('edit-active');
    $('.content-area').attr('contenteditable', isEditing);
    if(isEditing) {
        interact('.canvas-box').resizable({ edges: { right: true, bottom: true, left: true, top: true }, listeners: { start: saveHistory, move(event) {
                let target = event.target; let x = (parseFloat(target.getAttribute('data-x')) || 0); let y = (parseFloat(target.getAttribute('data-y')) || 0);
                target.style.width = event.rect.width + 'px'; target.style.height = event.rect.height + 'px';
                x += event.deltaRect.left; y += event.deltaRect.top;
                target.style.transform = `translate(${x}px, ${y}px)`; target.setAttribute('data-x', x); target.setAttribute('data-y', y);
            }}
        }).draggable({ listeners: { start: saveHistory, move(event) {
                let x = (parseFloat(event.target.getAttribute('data-x')) || 0) + event.dx; let y = (parseFloat(event.target.getAttribute('data-y')) || 0) + event.dy;
                event.target.style.transform = `translate(${x}px, ${y}px)`; event.target.setAttribute('data-x', x); event.target.setAttribute('data-y', y);
            }, end: refreshPinList }
        });
        interact('.pin').draggable({ listeners: { start: saveHistory, move(event) {
                let x = (parseFloat(event.target.getAttribute('data-x')) || 0) + event.dx; let y = (parseFloat(event.target.getAttribute('data-y')) || 0) + event.dy;
                event.target.style.transform = `translate(${x}px, ${y}px)`; event.target.setAttribute('data-x', x); event.target.setAttribute('data-y', y);
            }, end: refreshPinList }
        });
    } else { interact('.canvas-box').unset(); interact('.pin').unset(); }
}

function format(c, v=null) { saveHistory(); document.execCommand(c, false, v); }
function setZoom(v) { $('#canvas').css('transform', `scale(${v})`); $('#zoom-txt').text(Math.round(v*100)+'%'); }
function saveHistory() { history.push($('#canvas').html()); if(history.length > 15) history.shift(); $('#undo-btn').prop('disabled', false); }
function undo() { if(history.length > 0) { $('#canvas').html(history.pop()); if(history.length === 0) $('#undo-btn').prop('disabled', true); refreshPinList(); if(isEditing) { toggleEdit(); toggleEdit(); } } }
function saveNote(id) { localStorage.setItem('n-'+id, $('#note-main').html()); }
function switchTab(t) { $('.tab-btn').removeClass('active-tab'); $('.tab-content').removeClass('active-tab'); $(`.tab-btn[onclick*="${t}"]`).addClass('active-tab'); $('#'+t).addClass('active-tab'); }
function addText() { saveHistory(); $(`#p-${current}`).append(`<div class="canvas-box" style="top:150px;left:150px;width:200px;"><div class="del-btn" onclick="$(this).parent().remove()">X</div><div class="content-area" contenteditable="true">New Label</div></div>`); if(isEditing){toggleEdit();toggleEdit();} }
function addImg() { let i=document.createElement('input'); i.type='file'; i.accept='image/*'; i.onchange=e=>{let r=new FileReader(); r.readAsDataURL(e.target.files[0]); r.onload=ev=>{saveHistory(); $(`#p-${current}`).append(`<div class="canvas-box" style="top:200px;left:200px;width:300px;"><div class="del-btn" onclick="$(this).parent().remove()">X</div><img src="${ev.target.result}" style="width:100%"></div>`); if(isEditing){toggleEdit();toggleEdit();}}}; i.click(); }
