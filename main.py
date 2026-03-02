import streamlit as st
from pptx import Presentation
import html 
import base64
from io import BytesIO
from template import get_template

st.set_page_config(page_title="NoteDump", layout="centered", initial_sidebar_state="collapsed")

# FIX: Removed all indentation from the HTML so Streamlit does not treat it as a code block!
st.markdown("""
<style>
.stApp { background-color: #000000; }
.top-nav { display: flex; justify-content: flex-end; align-items: center; padding: 10px 20px; }

.guide-btn {
    color: #ccc; text-decoration: none; font-size: 18px; font-weight: bold; font-family: sans-serif;
    border: 2px solid #555; border-radius: 50%; width: 32px; height: 32px; 
    display: flex; align-items: center; justify-content: center; 
    background: #222; margin-right: 15px; transition: 0.2s;
}
.guide-btn:hover { color: white; border-color: #4285f4; background: #1a1a1a; transform: scale(1.1); }

.coffee-btn {
    color: #FFDD00; text-decoration: none; font-weight: bold; 
    border: 1px solid #FFDD00; padding: 5px 12px; border-radius: 20px; 
    transition: 0.2s;
}
.coffee-btn:hover { background: rgba(255, 221, 0, 0.1); color: #fff; }

.modal-window {
    position: fixed; background-color: rgba(0, 0, 0, 0.85); backdrop-filter: blur(5px);
    top: 0; right: 0; bottom: 0; left: 0; z-index: 99999;
    visibility: hidden; opacity: 0; transition: all 0.3s;
    display: flex; justify-content: center; align-items: center;
}
.modal-window:target { visibility: visible; opacity: 1; }
.modal-content {
    background: #121212; width: 90%; max-width: 650px; padding: 30px;
    border-radius: 16px; border: 1px solid #444; color: #eee;
    position: relative; max-height: 80vh; overflow-y: auto; box-shadow: 0 10px 40px rgba(0,0,0,0.8);
}
.modal-close {
    position: absolute; top: 20px; right: 25px; color: #888;
    text-decoration: none; font-size: 28px; font-weight: bold; transition: 0.2s;
}
.modal-close:hover { color: #ff4b4b; }

.modal-content h2 { margin-top: 0; color: #4285f4; font-size: 24px; border-bottom: 1px solid #333; padding-bottom: 10px;}
.modal-content h4 { color: #FFDD00; margin-top: 20px; margin-bottom: 10px; font-size: 18px;}
.modal-content li { margin-bottom: 10px; line-height: 1.5; font-size: 15px; color: #ccc;}
.modal-content strong { color: white; }

.hero { text-align: center; color: white; padding: 20px 0; }
.logo-container { display: flex; align-items: center; justify-content: center; gap: 15px; }
.logo-text { font-size: 75px; font-weight: 800; }
.logo-icon { font-size: 65px; }
.support-text { font-size: 14px; color: #666; margin-top: 10px; }

[data-testid="stFileUploader"] { display: flex; justify-content: center; }
[data-testid="stFileUploader"] section { 
    width: 500px !important; 
    text-align: center !important; 
    background-color: #161616 !important; 
    border: 1px dashed #333 !important;
}
.or-divider { text-align: center; color: #555; margin: 30px 0; font-size: 14px; font-weight: bold; letter-spacing: 1px; }
</style>

<div class="top-nav">
<a href="#guide-modal" class="guide-btn" title="App Guide & Features">?</a>
<a href="https://buymeacoffee.com/jpramirez" target="_blank" class="coffee-btn">☕ Buy me a coffee</a>
</div>

<div id="guide-modal" class="modal-window">
<div class="modal-content">
<a href="#" class="modal-close" title="Close">&times;</a>
<h2>📝 Welcome to NoteDump</h2>
<p style="font-size: 16px; line-height: 1.5; color: #bbb;"><strong>Our Goal:</strong> NoteDump transforms static lecture slides into a fast, interactive, and offline-first digital notebook. Built for students and teachers who need to annotate, organize, and study without relying on cloud subscriptions.</p>
<h4>✨ Core Features & Interface Guide</h4>
<ul>
<li><strong>100% Offline & Private:</strong> NoteDump runs entirely inside your browser. Your notes auto-save to your local device. Click <em>Export Notebook</em> to save your work as a standalone HTML file to share or back up.</li>
<li><strong>Interactive Teardrop Pins:</strong> Drop map-style pins anywhere on a slide. You can rotate them to point at specific diagrams, link them securely to images so they move together, and write detailed notes for each pin.</li>
<li><strong>Notebook View:</strong> Activate the distraction-free reading mode. It features a sleek, semi-transparent overlapping page stack on the left, and a dedicated control panel on the right.</li>
<li><strong>Smart Search Navigation:</strong> Type a keyword in the search bar and press <strong>Enter</strong> to instantly jump to the next matching word or pin. The app automatically flips pages and highlights the active match in bright orange.</li>
<li><strong>Full Editing Suite:</strong> Add custom text boxes, crop and resize images, change layer ordering (send to front/back), adjust text background transparency, and format text freely.</li>
<li><strong>Chapter Organization:</strong> Insert Chapter Dividers to automatically group your slides. The side panel lets you easily filter your page stack by chapter.</li>
<li><strong>True Dark Mode:</strong> Seamlessly toggle the entire canvas and interface into a deep charcoal theme to prevent eye strain during late-night study sessions.</li>
<li><strong>Trackpad Zoom:</strong> Hold <em>Ctrl</em> (or <em>Cmd</em>) and scroll/pinch on your trackpad to smoothly zoom in and out of the canvas without zooming the entire browser window.</li>
</ul>
</div>
</div>

<div class="hero">
<div class="logo-container">
<span class="logo-icon">📝</span>
<span class="logo-text">NoteDump</span>
</div>
<p style="font-size: 22px; color: #999; margin-top: -5px;">Transforming your lectures into a notebook</p>
<p class="support-text">Supports: PowerPoint • Google Slides • Canva (Export as PPTX)</p>
</div>
""", unsafe_allow_html=True)

up = st.file_uploader("", type=["pptx", "ppt"])

if up:
    try:
        ppt = Presentation(up)
        nav, slides = "", ""

        def parse_shapes(shapes, slide_height, slide_width):
            html_content = ""
            for shape in shapes:
                try:
                    if shape.shape_type == 6: 
                        html_content += parse_shapes(shape.shapes, slide_height, slide_width)
                        continue

                    top = (shape.top / slide_height) * 1000 if shape.top else 0
                    left = (shape.left / slide_width) * 800 if shape.left else 0
                    width = (shape.width / slide_width) * 800 if shape.width else 200

                    if shape.shape_type == 13: 
                        img_stream = BytesIO(shape.image.blob)
                        base64_img = base64.b64encode(img_stream.getvalue()).decode()
                        html_content += f'''
                        <div class="canvas-box" style="top:{top}px; left:{left}px; width:{width}px; max-width: calc(800px - {left}px); transform: translate(0px, 0px);">
                            <img src="data:image/png;base64,{base64_img}" style="width:100%;">
                        </div>'''

                    elif shape.has_table:
                        table_html = "<table style='width:100%; border-collapse: collapse; font-size:12px;' border='1'>"
                        for row in shape.table.rows:
                            table_html += "<tr>"
                            for cell in row.cells:
                                table_html += f"<td style='padding:5px;'>{html.escape(cell.text)}</td>"
                            table_html += "</tr>"
                        table_html += "</table>"
                        html_content += f'''
                        <div class="canvas-box" style="top:{top}px; left:{left}px; width:{width}px; max-width: calc(800px - {left}px); background:rgba(255,255,255,0.9); transform: translate(0px, 0px);">
                            <div class="content-area">{table_html}</div>
                        </div>'''

                    elif shape.has_text_frame and shape.text.strip():
                        html_text = ""
                        for paragraph in shape.text_frame.paragraphs:
                            p_text = ""
                            for run in paragraph.runs:
                                r_txt = html.escape(run.text)
                                if getattr(run.font, 'bold', False) == True:
                                    r_txt = f"<strong>{r_txt}</strong>"
                                if getattr(run.font, 'italic', False) == True:
                                    r_txt = f"<em>{r_txt}</em>"
                                if getattr(run.font, 'underline', False) == True:
                                    r_txt = f"<u>{r_txt}</u>"
                                p_text += r_txt

                            if not p_text.strip():
                                html_text += "<br>"
                            else:
                                html_text += f"<div>{p_text}</div>"

                        html_content += f'''
                        <div class="canvas-box" style="top:{top}px; left:{left}px; width:{width}px; max-width: calc(800px - {left}px); transform: translate(0px, 0px);">
                            <div class="content-area" style="word-wrap: break-word; white-space: pre-wrap; overflow-wrap: break-word;">{html_text}</div>
                        </div>'''
                except Exception as e:
                    continue 

            return html_content

        for i, slide in enumerate(ppt.slides):
            title_text = slide.shapes.title.text if slide.shapes.title else f"Slide {i+1}"
            nav += f'<div class="nav-link" id="link-{i}" onclick="goTo(\'{i}\')"><i class="fas fa-bars drag-handle"></i> <span class="nav-text">{html.escape(title_text)}</span></div>'

            slides += f'<div id="p-{i}" class="page {"active" if i==0 else ""}"> '
            slides += parse_shapes(slide.shapes, ppt.slide_height, ppt.slide_width)
            slides += '</div>'

        final_html = get_template(len(ppt.slides)).replace("{{NAV_LINKS}}", nav).replace("{{SLIDE_CONTENT}}", slides).replace("{{LECTURE_ID}}", html.escape(up.name))

        st.markdown("<br>", unsafe_allow_html=True)
        st.download_button(
            label="📥 Download My Notebook", 
            data=final_html, 
            file_name=f"NoteDump_{up.name}.html", 
            mime="text/html",
            use_container_width=True
        )
    except Exception as e:
        st.error(f"Error Processing File: {e}")

st.markdown('<div class="or-divider">— OR START FROM SCRATCH —</div>', unsafe_allow_html=True)

blank_nav = '<div class="nav-link active-nav" id="link-0" onclick="goTo(\'0\')"><i class="fas fa-bars drag-handle"></i> <span class="nav-text">Page 1</span></div>'
blank_slides = '<div id="p-0" class="page active"></div>'
blank_html = get_template(1).replace("{{NAV_LINKS}}", blank_nav).replace("{{SLIDE_CONTENT}}", blank_slides).replace("{{LECTURE_ID}}", "New_Notebook")

col1, col2, col3 = st.columns([1, 2, 1])
with col2:
    st.download_button(
        label="📓 Create Blank Notebook", 
        data=blank_html, 
        file_name="NoteDump_Blank.html", 
        mime="text/html",
        use_container_width=True
    )
