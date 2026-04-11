import streamlit as st
from pptx import Presentation
import html 
import base64
import time
from io import BytesIO
from template import get_template

try:
    import pymupdf as fitz
except ImportError:
    import fitz

st.set_page_config(page_title="NoteDump", layout="centered", initial_sidebar_state="collapsed")

# ==========================================================================
# SECTION 1: GLOBAL UI STYLING & MODAL CONTENT
# ==========================================================================
st.markdown("""
<style>
.stApp { background-color: #000000; }

[data-testid="block-container"] { max-width: 800px; padding-top: 3rem; }

/* =======================================================================
   COLUMN WRAPPERS
   ======================================================================= */
[data-testid="stColumn"] {
    background-color: #0f172a !important;
    border-radius: 12px !important;
    min-height: 240px !important;
    box-sizing: border-box !important;
    transition: 0.2s !important;
}
[data-testid="stColumn"] > div[data-testid="stVerticalBlock"] {
    height: 100% !important;
    display: flex !important;
    flex-direction: column !important;
    justify-content: center !important;
    align-items: center !important;
    width: 100% !important;
    padding: 0 !important;
}

/* RIGHT BOX */
[data-testid="stColumn"]:nth-child(2) {
    border: 1px solid #1e293b !important;
    padding: 20px !important;
}
[data-testid="stColumn"]:nth-child(2):hover {
    border-color: #0ea5e9 !important;
    background: rgba(14, 165, 233, 0.1) !important;
}

/* =======================================================================
   RIGHT BOX: BLANK NOTEBOOK BUTTON
   ======================================================================= */
[data-testid="stColumn"]:nth-child(2) [data-testid="stDownloadButton"] { height: 100% !important; width: 100% !important; margin: 0 !important; }
[data-testid="stColumn"]:nth-child(2) [data-testid="stDownloadButton"] button {
    background: transparent !important; border: none !important; box-shadow: none !important;
    height: 100% !important; width: 100% !important; display: flex !important; flex-direction: row !important;
    justify-content: center !important; align-items: center !important;
}
[data-testid="stColumn"]:nth-child(2) [data-testid="stDownloadButton"] button * { display: none !important; }
[data-testid="stColumn"]:nth-child(2) [data-testid="stDownloadButton"] button::before {
    content: "📓"; font-size: 65px !important; margin-right: 15px !important;
}
[data-testid="stColumn"]:nth-child(2) [data-testid="stDownloadButton"] button::after {
    content: "Create\A Blank\A Notebook"; white-space: pre !important; font-size: 24px !important;
    font-weight: 800 !important; color: #f8fafc !important; line-height: 1.1 !important; text-align: left !important;
}

/* =======================================================================
   LEFT BOX: FILE UPLOADER
   ======================================================================= */
[data-testid="stColumn"]:nth-child(1) {
    border: 1px dashed #334155 !important;
    padding: 0 !important;
    position: relative !important;
    overflow: hidden !important;
}
[data-testid="stColumn"]:nth-child(1):hover {
    border-color: #0ea5e9 !important;
    background: rgba(14, 165, 233, 0.05) !important;
}

/* Make file uploader fill the entire left box */
[data-testid="stColumn"]:nth-child(1) div[data-testid="stFileUploader"],
[data-testid="stColumn"]:nth-child(1) div[data-testid="stFileUploader"] > section {
    width: 100% !important;
    height: 100% !important;
    min-height: 240px !important;
}

/* =======================================================================
   THE DROPZONE: transparent, full-size, centered flex
   ======================================================================= */
[data-testid="stFileUploadDropzone"] {
    background: transparent !important;
    background-color: transparent !important;
    border: none !important;
    box-shadow: none !important;
    width: 100% !important;
    min-height: 240px !important;
    display: flex !important;
    flex-direction: column !important;
    align-items: center !important;
    justify-content: center !important;
    padding: 16px !important;
    margin: 0 !important;
    position: relative !important;
}

/* =======================================================================
   LABEL: This is where our custom HTML lives — make it fully visible
   ======================================================================= */
[data-testid="stFileUploader"] label {
    display: flex !important;
    flex-direction: column !important;
    align-items: center !important;
    justify-content: center !important;
    width: 100% !important;
    text-align: center !important;
    color: #f8fafc !important;
    font-size: 1rem !important;
    cursor: default !important;
    margin-bottom: 0 !important;
    padding-bottom: 0 !important;
}

/* =======================================================================
   KILL ALL NATIVE DROPZONE INJECTED CONTENT
   Streamlit renders these inside [data-testid="stFileUploadDropzone"] > div:
     - An SVG cloud icon
     - A <p> "Drag and drop file here"  
     - A <small> "Limit 200MB per file • PPTX, PPT, PDF"
   We hide all of them. The <button> (Browse files) we keep and restyle.
   ======================================================================= */

/* Kill the cloud SVG */
[data-testid="stFileUploadDropzone"] > div > svg { display: none !important; }

/* Kill "Drag and drop" paragraph and "Limit 200MB" small tag */
[data-testid="stFileUploadDropzone"] > div > p,
[data-testid="stFileUploadDropzone"] > div > small,
[data-testid="stFileUploadDropzone"] > div > span:not(button span) {
    display: none !important;
    height: 0 !important;
    overflow: hidden !important;
}

/* Style the native Browse Files button */
[data-testid="stFileUploadDropzone"] > div > button {
    background: #1e293b !important;
    border: 1px solid #334155 !important;
    color: #f8fafc !important;
    border-radius: 8px !important;
    padding: 10px 28px !important;
    font-size: 15px !important;
    font-weight: 600 !important;
    cursor: pointer !important;
    margin-top: 14px !important;
    transition: border-color 0.2s, background 0.2s !important;
}
[data-testid="stFileUploadDropzone"] > div > button:hover {
    background: #334155 !important;
    border-color: #0ea5e9 !important;
}

/* Expand hidden file <input> so the whole box is a drop target */
[data-testid="stFileUploadDropzone"] input[type="file"] {
    position: absolute !important;
    top: 0 !important; left: 0 !important; right: 0 !important; bottom: 0 !important;
    width: 100% !important; height: 100% !important;
    z-index: 9999 !important;
    opacity: 0 !important;
    cursor: pointer !important;
}

/* =======================================================================
   AFTER UPLOAD: HIDE THE RE-APPEARING DROPZONE ("+" add-more button)
   :has() is supported in Chrome 105+, Edge 105+, Safari 15.4+, Firefox 121+
   ======================================================================= */
[data-testid="stFileUploader"]:has([data-testid="stUploadedFile"]) [data-testid="stFileUploadDropzone"] {
    display: none !important;
    height: 0 !important;
    overflow: hidden !important;
}

/* =======================================================================
   UPLOADED FILE CARD
   ======================================================================= */
[data-testid="stUploadedFile"] {
    background: #1e293b !important;
    border: none !important;
    border-radius: 8px !important;
    padding: 14px 50px 14px 14px !important;
    width: 100% !important;
    position: relative !important;
    overflow: hidden !important;
    margin-top: 8px !important;
}
[data-testid="stUploadedFile"] span,
[data-testid="stUploadedFile"] small { color: #f8fafc !important; font-size: 14px !important; }
[data-testid="stUploadedFile"] svg { display: none !important; }
[data-testid="stUploadedFile"] button {
    background: transparent !important; border: none !important;
    position: absolute !important; right: 12px !important; top: 50% !important;
    transform: translateY(-50%) scale(1.4) !important; z-index: 10 !important;
}
[data-testid="stUploadedFile"]::after {
    content: ''; position: absolute; bottom: 0; left: 0;
    height: 3px; width: 100%; background: #10b981;
    border-radius: 0 0 8px 8px;
}

/* =======================================================================
   DOWNLOAD BUTTON (after processing)
   ======================================================================= */
[data-testid="stColumn"]:nth-child(1) [data-testid="stDownloadButton"] { width: 100% !important; margin-top: 12px !important; }
[data-testid="stColumn"]:nth-child(1) [data-testid="stDownloadButton"] button {
    width: 100% !important; background-color: transparent !important;
    border: 1px solid #0ea5e9 !important; color: #0ea5e9 !important;
    border-radius: 8px !important; height: 45px !important;
    font-size: 15px !important; font-weight: bold !important; transition: 0.2s;
}
[data-testid="stColumn"]:nth-child(1) [data-testid="stDownloadButton"] button:hover { background: rgba(14, 165, 233, 0.1) !important; }

/* Kill Streamlit's global run spinner (top-right) */
[data-testid="stStatusWidget"] { display: none !important; }

/* =======================================================================
   NAV, HEADER, MODAL
   ======================================================================= */
.top-nav { display:flex; justify-content:flex-end; align-items:center; padding:10px 20px; position:absolute; top:0; right:0; width:100%; z-index:999; gap:12px; }
.guide-btn { color:#94a3b8; text-decoration:none; font-size:16px; font-weight:bold; font-family:sans-serif; border:1px solid #475569; border-radius:50%; width:28px; height:28px; display:flex; align-items:center; justify-content:center; background:#1e293b; transition:0.2s; }
.guide-btn:hover { color:white; border-color:#0ea5e9; transform:scale(1.1); background:#0ea5e9; }
.coffee-btn { color:#0ea5e9; text-decoration:none; font-weight:bold; font-size:12px; border:1px solid #0ea5e9; padding:4px 10px; border-radius:20px; transition:0.2s; white-space:nowrap; }
.coffee-btn:hover { background:rgba(14,165,233,0.15); color:#fff; }
.modal-window { position:fixed; background-color:rgba(0,0,0,0.85); backdrop-filter:blur(5px); top:0; right:0; bottom:0; left:0; z-index:99999; visibility:hidden; opacity:0; transition:all 0.3s; display:flex; justify-content:center; align-items:center; }
.modal-window:target { visibility:visible; opacity:1; }
.modal-content { background:#0f172a; width:90%; max-width:650px; padding:30px; border-radius:16px; border:1px solid #334155; color:#f1f5f9; position:relative; max-height:80vh; overflow-y:auto; box-shadow:0 10px 40px rgba(0,0,0,0.8); }
.modal-close { position:absolute; top:20px; right:25px; color:#64748b; text-decoration:none; font-size:28px; font-weight:bold; transition:0.2s; }
.modal-close:hover { color:#ef4444; }
.modal-content h2 { margin-top:0; color:#4f46e5; font-size:24px; border-bottom:1px solid #1e293b; padding-bottom:10px; }
.modal-content h4 { color:#0ea5e9; margin-top:20px; margin-bottom:10px; font-size:18px; }
.modal-content li { margin-bottom:10px; line-height:1.5; font-size:15px; color:#cbd5e1; }
.pro-tag { color:#10b981; font-weight:bold; }
.hero { text-align:center; color:white; padding:10px 0; max-width:500px; margin:0 auto; }
.logo-container { display:flex; align-items:center; justify-content:center; gap:10px; margin-bottom:0px; }
.logo-text { font-size:55px; font-weight:800; margin:0; color:#f8fafc; }
.logo-icon { font-size:48px; margin:0; }
.tagline { font-size:18px; color:#94a3b8; margin-top:-8px !important; margin-bottom:8px !important; font-weight:normal; }
.support-text { font-size:12px; color:#475569; margin-top:2px !important; margin-bottom:20px !important; }
@media (max-width:768px) { .top-nav { position:relative; justify-content:center; padding-top:20px; } }
</style>

<div class="top-nav">
  <a href="https://buymeacoffee.com/jpramirez" target="_blank" class="coffee-btn">☕ Buy me a coffee</a>
  <a href="#guide-modal" class="guide-btn" title="App Guide & Features">?</a>
</div>

<div id="guide-modal" class="modal-window">
  <div class="modal-content">
    <a href="#" class="modal-close" title="Close">&times;</a>
    <h2>📝 Welcome to NoteDump</h2>
    <p>Turning your documents into an interactive notebook.</p>
    <h4>✨ NoteDump Features & Guide</h4>
    <ul>
      <li>Providing an HTML based editor that allows for creating seamless interactive notebooks.</li>
      <li>Add pins to images to correctly identify them.</li>
      <li>Add audio or links that will allow a better review.</li>
      <li>Create reviewers with more freedom and specialized tools.</li>
    </ul>
    <h4>🚀 Why Use NoteDump?</h4>
    <ul>
      <li><span class="pro-tag">100% Offline Capable:</span> Once downloaded, your interactive notebook is a single HTML file that works perfectly without an internet connection.</li>
      <li><span class="pro-tag">Ultimate Privacy:</span> No accounts, no cloud syncing, no subscriptions. Your notes and files stay locally on your device.</li>
      <li><span class="pro-tag">Limitless Annotation:</span> Draw freely, drop sticky notes, create custom tables, and pin interactive markers directly onto your lecture slides.</li>
      <li><span class="pro-tag">Universal Compatibility:</span> Works natively on any modern device (desktop, tablet, or phone) using just a standard web browser.</li>
    </ul>
  </div>
</div>

<div class="hero">
  <div class="logo-container">
    <span class="logo-icon">📝</span>
    <span class="logo-text">NoteDump</span>
  </div>
  <p class="tagline">Turning your documents into an interactive notebook</p>
  <p class="support-text">PPTX • PPT • PDF</p>
</div>
""", unsafe_allow_html=True)

# ==========================================================================
# SECTION 2: PRE-GENERATE BLANK NOTEBOOK (CACHED)
# ==========================================================================
if "blank_html" not in st.session_state:
    blank_nav = '<div class="nav-link active-nav" id="link-0" onclick="goTo(\'0\')"><i class="fas fa-bars drag-handle"></i> <span class="nav-text">Page 1</span></div>'
    blank_slides = '<div id="p-0" class="page active" data-page-width="816" data-page-height="1054" style="width:816px; height:1054px;"></div>'
    unique_blank_id = f"New_Notebook_{int(time.time())}"
    st.session_state.blank_html = get_template(1)\
        .replace("{{NAV_LINKS}}", blank_nav)\
        .replace("{{SLIDE_CONTENT}}", blank_slides)\
        .replace("{{VISIBLE_TITLE}}", "New_Notebook")\
        .replace("{{STORAGE_ID}}", unique_blank_id)

# ==========================================================================
# SECTION 3: THE 2-COLUMN LAYOUT
# ==========================================================================
st.markdown('<div style="margin-bottom: 10px;"></div>', unsafe_allow_html=True)
col1, col2 = st.columns(2, gap="medium")

with col2:
    st.download_button(
        label="Create Blank Notebook",
        data=st.session_state.blank_html.encode('utf-8'),
        file_name="NoteDump_Blank.html",
        mime="text/html",
        use_container_width=True
    )

with col1:
    # KEY CHANGE: Put our custom icon+text into the FILE UPLOADER LABEL.
    # Streamlit renders the label INSIDE the dropzone, so it becomes part
    # of the same element — no separate HTML block stacking below it.
    # The label uses unsafe_allow_html via markdown, but st.file_uploader
    # does NOT support HTML in label. So we use a workaround:
    # render a st.markdown above with a negative margin to visually sit inside
    # the box, then hide the uploader's own label.

    # Step 1: Custom content rendered as markdown (pointer-events:none so clicks pass through)
    st.markdown("""
    <div style="
        display:flex; flex-direction:column; align-items:center; justify-content:center;
        text-align:center; gap:6px; padding:24px 20px 0 20px; pointer-events:none;
    ">
      <div style="font-size:42px; line-height:1;">📤</div>
      <div style="font-size:19px; font-weight:800; color:#f8fafc; line-height:1.3;">
        Convert file to an<br>interactive notebook
      </div>
      <div style="font-size:13px; color:#94a3b8; margin-top:2px;">
        200MB per file &bull; PPTX, PPT, PDF
      </div>
    </div>
    """, unsafe_allow_html=True)

    # Step 2: The actual uploader — label hidden, just the dropzone button shows
    up = st.file_uploader(
        "upload",                    # label text (hidden by CSS below)
        type=["pptx", "ppt", "pdf"],
        label_visibility="hidden"    # hides label entirely, no layout gap
    )

    # STATE 1: NO FILE
    if not up:
        st.session_state.final_html = None
        st.session_state.error_msg = None
        st.session_state.current_file_key = None

    # STATE 2: FILE UPLOADED
    else:
        file_key = f"{up.name}_{up.size}"

        if st.session_state.get("current_file_key") != file_key:
            st.session_state.current_file_key = file_key
            st.session_state.final_html = None
            st.session_state.error_msg = None

            st.markdown(f"**⚙️ Processing `{up.name}`...**")
            progress_bar = st.progress(0)

            for percent_complete in range(100):
                time.sleep(0.01)
                progress_bar.progress(percent_complete + 1)

            try:
                nav, slides = "", ""
                file_name = up.name.lower()
                total_pages = 0
                unique_storage_id = f"{file_name}_{int(time.time())}"
                base_w = 816
                base_h = 1054

                if file_name.endswith(('.pptx', '.ppt')):
                    ppt = Presentation(up)
                    total_pages = len(ppt.slides)
                    slide_width_emu = ppt.slide_width or 9144000
                    scale_w = base_w / slide_width_emu

                    def parse_shapes(shapes):
                        html_content = ""
                        for shape in shapes:
                            try:
                                if shape.shape_type == 6:
                                    html_content += parse_shapes(shape.shapes)
                                    continue
                                top = (shape.top * scale_w) if shape.top else 0
                                left = (shape.left * scale_w) if shape.left else 0
                                width = (shape.width * scale_w) if shape.width else 200
                                height = (shape.height * scale_w) if shape.height else 50

                                if shape.shape_type == 13:
                                    img_stream = BytesIO(shape.image.blob)
                                    base64_img = base64.b64encode(img_stream.getvalue()).decode()
                                    html_content += f'<div class="canvas-box" style="top:{top}px;left:{left}px;width:{width}px;height:{height}px;z-index:10;transform:translate(0px,0px);"><img src="data:image/png;base64,{base64_img}" style="width:100%;height:100%;object-fit:contain;"></div>'
                                elif shape.has_table:
                                    table_html = "<table style='width:100%;height:100%;border-collapse:collapse;font-size:12px;' border='1'>"
                                    for row in shape.table.rows:
                                        table_html += "<tr>"
                                        for cell in row.cells:
                                            table_html += f"<td style='padding:5px;'>{html.escape(cell.text)}</td>"
                                        table_html += "</tr>"
                                    table_html += "</table>"
                                    html_content += f'<div class="canvas-box" style="top:{top}px;left:{left}px;width:{width}px;background:rgba(255,255,255,0.9);z-index:15;transform:translate(0px,0px);"><div class="content-area">{table_html}</div></div>'
                                elif shape.has_text_frame and shape.text.strip():
                                    html_text = ""
                                    for paragraph in shape.text_frame.paragraphs:
                                        p_text = ""
                                        for run in paragraph.runs:
                                            r_txt = html.escape(run.text)
                                            fs_style = ""
                                            if hasattr(run.font, 'size') and run.font.size:
                                                pt_size = run.font.size.pt
                                                px_size = max(10, int(pt_size * scale_w * 12700 * 1.33))
                                                fs_style = f"font-size:{px_size}px;"
                                            if getattr(run.font, 'bold', False): r_txt = f"<strong>{r_txt}</strong>"
                                            if getattr(run.font, 'italic', False): r_txt = f"<em>{r_txt}</em>"
                                            if getattr(run.font, 'underline', False): r_txt = f"<u>{r_txt}</u>"
                                            p_text += f"<span style='{fs_style}'>{r_txt}</span>" if fs_style else r_txt
                                        html_text += "<br>" if not p_text.strip() else f"<div>{p_text}</div>"
                                    html_content += f'<div class="canvas-box" style="top:{top}px;left:{left}px;width:{width}px;min-height:{height}px;z-index:20;transform:translate(0px,0px);"><div class="content-area" style="word-wrap:break-word;white-space:pre-wrap;overflow-wrap:break-word;">{html_text}</div></div>'
                            except Exception:
                                continue
                        return html_content

                    for i, slide in enumerate(ppt.slides):
                        title_text = slide.shapes.title.text if slide.shapes.title else f"Slide {i+1}"
                        nav += f'<div class="nav-link" id="link-{i}" onclick="goTo(\'{i}\')"><i class="fas fa-bars drag-handle"></i> <span class="nav-text">{html.escape(title_text)}</span></div>'
                        slides += f'<div id="p-{i}" class="page {"active" if i==0 else ""}" data-page-height="{base_h}" style="height:{base_h}px;">'
                        slides += parse_shapes(slide.shapes)
                        slides += '</div>'

                elif file_name.endswith('.pdf'):
                    doc = fitz.open(stream=up.read(), filetype="pdf")
                    total_pages = len(doc)
                    for i, page in enumerate(doc):
                        page_width = page.rect.width
                        page_height = page.rect.height
                        p_scale = base_w / page_width if page_width > 0 else 1
                        scaled_height = max(1054, int(page_height * p_scale))
                        nav += f'<div class="nav-link" id="link-{i}" onclick="goTo(\'{i}\')"><i class="fas fa-bars drag-handle"></i> <span class="nav-text">Page {i+1}</span></div>'
                        slides += f'<div id="p-{i}" class="page {"active" if i==0 else ""}" data-page-height="{scaled_height}" style="height:{scaled_height}px;">'
                        blocks = page.get_text("dict")["blocks"]
                        html_content = ""
                        for b in blocks:
                            bbox = b["bbox"]
                            top = bbox[1] * p_scale
                            left = bbox[0] * p_scale
                            width = (bbox[2] - bbox[0]) * p_scale
                            height = (bbox[3] - bbox[1]) * p_scale
                            if b["type"] == 0:
                                text_html = ""
                                for line in b["lines"]:
                                    line_html = ""
                                    for span in line["spans"]:
                                        txt = html.escape(span["text"])
                                        if not txt.strip():
                                            line_html += " "
                                            continue
                                        px_size = max(10, int(span["size"] * p_scale))
                                        if span["flags"] & 16: txt = f"<strong>{txt}</strong>"
                                        if span["flags"] & 2: txt = f"<em>{txt}</em>"
                                        line_html += f"<span style='font-size:{px_size}px;'>{txt}</span>"
                                    text_html += "<br>" if not line_html.strip() else f"<div>{line_html}</div>"
                                html_content += f'<div class="canvas-box" style="top:{top}px;left:{left}px;width:{width}px;min-height:{height}px;z-index:20;transform:translate(0px,0px);"><div class="content-area" style="word-wrap:break-word;white-space:pre-wrap;overflow-wrap:break-word;font-family:sans-serif;">{text_html}</div></div>'
                            elif b["type"] == 1:
                                img_bytes = b.get("image")
                                if img_bytes:
                                    base64_img = base64.b64encode(img_bytes).decode()
                                    html_content += f'<div class="canvas-box" style="top:{top}px;left:{left}px;width:{width}px;height:{height}px;z-index:10;transform:translate(0px,0px);"><img src="data:image/png;base64,{base64_img}" style="width:100%;height:100%;object-fit:contain;"></div>'
                        slides += html_content + '</div>'

                dimension_script = f"""<script>
                document.addEventListener("DOMContentLoaded", function() {{
                    var cvs = document.getElementById('canvas');
                    if(cvs) {{
                        cvs.style.width = '{base_w}px';
                        cvs.setAttribute('data-width', '{base_w}');
                        var wInput = document.getElementById('canvas-w-cm');
                        var hInput = document.getElementById('canvas-h-cm');
                        if(wInput) wInput.value = (Math.round(({base_w}/37.795)*10)/10).toFixed(1);
                        if(hInput) hInput.value = (Math.round((parseInt(cvs.style.height)/37.795)*10)/10).toFixed(1);
                    }}
                }});
                </script>"""

                st.session_state.final_html = get_template(total_pages)\
                    .replace("{{NAV_LINKS}}", nav)\
                    .replace("{{SLIDE_CONTENT}}", dimension_script + slides)\
                    .replace("{{VISIBLE_TITLE}}", html.escape(up.name))\
                    .replace("{{STORAGE_ID}}", html.escape(unique_storage_id))

            except Exception as e:
                err_msg = str(e).lower()
                if "not a zip file" in err_msg or "badzipfile" in err_msg:
                    st.session_state.error_msg = "🚨 FORMAT ERROR: You uploaded an older `.ppt` file. Please save as `.pptx` and re-upload."
                elif "has no attribute 'open'" in err_msg:
                    st.session_state.error_msg = "🚨 REPLIT PACKAGE ERROR: Run `pip uninstall fitz -y` then `pip install PyMuPDF -y` in the Shell and restart."
                else:
                    st.session_state.error_msg = f"Error Processing File: {e}"

            progress_bar.empty()

        if st.session_state.get("error_msg"):
            st.error(st.session_state.error_msg)
        elif st.session_state.get("final_html"):
            st.download_button(
                label="📥 Download Interactive Notebook",
                data=st.session_state.final_html.encode('utf-8'),
                file_name=f"NoteDump_{up.name}.html",
                mime="text/html",
                use_container_width=True
            )
