const { jsPDF } = require("jspdf");
const fs = require("fs");
const path = require("path");

const doc = new jsPDF({
  orientation: "portrait",
  unit: "mm",
  format: "a4",
});

const pageWidth = 210;
const pageHeight = 297;
const margin = 18;
const contentWidth = pageWidth - margin * 2;
let y = 18;

function checkPageBreak(neededHeight) {
  if (y + neededHeight > pageHeight - 20) {
    doc.addPage();
    y = 20;
    return true;
  }
  return false;
}

function drawHeader() {
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(0, 0, pageWidth, 38, "F");

  // Accent bar
  doc.setFillColor(99, 102, 241); // indigo-500
  doc.rect(0, 38, pageWidth, 2, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(255, 255, 255);
  doc.text("BIASLENS — COLLABORATOR TESTING & HANDOFF GUIDE", margin, 17);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(203, 213, 225); // slate-300
  doc.text(
    "Automated Bias Detection • Fairness Auditing • MS Word-Style Resume Editor • Dual-Engine Architecture",
    margin,
    24,
  );

  doc.setFontSize(8.5);
  doc.setTextColor(148, 163, 184); // slate-400
  doc.text(
    "Target Repo: github.com/Sanchit-Agarwal-27/ResumeBiasDetector  |  Branch: main (Synced)",
    margin,
    31,
  );

  y = 48;
}

function drawSectionHeading(title, icon = "") {
  checkPageBreak(14);
  doc.setFillColor(241, 245, 249); // slate-100
  doc.roundedRect(margin, y, contentWidth, 8, 1.5, 1.5, "F");

  doc.setFillColor(79, 70, 229); // indigo-600 left accent tab
  doc.roundedRect(margin, y, 3, 8, 1, 1, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.setTextColor(30, 41, 59); // slate-800
  doc.text(`${title}`, margin + 6, y + 5.5);
  y += 12;
}

function drawParagraph(text, fontSize = 9, color = [51, 65, 85]) {
  doc.setFont("helvetica", "normal");
  doc.setFontSize(fontSize);
  doc.setTextColor(...color);
  const lines = doc.splitTextToSize(text, contentWidth);
  checkPageBreak(lines.length * 4.5);
  doc.text(lines, margin, y);
  y += lines.length * 4.5 + 2;
}

function drawCodeBlock(codeLines, label = "") {
  const lineHeight = 4.2;
  const blockHeight = codeLines.length * lineHeight + (label ? 8 : 4);
  checkPageBreak(blockHeight + 4);

  // Background box
  doc.setFillColor(30, 41, 59); // slate-800
  doc.roundedRect(margin, y, contentWidth, blockHeight, 1.5, 1.5, "F");

  let currentY = y + 4;
  if (label) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184); // slate-400
    doc.text(label.toUpperCase(), margin + 4, currentY);
    currentY += 4.5;
  }

  doc.setFont("courier", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(226, 232, 240); // slate-200

  for (const line of codeLines) {
    doc.text(line, margin + 4, currentY);
    currentY += lineHeight;
  }

  y += blockHeight + 4;
}

function drawFeatureItem(title, description) {
  checkPageBreak(12);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42); // slate-900

  // Bullet bullet point
  doc.setFillColor(99, 102, 241);
  doc.circle(margin + 2, y - 1, 1.2, "F");

  doc.text(title, margin + 6, y);
  y += 4.2;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105); // slate-600
  const lines = doc.splitTextToSize(description, contentWidth - 6);
  checkPageBreak(lines.length * 4);
  doc.text(lines, margin + 6, y);
  y += lines.length * 4 + 2.5;
}

// ---------------- EXECUTION ----------------
drawHeader();

// Section 1: Overview
drawSectionHeading("1. OVERVIEW & REPOSITORY STATUS");
drawParagraph(
  "BiasLens is an AI-powered resume bias detector, fairness auditing engine, and interactive MS Word-style document editor. All latest updates (dynamic bundle splitting, GDPR privacy compliance, universal writing quality scanner, sticky review UI, and automated evaluation suites) have been verified and pushed to GitHub main.",
);

// Section 2: Quick Pull / Clone
drawSectionHeading("2. CLONE OR PULL LATEST CODE");
drawParagraph(
  "If you already have the repository cloned, pull the latest commits. If cloning fresh, use the standard clone command:",
);
drawCodeBlock(
  [
    "# Option A: Pull latest code if already cloned",
    "git fetch origin",
    "git pull origin main",
    "",
    "# Option B: Clone fresh repository",
    "git clone https://github.com/Sanchit-Agarwal-27/ResumeBiasDetector.git",
    "cd ResumeBiasDetector",
  ],
  "Terminal — Git Setup",
);

// Section 3: Dependencies & Running
drawSectionHeading("3. FRONTEND SETUP & RUNNING");
drawParagraph(
  "Prerequisites: Node.js (v18.0+) and npm. BiasLens functions 100% out of the box with zero required environment configuration. If Supabase keys are not provided, it automatically engages an offline local guest mode.",
);
drawCodeBlock(
  [
    "# 1. Install frontend dependencies",
    "npm install",
    "",
    "# 2. Run automated validation suite (57/57 tests)",
    "npm test",
    "",
    "# 3. Start local development server",
    "npm run dev",
  ],
  "Terminal — Frontend Commands",
);

drawParagraph(
  "Once started, open your browser at http://localhost:3000 (or the local URL printed by Vite in your console).",
);

// Section 4: Python Backend
drawSectionHeading("4. OPTIONAL: PYTHON FASTAPI AI MICROSERVICE");
drawParagraph(
  "BiasLens uses a Dual-Engine Architecture. While the browser engine runs 100% client-side, an optional high-throughput Python FastAPI microservice is available in backend/ for deep NLP & ATS simulations:",
);
drawCodeBlock(
  [
    "cd backend",
    "# Create virtual environment (Windows: python -m venv .venv | Mac/Linux: python3 -m venv .venv)",
    "python -m venv .venv",
    "# Activate environment: Windows -> .venv\\Scripts\\activate | Mac/Linux -> source .venv/bin/activate",
    ".venv\\Scripts\\activate",
    "pip install -r requirements.txt",
    "pytest",
    "uvicorn app.main:app --reload --port 8000",
  ],
  "Terminal — Backend Service",
);
drawParagraph(
  "To connect: In the web UI, open Settings (gear icon in header) and switch Analysis Engine to 'Python FastAPI Microservice'.",
);

// Section 5: Feature Checklist
drawSectionHeading("5. INTERACTIVE FEATURE TESTING CHECKLIST");
drawFeatureItem(
  "Interactive Word-Style Document Editor",
  "Test rich text formatting, font families, font sizes, headings, text alignment, and bullet lists. Import existing PDF/DOCX resumes or click 'Load Sample Resume' in the toolbar to populate sample content.",
);
drawFeatureItem(
  "Real-Time Context-Aware Bias Detection",
  "Type or inspect highlighted bias tokens (e.g., gender-coded terminology, ageist phrases, socio-economic signals). Click any inline highlight or review item in the sidebar to review explainable AI reasoning and apply neutral rewrites with one click.",
);
drawFeatureItem(
  "Writing Quality & Resume Hygiene Scanner",
  "Switch to the 'Quality' tab in the Review Queue. Test automatic detection of passive voice, weak action verbs, unquantified claims, and corporate buzzwords.",
);
drawFeatureItem(
  "Dynamic Google XYZ Sentence Rewriter",
  "Click 'Rewrite with Google XYZ Formula' on resume bullet points to convert qualitative duties into quantified impact statements: Accomplished [X] as measured by [Y], by doing [Z].",
);
drawFeatureItem(
  "Counterfactual Fairness Audit (EEOC 80% Rule)",
  "Click 'Fairness Audit' in the navigation bar to trigger 10 demographic counterfactual perturbations (gender, race, age, non-traditional backgrounds) and check Disparate Impact compliance.",
);
drawFeatureItem(
  "Empirical Model Benchmarks Modal",
  "Click 'Benchmarks' in the navigation bar to run and inspect live confusion matrices, precision, recall, and accuracy metrics on the 30-sample gold dataset.",
);
drawFeatureItem(
  "Vector PDF & Clean DOCX Export",
  "Click the 'Export' dropdown in the editor toolbar to download the cleaned, de-biased resume as a publication-ready Vector PDF or editable DOCX.",
);

// Add footer on all pages
const totalPages = doc.internal.getNumberOfPages();
for (let i = 1; i <= totalPages; i++) {
  doc.setPage(i);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184); // slate-400
  doc.setDrawColor(226, 232, 240); // slate-200
  doc.line(margin, pageHeight - 12, pageWidth - margin, pageHeight - 12);
  doc.text(
    `BiasLens Collaborator Handoff Guide  •  Confidential & Internal`,
    margin,
    pageHeight - 8,
  );
  doc.text(`Page ${i} of ${totalPages}`, pageWidth - margin - 15, pageHeight - 8);
}

const outputPath = path.resolve("BiasLens_Testing_and_Handoff_Guide.pdf");
fs.writeFileSync(outputPath, Buffer.from(doc.output("arraybuffer")));
console.log(`PDF successfully generated at: ${outputPath} (${totalPages} pages)`);
