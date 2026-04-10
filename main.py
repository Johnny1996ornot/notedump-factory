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

/* 1. COLUMN SIZES AND STRUCTURE */
[data-testid="stColumn"] {
    background-color: #0f172a !important;
    border-radius: 16px !important;
    min-height: 400px !important; /* Enforces height so elements aren't sandwiched */
    padding: 30px !important;
    display: flex !important;
    flex-direction: column !important;
}

/* Left Column Border */
[data-testid="stColumn"]:nth-child(1) { border: 1px dashed #334155 !important; }

/* Right Column Border */
[data-testid="stColumn"]:nth-child(2) { border: 1px solid #1e293b !important; }

/* Ensure the internal flexbox stretches full height to push download button down */
[data-testid="stColumn"] > div[data-testid="stVerticalBlock"] {
    height: 100% !important;
    display: flex !important;
    flex-direction: column !important;
    justify-content: flex-start !important;
    flex: 1 !important;
}

/* 2. LEFT BOX HEADING */
.upload-heading {
    font-size: 22px !important; /* Smaller text */
    font-weight: 800;
    color: #f8fafc;
    margin-top: 0px !important; /* Moved upward */
    margin-bottom: 20px !important;
    text-align: center;
    line-height: 1.2;
}

/* 3. UPLOAD DROPZONE (EMPTY STATE) */
[data-testid="stFileUploadDropzone"] {
    background-color: #1e293b !important;
    border: none !important;
    border-radius: 12px !important;
    padding: 30px 20px !important;
    display: flex !important;
    flex-direction: column !important;
    align-items: center !important; /* Strictly centers contents */
    justify-content: center !important;
}

/* Hide Streamlit's native SVG cloud and text */
[data-testid="stFileUploadDropzone"] > div > svg { display: none !important; }
[data-testid="stFileUploadDropzone"] > div > div[data-testid="stMarkdownContainer"] { display: none !important; }

/* Force internal wrappers to center */
[data-testid="stFileUploadDropzone"] > div {
    display: flex !important;
    flex-direction: column !important;
    align-items: center !important;
    width: 100% !important;
}

/* The custom ↑ Upload Button */
[data-testid="stFileUploadDropzone"] button {
    margin: 0 auto !important; /* PERFECT CENTERING */
    background-color: transparent !important;
    border: 1px solid #334155 !important;
    border-radius: 8px !important;
    width: 120px !important;
    height: 40px !important;
    position: relative;
    color: transparent !important; /* Hides 'Browse files' */
}
[data-testid="stFileUploadDropzone"] button:hover {
    background-color: rgba(255,255,255,0.05) !important;
}
[data-testid="stFileUploadDropzone"] button::after {
    content: "↑ Upload" !important;
    position: absolute;
    top: 50%; left: 50%;
    transform: translate(-50%, -50%);
    color: white !important;
    font-size: 14px !important;
    font-weight: 600 !important;
}

/* The Limit Text */
[data-testid="stFileUploadDropzone"] small {
    display: block !important;
    text-align: center !important; /* PERFECT CENTERING */
    color: #94a3b8 !important;
    margin-top: 15px !important;
    font-size: 13px !important;
}

/* 4. ACTIVE STATE (FILE UPLOADED) */
/* Reset dropzone padding so the + sign isn't massive */
div[data-testid="stFileUploader"]:has([data-testid="stUploadedFile"]) [data-testid="stFileUploadDropzone"] {
    background-color: transparent !important;
    padding: 10px !important;
    min-height: auto !important;
}

/* The Streamlit Progress Bar / File Box UI */
[data-testid="stUploadedFile"] {
    background-color: #1e293b !important;
    border-radius: 8px !important;
    border: none !important;
}

/* 5. DOWNLOAD BUTTON (LEFT COLUMN) */
/* Pushes the download button completely to the bottom, fixing the sandwich issue */
.final-download-target {
    margin-top: auto !important; 
    padding-top: 30px !important;
    width: 100% !important;
}
.final-download-target [data-testid="stDownloadButton"] button {
    width: 100% !important;
    background-color: transparent !important;
    border: 1px solid #334155 !important;
    color: white !important;
    border-radius: 8px !important;
    height: 45px !important;
}
.final-download-target [data-testid="stDownloadButton"] button:hover {
    background-color: rgba(255,255,255,0.05) !important;
}

/* 6. RIGHT COLUMN BLANK NOTEBOOK BUTTON */
[data-testid="stColumn"]:nth-child(2) [data-testid="stDownloadButton"] button {
    background: transparent !important; border: none !important;
    height: 100% !important; width: 100% !important;
    display: flex !important; align-items: center !important; justify-content: center !important;
}
[data-testid="stColumn"]:nth-child(2) [data-testid="stDownloadButton"] button * { display: none !important; }
[data-testid="stColumn"]:nth-child(2) [data-testid="stDownloadButton"] button::before {
    content: "📓"; font-size: 60px !important; margin-right: 20px !important;
}
[data-testid="stColumn"]:nth-child(2) [data-testid="stDownloadButton"] button::after {
    content: "Create\\A Blank\\A Notebook"; white-space: pre !important; font-size: 24px !important; 
    font-weight: 800 !important; color: #f8fafc !important; line-height: 1.2 !important; text-align: left !important;
}

/* MISCELLANEOUS HERO UI */
.hero { text-align: center; color: white; padding: 20px 0; }
.logo-container { display: flex; align-items: center; justify-content: center; gap: 15px; margin-bottom: 5px; }
.logo-text { font-size: 48px; font-weight: 800; color: #f8fafc; margin: 0;}
.logo-icon { font-size: 40px; margin: 0; }
.tagline { font-size: 16px; color: #94a3b8; margin-top: 0; }
.support-text { font-size: 12px; color: #475569; }
.top-nav { display: flex; justify-content: flex-end; padding: 10px 20px; gap: 12px; }
.coffee-btn { color: #0ea5e9; text-decoration: none; border: 1px solid #0ea5e9; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: bold; }
</style>

<div class="top-nav">
    <a href="https://buymeacoffee.com/jpramirez" target="_blank" class="coffee-btn">☕ Buy me a coffee</a>
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
# SECTION 2: APP LOGIC & FILE PROCESSING
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
    st.download_button(
        label="Create Blank Notebook", 
        data=st.session_state.blank_html.encode('utf-8'), 
        file_name="NoteDump_Blank.html", 
        mime="text/html", 
        use_container_width=True
    )

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
            # This target div utilizes margin-top: auto to drop to the bottom of the column!
            st.markdown('<div class="final-download-target">', unsafe_allow_html=True)
            st.download_button(
                label="📥 Download Interactive Notebook", 
                data=st.session_state.final_html.encode('utf-8'), 
                file_name=f"NoteDump_{up.name}.html", 
                mime="text/html", 
                use_container_width=True
            )
            st.markdown('</div>', unsafe_allow_html=True)
