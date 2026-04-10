import streamlit as st
from pptx import Presentation
import html 
import base64
import time
from io import BytesIO
from template import get_template

# Bypassing the Replit Auto-Installer Bug
try:
    import pymupdf as fitz
except ImportError:
    import fitz

st.set_page_config(page_title="NoteDump", layout="centered", initial_sidebar_state="collapsed")

# ==========================================================================
# SECTION 1: UI STYLING & MODAL CONTENT
# ==========================================================================
st.markdown("""
<style>
.stApp { background-color: #000000; }

/* Unlock Streamlit Columns so elements can span across them */
[data-testid="stColumn"], [data-testid="column"] { overflow: visible !important; }

/* Nav & Header */
.top-nav { display: flex; justify-content: flex-end; align-items: center; padding: 10px 20px; position: absolute; top: 0; right: 0; width: 100%; z-index: 999; gap: 12px; }
.guide-btn { color: #94a3b8; text-decoration: none; font-size: 16px; font-weight: bold; font-family: sans-serif; border: 1px solid #475569; border-radius: 50%; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; background: #1e293b; transition: 0.2s; }
.guide-btn:hover { color: white; border-color: #0ea5e9; transform: scale(1.1); background: #0ea5e9;}
.coffee-btn { color: #0ea5e9; text-decoration: none; font-weight: bold; font-size: 12px; border: 1px solid #0ea5e9; padding: 4px 10px; border-radius: 20px; transition: 0.2s; white-space: nowrap; }
.coffee-btn:hover { background: rgba(14, 165, 233, 0.15); color: #fff; }

.modal-window { position: fixed; background-color: rgba(0, 0, 0, 0.85); backdrop-filter: blur(5px); top: 0; right: 0; bottom: 0; left: 0; z-index: 99999; visibility: hidden; opacity: 0; transition: all 0.3s; display: flex; justify-content: center; align-items: center; }
.modal-window:target { visibility: visible; opacity: 1; }
.modal-content { background: #0f172a; width: 90%; max-width: 650px; padding: 30px; border-radius: 16px; border: 1px solid #334155; color: #f1f5f9; position: relative; max-height: 80vh; overflow-y: auto; box-shadow: 0 10px 40px rgba(0,0,0,0.8); }
.modal-close { position: absolute; top: 20px; right: 25px; color: #64748b; text-decoration: none; font-size: 28px; font-weight: bold; transition: 0.2s; }
.modal-close:hover { color: #ef4444; }

.hero { text-align: center; color: white; padding: 10px 0; max-width: 500px; margin: 0 auto; }
.logo-container { display: flex; align-items: center; justify-content: center; gap: 10px; margin-bottom: 0px;}
.logo-text { font-size: 55px; font-weight: 800; margin: 0; color: #f8fafc;}
.logo-icon { font-size: 48px; margin: 0;}
.tagline { font-size: 18px; color: #94a3b8; margin-top: -8px !important; margin-bottom: 8px !important; font-weight: normal; }
.support-text { font-size: 12px; color: #475569; margin-top: 2px !important; margin-bottom: 20px !important; }

/* =======================================================================
   1. COLUMN WRAPPERS
   ======================================================================= */
[data-testid="stColumn"]:nth-child(1),
[data-testid="stColumn"]:nth-child(2) {
    background-color: #0f172a !important;
    border-radius: 12px !important;
    height: 240px !important;
    padding: 20px !important;
    box-sizing: border-box !important;
    display: flex !important;
    flex-direction: column !important;
}

/* Left Box Border (Upload) */
[data-testid="stColumn"]:nth-child(1) { border: 1px dashed #334155 !important; }

/* Right Box Border (Blank Notebook) */
[data-testid="stColumn"]:nth-child(2) {
    border: 1px solid #1e293b !important;
    transition: 0.2s !important;
}
[data-testid="stColumn"]:nth-child(2):hover {
    border-color: #0ea5e9 !important;
    background: rgba(14, 165, 233, 0.1) !important;
}

/* Vertical centering within columns */
[data-testid="stColumn"] > div[data-testid="stVerticalBlock"] {
    height: 100% !important;
    display: flex !important;
    flex-direction: column !important;
    justify-content: center !important;
    align-items: center !important;
    width: 100% !important;
    gap: 0 !important; 
}

/* =======================================================================
   2. LEFT BOX: UPLOAD UI
   ======================================================================= */
.upload-heading {
    font-size: 24px;
    font-weight: 800;
    color: #f8fafc;
    margin-bottom: 15px;
    text-align: center;
    line-height: 1.1;
    letter-spacing: -1px;
}

[data-testid="stFileUploader"] > label { display: none !important; }
[data-testid="stFileUploader"], [data-testid="stFileUploadDropzone"] {
    background: transparent !important; border: none !important; padding: 0 !important;
}

/* Center and clean up the dropzone */
[data-testid="stFileUploadDropzone"] svg, 
[data-testid="stFileUploadDropzone"] div[data-testid="stMarkdownContainer"] p {
    display: none !important;
}

[data-testid="stFileUploadDropzone"] > div {
    display: flex !important; flex-direction: column !important; align-items: center !important; justify-content: center !important; width: 100% !important;
}

/* Center the small limit text */
[data-testid="stFileUploadDropzone"] small {
    order: 2 !important; font-size: 13px !important; color: #475569 !important; margin-top: 10px !important; display: block !important; text-align: center !important;
}

/* Center and style the Browse button */
[data-testid="stFileUploadDropzone"] button {
    order: 1 !important; background-color: #1e293b !important; color: transparent !important; border: 1px solid #334155 !important; border-radius: 8px !important; width: 140px !important; height: 42px !important; position: relative !important; display: flex !important; align-items: center !important; justify-content: center !important; margin: 0 auto !important;
}
[data-testid="stFileUploadDropzone"] button:hover { background-color: #4f46e5 !important; border-color: #4f46e5 !important;}
[data-testid="stFileUploadDropzone"] button::after {
    content: "Browse files" !important; position: absolute !important; color: #ffffff !important; font-size: 15px !important; font-weight: bold !important; display: flex; align-items: center; justify-content: center;
}

/* =======================================================================
   3. ACTIVE STATE: HIDE DEFAULT UI WHEN FILE UPLOADED
   ======================================================================= */
div[data-testid="stColumn"]:has([data-testid="stUploadedFile"]) .upload-heading,
div[data-testid="stColumn"]:has([data-testid="stUploadedFile"]) [data-testid="stFileUploadDropzone"] {
    display: none !important;
}

/* Progress Bar / Uploaded File Styling */
[data-testid="stUploadedFile"] {
    background: rgba(30, 41, 59, 0.7) !important;
    border: 1px solid #0ea5e9 !important;
    border-radius: 12px !important;
    padding: 15px !important;
    width: 100% !important;
}

/* =======================================================================
   4. RIGHT BOX: BLANK NOTEBOOK
   ======================================================================= */
[data-testid="stColumn"]:nth-child(2) [data-testid="stDownloadButton"] { height: 100% !important; width: 100% !important; margin: 0 !important; }
[data-testid="stColumn"]:nth-child(2) [data-testid="stDownloadButton"] button {
    background: transparent !important; border: none !important; box-shadow: none !important;
    height: 100% !important; width: 100% !important;
    display: flex !important; flex-direction: row !important; justify-content: center !important; align-items: center !important;
}
[data-testid="stColumn"]:nth-child(2) [data-testid="stDownloadButton"] button * { display: none !important; }
[data-testid="stColumn"]:nth-child(2) [data-testid="stDownloadButton"] button::before { content: "📓"; font-size: 70px !important; margin-right: 15px !important; }
[data-testid="stColumn"]:nth-child(2) [data-testid="stDownloadButton"] button::after {
    content: "Create\\A Blank\\A Notebook"; white-space: pre !important; font-size: 26px !important; 
    font-weight: 800 !important; color: #f8fafc !important; line-height: 1.1 !important; text-align: left !important; letter-spacing: -1px !important;
}

/* =======================================================================
   5. FINAL DOWNLOAD BUTTON (LEFT BOX)
   ======================================================================= */
.final-download-target { width: 100% !important; margin-top: 15px !important; }
.final-download-target [data-testid="stDownloadButton"] button {
    width: 100% !important; height: 50px !important; background: #0ea5e9 !important; color: white !important; border: none !important; border-radius: 8px !important; font-size: 16px !important; font-weight: bold !important;
}

@media (max-width: 768px) { .top-nav { position: relative; justify-content: center; padding-top: 20px; } }
[data-testid="block-container"] { max-width: 800px; padding-top: 3rem; }
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
# SECTION 2: LOGIC & PROCESSING
# ==========================================================================
if "blank_html" not in st.session_state:
    unique_blank_id = f"New_Notebook_{int(time.time())}"
    st.session_state.blank_html = get_template(1)\
        .replace("{{NAV_LINKS}}", '<div class="nav-link active-nav" id="link-0" onclick="goTo(\'0\')"><span class="nav-text">Page 1</span></div>')\
        .replace("{{SLIDE_CONTENT}}", '<div id="p-0" class="page active" style="width:816px; height:1054px;"></div>')\
        .replace("{{VISIBLE_TITLE}}", "New_Notebook")\
        .replace("{{STORAGE_ID}}", unique_blank_id)

st.markdown('<div style="margin-bottom: 10px;"></div>', unsafe_allow_html=True)
col1, col2 = st.columns(2, gap="medium")

with col2:
    st.download_button(label="Create Blank Notebook", data=st.session_state.blank_html.encode('utf-8'), file_name="NoteDump_Blank.html", mime="text/html", use_container_width=True)

with col1:
    st.markdown('<div class="upload-heading">Convert file to<br>interactive notebook</div>', unsafe_allow_html=True)
    up = st.file_uploader("Upload a document", label_visibility="hidden", type=["pptx", "ppt", "pdf"])

    if up:
        file_key = f"{up.name}_{up.size}"
        if st.session_state.get("current_file_key") != file_key:
            st.session_state.current_file_key = file_key
            st.session_state.final_html = None
            st.session_state.error_msg = None

            try:
                nav, slides = "", ""
                file_name = up.name.lower()
                total_pages = 0
                unique_storage_id = f"{file_name}_{int(time.time())}"
                base_w, base_h = 816, 1054

                if file_name.endswith(('.pptx', '.ppt')):
                    ppt = Presentation(up)
                    total_pages = len(ppt.slides)
                    scale_w = base_w / (ppt.slide_width or 9144000)

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

                                if shape.shape_type == 13: # Image
                                    img_stream = BytesIO(shape.image.blob)
                                    base64_img = base64.b64encode(img_stream.getvalue()).decode()
                                    html_content += f'<div class="canvas-box" style="top:{top}px; left:{left}px; width:{width}px; height:{height}px; z-index:10;"><img src="data:image/png;base64,{base64_img}" style="width:100%; height:100%; object-fit:contain;"></div>'
                                elif shape.has_table: # Table
                                    t_html = "<table style='width:100%; border-collapse: collapse; font-size:12px;' border='1'>"
                                    for row in shape.table.rows:
                                        t_html += "<tr>" + "".join([f"<td style='padding:5px;'>{html.escape(c.text)}</td>" for c in row.cells]) + "</tr>"
                                    t_html += "</table>"
                                    html_content += f'<div class="canvas-box" style="top:{top}px; left:{left}px; width:{width}px; background:rgba(255,255,255,0.9); z-index:15;"><div class="content-area">{t_html}</div></div>'
                                elif shape.has_text_frame and shape.text.strip(): # Text
                                    html_text = "".join([f"<div>{html.escape(p.text)}</div>" for p in shape.text_frame.paragraphs])
                                    html_content += f'<div class="canvas-box" style="top:{top}px; left:{left}px; width:{width}px; min-height:{height}px; z-index:20;"><div class="content-area" style="word-wrap: break-word; white-space: pre-wrap;">{html_text}</div></div>'
                            except: continue
                        return html_content

                    for i, slide in enumerate(ppt.slides):
                        t = slide.shapes.title.text if slide.shapes.title else f"Slide {i+1}"
                        nav += f'<div class="nav-link" onclick="goTo(\'{i}\')"><span class="nav-text">{html.escape(t)}</span></div>'
                        slides += f'<div id="p-{i}" class="page {"active" if i==0 else ""}" style="height:{base_h}px;">{parse_shapes(slide.shapes)}</div>'

                elif file_name.endswith('.pdf'):
                    doc = fitz.open(stream=up.read(), filetype="pdf")
                    total_pages = len(doc)
                    for i, page in enumerate(doc):
                        p_scale = base_w / page.rect.width if page.rect.width > 0 else 1
                        scaled_h = max(1054, int(page.rect.height * p_scale))
                        nav += f'<div class="nav-link" onclick="goTo(\'{i}\')"><span class="nav-text">Page {i+1}</span></div>'
                        slides += f'<div id="p-{i}" class="page {"active" if i==0 else ""}" style="height:{scaled_h}px;">'
                        for b in page.get_text("dict")["blocks"]:
                            bbox = b["bbox"]
                            t, l, w, h = bbox[1]*p_scale, bbox[0]*p_scale, (bbox[2]-bbox[0])*p_scale, (bbox[3]-bbox[1])*p_scale
                            if b["type"] == 0: # Text
                                txt = "".join(["".join([html.escape(s["text"]) for s in ln["spans"]]) for ln in b["lines"]])
                                slides += f'<div class="canvas-box" style="top:{t}px; left:{l}px; width:{w}px;"><div class="content-area">{txt}</div></div>'
                            elif b["type"] == 1: # Image
                                b64 = base64.b64encode(b.get("image")).decode()
                                slides += f'<div class="canvas-box" style="top:{t}px; left:{l}px; width:{w}px; height:{h}px;"><img src="data:image/png;base64,{b64}" style="width:100%; height:100%; object-fit:contain;"></div>'
                        slides += '</div>'

                st.session_state.final_html = get_template(total_pages).replace("{{NAV_LINKS}}", nav).replace("{{SLIDE_CONTENT}}", slides).replace("{{VISIBLE_TITLE}}", html.escape(up.name)).replace("{{STORAGE_ID}}", html.escape(unique_storage_id))
            except Exception as e:
                st.session_state.error_msg = f"Error: {e}"

        if st.session_state.get("error_msg"):
            st.error(st.session_state.error_msg)
        elif st.session_state.get("final_html"):
            st.markdown('<div class="final-download-target">', unsafe_allow_html=True)
            st.download_button(label="📥 Download Interactive Notebook", data=st.session_state.final_html.encode('utf-8'), file_name=f"NoteDump_{up.name}.html", mime="text/html", use_container_width=True)
            st.markdown('</div>', unsafe_allow_html=True)
