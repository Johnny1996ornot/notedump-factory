import os
import time
from io import BytesIO
import base64
import html
from flask import Flask, request, send_file
from pptx import Presentation
import fitz  # PyMuPDF
from template import get_template

app = Flask(__name__)

# --- HTML FRONTEND (Mimics your old NoteDump UI) ---
FRONTEND_HTML = """
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>NoteDump</title>
    <style>
        body { background-color: #000000; color: white; font-family: 'Segoe UI', sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; }
        .hero { text-align: center; margin-bottom: 30px; }
        .logo-text { font-size: 55px; font-weight: 800; color: #f8fafc; margin: 0;}
        .tagline { color: #94a3b8; font-size: 18px; margin-top: -5px;}
        .upload-box { background-color: #0f172a; border: 1px dashed #334155; border-radius: 12px; padding: 40px; text-align: center; width: 400px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
        input[type="file"] { margin-bottom: 20px; color: #e2e8f0; font-weight: bold; }
        button { background-color: #4f46e5; color: white; border: none; padding: 12px 24px; border-radius: 6px; font-weight: bold; cursor: pointer; font-size: 16px; width: 100%; transition: 0.2s;}
        button:hover { background-color: #4338ca; }
        .blank-btn { background-color: #1e293b; border: 1px solid #334155; margin-top: 15px;}
        .blank-btn:hover { background-color: #334155; }
    </style>
</head>
<body>
    <div class="hero">
        <h1 class="logo-text">📝 NoteDump</h1>
        <p class="tagline">Turning your documents into an interactive notebook</p>
        <p style="color: #475569; font-size: 12px;">PPTX • PPT • PDF</p>
    </div>
    <div class="upload-box">
        <form action="/convert" method="POST" enctype="multipart/form-data">
            <input type="file" name="file" accept=".pdf,.pptx,.ppt" required>
            <button type="submit">📥 Generate & Download Notebook</button>
        </form>
        <form action="/blank" method="GET">
            <button type="submit" class="blank-btn">📓 Create Blank Notebook</button>
        </form>
    </div>
</body>
</html>
"""

@app.route("/", methods=["GET"])
def index():
    return FRONTEND_HTML

@app.route("/blank", methods=["GET"])
def create_blank():
    blank_nav = '<div class="nav-link active-nav" id="link-0" onclick="goTo(\'0\')"><i class="fas fa-bars drag-handle"></i> <span class="nav-text">Page 1</span></div>'
    blank_slides = '<div id="p-0" class="page active" data-page-width="816" data-page-height="1054" style="width:816px; height:1054px;"></div>'
    unique_blank_id = f"New_Notebook_{int(time.time())}"
    
    html_out = get_template(1) \
        .replace("{{NAV_LINKS}}", blank_nav) \
        .replace("{{SLIDE_CONTENT}}", blank_slides) \
        .replace("{{VISIBLE_TITLE}}", "New_Notebook") \
        .replace("{{STORAGE_ID}}", unique_blank_id)
        
    return send_file(
        BytesIO(html_out.encode('utf-8')),
        mimetype="text/html",
        as_attachment=True,
        download_name="NoteDump_Blank.html"
    )

@app.route("/convert", methods=["POST"])
def convert_file():
    if 'file' not in request.files:
        return "No file uploaded", 400
    
    file = request.files['file']
    if file.filename == '':
        return "No selected file", 400
        
    file_name = file.filename.lower()
    file_bytes = file.read()
    
    nav = ""
    slides = ""
    total_pages = 0
    unique_storage_id = f"{file_name}_{int(time.time())}"
    base_w = 816 
    base_h = 1054
    
    try:
        if file_name.endswith(('.pptx', '.ppt')):
            ppt = Presentation(BytesIO(file_bytes))
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
            doc = fitz.open(stream=file_bytes, filetype="pdf")
            total_pages = len(doc)

            first_page = doc[0]
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

        final_html = get_template(total_pages)\
            .replace("{{NAV_LINKS}}", nav)\
            .replace("{{SLIDE_CONTENT}}", dimension_script + slides)\
            .replace("{{VISIBLE_TITLE}}", html.escape(file.filename))\
            .replace("{{STORAGE_ID}}", html.escape(unique_storage_id))
            
        return send_file(
            BytesIO(final_html.encode('utf-8')),
            mimetype="text/html",
            as_attachment=True,
            download_name=f"NoteDump_{file.filename}.html"
        )

    except Exception as e:
        return f"<h1>Error processing file</h1><p>{str(e)}</p>", 500

# Required for Vercel serverless to map the app correctly
if __name__ == "__main__":
    app.run(debug=True)
