import streamlit as st
from pptx import Presentation
import base64
import html 
from template import BOOK_TEMPLATE

# --- UI BRANDING & MINIMALISM ---
st.set_page_config(page_title="NoteDump", layout="centered")
st.markdown("""
    <style>
        .stApp { background-color: #000000; }
        .hero { text-align: center; color: white; padding: 30px 0; }
        .logo { font-size: 70px; font-weight: 800; margin-bottom: 0; }
        .tagline { font-size: 20px; color: #888; margin-top: -10px; margin-bottom: 10px; }
        .instruction-bar { color: #555; font-size: 14px; margin-bottom: 30px; text-align: center; line-height: 1.6; }

        [data-testid="stFileUploader"] { display: flex; justify-content: center; width: 100%; margin-top: 20px; }
        [data-testid="stFileUploader"] section { 
            width: 550px !important; margin: 0 auto; display: flex; 
            flex-direction: column; align-items: center !important; text-align: center !important; 
        }
        [data-testid="stFileUploader"] section > div:nth-child(2),
        [data-testid="stFileUploader"] section > small { display: none !important; }
        button[title="View help"] { display: none !important; }
        [data-testid="stFileUploaderDropzoneInstructions"] { color: #ffffff !important; font-size: 16px; }
    </style>
""", unsafe_allow_html=True)

st.markdown('<div class="hero"><div class="logo">📝 NoteDump</div><p class="tagline">Transforming your lectures into a notebook</p></div>', unsafe_allow_html=True)
st.markdown('<div class="instruction-bar">Upload your file (pptx ppt pdf)<br>Supports: PowerPoint • Google Slides • Canva • PDF*</div>', unsafe_allow_html=True)

up = st.file_uploader("", type=["pptx", "ppt", "pdf"])

if up:
    with st.spinner("Extracting layered elements..."):
        ppt = Presentation(up)
        nav, slides = "", ""

        for i, slide in enumerate(ppt.slides):
            title_text = slide.shapes.title.text if slide.shapes.title else f"Page {i+1}"
            nav += f'<div class="nav-link" id="link-{i}" onclick="goTo({i})">{html.escape(title_text)}</div>'

            slides += f'<div id="p-{i}" class="page {"active" if i==0 else ""}"> '

            y_pos = 20
            # TITLES: Wrapped in a movable box
            if slide.shapes.title:
                slides += f'<div class="canvas-box" style="top:{y_pos}px; left:50px; width:650px;"><div class="del-btn" onclick="$(this).parent().remove()">X</div><div class="content-area" style="font-size:32px; font-weight:bold;">{html.escape(slide.shapes.title.text)}</div></div>'
                y_pos += 100

            for shape in slide.shapes:
                if shape.shape_type == 13: # Image extraction
                    b64 = base64.b64encode(shape.image.blob).decode()
                    slides += f'<div class="canvas-box" style="top:{y_pos}px; left:50px; width:400px;"><div class="del-btn" onclick="$(this).parent().remove()">X</div><img src="data:image/png;base64,{b64}"></div>'
                    y_pos += 350
                elif shape.has_text_frame and shape != slide.shapes.title:
                    txt = html.escape(shape.text)
                    if txt.strip():
                        slides += f'<div class="canvas-box" style="top:{y_pos}px; left:480px; width:300px;"><div class="del-btn" onclick="$(this).parent().remove()">X</div><div class="content-area" style="font-size:16px;">{txt}</div></div>'
                        y_pos += 180
            slides += '</div>'

    final_book = BOOK_TEMPLATE.replace("{{NAV_LINKS}}", nav).replace("{{SLIDE_CONTENT}}", slides).replace("{{TOTAL_PAGES}}", str(len(ppt.slides)))
    st.markdown("<div style='text-align: center; padding-top: 30px;'>", unsafe_allow_html=True)
    st.download_button(label="📥 Download My Notebook", data=final_book, file_name=f"NoteDump_{up.name}.html", mime="text/html", use_container_width=True)
