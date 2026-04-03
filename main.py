import streamlit as st
from pptx import Presentation
import html
import base64
import time
from io import BytesIO
from template import get_template

# Safe PyMuPDF import
try:
    import pymupdf as fitz
except ImportError:
    import fitz

st.set_page_config(page_title="NoteDump", layout="centered")

# =========================================================
# CLEAN + STABLE CSS (NO fragile selectors)
# =========================================================
st.markdown("""
<style>
.stApp {
    background-color: #000000;
    color: white;
}

/* Header */
.hero {
    text-align: center;
    margin-bottom: 20px;
}
.logo {
    font-size: 48px;
    font-weight: 800;
}
.tagline {
    color: #94a3b8;
    font-size: 16px;
}

/* Buttons */
.stDownloadButton button {
    width: 100%;
    height: 200px;
    border-radius: 12px;
    background-color: #0f172a;
    border: 1px solid #1e293b;
    font-size: 20px;
    font-weight: bold;
}

/* Uploader */
.upload-box {
    padding: 20px;
    border-radius: 12px;
    border: 1px dashed #334155;
    background-color: #0f172a;
    text-align: center;
}
</style>

<div class="hero">
    <div class="logo">📝 NoteDump</div>
    <div class="tagline">Turning your documents into an interactive notebook</div>
</div>
""", unsafe_allow_html=True)

# =========================================================
# BLANK NOTEBOOK CACHE
# =========================================================
if "blank_html" not in st.session_state:
    blank_nav = '<div class="nav-link active-nav" id="link-0" onclick="goTo(\'0\')">Page 1</div>'
    blank_slides = '<div id="p-0" class="page active"></div>'

    st.session_state.blank_html = get_template(1) \
        .replace("{{NAV_LINKS}}", blank_nav) \
        .replace("{{SLIDE_CONTENT}}", blank_slides) \
        .replace("{{VISIBLE_TITLE}}", "New_Notebook") \
        .replace("{{STORAGE_ID}}", f"New_{int(time.time())}")

# =========================================================
# LAYOUT
# =========================================================
col1, col2 = st.columns(2)

with col1:
    st.markdown('<div class="upload-box">Upload PPTX / PDF</div>', unsafe_allow_html=True)
    up = st.file_uploader("", type=["pptx", "ppt", "pdf"])

with col2:
    st.download_button(
        "📓 Create Blank Notebook",
        data=st.session_state.blank_html.encode("utf-8"),
        file_name="NoteDump_Blank.html",
        mime="text/html"
    )

# =========================================================
# PROCESS FILE
# =========================================================
if up:
    file_key = f"{up.name}_{up.size}"

    if st.session_state.get("current_file_key") != file_key:
        st.session_state.current_file_key = file_key
        st.session_state.final_html = None
        st.session_state.error_msg = None

        try:
            nav, slides = "", ""
            file_name = up.name.lower()
            base_w, base_h = 816, 1054

            # ================= PPTX =================
            if file_name.endswith(('.pptx', '.ppt')):
                ppt = Presentation(up)
                scale_w = base_w / (ppt.slide_width or 9144000)

                for i, slide in enumerate(ppt.slides):
                    nav += f"<div>Slide {i+1}</div>"
                    slides += f'<div class="page" style="height:{base_h}px;">'

                    for shape in slide.shapes:
                        try:
                            top = shape.top * scale_w
                            left = shape.left * scale_w
                            w = shape.width * scale_w
                            h = shape.height * scale_w

                            if shape.shape_type == 13:
                                img = base64.b64encode(shape.image.blob).decode()
                                slides += f'''
                                <img src="data:image/png;base64,{img}"
                                style="position:absolute; top:{top}px; left:{left}px; width:{w}px; height:{h}px;">
                                '''

                            elif shape.has_text_frame:
                                txt = html.escape(shape.text)
                                slides += f'''
                                <div style="position:absolute; top:{top}px; left:{left}px; width:{w}px;">
                                {txt}
                                </div>
                                '''

                        except:
                            continue

                    slides += "</div>"

            # ================= PDF =================
            elif file_name.endswith(".pdf"):
                doc = fitz.open(stream=up.read(), filetype="pdf")

                for i, page in enumerate(doc):
                    nav += f"<div>Page {i+1}</div>"
                    slides += f'<div class="page">'

                    blocks = page.get_text("dict")["blocks"]

                    for b in blocks:
                        x0, y0, x1, y1 = b["bbox"]

                        if b["type"] == 0:
                            text = ""
                            for line in b["lines"]:
                                for span in line["spans"]:
                                    text += html.escape(span["text"])

                            slides += f'''
                            <div style="position:absolute; top:{y0}px; left:{x0}px;">
                            {text}
                            </div>
                            '''

                        elif b["type"] == 1:
                            img = base64.b64encode(b["image"]).decode()
                            slides += f'''
                            <img src="data:image/png;base64,{img}"
                            style="position:absolute; top:{y0}px; left:{x0}px;">
                            '''

                    slides += "</div>"

            st.session_state.final_html = get_template(1) \
                .replace("{{NAV_LINKS}}", nav) \
                .replace("{{SLIDE_CONTENT}}", slides) \
                .replace("{{VISIBLE_TITLE}}", up.name) \
                .replace("{{STORAGE_ID}}", f"ND_{int(time.time())}")

        except Exception as e:
            st.session_state.error_msg = str(e)

    # =========================================================
    # OUTPUT
    # =========================================================
    if st.session_state.get("error_msg"):
        st.error(st.session_state.error_msg)

    elif st.session_state.get("final_html"):
        st.download_button(
            "📥 Download Interactive Notebook",
            data=st.session_state.final_html.encode("utf-8"),
            file_name=f"NoteDump_{up.name}.html",
            mime="text/html"
        )
