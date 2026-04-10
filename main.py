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
/* Target the empty state */
div[data-testid="stFileUploader"] section {
    background-color: transparent !important;
    border: 1px dashed #334155 !important;
    border-radius: 12px !important;
    height: 200px !important;
    padding: 0 !important;
    transition: 0.2s;
}
div[data-testid="stFileUploader"] section:hover {
    border-color: #0ea5e9 !important;
    background: rgba(14, 165, 233, 0.05) !important;
}

/* Hide the native "Browse Files" button text and icon */
div[data-testid="stFileUploader"] section button { display: none !important; }
div[data-testid="stFileUploader"] section div { color: transparent !important; }

/* Inject your custom icon and text into the native section */
div[data-testid="stFileUploader"] section::before {
    content: "📤";
    font-size: 45px;
    display: block;
    margin-top: 30px;
    margin-bottom: 10px;
    text-align: center;
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
    margin-top: 20px !important;
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
    <div class="logo-container">
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
    st.session_state.blank_html = get_template(1).replace("{{VISIBLE_TITLE}}", "Blank_Notebook")

with col2:
    st.download_button("Blank", data=st.session_state.blank_html, file_name="Blank_NoteDump.html", mime="text/html")

with col1:
    # THE UPLOADER (No longer hidden, just styled)
    up = st.file_uploader("Upload", type=["pptx", "ppt", "pdf"], label_visibility="collapsed")

    if up:
        file_key = f"{up.name}_{up.size}"
        
        # Only process if it's a new file
        if st.session_state.get("last_processed") != file_key:
            with st.status("Converting your file...", expanded=False) as status:
                try:
                    # [Processing Logic - Same as your PDF/PPT parser]
                    file_name = up.name.lower()
                    unique_id = f"{file_name}_{int(time.time())}"
                    nav, slides = "", ""
                    
                    if file_name.endswith(('.pptx', '.ppt')):
                        ppt = Presentation(up)
                        total = len(ppt.slides)
                        for i, slide in enumerate(ppt.slides):
                            nav += f'<div class="nav-link" onclick="goTo(\'{i}\')">Page {i+1}</div>'
                            slides += f'<div id="p-{i}" class="page">Slide {i+1} Content</div>'
                    else:
                        doc = fitz.open(stream=up.read(), filetype="pdf")
                        total = len(doc)
                        for i in range(total):
                            nav += f'<div class="nav-link" onclick="goTo(\'{i}\')">Page {i+1}</div>'
                            slides += f'<div id="p-{i}" class="page">PDF Page {i+1} Content</div>'

                    st.session_state.final_html = get_template(total).replace("{{NAV_LINKS}}", nav).replace("{{SLIDE_CONTENT}}", slides).replace("{{VISIBLE_TITLE}}", up.name).replace("{{STORAGE_ID}}", unique_id)
                    st.session_state.last_processed = file_key
                    status.update(label="Conversion Complete!", state="complete")
                except Exception as e:
                    st.error(f"Error processing: {e}")

        # SHOW DOWNLOAD BUTTON AFTER UPLOAD
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
            
            # Reset button
            if st.button("🗑️ Clear and Upload New"):
                st.session_state.final_html = None
                st.session_state.last_processed = None
                st.rerun()
