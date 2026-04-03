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

/* Modal Content Styling */
.modal-content h2 { margin-top: 0; color: #4f46e5; font-size: 24px; border-bottom: 1px solid #1e293b; padding-bottom: 10px;}
.modal-content h4 { color: #0ea5e9; margin-top: 20px; margin-bottom: 10px; font-size: 18px;}
.modal-content li { margin-bottom: 10px; line-height: 1.5; font-size: 15px; color: #cbd5e1;}
.pro-tag { color: #10b981; font-weight: bold; } 

.hero { text-align: center; color: white; padding: 10px 0; max-width: 500px; margin: 0 auto; }
.logo-container { display: flex; align-items: center; justify-content: center; gap: 10px; margin-bottom: 0px;}
.logo-text { font-size: 55px; font-weight: 800; margin: 0; color: #f8fafc;}
.logo-icon { font-size: 48px; margin: 0;}
.tagline { font-size: 18px; color: #94a3b8; margin-top: -8px !important; margin-bottom: 8px !important; font-weight: normal; }
.support-text { font-size: 12px; color: #475569; margin-top: 2px !important; margin-bottom: 20px !important; }

/* =========================================
   1. FORCE LEFT BOX (UPLOADER) TO 220PX & HIDE LABEL
   ========================================= */
/* THIS IS STEP 2: ASSASSINATE THE LABEL */
[data-testid="stFileUploader"] > label { 
    display: none !important; 
}

[data-testid="stFileUploader"] { 
    width: 100% !important; margin: 0 !important; padding: 0 !important; 
}

[data-testid="stFileUploadDropzone"] { 
    height: 220px !important; 
    min-height: 220px !important; 
    background-color: #0f172a !important; 
    border: 1px dashed #334155 !important;
    border-radius: 12px !important; 
    display: flex !important; 
    flex-direction: column !important; 
    justify-content: center !important; 
    align-items: center !important; 
    padding: 20px !important;
    text-align: center !important; 
    box-sizing: border-box !important;
}
[data-testid="stFileUploadDropzone"] > div,
[data-testid="stFileUploadDropzone"] > div > div { 
    display: flex !important; flex-direction: column !important; align-items: center !important; justify-content: center !important; text-align: center !important; width: 100% !important; 
}
[data-testid="stFileUploadDropzone"] span { font-size: 16px !important; font-weight: bold !important; color:#e2e8f0 !important; line-height: 1.2 !important; text-align: center !important; margin: 0 auto !important;}
[data-testid="stFileUploadDropzone"] small { font-size: 13px !important; color: #64748b !important; text-align: center !important; margin: 0 auto !important;}
[data-testid="stFileUploadDropzone"] button { 
    background-color: #4f46e5 !important; color: #ffffff !important; border: none !important; padding: 10px 24px !important; border-radius: 6px !important; font-weight: bold !important; margin-top: 15px !important; font-size: 15px !important; margin-left: auto !important; margin-right: auto !important; 
}

/* =========================================
   2. CUSTOM INJECTED BLANK NOTEBOOK LAYOUT
   ========================================= */
[data-testid="stColumn"]:nth-child(2) [data-testid="stDownloadButton"] button,
[data-testid="column"]:nth-child(2) [data-testid="stDownloadButton"] button {
    height: 220px !important; 
    min-height: 220px !important; 
    width: 100% !important; 
    margin: 0 !important;
    background-color: #0f172a !important; border: 1px solid #1e293b !important; border-radius: 12px !important;
    display: flex !important; flex-direction: row !important;
    justify-content: center !important; align-items: center !important;
    transition: 0.2s; padding: 0 !important;
    box-sizing: border-box !important;
}
[data-testid="stColumn"]:nth-child(2) [data-testid="stDownloadButton"] button:hover,
[data-testid="column"]:nth-child(2) [data-testid="stDownloadButton"] button:hover { 
    border-color: #0ea5e9 !important; background: rgba(14, 165, 233, 0.1) !important; 
}

/* Completely hide Streamlit's default text wrappers */
[data-testid="stColumn"]:nth-child(2) [data-testid="stDownloadButton"] button div,
[data-testid="column"]:nth-child(2) [data-testid="stDownloadButton"] button div,
[data-testid="stColumn"]:nth-child(2) [data-testid="stDownloadButton"] button p,
[data-testid="column"]:nth-child(2) [data-testid="stDownloadButton"] button p,
[data-testid="stColumn"]:nth-child(2) [data-testid="stDownloadButton"] button span,
[data-testid="column"]:nth-child(2) [data-testid="stDownloadButton"] button span {
    display: none !important;
}

/* Inject Giant Icon on the Left */
[data-testid="stColumn"]:nth-child(2) [data-testid="stDownloadButton"] button::before,
[data-testid="column"]:nth-child(2) [data-testid="stDownloadButton"] button::before {
    content: "📓";
    font-size: 70px !important; 
    margin-right: 15px !important; 
    line-height: 1 !important;
    display: block !important;
}

/* Inject Stacked Text on the Right */
[data-testid="stColumn"]:nth-child(2) [data-testid="stDownloadButton"] button::after,
[data-testid="column"]:nth-child(2) [data-testid="stDownloadButton"] button::after {
    content: "Create\\A Blank\\A Notebook"; 
    white-space: pre !important; 
    font-size: 28px !important; 
    font-weight: 800 !important; 
    color: #f8fafc !important; 
    line-height: 1.1 !important;
    text-align: left !important; 
    letter-spacing: -1px !important;
    display: block !important;
}

/* =========================================
   3. FORCE UPLOADED FILE BAR TO SPAN & PROTECT X
   ========================================= */
[data-testid="stUploadedFile"], 
div[data-testid*="UploadedFile"],
div[data-testid*="FileUploaderFile"],
.stUploadedFile { 
    background-color: #0f172a !important; border: 1px solid #334155 !important; border-radius: 12px !important; 
    padding: 15px 20px !important; margin-top: 20px !important;
    position: relative !important; display: block !important;
}
[data-testid="stUploadedFile"] > div:first-child,
div[data-testid*="UploadedFile"] > div:first-child { 
    padding-right: 60px !important; width: 100% !important; box-sizing: border-box !important;
}
[data-testid="stUploadedFile"] button,
div[data-testid*="UploadedFile"] button { 
    position: absolute !important; right: 15px !important; top: 50% !important; transform: translateY(-50%) !important;
    margin: 0 !important; width: 35px !important; height: 35px !important; 
    background: #4f46e5 !important; border-radius: 8px !important; color: white !important; border: none !important;
}

/* =========================================
   4. FINAL DOWNLOAD BUTTON FORMATTING
   ========================================= */
.final-download-target [data-testid="stDownloadButton"] button {
    width: 100% !important; height: auto !important; padding: 18px !important; margin-top: 10px !important;
    background: #1e293b !important; color: #0ea5e9 !important; border: 1px solid #0ea5e9 !important; border-radius: 8px !important;
    font-size: 18px !important; font-weight: bold !important; transition: 0.2s;
}
.final-download-target [data-testid="stDownloadButton"] button:hover { background: #0ea5e9 !important; color: white !important; }

/* Desktop Spanning Hack */
@media (min-width: 769px) {
    [data-testid="stUploadedFile"], 
    div[data-testid*="UploadedFile"],
    .final-download-target [data-testid="stDownloadButton"] button { 
        width: calc(200% + 1rem) !important; 
    }
}
@media (max-width: 768px) {
    .top-nav { position: relative; justify-content: center; padding-top: 20px; }
}

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
# SECTION 2: PRE-GENERATE BLANK NOTEBOOK (CACHED TO PREVENT DOUBLE-CLICK BUG)
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
    # THIS IS STEP 1: FORCE FULL MODE (NO "label_visibility" TRICKS)
    up = st.file_uploader("Upload a document", type=["pptx", "ppt", "pdf"])

    # ==========================================================================
    # SECTION 4: FILE PARSING & PROCESSING
    # ==========================================================================
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
                                    html_content += f'''
                                    <div class="canvas-box" style="top:{top}px; left:{left}px; width:{width}px; height:{height}px; z-index:10; transform: translate(0px, 0px);">
                                        <img src="data:image/png;base64,{base64_img}" style="width:100%; height:100%; object-fit:contain;">
                                    </div>'''

                                elif shape.has_table:
                                    table_html = "<table style='width:100%; height:100%; border-collapse: collapse; font-size:12px;' border='1'>"
                                    for row in shape.table.rows:
                                        table_html += "<tr>"
                                        for cell in row.cells:
                                            table_html += f"<td style='padding:5px;'>{html.escape(cell.text)}</td>"
                                        table_html += "</tr>"
                                    table_html += "</table>"
                                    html_content += f'''
                                    <div class="canvas-box" style="top:{top}px; left:{left}px; width:{width}px; background:rgba(255,255,255,0.9); z-index:15; transform: translate(0px, 0px);">
                                        <div class="content-area">{table_html}</div>
                                    </div>'''

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

                                            if getattr(run.font, 'bold', False) == True: r_txt = f"<strong>{r_txt}</strong>"
                                            if getattr(run.font, 'italic', False) == True: r_txt = f"<em>{r_txt}</em>"
                                            if getattr(run.font, 'underline', False) == True: r_txt = f"<u>{r_txt}</u>"

                                            if fs_style: p_text += f"<span style='{fs_style}'>{r_txt}</span>"
                                            else: p_text += r_txt

                                        if not p_text.strip(): html_text += "<br>"
                                        else: html_text += f"<div>{p_text}</div>"

                                    html_content += f'''
                                    <div class="canvas-box" style="top:{top}px; left:{left}px; width:{width}px; min-height:{height}px; z-index:20; transform: translate(0px, 0px);">
                                        <div class="content-area" style="word-wrap: break-word; white-space: pre-wrap; overflow-wrap: break-word;">{html_text}</div>
                                    </div>'''
                            except Exception as e:
                                continue 
                        return html_content

                    for i, slide in enumerate(ppt.slides):
                        title_text = slide.shapes.title.text if slide.shapes.title else f"Slide {i+1}"
                        nav += f'<div class="nav-link" id="link-{i}" onclick="goTo(\'{i}\')"><i class="fas fa-bars drag-handle"></i> <span class="nav-text">{html.escape(title_text)}</span></div>'
                        slides += f'<div id="p-{i}" class="page {"active" if i==0 else ""}" data-page-height="{base_h}" style="height:{base_h}px;"> '
                        slides += parse_shapes(slide.shapes)
                        slides += '</div>'

                elif file_name.endswith('.pdf'):
                    doc = fitz.open(stream=up.read(), filetype="pdf")
                    total_pages = len(doc)

                    first_page = doc[0]
                    base_w = 816
                    p_scale = base_w / first_page.rect.width if first_page.rect.width > 0 else 1

                    for i, page in enumerate(doc):
                        page_width = page.rect.width
                        page_height = page.rect.height
                        p_scale = base_w / page_width if page_width > 0 else 1
                        scaled_height = max(1054, int(page_height * p_scale))

                        nav += f'<div class="nav-link" id="link-{i}" onclick="goTo(\'{i}\')"><i class="fas fa-bars drag-handle"></i> <span class="nav-text">Page {i+1}</span></div>'
                        slides += f'<div id="p-{i}" class="page {"active" if i==0 else ""}" data-page-height="{scaled_height}" style="height:{scaled_height}px;"> '

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
                                        fs_style = f"font-size:{px_size}px;"

                                        if span["flags"] & 16: txt = f"<strong>{txt}</strong>"
                                        if span["flags"] & 2: txt = f"<em>{txt}</em>"

                                        line_html += f"<span style='{fs_style}'>{txt}</span>"

                                    if not line_html.strip(): text_html += "<br>"
                                    else: text_html += f"<div>{line_html}</div>"

                                html_content += f'''
                                <div class="canvas-box" style="top:{top}px; left:{left}px; width:{width}px; min-height:{height}px; z-index:20; transform: translate(0px, 0px);">
                                    <div class="content-area" style="word-wrap: break-word; white-space: pre-wrap; overflow-wrap: break-word; font-family: sans-serif;">{text_html}</div>
                                </div>'''

                            elif b["type"] == 1: 
                                img_bytes = b.get("image")
                                if img_bytes:
                                    base64_img = base64.b64encode(img_bytes).decode()
                                    html_content += f'''
                                    <div class="canvas-box" style="top:{top}px; left:{left}px; width:{width}px; height:{height}px; z-index:10; transform: translate(0px, 0px);">
                                        <img src="data:image/png;base64,{base64_img}" style="width:100%; height:100%; object-fit:contain;">
                                    </div>'''

                        slides += html_content
                        slides += '</div>'

                dimension_script = f"""
                <script>
                    document.addEventListener("DOMContentLoaded", function() {{
                        var cvs = document.getElementById('canvas');
                        if(cvs) {{
                            cvs.style.width = '{base_w}px';
                            cvs.setAttribute('data-width', '{base_w}');
                            var wInput = document.getElementById('canvas-w-cm');
                            var hInput = document.getElementById('canvas-h-cm');
                            if(wInput) wInput.value = (Math.round(({base_w} / 37.795) * 10) / 10).toFixed(1);
                            if(hInput) hInput.value = (Math.round((parseInt(cvs.style.height) / 37.795) * 10) / 10).toFixed(1);
                        }}
                    }});
                </script>
                """

                # Save the final parsed result into session memory
                st.session_state.final_html = get_template(total_pages)\
                    .replace("{{NAV_LINKS}}", nav)\
                    .replace("{{SLIDE_CONTENT}}", dimension_script + slides)\
                    .replace("{{VISIBLE_TITLE}}", html.escape(up.name))\
                    .replace("{{STORAGE_ID}}", html.escape(unique_storage_id))

            except Exception as e:
                err_msg = str(e).lower()
                if "not a zip file" in err_msg or "badzipfile" in err_msg:
                    st.session_state.error_msg = "🚨 FORMAT ERROR: You uploaded an older `.ppt` file. Python-PPTX only supports modern `.pptx` files. Please open your file in PowerPoint, click 'Save As', choose `.pptx`, and upload the new file."
                elif "has no attribute 'open'" in err_msg:
                    st.session_state.error_msg = "🚨 REPLIT PACKAGE ERROR: You have the wrong 'fitz' package installed. Please open the Shell tab, run `pip uninstall fitz -y`, then run `pip install PyMuPDF -y` and restart the app."
                else:
                    st.session_state.error_msg = f"Error Processing File: {e}"

        # OUTPUT STAGE: Render error or the cached download button
        if st.session_state.get("error_msg"):
            st.error(st.session_state.error_msg)
        elif st.session_state.get("final_html"):
            with col1:
                st.markdown('<div class="final-download-target">', unsafe_allow_html=True)
                st.download_button(
                    label="📥 Download Interactive Notebook", 
                    data=st.session_state.final_html.encode('utf-8'), 
                    file_name=f"NoteDump_{up.name}.html", 
                    mime="text/html",
                    use_container_width=True
                )
                st.markdown('</div>', unsafe_allow_html=True)
