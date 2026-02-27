import streamlit as st
from pptx import Presentation
import base64
import html 
from template import get_template

# --- UI BRANDING & CENTERING ---
st.set_page_config(page_title="NoteDump", layout="centered")

st.markdown("""
    <style>
        .stApp { background-color: #000000; }
        .hero { text-align: center; color: white; padding: 30px 0; }
        .logo { font-size: 70px; font-weight: 800; margin-bottom: 0; }
        .tagline { font-size: 20px; color: #888; margin-top: -10px; margin-bottom: 10px; }
        .instruction-bar { color: #555; font-size: 14px; margin-bottom: 30px; text-align: center; line-height: 1.6; }

        /* FORCE CENTERING FOR UPLOADER */
        [data-testid="stFileUploader"] { 
            display: flex; 
            justify-content: center; 
            width: 100% !important; 
        }
        [data-testid="stFileUploader"] section { 
            width: 550px !important; 
            margin: 0 auto !important; 
            display: flex;
            flex-direction: column;
            align-items: center !important;
            text-align: center !important;
        }
        [data-testid="stFileUploader"] section > div:nth-child(2),
        [data-testid="stFileUploader"] section > small { display: none !important; }
    </style>
""", unsafe_allow_html=True)

st.markdown('<div class="hero"><div class="logo">🛠️ NoteDump</div><p class="tagline">Transforming your lectures into a notebook</p></div>', unsafe_allow_html=True)
st.markdown('<div class="instruction-bar">Upload your file (pptx ppt)<br>Supports: PowerPoint • Google Slides • Canva</div>', unsafe_allow_html=True)

up = st.file_uploader("", type=["pptx", "ppt"])

if up:
    with st.spinner("Processing lecture layers..."):
        ppt = Presentation(up)
        nav, slides = "", ""

        for i, slide in enumerate(ppt.slides):
            title_text = slide.shapes.title.text if slide.shapes.title else f"Page {i+1}"
            nav += f'<div class="nav-link" id="link-{i}" onclick="goTo({i})"><span class="nav-title" contenteditable="true">{html.escape(title_text)}</span></div>'
            slides += f'<div id="p-{i}" class="page {"active" if i==0 else ""}"> '

            for shape in slide.shapes:
                top = (shape.top / ppt.slide_height) * 1000 
                left = (shape.left / ppt.slide_width) * 800
                width = (shape.width / ppt.slide_width) * 800

                if shape == slide.shapes.title:
                    slides += f'<div class="canvas-box" style="top:{top}px; left:{left}px; width:{width}px;"><div class="del-btn" onclick="$(this).parent().remove()">X</div><div class="content-area" style="font-size:32px; font-weight:bold;">{html.escape(shape.text)}</div></div>'
                elif shape.shape_type == 13: 
                    b64 = base64.b64encode(shape.image.blob).decode()
                    slides += f'<div class="canvas-box" style="top:{top}px; left:{left}px; width:{width}px;"><div class="del-btn" onclick="$(this).parent().remove()">X</div><img src="data:image/png;base64,{b64}"></div>'
                elif shape.has_text_frame:
                    txt = html.escape(shape.text)
                    if txt.strip():
                        slides += f'<div class="canvas-box" style="top:{top}px; left:{left}px; width:{width}px;"><div class="del-btn" onclick="$(this).parent().remove()">X</div><div class="content-area" style="font-size:16px;">{txt}</div></div>'
            slides += '</div>'

        final_book = get_template(len(ppt.slides)).replace("{{NAV_LINKS}}", nav).replace("{{SLIDE_CONTENT}}", slides)
        st.download_button(label="📥 Download My Notebook", data=final_book, file_name=f"NoteDump_{up.name}.html", mime="text/html", use_container_width=True)
