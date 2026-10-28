"""Generate the fictional demo packet. Run: python3 demo-docs/make.py
HTML -> demo-docs/html, PNG/JPG -> public/demo (used by the app), PDF -> demo-docs/print (to print for the demo)."""
import pathlib, subprocess, html

ROOT = pathlib.Path(__file__).resolve().parent
OUT_HTML, OUT_PDF, OUT_IMG = ROOT / "html", ROOT / "print", ROOT.parent / "public" / "demo"
CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
for d in (OUT_HTML, OUT_PDF, OUT_IMG): d.mkdir(parents=True, exist_ok=True)

PATIENT = dict(name="Mr. Ramesh Iyer", age="68 Y / Male", uhid="SD-2025-118742", phone="+91 98XXX X4521")
BASE_CSS = """*{box-sizing:border-box}body{margin:0;background:#fff;font-family:Arial,Helvetica,sans-serif;color:#111;font-size:13px}
.page{width:794px;min-height:1123px;padding:36px 44px;position:relative}
.hdr{display:flex;justify-content:space-between;align-items:center;border-bottom:3px solid #0b5394;padding-bottom:10px}
.logo{font-size:26px;font-weight:800;color:#0b5394}.logo small{display:block;font-size:11px;font-weight:400;color:#555}
.addr{text-align:right;font-size:11px;color:#444;line-height:1.5}
.pt{display:grid;grid-template-columns:1fr 1fr;gap:2px 24px;border:1px solid #bbb;padding:10px 12px;margin:14px 0;font-size:12px}
.pt b{display:inline-block;min-width:110px}
h2{background:#e8eef7;color:#0b5394;font-size:13px;padding:5px 8px;margin:12px 0 0}
table{width:100%;border-collapse:collapse}th{text-align:left;font-size:11px;color:#555;border-bottom:1px solid #999;padding:6px 8px}
td{padding:3px 8px;border-bottom:1px solid #eee}.hi{font-weight:700}.flag{font-weight:700;color:#b00}
.signrow{display:flex;justify-content:space-between;align-items:flex-end;margin-top:4px}.sign{position:absolute;bottom:60px;right:44px;text-align:center;font-size:12px}.signrow .sign{position:static}.sign .sig{font-family:'Brush Script MT',cursive;font-size:26px;color:#1d3c78}
.foot{position:absolute;bottom:24px;left:44px;right:44px;border-top:1px solid #ccc;padding-top:6px;font-size:10px;color:#666;display:flex;justify-content:space-between}
.stamp{width:84px;height:84px;font-size:10px!important;margin-left:16px;border:3px solid rgba(11,83,148,.45);border-radius:50%;color:rgba(11,83,148,.55);font-size:11px;font-weight:700;display:grid;place-items:center;text-align:center;transform:rotate(-14deg)}"""

def lab_header():
    return """<div class="hdr"><div class="logo">SUNRISE DIAGNOSTICS<small>NABL accredited laboratory · ISO 15189:2022</small></div>
<div class="addr">#42, 3rd Cross, Jayanagar 4th Block<br>Bengaluru 560011 · 080-4123 7788<br>reports@sunrisediag.example</div></div>"""

def patient_box(date, ref, sample_id):
    p = PATIENT
    return f"""<div class="pt"><div><b>Patient Name</b>: {p['name']}</div><div><b>Sample ID</b>: {sample_id}</div>
<div><b>Age / Sex</b>: {p['age']}</div><div><b>Collected</b>: {date} 08:12 AM</div>
<div><b>UHID</b>: {p['uhid']}</div><div><b>Reported</b>: {date} 04:40 PM</div>
<div><b>Referred By</b>: {ref}</div><div><b>Sample</b>: Blood (fasting), EDTA, Serum</div></div>"""

def lab_report(fname, date, sample_id, sections):
    rows = ""
    for title, tests in sections:
        rows += f"<h2>{title}</h2><table><tr><th style='width:42%'>Test</th><th>Result</th><th>Unit</th><th>Biological Ref. Interval</th></tr>"
        for name, val, unit, lo, hi, method in tests:
            flag = " H" if hi is not None and val > hi else " L" if lo is not None and val < lo else ""
            rng = f"{lo} - {hi}" if lo is not None and hi is not None else (f"&lt; {hi}" if hi is not None else f"&gt; {lo}")
            cls = "hi" if flag else ""
            rows += f"<tr><td>{name}<div style='font-size:10px;color:#777'>{method}</div></td><td class='{cls}'>{val}<span class='flag'>{flag}</span></td><td>{unit}</td><td>{rng}</td></tr>"
        rows += "</table>"
    body = f"""<div class="page">{lab_header()}{patient_box(date, 'Dr. Anita Rao, MD', sample_id)}
<div style="text-align:center;font-weight:700;font-size:15px;letter-spacing:1px;margin-top:6px">DIABETES &amp; WELLNESS PROFILE</div>{rows}
<p style="font-size:11px;color:#555;margin-top:14px">HbA1c interpretation (ADA): Normal &lt; 5.7 % · Prediabetes 5.7 – 6.4 % · Diabetes ≥ 6.5 %. Results marked H/L are outside the reference interval.</p>
<p style="text-align:center;font-size:11px">*** End of Report ***</p>
<div class="signrow"><div class="stamp">SUNRISE<br>DIAGNOSTICS<br>VERIFIED</div>
<div class="sign"><div class="sig">Meera K</div>Dr. Meera Krishnan, MD (Pathology)<br>Consultant Pathologist · KMC Reg. 61214</div></div>
<div class="foot"><span>Page 1 of 1</span><span>This report is for the referring doctor. Correlate clinically.</span></div></div>"""
    return fname, body

def labs(hba1c, fbs, sgpt, creat, ldl, tg, hb, vitd, sgot=None):
    liver = [("SGPT (ALT)", sgpt, "U/L", 0, 40, "IFCC without P5P")] + ([("SGOT (AST)", sgot, "U/L", 0, 40, "IFCC without P5P")] if sgot else [])
    return [
        ("DIABETES", [("Glycated Haemoglobin (HbA1c)", hba1c, "%", 4.0, 5.6, "HPLC"), ("Fasting Plasma Glucose", fbs, "mg/dL", 70, 100, "Hexokinase")]),
        ("LIVER FUNCTION", liver),
        ("KIDNEY FUNCTION", [("Serum Creatinine", creat, "mg/dL", 0.7, 1.3, "Enzymatic")]),
        ("LIPID PROFILE", [("LDL Cholesterol (Direct)", ldl, "mg/dL", None, 100, "Direct measure"), ("Triglycerides", tg, "mg/dL", None, 150, "GPO-POD")]),
        ("HAEMATOLOGY", [("Haemoglobin", hb, "g/dL", 13.0, 17.0, "Photometric")]),
        ("VITAMINS", [("25-OH Vitamin D (Total)", vitd, "ng/mL", 30, 100, "CLIA")]),
    ]

def clinic_header():
    return """<div class="hdr" style="border-color:#0f766e"><div class="logo" style="color:#0f766e">Dr. Anita Rao<small>MBBS, MD (General Medicine) · Diabetologist<br>KMC Reg. No. 45821 (fictional)</small></div>
<div class="addr"><b>Rao Diabetes &amp; Heart Clinic</b><br>12, 9th Main, Banashankari 2nd Stage<br>Bengaluru 560070 · 080-2671 4400<br>Mon–Sat 10 AM – 1 PM, 5 – 8 PM</div></div>"""

def typed_rx():
    meds = [("Tab. GLYCOMET 500 mg", "Metformin", "1 - 0 - 1", "After food", "6 months"),
            ("Tab. TELMA 40 mg", "Telmisartan", "1 - 0 - 0", "Morning", "6 months"),
            ("Tab. ATORVA 10 mg", "Atorvastatin", "0 - 0 - 1", "After dinner", "6 months"),
            ("UPRISE-D3 60K sachet", "Cholecalciferol", "Once a week (Sunday)", "In milk, after breakfast", "8 weeks")]
    rows = "".join(f"<tr><td><b>{n}</b><div style='font-size:11px;color:#666'>{g}</div></td><td>{d}</td><td>{w}</td><td>{dur}</td></tr>" for n, g, d, w, dur in meds)
    body = f"""<div class="page">{clinic_header()}
<div class="pt"><div><b>Patient</b>: {PATIENT['name']}</div><div><b>Date</b>: 20/04/2026</div><div><b>Age / Sex</b>: {PATIENT['age']}</div><div><b>Weight</b>: 78 kg</div>
<div><b>BP</b>: 142/88 mmHg</div><div><b>Pulse</b>: 78/min</div></div>
<p><b>C/o:</b> Routine follow-up. Mild tiredness. Right knee pain on climbing stairs.</p>
<p><b>Dx:</b> Type 2 Diabetes Mellitus (on treatment) · Essential Hypertension · Dyslipidaemia · Vit D deficiency</p>
<div style="font-size:34px;font-family:Georgia,serif;color:#0f766e;margin-top:10px">℞</div>
<table><tr><th>Medicine</th><th>Dose (M-A-N)</th><th>When</th><th>Duration</th></tr>{rows}</table>
<h2 style="background:#e6f4f1;color:#0f766e">Advice</h2><ul style="line-height:1.8">
<li>Avoid sweets, sugary tea/coffee and large portions of white rice.</li><li>Brisk walk 30 minutes daily.</li>
<li>Check fasting sugar at home twice a week, keep a record.</li><li>Review after 6 months with HbA1c, LFT, lipid profile.</li></ul>
<div class="sign"><div class="sig" style="color:#0f766e">A. Rao</div>Dr. Anita Rao, MD</div>
<div class="foot"><span>Not valid for medico-legal purposes</span><span>Next review: Oct 2026</span></div></div>"""
    return "03-rx", body

def scan_report(fname, modality, date, ref_no, radiologist, technique, findings, impression):
    f = "".join(f"<p>{html.escape(x)}</p>" for x in findings)
    imp = "".join(f"<li><b>{html.escape(x)}</b></li>" for x in impression)
    body = f"""<div class="page"><div class="hdr"><div class="logo">CITY IMAGING CENTRE<small>MRI · CT · Ultrasound · Digital X-ray</small></div>
<div class="addr">88, Bannerghatta Road, Bengaluru 560076<br>080-4550 2020 · cityimaging.example</div></div>
<div class="pt"><div><b>Patient Name</b>: {PATIENT['name']}</div><div><b>Ref. No</b>: {ref_no}</div><div><b>Age / Sex</b>: {PATIENT['age']}</div>
<div><b>Date</b>: {date}</div><div><b>Referred By</b>: Dr. Anita Rao, MD</div><div><b>Study</b>: {modality}</div></div>
<div style="text-align:center;font-weight:700;font-size:16px;text-decoration:underline;margin:10px 0">{modality.upper()}</div>
<p><b>Technique:</b> {technique}</p><h2>FINDINGS</h2>{f}<h2>IMPRESSION</h2><ol>{imp}</ol>
<p style="font-size:11px;color:#555">Kindly correlate clinically. This is a professional opinion, not a diagnosis.</p>
<div class="sign"><div class="sig">{radiologist.split()[1]}</div>{radiologist}<br>Consultant Radiologist</div>
<div class="foot"><span>Page 1 of 1</span><span>Images archived on PACS for 5 years</span></div></div>"""
    return fname, body

HAND_CSS = """@import url('https://fonts.googleapis.com/css2?family=Caveat:wght@500&family=Kalam&display=swap');
.hand{font-family:'Caveat',cursive;font-size:30px;color:#1a2a6c;line-height:1.35}
.paper{background:#fdfbf4;background-image:repeating-linear-gradient(transparent 0 39px,#e8e2cf 39px 40px)}"""

def handwritten_rx():
    body = f"""<div class="page paper" style="transform:rotate(-0.6deg)">{clinic_header()}
<div class="hand" style="margin-top:18px">
<div style="display:flex;justify-content:space-between"><span>Mr. Ramesh Iyer &nbsp; 68/M</span><span>24/10/26</span></div>
<div style="font-size:26px">BP 138/86 &nbsp;&nbsp; Wt 79 kg &nbsp;&nbsp; FBS 146</div>
<div style="font-size:26px">T2DM - uncontrolled, HbA1c 7.8 ↑ &nbsp; SGPT 68 ↑ &nbsp; Fatty liver Gr I</div>
<div style="font-size:48px;margin-top:6px">℞</div>
<div>1) Tab. Glycomet 1000 mg &nbsp;&nbsp; 1 — 0 — 1 &nbsp; PC &nbsp; x 3 mon</div>
<div>2) Tab. Telma 40 &nbsp;&nbsp;&nbsp; 1 — 0 — 0 &nbsp; x 3 mon</div>
<div>3) Tab. Atorva 10 &nbsp;&nbsp;&nbsp; 0 — 0 — 1 &nbsp; PC &nbsp; x 3 mon</div>
<div style="margin-top:14px"><u>Adv</u>: Low carb diet, no fried / outside food</div>
<div style="padding-left:58px">Walk 45 min daily</div>
<div style="padding-left:58px">Repeat HbA1c + LFT after 3 months</div>
<div style="margin-top:60px;text-align:right;padding-right:30px;font-size:40px">A. Rao</div>
</div></div>"""
    return "08-rx-handwritten", body, HAND_CSS

DOCS = [
    lab_report("01-blood-oct25", "18/10/2025", "SD25-104882", labs(6.6, 112, 30, 0.9, 124, 160, 13.8, 18)),
    lab_report("02-blood-apr26", "20/04/2026", "SD26-031577", labs(7.1, 128, 41, 1.0, 136, 178, 13.5, 24)),
    typed_rx(),
    scan_report("04-cxr-report", "X-Ray Chest PA View", "10/02/2026", "CIC/XR/26/2214", "Dr. S. Menon, MD (Radio-diagnosis)",
        "Digital radiograph, PA erect view.",
        ["Trachea is central. Both hila are normal.", "Both lung fields are clear. No consolidation, effusion or pneumothorax.",
         "Cardiac size within normal limits (CTR 0.46).", "Both costophrenic angles are clear. Bony thorax is unremarkable."],
        ["Normal chest radiograph."]),
    scan_report("05-knee-mri-report", "MRI Right Knee (Plain)", "05/06/2026", "CIC/MR/26/0981", "Dr. R. Kulkarni, MD (Radio-diagnosis)",
        "Multiplanar PD fat-sat, T1 and T2 sequences on 1.5T.",
        ["Medial meniscus: horizontal degenerative tear in the body of the medial meniscus reaching the inferior articular surface.",
         "Lateral meniscus is normal.", "ACL, PCL, MCL and LCL are intact.",
         "Patellofemoral joint: grade II chondromalacia patellae with mild cartilage thinning.", "Mild joint effusion. No bone marrow oedema."],
        ["Horizontal degenerative tear of the body of the medial meniscus.", "Grade II chondromalacia patellae.", "Mild joint effusion."]),
    scan_report("06-usg-report", "USG Whole Abdomen", "12/08/2026", "CIC/US/26/4410", "Dr. P. Shah, MD (Radio-diagnosis)",
        "Real-time B-mode sonography with convex probe.",
        ["Liver: normal in size (14.2 cm) with mildly increased echotexture. No focal lesion. Portal vein normal.",
         "Gallbladder: well distended, no calculi. CBD normal.", "Pancreas and spleen: normal.",
         "Both kidneys normal in size and echotexture. No calculi or hydronephrosis.", "Urinary bladder normal. Prostate 22 cc."],
        ["Grade I fatty liver.", "No other significant abnormality."]),
    lab_report("07-blood-oct26", "24/10/2026", "SD26-118230", labs(7.8, 146, 68, 1.1, 112, 196, 13.2, 31, sgot=52)),
    handwritten_rx(),
]

for doc in DOCS:
    fname, body = doc[0], doc[1]
    extra = doc[2] if len(doc) > 2 else ""
    page = f"<!doctype html><html><head><meta charset='utf-8'><style>{BASE_CSS}{extra}@page{{size:A4;margin:0}}</style></head><body>{body}</body></html>"
    h = OUT_HTML / f"{fname}.html"; h.write_text(page)
    pdf = OUT_PDF / f"{fname}.pdf"
    subprocess.run([CHROME, "--headless", "--disable-gpu", "--no-pdf-header-footer", "--virtual-time-budget=4000", f"--print-to-pdf={pdf}", h.as_uri()], check=True, capture_output=True)
    if fname.endswith("-report"): continue  # scan reports: print only; the app shows the scan image
    png = OUT_IMG / f"{fname}.png"
    subprocess.run([CHROME, "--headless", "--disable-gpu", "--hide-scrollbars", "--virtual-time-budget=4000", "--force-device-scale-factor=1.5",
                    "--window-size=794,1123", f"--screenshot={png}", h.as_uri()], check=True, capture_output=True)
    if fname == "08-rx-handwritten":  # store as a phone-photo style JPEG
        subprocess.run(["sips", "-s", "format", "jpeg", "-s", "formatOptions", "80", str(png), "--out", str(OUT_IMG / f"{fname}.jpg")], check=True, capture_output=True)
        png.unlink()
    print("built", fname)
