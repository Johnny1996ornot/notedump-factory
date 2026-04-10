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

/* 1. COLUMN WRAPPERS: STRICT 220PX HEIGHT */
[data-testid="stColumn"] {
    background-color: #0f172a !important;
    border-radius: 12px !important;
    height: 220px !important; /* Reverted to your preferred size */
    padding: 15px !important;
    display: flex !important;
    flex-direction: column !important;
    box-sizing: border-box !important;
}

[data-testid="stColumn"]:nth-child(1) { border: 1px dashed #334155 !important; }
[data-testid="stColumn"]:nth-child(2) { border: 1px solid #1e293b !important; }

/* Internal Flexbox: Distributes space perfectly to avoid sandwiching */
[data-testid="stColumn"] > div[data-testid="stVerticalBlock"] {
    height: 100% !important;
    display: flex !important;
    flex-direction: column !important;
    justify-content: center !important;
    align-items: center !important;
    gap: 12px !important; /* Strict gap so file info and download button never touch */
}

/* 2. LEFT BOX: HEADING (EMPTY STATE) */
.upload-heading {
    font-size: 18px !important; /* Made words smaller */
    font-weight: 800;
    color: #f8fafc;
    margin: -10px 0 10px 0 !important; /* Shifted slightly upward */
    text-align: center;
    line-height: 1.1;
    width: 100%;
}

/* 3. LEFT BOX: UPLOAD DROPZONE (EMPTY STATE) */
[data-testid="stFileUploader"] { width: 100% !important; }
[data-testid="stFileUploader"] > label { display: none !important; }

[data-testid="stFileUploadDropzone"] {
    background: transparent !important;
    border: none !important;
    padding: 0 !important;
    display: flex !important;
    flex-direction: column !important;
    align-items: center !important; /* Perfect Center */
    justify-content: center !important; /* Perfect Center */
    width: 100% !important;
}

/* Hide Native SVG and default text */
[data-testid="stFileUploadDropzone"] > div > svg { display: none !important; }
[data-testid="stFileUploadDropzone"] > div > div[data-testid="stMarkdownContainer"] { display: none !important; }
[data-testid="stFileUploadDropzone"] > div { align-items: center !important; width: 100% !important; }

/* Custom Upload Button */
[data-testid="stFileUploadDropzone"] button {
    margin: 0 auto !important;
    background-color: transparent !important;
    border: 1px solid #334155 !important;
    border-radius: 6px !important;
    width: 120px !important;
    height: 36px !important;
    position: relative;
    color: transparent !important; /* Hides default text */
}
[data-testid="stFileUploadDropzone"] button:hover { background-color: rgba(255,255,255,0.05) !important; }
[data-testid="stFileUploadDropzone"] button::after {
    content: "↑ Upload" !important;
    position: absolute;
    top: 50%; left: 50%;
    transform: translate(-50%, -50%);
    color: white !important;
    font-size: 14px !important;
    font-weight: 600 !important;
}

/* Limit Text underneath button */
[data-testid="stFileUploadDropzone"] small {
    display: block !important;
    text-align: center !important;
    color: #94a3b8 !important;
    margin-top: 10px !important;
    font-size: 12px !important;
}

/* 4. ACTIVE STATE: FILE UPLOADED */
/* Hides the heading and dropzone entirely to make room for progress bar & download */
div[data-testid="stColumn"]:has([data-testid="stUploadedFile"]) .upload-heading,
div[data-testid="stFileUploader"]:has([data-testid="stUploadedFile"]) [data-testid="stFileUploadDropzone"] {
    display: none !important;
}

/* The Native File Box / Progress Area */
[data-testid="stUploadedFile"] {
    background-color: #1e293b !important;
    border-radius: 8px !important;
    border: none !important;
    width: 100% !important;
    padding: 10px !important;
}

/* 5. THE NEW DOWNLOAD BUTTON (INSIDE LEFT BOX) */
.final-download-target { width: 100% !important; }
.final-download-target [data-testid="stDownloadButton"] button {
    width: 100% !important;
    background-color: transparent !important;
    border: 1px solid #0ea5e9 !important;
    color: #0ea5e9 !important;
    border-radius: 8px !important;
    height: 42px !important;
    font-size: 14px !important;
    font-weight: bold !important;
    transition: 0.2s;
}
.final-download-target [data-testid="stDownloadButton"] button:hover {
    background: rgba(14, 165, 233, 0.1) !important;
}

/* 6. RIGHT BOX: BLANK NOTEBOOK */
[data-testid="stColumn"]:nth-child(2) [data-testid="stDownloadButton"] { height: 100% !important; width: 100% !important; margin: 0 !important; }
[data-testid="stColumn"]:nth-child(2) [data-testid="stDownloadButton"] button {
    background: transparent !important; border: none !important;
    height: 100% !important; width: 100% !important;
    display: flex !important; flex-direction: row !important; justify-content: center !important; align-items: center !important;
}
[data-testid="stColumn"]:nth-child(2) [data-testid="stDownloadButton"] button * { display: none !important; }
[data-testid="stColumn"]:nth-child(2) [data-testid="stDownloadButton"] button::before {
    content: "📓"; font-size: 60px !important; margin-right: 15px !important;
}
[data-testid="stColumn"]:nth-child(2) [data-testid="stDownloadButton"] button::after {
    content: "Create\\A Blank\\A Notebook"; white-space: pre !important; font-size: 24px !important; 
    font-weight: 800 !important; color: #f8fafc !important; line-height: 1.1 !important; text-align: left !important;
}

/* HERO & NAV LOGISTICS */
.hero { text-align: center; color: white; padding: 10px 0; max-width: 500px; margin: 0 auto; }
.logo-container { display: flex; align-items: center; justify-content: center; gap: 10px; margin-bottom: 0px;}
.logo-text { font-size: 48px; font-weight: 800; margin: 0; color: #f8fafc;}
.logo-icon { font-size: 40px; margin: 0;}
.tagline { font-size: 16px; color: #94a3b8; margin-top: 0 !important; margin-bottom: 8px !important;}
.support-text { font-size: 12px; color: #475569; margin-bottom: 20px !important; }
.top-nav { display: flex; justify-content: flex-end; padding: 10px 20px; gap: 12px; position: absolute; top: 0; right: 0; width: 100%; z-index: 999;}
.coffee-btn { color: #0ea5e9; text-decoration: none; font-weight: bold; font-size: 12px; border: 1px solid #0ea5e9; padding: 4px 10px; border-radius: 20px;}
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
# SECTION 2: PRE-GENERATE BLANK NOTEBOOK 
# ==========================================================================
if "blank_html" not in st.session_state:
    blank_nav = '<div class="nav-link active-nav" id="link-0" onclick="goTo(\'0\')"><span class="nav-text">Page 1</span></div>'
    blank_slides = '<div id="p-0" class="page active" style="width:816px; height:1054px;"></div>'
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
    st.markdown('<div class="upload-heading">Convert file to<br>interactive notebook</div>', unsafe_allow_html=True)
    up = st.file_uploader("Upload a document", label_visibility="hidden", type=["pptx", "ppt", "pdf"])

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

                                if shape.shape_type == 13: 
                                    img_stream = BytesIO(shape.image.blob)
                                    base64_img = base64.b64encode(img_stream.getvalue()).decode()
                                    html_content += f'<div class="canvas-box" style="top:{top}px; left:{left}px; width:{width}px; height:{height}px; z-index:10;"><img src="data:image/png;base64,{base64_img}" style="width:100%; height:100%; object-fit:contain;"></div>'

                                elif shape.has_table:
                                    table_html = "<table style='width:100%; height:100%; border-collapse: collapse; font-size:12px;' border='1'>"
                                    for row in shape.table.rows:
                                        table_html += "<tr>"
                                        for cell in row.cells:
                                            table_html += f"<td style='padding:5px;'>{html.escape(cell.text)}</td>"
                                        table_html += "</tr>"
                                    table_html += "</table>"
                                    html_content += f'<div class="canvas-box" style="top:{top}px; left:{left}px; width:{width}px; background:rgba(255,255,255,0.9); z-index:15;"><div class="content-area">{table_html}</div></div>'

                                elif shape.has_text_frame and shape.text.strip():
                                    html_text = ""
                                    for paragraph in shape.text_frame.paragraphs:
                                        p_text = "".join([html.escape(run.text) for run in paragraph.runs])
                                        html_text += f"<div>{p_text}</div>" if p_text.strip() else "<br>"
                                    html_content += f'<div class="canvas-box" style="top:{top}px; left:{left}px; width:{width}px; min-height:{height}px; z-index:20;"><div class="content-area" style="word-wrap: break-word; white-space: pre-wrap;">{html_text}</div></div>'
                            except Exception:
                                continue 
                        return html_content

                    for i, slide in enumerate(ppt.slides):
                        title_text = slide.shapes.title.text if slide.shapes.title else f"Slide {i+1}"
                        nav += f'<div class="nav-link" onclick="goTo(\'{i}\')"><span class="nav-text">{html.escape(title_text)}</span></div>'
                        slides += f'<div id="p-{i}" class="page {"active" if i==0 else ""}" style="height:{base_h}px;">{parse_shapes(slide.shapes)}</div>'

                elif file_name.endswith('.pdf'):
                    doc = fitz.open(stream=up.read(), filetype="pdf")
                    total_pages = len(doc)
                    for i, page in enumerate(doc):
                        p_scale = base_w / page.rect.width if page.rect.width > 0 else 1
                        scaled_height = max(1054, int(page.rect.height * p_scale))
                        nav += f'<div class="nav-link" onclick="goTo(\'{i}\')"><span class="nav-text">Page {i+1}</span></div>'
                        slides += f'<div id="p-{i}" class="page {"active" if i==0 else ""}" style="height:{scaled_height}px;">'
                        
                        for b in page.get_text("dict")["blocks"]:
                            bbox = b["bbox"]
                            top, left = bbox[1] * p_scale, bbox[0] * p_scale
                            width, height = (bbox[2] - bbox[0]) * p_scale, (bbox[3] - bbox[1]) * p_scale

                            if b["type"] == 0: 
                                text_html = "".join(["<div>" + "".join([html.escape(span["text"]) for span in line["spans"]]) + "</div>" for line in b["lines"]])
                                slides += f'<div class="canvas-box" style="top:{top}px; left:{left}px; width:{width}px; min-height:{height}px; z-index:20;"><div class="content-area" style="word-wrap: break-word; white-space: pre-wrap;">{text_html}</div></div>'
                            elif b["type"] == 1: 
                                img_bytes = b.get("image")
                                if img_bytes:
                                    base64_img = base64.b64encode(img_bytes).decode()
                                    slides += f'<div class="canvas-box" style="top:{top}px; left:{left}px; width:{width}px; height:{height}px; z-index:10;"><img src="data:image/png;base64,{base64_img}" style="width:100%; height:100%; object-fit:contain;"></div>'
                        slides += '</div>'

                st.session_state.final_html = get_template(total_pages).replace("{{NAV_LINKS}}", nav).replace("{{SLIDE_CONTENT}}", slides).replace("{{VISIBLE_TITLE}}", html.escape(up.name)).replace("{{STORAGE_ID}}", html.escape(unique_storage_id))

            except Exception as e:
                st.session_state.error_msg = f"Error: {e}"

        # Render Error OR Download Button
        if st.session_state.get("error_msg"):
            st.error(st.session_state.error_msg)
            
        elif st.session_state.get("final_html"):
            st.markdown('<div class="final-download-target">', unsafe_allow_html=True)
            st.download_button(
                label="📥 Download Interactive Notebook",
                data=st.session_state.final_html.encode('utf-8'), 
                file_name=f"NoteDump_{up.name}.html", 
                mime="text/html",
                use_container_width=True
            )
            st.markdown('</div>', unsafe_allow_html=True)
