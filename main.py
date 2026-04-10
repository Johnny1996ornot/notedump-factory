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

/* Global Column Fixes */
[data-testid="stColumn"] {
    background-color: #0f172a !important;
    border-radius: 16px !important;
    height: 300px !important; /* Increased height for better spacing */
    padding: 30px !important;
    display: flex !important;
    flex-direction: column !important;
    box-sizing: border-box !important;
}

[data-testid="stColumn"] > div { width: 100%; height: 100%; }

/* Vertical Block stretching */
[data-testid="stVerticalBlock"] {
    height: 100% !important;
    display: flex !important;
    flex-direction: column !important;
    justify-content: center !important;
    align-items: center !important;
    gap: 0 !important;
}

/* LEFT BOX BORDER */
[data-testid="stColumn"]:nth-child(1) { border: 1px dashed #334155 !important; }

/* RIGHT BOX BORDER */
[data-testid="stColumn"]:nth-child(2) { border: 1px solid #1e293b !important; transition: 0.2s; }
[data-testid="stColumn"]:nth-child(2):hover { border-color: #0ea5e9 !important; background: rgba(14, 165, 233, 0.05) !important; }

/* HEADING STYLE */
.upload-heading {
    font-size: 26px;
    font-weight: 800;
    color: #f8fafc;
    margin-bottom: 25px;
    text-align: center;
    line-height: 1.1;
    letter-spacing: -0.5px;
}

/* FILE UPLOADER CENTERING (EMPTY STATE) */
[data-testid="stFileUploader"] > label { display: none !important; }
[data-testid="stFileUploadDropzone"] {
    background: transparent !important; border: none !important;
    display: flex !important; flex-direction: column !important; align-items: center !important;
}
[data-testid="stFileUploadDropzone"] svg, 
[data-testid="stFileUploadDropzone"] div[data-testid="stMarkdownContainer"] p {
    display: none !important;
}

/* Browse Button */
[data-testid="stFileUploadDropzone"] button {
    background-color: #1e293b !important; color: white !important;
    border: 1px solid #334155 !important; border-radius: 8px !important;
    padding: 10px 24px !important; font-weight: bold !important;
}
[data-testid="stFileUploadDropzone"] button:hover { background: #4f46e5 !important; border-color: #4f46e5 !important; }

/* Limit Text */
[data-testid="stFileUploadDropzone"] small {
    margin-top: 12px !important; color: #475569 !important; font-size: 13px !important;
}

/* ACTIVE STATE: UPLOADED FILE */
div[data-testid="stColumn"]:has([data-testid="stUploadedFile"]) .upload-heading {
    margin-bottom: 15px !important; text-align: left !important; font-size: 20px !important;
}

[data-testid="stUploadedFile"] {
    background: #1e293b !important;
    border: 1px solid #334155 !important;
    border-radius: 12px !important;
    padding: 12px 15px !important;
    width: 100% !important;
    margin-bottom: auto !important; /* Pushes button to bottom */
}

/* Download Button (Left Box) */
.final-download-target { width: 100% !important; margin-top: 20px !important; }
.final-download-target [data-testid="stDownloadButton"] button {
    width: 100% !important; height: 52px !important;
    background: #1e293b !important; color: #0ea5e9 !important;
    border: 1px solid #0ea5e9 !important; border-radius: 10px !important;
    font-weight: 800 !important; font-size: 16px !important;
}
.final-download-target [data-testid="stDownloadButton"] button:hover {
    background: #0ea5e9 !important; color: white !important;
}

/* RIGHT BOX CONTENT (BLANK) */
[data-testid="stColumn"]:nth-child(2) [data-testid="stDownloadButton"] button {
    background: transparent !important; border: none !important;
    height: 100% !important; width: 100% !important;
    display: flex !important; align-items: center !important; justify-content: center !important;
}
[data-testid="stColumn"]:nth-child(2) [data-testid="stDownloadButton"] button * { display: none !important; }
[data-testid="stColumn"]:nth-child(2) [data-testid="stDownloadButton"] button::before {
    content: "📓"; font-size: 70px !important; margin-right: 15px !important;
}
[data-testid="stColumn"]:nth-child(2) [data-testid="stDownloadButton"] button::after {
    content: "Create\\A Blank\\A Notebook"; white-space: pre !important; font-size: 26px !important; 
    font-weight: 800 !important; color: #f8fafc !important; line-height: 1.1 !important; text-align: left !important;
}

/* Hero Section Styles */
.hero { text-align: center; color: white; padding: 20px 0; }
.logo-text { font-size: 55px; font-weight: 800; color: #f8fafc; }
.tagline { font-size: 18px; color: #94a3b8; margin-top: -10px; }
.support-text { font-size: 12px; color: #475569; }

/* Nav Styles */
.top-nav { display: flex; justify-content: flex-end; padding: 10px 20px; gap: 12px; }
.coffee-btn { color: #0ea5e9; text-decoration: none; border: 1px solid #0ea5e9; padding: 4px 12px; border-radius: 20px; font-size: 13px; font-weight: bold; }
</style>

<div class="top-nav">
    <a href="https://buymeacoffee.com/jpramirez" target="_blank" class="coffee-btn">☕ Buy me a coffee</a>
</div>

<div class="hero">
    <div style="display: flex; align-items: center; justify-content: center; gap: 15px;">
        <span style="font-size: 50px;">📝</span>
        <span class="logo-text">NoteDump</span>
    </div>
    <p class="tagline">Turning your documents into an interactive notebook</p>
    <p class="support-text">PPTX • PPT • PDF</p>
</div>
""", unsafe_allow_html=True)

# ==========================================================================
# SECTION 2: APP LOGIC
# ==========================================================================

if "blank_html" not in st.session_state:
    st.session_state.blank_html = get_template(1).replace("{{VISIBLE_TITLE}}", "New_Notebook")

col1, col2 = st.columns(2, gap="medium")

with col2:
    st.download_button(
        label="Create Blank", 
        data=st.session_state.blank_html.encode('utf-8'), 
        file_name="NoteDump_Blank.html", 
        mime="text/html",
        use_container_width=True
    )

with col1:
    st.markdown('<div class="upload-heading">Convert file to<br>interactive notebook</div>', unsafe_allow_html=True)
    up = st.file_uploader("Upload", type=["pptx", "ppt", "pdf"], label_visibility="hidden")

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

                # PPTX PROCESSING
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
                                    b64 = base64.b64encode(img_stream.getvalue()).decode()
                                    html_content += f'<div class="canvas-box" style="top:{top}px; left:{left}px; width:{width}px; height:{height}px; z-index:10;"><img src="data:image/png;base64,{b64}" style="width:100%; height:100%; object-fit:contain;"></div>'
                                
                                elif shape.has_table: # Table
                                    rows = "".join(["<tr>" + "".join([f"<td style='padding:5px;'>{html.escape(c.text)}</td>" for c in r.cells]) + "</tr>" for r in shape.table.rows])
                                    html_content += f'<div class="canvas-box" style="top:{top}px; left:{left}px; width:{width}px; background:white; z-index:15;"><table border="1" style="width:100%; border-collapse:collapse;">{rows}</table></div>'
                                
                                elif shape.has_text_frame and shape.text.strip(): # Text
                                    txt = "".join([f"<div>{html.escape(p.text)}</div>" for p in shape.text_frame.paragraphs])
                                    html_content += f'<div class="canvas-box" style="top:{top}px; left:{left}px; width:{width}px; z-index:20;"><div style="word-wrap:break-word;">{txt}</div></div>'
                            except: continue
                        return html_content

                    for i, slide in enumerate(ppt.slides):
                        nav += f'<div class="nav-link" onclick="goTo(\'{i}\')">Page {i+1}</div>'
                        slides += f'<div id="p-{i}" class="page {"active" if i==0 else ""}" style="height:{base_h}px;">{parse_shapes(slide.shapes)}</div>'

                # PDF PROCESSING
                elif file_name.endswith('.pdf'):
                    doc = fitz.open(stream=up.read(), filetype="pdf")
                    total_pages = len(doc)
                    for i, page in enumerate(doc):
                        p_scale = base_w / page.rect.width if page.rect.width > 0 else 1
                        nav += f'<div class="nav-link" onclick="goTo(\'{i}\')">Page {i+1}</div>'
                        slides += f'<div id="p-{i}" class="page {"active" if i==0 else ""}" style="height:{int(page.rect.height*p_scale)}px;">'
                        for b in page.get_text("dict")["blocks"]:
                            bbox = b["bbox"]
                            t, l, w, h = bbox[1]*p_scale, bbox[0]*p_scale, (bbox[2]-bbox[0])*p_scale, (bbox[3]-bbox[1])*p_scale
                            if b["type"] == 0:
                                txt = "".join(["".join([html.escape(s["text"]) for s in ln["spans"]]) for ln in b["lines"]])
                                slides += f'<div class="canvas-box" style="top:{t}px; left:{l}px; width:{w}px;">{txt}</div>'
                            elif b["type"] == 1:
                                b64 = base64.b64encode(b.get("image")).decode()
                                slides += f'<div class="canvas-box" style="top:{t}px; left:{l}px; width:{w}px; height:{h}px;"><img src="data:image/png;base64,{b64}" style="width:100%; height:100%;"></div>'
                        slides += '</div>'

                st.session_state.final_html = get_template(total_pages).replace("{{NAV_LINKS}}", nav).replace("{{SLIDE_CONTENT}}", slides).replace("{{VISIBLE_TITLE}}", html.escape(up.name)).replace("{{STORAGE_ID}}", html.escape(unique_storage_id))
            
            except Exception as e:
                st.session_state.error_msg = f"Error: {e}"

        if st.session_state.get("error_msg"):
            st.error(st.session_state.error_msg)
        elif st.session_state.get("final_html"):
            # Renders the final centered download button with space below the progress bar
            st.markdown('<div class="final-download-target">', unsafe_allow_html=True)
            st.download_button(
                label="📥 Download Interactive Notebook", 
                data=st.session_state.final_html.encode('utf-8'), 
                file_name=f"NoteDump_{up.name}.html", 
                mime="text/html", 
                use_container_width=True
            )
            st.markdown('</div>', unsafe_allow_html=True)
