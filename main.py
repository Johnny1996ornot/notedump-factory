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
# SECTION 1: THE CSS (STYLING THE NATIVE UPLOADER DIRECTLY)
# ==========================================================================
st.markdown("""
<style>
.stApp { background-color: #000000; }

/* 1. COLUMN WRAPPERS */
[data-testid="stColumn"] {
    background-color: #0f172a !important; 
    border-radius: 12px !important;
    height: 240px !important; 
    display: flex !important;
    flex-direction: column !important;
    box-sizing: border-box !important;
}

[data-testid="stColumn"] > div[data-testid="stVerticalBlock"] {
    height: 100% !important;
    padding: 20px !important;
}

/* 2. REPLACING THE UPLOADER UI WITH YOUR BOX STYLE */
div[data-testid="stFileUploader"] section {
    background-color: transparent !important;
    border: 1px dashed #334155 !important;
    border-radius: 12px !important;
    height: 200px !important;
    padding: 0 !important;
    transition: 0.2s;
    display: flex !important;
    flex-direction: column !important;
    align-items: center !important;
    justify-content: center !important;
}
div[data-testid="stFileUploader"] section:hover {
    border-color: #0ea5e9 !important;
    background: rgba(14, 165, 233, 0.05) !important;
}

/* Hide the native "Browse Files" button text and icon */
div[data-testid="stFileUploader"] section button { display: none !important; }
div[data-testid="stFileUploader"] section div { color: transparent !important; font-size: 0 !important; }

/* Inject your custom icon and text into the native section */
div[data-testid="stFileUploader"] section::before {
    content: "📤";
    font-size: 45px;
    display: block;
    margin-bottom: 10px;
}
div[data-testid="stFileUploader"] section::after {
    content: "Convert file to an\\A interactive notebook\\A\\A Upload a file\\A 200MB per file • PPTX, PPT, PDF";
    white-space: pre-wrap;
    display: block;
    text-align: center;
    color: #f8fafc;
    font-size: 16px;
    font-weight: 800;
    line-height: 1.2;
}

/* 3. THE UPLOADED FILE CARD & PROGRESS BAR */
[data-testid="stUploadedFile"] {
    background: #1e293b !important;
    border: none !important;
    border-radius: 8px !important;
    padding: 15px !important;
    margin-top: 10px !important;
}

/* 4. DOWNLOAD BUTTON STYLING */
.final-download-target [data-testid="stDownloadButton"] button {
    width: 100% !important;
    background-color: transparent !important;
    border: 1px solid #0ea5e9 !important;
    color: #0ea5e9 !important;
    border-radius: 8px !important;
    height: 45px !important;
    font-weight: bold !important;
    margin-top: 10px;
}

/* 5. RIGHT BOX (BLANK NOTEBOOK) */
[data-testid="stColumn"]:nth-child(2) { border: 1px solid #1e293b !important; }
[data-testid="stColumn"]:nth-child(2) [data-testid="stDownloadButton"] button {
    background: transparent !important; border: none !important; height: 180px !important; width: 100% !important;
}
[data-testid="stColumn"]:nth-child(2) [data-testid="stDownloadButton"] button::before { content: "📓"; font-size: 65px; margin-right: 15px; }
[data-testid="stColumn"]:nth-child(2) [data-testid="stDownloadButton"] button div { display:none; }
[data-testid="stColumn"]:nth-child(2) [data-testid="stDownloadButton"] button::after {
    content: "Create\\A Blank\\A Notebook"; white-space: pre; font-size: 20px; font-weight: 800; color: #f8fafc; text-align: left;
}

/* Hide headers/nav info */
.hero { text-align: center; color: white; margin-bottom: 20px; }
.logo-text { font-size: 45px; font-weight: 800; color: #f8fafc; }
.tagline { color: #94a3b8; margin-top: -10px; }
</style>

<div class="hero">
    <div style="display: flex; align-items: center; justify-content: center; gap: 10px;">
        <span style="font-size:40px;">📝</span>
        <span class="logo-text">NoteDump</span>
    </div>
    <p class="tagline">Turning your documents into an interactive notebook</p>
</div>
""", unsafe_allow_html=True)

# ==========================================================================
# SECTION 2: LOGIC & COLUMNS
# ==========================================================================
col1, col2 = st.columns(2, gap="medium")

# Pre-generate blank notebook for Right Column
if "blank_html" not in st.session_state:
    blank_nav = '<div class="nav-link active-nav" id="link-0" onclick="goTo(\'0\')"><span class="nav-text">Page 1</span></div>'
    blank_slides = '<div id="p-0" class="page active" style="width:816px; height:1054px;"></div>'
    unique_blank_id = f"New_Notebook_{int(time.time())}"
    st.session_state.blank_html = get_template(1).replace("{{NAV_LINKS}}", blank_nav).replace("{{SLIDE_CONTENT}}", blank_slides).replace("{{VISIBLE_TITLE}}", "New_Notebook").replace("{{STORAGE_ID}}", unique_blank_id)

with col2:
    st.download_button("Blank", data=st.session_state.blank_html.encode('utf-8'), file_name="NoteDump_Blank.html", mime="text/html")

with col1:
    # THE UPLOADER (Native component styled via CSS, ensuring clicks work perfectly)
    up = st.file_uploader("Upload", type=["pptx", "ppt", "pdf"], label_visibility="collapsed")

    if up:
        file_key = f"{up.name}_{up.size}"
        
        # Only process if it's a new file
        if st.session_state.get("last_processed") != file_key:
            with st.status("Converting your file...", expanded=False) as status:
                try:
                    file_name = up.name.lower()
                    unique_storage_id = f"{file_name}_{int(time.time())}"
                    nav, slides = "", ""
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
                                top_pos, left_pos = bbox[1] * p_scale, bbox[0] * p_scale
                                w, h = (bbox[2] - bbox[0]) * p_scale, (bbox[3] - bbox[1]) * p_scale

                                if b["type"] == 0: 
                                    text_html = "".join(["<div>" + "".join([html.escape(span["text"]) for span in line["spans"]]) + "</div>" for line in b["lines"]])
                                    slides += f'<div class="canvas-box" style="top:{top_pos}px; left:{left_pos}px; width:{w}px; min-height:{h}px; z-index:20;"><div class="content-area" style="word-wrap: break-word; white-space: pre-wrap;">{text_html}</div></div>'
                                elif b["type"] == 1: 
                                    img_bytes = b.get("image")
                                    if img_bytes:
                                        base64_img = base64.b64encode(img_bytes).decode()
                                        slides += f'<div class="canvas-box" style="top:{top_pos}px; left:{left_pos}px; width:{w}px; height:{h}px; z-index:10;"><img src="data:image/png;base64,{base64_img}" style="width:100%; height:100%; object-fit:contain;"></div>'
                            slides += '</div>'

                    st.session_state.final_html = get_template(total_pages).replace("{{NAV_LINKS}}", nav).replace("{{SLIDE_CONTENT}}", slides).replace("{{VISIBLE_TITLE}}", html.escape(up.name)).replace("{{STORAGE_ID}}", html.escape(unique_storage_id))
                    st.session_state.last_processed = file_key
                    status.update(label="Conversion Complete!", state="complete")
                except Exception as e:
                    st.error(f"Error processing: {e}")

        # SHOW DOWNLOAD BUTTON AND CLEAR BUTTON AFTER UPLOAD
        if st.session_state.get("final_html"):
            st.markdown('<div class="final-download-target">', unsafe_allow_html=True)
            st.download_button(
                label="📥 Download Interactive Notebook",
                data=st.session_state.final_html.encode('utf-8'),
                file_name=f"NoteDump_{up.name}.html",
                mime="text/html",
                use_container_width=True
            )
            st.markdown('</div>', unsafe_allow_html=True)
            
            # Reset button to clear state and allow new uploads
            if st.button("🗑️ Clear and Upload New"):
                st.session_state.final_html = None
                st.session_state.last_processed = None
                st.rerun()import streamlit as st
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
# SECTION 1: THE CSS (STYLING THE NATIVE UPLOADER DIRECTLY)
# ==========================================================================
st.markdown("""
<style>
.stApp { background-color: #000000; }

/* 1. COLUMN WRAPPERS */
[data-testid="stColumn"] {
    background-color: #0f172a !important; 
    border-radius: 12px !important;
    height: 240px !important; 
    display: flex !important;
    flex-direction: column !important;
    box-sizing: border-box !important;
}

[data-testid="stColumn"] > div[data-testid="stVerticalBlock"] {
    height: 100% !important;
    padding: 20px !important;
}

/* 2. REPLACING THE UPLOADER UI WITH YOUR BOX STYLE */
div[data-testid="stFileUploader"] section {
    background-color: transparent !important;
    border: 1px dashed #334155 !important;
    border-radius: 12px !important;
    height: 200px !important;
    padding: 0 !important;
    transition: 0.2s;
    display: flex !important;
    flex-direction: column !important;
    align-items: center !important;
    justify-content: center !important;
}
div[data-testid="stFileUploader"] section:hover {
    border-color: #0ea5e9 !important;
    background: rgba(14, 165, 233, 0.05) !important;
}

/* Hide the native "Browse Files" button text and icon */
div[data-testid="stFileUploader"] section button { display: none !important; }
div[data-testid="stFileUploader"] section div { color: transparent !important; font-size: 0 !important; }

/* Inject your custom icon and text into the native section */
div[data-testid="stFileUploader"] section::before {
    content: "📤";
    font-size: 45px;
    display: block;
    margin-bottom: 10px;
}
div[data-testid="stFileUploader"] section::after {
    content: "Convert file to an\\A interactive notebook\\A\\A Upload a file\\A 200MB per file • PPTX, PPT, PDF";
    white-space: pre-wrap;
    display: block;
    text-align: center;
    color: #f8fafc;
    font-size: 16px;
    font-weight: 800;
    line-height: 1.2;
}

/* 3. THE UPLOADED FILE CARD & PROGRESS BAR */
[data-testid="stUploadedFile"] {
    background: #1e293b !important;
    border: none !important;
    border-radius: 8px !important;
    padding: 15px !important;
    margin-top: 10px !important;
}

/* 4. DOWNLOAD BUTTON STYLING */
.final-download-target [data-testid="stDownloadButton"] button {
    width: 100% !important;
    background-color: transparent !important;
    border: 1px solid #0ea5e9 !important;
    color: #0ea5e9 !important;
    border-radius: 8px !important;
    height: 45px !important;
    font-weight: bold !important;
    margin-top: 10px;
}

/* 5. RIGHT BOX (BLANK NOTEBOOK) */
[data-testid="stColumn"]:nth-child(2) { border: 1px solid #1e293b !important; }
[data-testid="stColumn"]:nth-child(2) [data-testid="stDownloadButton"] button {
    background: transparent !important; border: none !important; height: 180px !important; width: 100% !important;
}
[data-testid="stColumn"]:nth-child(2) [data-testid="stDownloadButton"] button::before { content: "📓"; font-size: 65px; margin-right: 15px; }
[data-testid="stColumn"]:nth-child(2) [data-testid="stDownloadButton"] button div { display:none; }
[data-testid="stColumn"]:nth-child(2) [data-testid="stDownloadButton"] button::after {
    content: "Create\\A Blank\\A Notebook"; white-space: pre; font-size: 20px; font-weight: 800; color: #f8fafc; text-align: left;
}

/* Hide headers/nav info */
.hero { text-align: center; color: white; margin-bottom: 20px; }
.logo-text { font-size: 45px; font-weight: 800; color: #f8fafc; }
.tagline { color: #94a3b8; margin-top: -10px; }
</style>

<div class="hero">
    <div style="display: flex; align-items: center; justify-content: center; gap: 10px;">
        <span style="font-size:40px;">📝</span>
        <span class="logo-text">NoteDump</span>
    </div>
    <p class="tagline">Turning your documents into an interactive notebook</p>
</div>
""", unsafe_allow_html=True)

# ==========================================================================
# SECTION 2: LOGIC & COLUMNS
# ==========================================================================
col1, col2 = st.columns(2, gap="medium")

# Pre-generate blank notebook for Right Column
if "blank_html" not in st.session_state:
    blank_nav = '<div class="nav-link active-nav" id="link-0" onclick="goTo(\'0\')"><span class="nav-text">Page 1</span></div>'
    blank_slides = '<div id="p-0" class="page active" style="width:816px; height:1054px;"></div>'
    unique_blank_id = f"New_Notebook_{int(time.time())}"
    st.session_state.blank_html = get_template(1).replace("{{NAV_LINKS}}", blank_nav).replace("{{SLIDE_CONTENT}}", blank_slides).replace("{{VISIBLE_TITLE}}", "New_Notebook").replace("{{STORAGE_ID}}", unique_blank_id)

with col2:
    st.download_button("Blank", data=st.session_state.blank_html.encode('utf-8'), file_name="NoteDump_Blank.html", mime="text/html")

with col1:
    # THE UPLOADER (Native component styled via CSS, ensuring clicks work perfectly)
    up = st.file_uploader("Upload", type=["pptx", "ppt", "pdf"], label_visibility="collapsed")

    if up:
        file_key = f"{up.name}_{up.size}"
        
        # Only process if it's a new file
        if st.session_state.get("last_processed") != file_key:
            with st.status("Converting your file...", expanded=False) as status:
                try:
                    file_name = up.name.lower()
                    unique_storage_id = f"{file_name}_{int(time.time())}"
                    nav, slides = "", ""
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
                                top_pos, left_pos = bbox[1] * p_scale, bbox[0] * p_scale
                                w, h = (bbox[2] - bbox[0]) * p_scale, (bbox[3] - bbox[1]) * p_scale

                                if b["type"] == 0: 
                                    text_html = "".join(["<div>" + "".join([html.escape(span["text"]) for span in line["spans"]]) + "</div>" for line in b["lines"]])
                                    slides += f'<div class="canvas-box" style="top:{top_pos}px; left:{left_pos}px; width:{w}px; min-height:{h}px; z-index:20;"><div class="content-area" style="word-wrap: break-word; white-space: pre-wrap;">{text_html}</div></div>'
                                elif b["type"] == 1: 
                                    img_bytes = b.get("image")
                                    if img_bytes:
                                        base64_img = base64.b64encode(img_bytes).decode()
                                        slides += f'<div class="canvas-box" style="top:{top_pos}px; left:{left_pos}px; width:{w}px; height:{h}px; z-index:10;"><img src="data:image/png;base64,{base64_img}" style="width:100%; height:100%; object-fit:contain;"></div>'
                            slides += '</div>'

                    st.session_state.final_html = get_template(total_pages).replace("{{NAV_LINKS}}", nav).replace("{{SLIDE_CONTENT}}", slides).replace("{{VISIBLE_TITLE}}", html.escape(up.name)).replace("{{STORAGE_ID}}", html.escape(unique_storage_id))
                    st.session_state.last_processed = file_key
                    status.update(label="Conversion Complete!", state="complete")
                except Exception as e:
                    st.error(f"Error processing: {e}")

        # SHOW DOWNLOAD BUTTON AND CLEAR BUTTON AFTER UPLOAD
        if st.session_state.get("final_html"):
            st.markdown('<div class="final-download-target">', unsafe_allow_html=True)
            st.download_button(
                label="📥 Download Interactive Notebook",
                data=st.session_state.final_html.encode('utf-8'),
                file_name=f"NoteDump_{up.name}.html",
                mime="text/html",
                use_container_width=True
            )
            st.markdown('</div>', unsafe_allow_html=True)
            
            # Reset button to clear state and allow new uploads
            if st.button("🗑️ Clear and Upload New"):
                st.session_state.final_html = None
                st.session_state.last_processed = None
                st.rerun()
