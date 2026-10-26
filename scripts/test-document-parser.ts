/**
 * @file test-document-parser.ts
 * Comprehensive test suite for the BiasLens Robust Document Extraction Pipeline.
 * Tests 10 distinct real-world resume layout scenarios:
 * 1. Simple, single-column resume
 * 2. Professionally designed resume with multiple fonts
 * 3. Two-column resume (verifies NO column interleaving!)
 * 4. Resume with horizontal and vertical lines
 * 5. Resume with tables and text boxes (DOCX)
 * 6. Resume with icons and contact information
 * 7. Multi-page resume with repeated headers and footers
 * 8. Scanned / image-based PDF resume (triggers OCR fallback)
 * 9. Resume with embedded hyperlinks and bullet points
 * 10. Complex formatting + ordinary text hybrid resume
 */

import { jsPDF } from "jspdf";
import JSZip from "jszip";
import {
  extractResumeDocument,
  detectPageColumns,
  orderRunsByLayout,
  validateExtraction,
  normalizeResumeText,
  parseDocxResume,
  shouldTriggerOcrFallback,
  type LineRun,
} from "../src/lib/document-parser";
import { analyzeResumeText, runCounterfactualFairnessAudit } from "../src/lib/bias-taxonomy";

console.log("================================================================================");
console.log(" BiasLens Robust Document Parser - 10 Layout Scenarios Verification Suite");
console.log("================================================================================\n");

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition: boolean, testName: string, details = "") {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✓ PASS: ${testName}`);
  } else {
    failedTests++;
    console.error(`  ✗ FAIL: ${testName}`);
    if (details) console.error(`    Details: ${details}`);
  }
}

async function runTests() {
  // ============================================================================
  // TEST 1: Simple, Single-Column Resume (PDF)
  // ============================================================================
  console.log("--------------------------------------------------------------------------------");
  console.log(" TEST 1: Simple, Single-Column Resume");
  console.log("--------------------------------------------------------------------------------");
  {
    const pdfDoc = new jsPDF({ unit: "pt", format: "letter" });
    pdfDoc.setFont("helvetica", "bold");
    pdfDoc.setFontSize(22);
    pdfDoc.text("Alex Mercer", 54, 60);

    pdfDoc.setFont("helvetica", "normal");
    pdfDoc.setFontSize(10);
    pdfDoc.text("alex.mercer@example.com | (555) 019-2834 | New York, NY", 54, 80);

    pdfDoc.setFont("helvetica", "bold");
    pdfDoc.setFontSize(14);
    pdfDoc.text("PROFESSIONAL SUMMARY", 54, 115);

    pdfDoc.setFont("helvetica", "normal");
    pdfDoc.setFontSize(10);
    pdfDoc.text(
      "Senior Software Engineer with 8 years of experience building resilient cloud architectures and distributed microservices.",
      54,
      135,
      { maxWidth: 500 },
    );

    pdfDoc.setFont("helvetica", "bold");
    pdfDoc.setFontSize(14);
    pdfDoc.text("EXPERIENCE", 54, 175);

    pdfDoc.setFont("helvetica", "bold");
    pdfDoc.setFontSize(11);
    pdfDoc.text("Staff Engineer — CloudScale Inc", 54, 195);
    pdfDoc.setFont("helvetica", "normal");
    pdfDoc.setFontSize(9);
    pdfDoc.text("2021 - Present", 450, 195);

    pdfDoc.setFontSize(10);
    pdfDoc.text("• Architected a high-throughput event processing pipeline ingesting 2.5B messages daily.", 64, 215);
    pdfDoc.text("• Reduced database latency by 42% through distributed Redis cluster caching tiers.", 64, 230);

    const pdfBuffer = Buffer.from(pdfDoc.output("arraybuffer"));
    const parsed = await extractResumeDocument(pdfBuffer, "simple_resume.pdf");

    assert(parsed.canvasBlocks.length > 0, "Single-column PDF parsed into canvas blocks");
    assert(parsed.cleanedText.includes("Alex Mercer"), "Candidate name correctly extracted");
    assert(parsed.cleanedText.includes("PROFESSIONAL SUMMARY"), "Section headers preserved");
    assert(parsed.cleanedText.includes("2.5B messages"), "Quantitative metrics preserved");
    assert(parsed.diagnostics.columnLayout === "single", "Detected layout is single-column");
    assert(parsed.validation.isValid, "Extraction quality validation passed (> 80 score)");

    // Downstream bias check
    const analysis = analyzeResumeText(parsed.cleanedText);
    assert(analysis.neutrality_score === 100, "Clean technical resume scores 100% neutrality");
  }

  // ============================================================================
  // TEST 2: Professionally Designed Resume with Multiple Fonts (PDF)
  // ============================================================================
  console.log("\n--------------------------------------------------------------------------------");
  console.log(" TEST 2: Professionally Designed Resume with Multiple Fonts");
  console.log("--------------------------------------------------------------------------------");
  {
    const pdfDoc = new jsPDF({ unit: "pt", format: "letter" });
    // Title in Times Bold
    pdfDoc.setFont("times", "bold");
    pdfDoc.setFontSize(24);
    pdfDoc.setTextColor(15, 23, 42);
    pdfDoc.text("Dr. Sophia Vance", 54, 60);

    // Subtitle in Helvetica Oblique
    pdfDoc.setFont("helvetica", "oblique");
    pdfDoc.setFontSize(11);
    pdfDoc.setTextColor(71, 85, 105);
    pdfDoc.text("Principal Machine Learning Researcher | San Francisco, CA", 54, 80);

    // Heading in Courier Bold
    pdfDoc.setFont("courier", "bold");
    pdfDoc.setFontSize(13);
    pdfDoc.setTextColor(30, 58, 138);
    pdfDoc.text("EDUCATION", 54, 120);

    // Degree in Times Normal
    pdfDoc.setFont("times", "normal");
    pdfDoc.setFontSize(10);
    pdfDoc.setTextColor(17, 24, 39);
    pdfDoc.text("Ph.D. in Computer Science — Stanford University, 2019", 54, 140);
    pdfDoc.text("B.S. in Electrical Engineering & Math — MIT, 2014", 54, 155);

    const pdfBuffer = Buffer.from(pdfDoc.output("arraybuffer"));
    const parsed = await extractResumeDocument(pdfBuffer, "multifont_resume.pdf");

    assert(parsed.cleanedText.includes("Dr. Sophia Vance"), "Extracted name across font shifts");
    assert(parsed.cleanedText.includes("Stanford University"), "Extracted academic institution");
    assert(parsed.canvasBlocks.some((b) => b.bold), "Bold font attribute preserved in canvas blocks");
    assert(parsed.validation.qualityScore >= 80, "Validation passes with multiple fonts");
  }

  // ============================================================================
  // TEST 3: Two-Column Resume (NO Column Interleaving!)
  // ============================================================================
  console.log("\n--------------------------------------------------------------------------------");
  console.log(" TEST 3: Two-Column Resume (No Column Interleaving)");
  console.log("--------------------------------------------------------------------------------");
  {
    const pdfDoc = new jsPDF({ unit: "pt", format: "letter" });
    const width = 612;

    // Header across top
    pdfDoc.setFont("helvetica", "bold");
    pdfDoc.setFontSize(22);
    pdfDoc.text("Marcus Sterling", 54, 55);
    pdfDoc.setFont("helvetica", "normal");
    pdfDoc.setFontSize(9);
    pdfDoc.text("marcus@example.com | github.com/msterling", 54, 72);

    // Left Column: X from 54 to 210 (Sidebar: 32% width)
    pdfDoc.setFont("helvetica", "bold");
    pdfDoc.setFontSize(11);
    pdfDoc.text("SKILLS", 54, 110);
    pdfDoc.setFont("helvetica", "normal");
    pdfDoc.setFontSize(9);
    pdfDoc.text("• TypeScript / Node.js", 54, 130);
    pdfDoc.text("• Python / FastAPI", 54, 145);
    pdfDoc.text("• PostgreSQL / Redis", 54, 160);
    pdfDoc.text("• Docker / Kubernetes", 54, 175);

    pdfDoc.setFont("helvetica", "bold");
    pdfDoc.setFontSize(11);
    pdfDoc.text("LANGUAGES", 54, 210);
    pdfDoc.setFont("helvetica", "normal");
    pdfDoc.setFontSize(9);
    pdfDoc.text("• English (Fluent)", 54, 230);
    pdfDoc.text("• German (Professional)", 54, 245);

    // Right Column: X from 235 to 550 (Main Experience: 68% width)
    pdfDoc.setFont("helvetica", "bold");
    pdfDoc.setFontSize(12);
    pdfDoc.text("WORK EXPERIENCE", 235, 110);

    pdfDoc.setFont("helvetica", "bold");
    pdfDoc.setFontSize(10);
    pdfDoc.text("Lead Backend Architect — FinTech Corp", 235, 130);
    pdfDoc.setFont("helvetica", "normal");
    pdfDoc.setFontSize(9);
    pdfDoc.text("• Directed development of algorithmic trading gateway supporting 50K RPS.", 235, 145, { maxWidth: 310 });
    pdfDoc.text("• Implemented zero-trust authentication reducing security exposure by 95%.", 235, 175, { maxWidth: 310 });

    pdfDoc.setFont("helvetica", "bold");
    pdfDoc.setFontSize(10);
    pdfDoc.text("Senior Software Engineer — TechGiant", 235, 215);
    pdfDoc.setFont("helvetica", "normal");
    pdfDoc.setFontSize(9);
    pdfDoc.text("• Scaled multi-tenant SaaS application across 4 AWS geographic regions.", 235, 230, { maxWidth: 310 });

    const pdfBuffer = Buffer.from(pdfDoc.output("arraybuffer"));
    const parsed = await extractResumeDocument(pdfBuffer, "two_column_resume.pdf");

    assert(parsed.cleanedText.includes("Marcus Sterling"), "Candidate name extracted");
    assert(parsed.diagnostics.columnLayout.includes("two-column"), "Detected two-column layout");

    // Critical test: Ensure column items are NOT interleaved!
    // Left column items ("TypeScript", "Docker", "German") should be grouped together,
    // and right column items ("Directed development", "FinTech Corp") should be grouped together.
    const leftIndex = parsed.cleanedText.indexOf("Docker / Kubernetes");
    const rightIndex = parsed.cleanedText.indexOf("algorithmic trading gateway");

    assert(leftIndex !== -1 && rightIndex !== -1, "Both left and right column texts extracted");

    // Check that we didn't slice "TypeScript / Node.js Directed development of algorithmic" together on one line
    assert(
      !parsed.cleanedText.includes("TypeScript / Node.js Directed development"),
      "Left and right columns are NOT mashed onto the same line",
    );
    assert(
      !parsed.cleanedText.includes("German (Professional) Scaled multi-tenant"),
      "Sidebar and main column are cleanly separated",
    );
  }

  // ============================================================================
  // TEST 4: Resume Containing Horizontal and Vertical Lines (PDF)
  // ============================================================================
  console.log("\n--------------------------------------------------------------------------------");
  console.log(" TEST 4: Resume with Horizontal and Vertical Lines");
  console.log("--------------------------------------------------------------------------------");
  {
    const pdfDoc = new jsPDF({ unit: "pt", format: "letter" });
    pdfDoc.text("David Kim", 54, 50);

    // Draw horizontal separator lines using vector graphics
    pdfDoc.setLineWidth(1.5);
    pdfDoc.setDrawColor(200, 200, 200);
    pdfDoc.line(54, 60, 550, 60);

    pdfDoc.text("EXPERIENCE", 54, 85);
    pdfDoc.line(54, 92, 550, 92);

    pdfDoc.text("• Built analytics dashboard with React and Recharts.", 54, 110);

    // Add string-based divider line (common in plain-text or LaTeX exports)
    pdfDoc.text("--------------------------------------------------------------------------------", 54, 130);
    pdfDoc.text("EDUCATION", 54, 150);
    pdfDoc.text("B.S. in Computer Science — UC Berkeley", 54, 170);

    const pdfBuffer = Buffer.from(pdfDoc.output("arraybuffer"));
    const parsed = await extractResumeDocument(pdfBuffer, "lined_resume.pdf");

    assert(parsed.cleanedText.includes("David Kim"), "Name extracted cleanly");
    assert(parsed.cleanedText.includes("Built analytics dashboard"), "Bullet extracted cleanly");
    assert(!parsed.cleanedText.includes("----------------"), "String divider artifact removed from text");
    assert(parsed.validation.issues.filter((i) => i.code === "REPEATED_SYMBOLS").length === 0, "No repeated symbols error");
  }

  // ============================================================================
  // TEST 5: Resume Containing Tables and Text Boxes (DOCX)
  // ============================================================================
  console.log("\n--------------------------------------------------------------------------------");
  console.log(" TEST 5: Resume with Tables and Text Boxes (DOCX)");
  console.log("--------------------------------------------------------------------------------");
  {
    const zip = new JSZip();

    // Create a realistic Word document.xml with:
    // 1. Header with contact info
    // 2. A Text Box (<w:txbxContent>) containing candidate sidebar skills
    // 3. A Table (<w:tbl>) containing experience data
    const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p>
      <w:r><w:t>Elena Rostova</w:t></w:r>
    </w:p>
    <w:p>
      <w:r><w:t>elena.rostova@example.com | (555) 321-9876 | Chicago, IL</w:t></w:r>
    </w:p>
    <!-- Text Box with skills (commonly dropped by simple parsers!) -->
    <w:txbxContent>
      <w:p>
        <w:r><w:t>SIDEBAR SKILLS</w:t></w:r>
      </w:p>
      <w:p>
        <w:numPr><w:ilvl w:val="0"/></w:numPr>
        <w:r><w:t>Kubernetes &amp; Terraform</w:t></w:r>
      </w:p>
      <w:p>
        <w:numPr><w:ilvl w:val="0"/></w:numPr>
        <w:r><w:t>Golang Microservices</w:t></w:r>
      </w:p>
    </w:txbxContent>
    <!-- Table containing Work Experience -->
    <w:tbl>
      <w:tr>
        <w:tc>
          <w:p><w:r><w:t>Staff DevOps Engineer</w:t></w:r></w:p>
        </w:tc>
        <w:tc>
          <w:p><w:r><w:t>Acme Cloud Corp</w:t></w:r></w:p>
        </w:tc>
        <w:tc>
          <w:p><w:r><w:t>2020 - Present</w:t></w:r></w:p>
        </w:tc>
      </w:tr>
      <w:tr>
        <w:tc>
          <w:p><w:r><w:t>• Automated CI/CD pipeline cutting deployment times from 45m to 4m.</w:t></w:r></w:p>
        </w:tc>
      </w:tr>
    </w:tbl>
  </w:body>
</w:document>`;

    zip.file("word/document.xml", documentXml);
    const docxBuffer = await zip.generateAsync({ type: "nodebuffer" });

    const parsed = await extractResumeDocument(docxBuffer, "table_textbox_resume.docx");

    assert(parsed.cleanedText.includes("Elena Rostova"), "DOCX candidate name extracted");
    assert(parsed.cleanedText.includes("SIDEBAR SKILLS"), "DOCX Text Box title extracted");
    assert(parsed.cleanedText.includes("Kubernetes & Terraform"), "DOCX Text Box bullet extracted (with XML entity decoded)");
    assert(parsed.cleanedText.includes("Acme Cloud Corp"), "DOCX Table cells extracted");
    assert(parsed.cleanedText.includes("45m to 4m"), "DOCX Table bullet extracted");
    assert(parsed.diagnostics.method === "docx-xml-structured", "Extraction method is docx-xml-structured");
  }

  // ============================================================================
  // TEST 6: Resume with Icons and Contact Information (PDF)
  // ============================================================================
  console.log("\n--------------------------------------------------------------------------------");
  console.log(" TEST 6: Resume with Icons and Contact Information");
  console.log("--------------------------------------------------------------------------------");
  {
    const pdfDoc = new jsPDF({ unit: "pt", format: "letter" });
    pdfDoc.setFontSize(20);
    pdfDoc.text("Jordan Lee", 54, 50);

    // Contact line with email, phone, and LinkedIn URL (standard 9.5pt font)
    pdfDoc.setFontSize(9.5);
    const contactLine = "Email: jordan.lee@gmail.com | Phone: (415) 555-0199 | LinkedIn: linkedin.com/in/jordanlee";
    pdfDoc.text(contactLine, 54, 70);

    pdfDoc.setFontSize(12);
    pdfDoc.text("SUMMARY", 54, 100);
    pdfDoc.setFontSize(10);
    pdfDoc.text("Fullstack developer passionate about accessible and intuitive web interfaces.", 54, 120);

    const pdfBuffer = Buffer.from(pdfDoc.output("arraybuffer"));
    const parsed = await extractResumeDocument(pdfBuffer, "icons_contact_resume.pdf");

    assert(parsed.cleanedText.includes("Jordan Lee"), "Candidate name extracted");
    assert(parsed.cleanedText.includes("jordan.lee@gmail.com"), "Email extracted cleanly without corruption");
    assert(parsed.cleanedText.includes("linkedin.com/in/jordanlee"), "LinkedIn URL extracted");
    assert(parsed.validation.isValid, "No critical garbled character errors on icon glyphs");
  }

  // ============================================================================
  // TEST 7: Multi-Page Resume with Repeated Headers and Footers (PDF)
  // ============================================================================
  console.log("\n--------------------------------------------------------------------------------");
  console.log(" TEST 7: Multi-Page Resume with Repeated Headers & Footers");
  console.log("--------------------------------------------------------------------------------");
  {
    const pdfDoc = new jsPDF({ unit: "pt", format: "letter" });

    // Page 1
    pdfDoc.text("Samantha Wright", 54, 50);
    pdfDoc.text("SUMMARY", 54, 80);
    pdfDoc.text("Executive Engineering Leader with 15+ years of software delivery experience.", 54, 100);
    pdfDoc.text("EXPERIENCE", 54, 130);
    pdfDoc.text("VP of Engineering — Global Retail Co | 2019 - Present", 54, 150);
    pdfDoc.text("• Managed engineering organization of 120+ engineers across 6 global offices.", 54, 170);
    pdfDoc.text("Page 1 of 2", 270, 770);

    // Page 2
    pdfDoc.addPage();
    // Repeated Header on Page 2
    pdfDoc.text("Samantha Wright - Resume", 54, 40);
    pdfDoc.text("• Spearheaded modern cloud migration delivering $14M in annual operating savings.", 54, 80);
    pdfDoc.text("EDUCATION", 54, 120);
    pdfDoc.text("M.S. in Computer Science — Carnegie Mellon University", 54, 140);
    pdfDoc.text("Page 2 of 2", 270, 770);

    const pdfBuffer = Buffer.from(pdfDoc.output("arraybuffer"));
    const parsed = await extractResumeDocument(pdfBuffer, "multipage_resume.pdf");

    assert(parsed.diagnostics.pageCount === 2, "Detected 2 pages");
    assert(parsed.cleanedText.includes("Global Retail Co"), "Page 1 content extracted");
    assert(parsed.cleanedText.includes("Carnegie Mellon University"), "Page 2 content extracted");
    // Verify repeated footer was suppressed from clean body text
    assert(!parsed.cleanedText.includes("Page 1 of 2"), "Page 1 footer suppressed");
    assert(!parsed.cleanedText.includes("Page 2 of 2"), "Page 2 footer suppressed");
  }

  // ============================================================================
  // TEST 8: Scanned PDF Resume (OCR Fallback Verification)
  // ============================================================================
  console.log("\n--------------------------------------------------------------------------------");
  console.log(" TEST 8: Scanned PDF Resume (OCR Detection & Fallback)");
  console.log("--------------------------------------------------------------------------------");
  {
    // A PDF with ZERO text items (simulating a scanned raster image)
    const pdfDoc = new jsPDF({ unit: "pt", format: "letter" });
    // Draw only a vector rectangle (no text)
    pdfDoc.rect(20, 20, 500, 700);

    const pdfBuffer = Buffer.from(pdfDoc.output("arraybuffer"));

    // Check shouldTriggerOcrFallback logic
    const willTrigger = shouldTriggerOcrFallback(0, 1);
    assert(willTrigger === true, "OCR detector accurately identifies 0-text scanned document");

    const parsed = await extractResumeDocument(pdfBuffer, "scanned_resume.pdf", { allowOcr: false });
    assert(parsed.validation.requiresFallback === true, "Validation flags that fallback is required");
    assert(
      parsed.validation.fallbackReason?.includes("No readable text") ||
      parsed.validation.fallbackReason?.includes("Scanned image"),
      "Helpful error explanation provided for scanned document",
    );
  }

  // ============================================================================
  // TEST 9: Resume with Embedded Hyperlinks and Bullet Points (PDF)
  // ============================================================================
  console.log("\n--------------------------------------------------------------------------------");
  console.log(" TEST 9: Resume with Hyperlinks and Bullet Points");
  console.log("--------------------------------------------------------------------------------");
  {
    const pdfDoc = new jsPDF({ unit: "pt", format: "letter" });
    pdfDoc.text("Priya Sharma", 54, 50);

    // Hyperlink text
    pdfDoc.textWithLink("portfolio.dev/priya", 54, 70, { url: "https://portfolio.dev/priya" });
    pdfDoc.textWithLink("github.com/priyasharma", 200, 70, { url: "https://github.com/priyasharma" });

    pdfDoc.text("PROJECTS", 54, 100);

    // Various bullet symbols: hyphen, star, wingdings bullet
    pdfDoc.text("- OpenSource Auth Engine: Lightweight OAuth2/OIDC provider in Go.", 54, 120);
    pdfDoc.text("* Distributed Key-Value Store: Raft consensus based storage engine.", 54, 140);
    pdfDoc.text("\u2022 Real-Time Collaboration Canvas: WebSockets and CRDT sync.", 54, 160);

    const pdfBuffer = Buffer.from(pdfDoc.output("arraybuffer"));
    const parsed = await extractResumeDocument(pdfBuffer, "links_bullets_resume.pdf");

    assert(parsed.cleanedText.includes("portfolio.dev/priya"), "Hyperlink URL preserved");
    assert(parsed.cleanedText.includes("github.com/priyasharma"), "GitHub link preserved");

    // Check bullets normalized to standard •
    assert(parsed.cleanedText.includes("• OpenSource Auth Engine"), "Hyphen bullet normalized to • ");
    assert(parsed.cleanedText.includes("• Distributed Key-Value Store"), "Star bullet normalized to • ");
    assert(parsed.cleanedText.includes("• Real-Time Collaboration Canvas"), "Unicode bullet normalized to • ");
  }

  // ============================================================================
  // TEST 10: Complex Formatting & Ordinary Text Hybrid (End-to-End Bias Detection)
  // ============================================================================
  console.log("\n--------------------------------------------------------------------------------");
  console.log(" TEST 10: Complex Formatting Hybrid + Downstream Bias Pipeline");
  console.log("--------------------------------------------------------------------------------");
  {
    const zip = new JSZip();

    // Create a rich hybrid DOCX with multiple sections, sidebars, and mixed content
    const hybridDocXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p><w:r><w:t>Morgan Tyler</w:t></w:r></w:p>
    <w:p><w:r><w:t>morgan.tyler@example.com | 555-888-2345</w:t></w:r></w:p>
    <w:p><w:r><w:t>PROFESSIONAL SUMMARY</w:t></w:r></w:p>
    <w:p><w:r><w:t>Seasoned digital native and rockstar developer who brings energetic youth to high-pressure sprints.</w:t></w:r></w:p>
    <w:p><w:r><w:t>EXPERIENCE</w:t></w:r></w:p>
    <w:tbl>
      <w:tr>
        <w:tc><w:p><w:r><w:t>Senior Architect — Enterprise Systems</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>2022 - Present</w:t></w:r></w:p></w:tc>
      </w:tr>
      <w:tr>
        <w:tc><w:p><w:r><w:t>• Architected resilient fault-tolerant payment gateway processing $1.2B annually.</w:t></w:r></w:p></w:tc>
      </w:tr>
    </w:tbl>
  </w:body>
</w:document>`;

    zip.file("word/document.xml", hybridDocXml);
    const docxBuffer = await zip.generateAsync({ type: "nodebuffer" });

    const parsed = await extractResumeDocument(docxBuffer, "complex_hybrid_resume.docx");

    assert(parsed.cleanedText.includes("Morgan Tyler"), "Candidate name extracted");
    assert(parsed.cleanedText.includes("digital native"), "Extracted sensitive summary phrase");
    assert(parsed.cleanedText.includes("$1.2B annually"), "Extracted metric from table");

    // Run downstream BiasLens analysis on the extracted text!
    const analysis = analyzeResumeText(parsed.cleanedText);
    const fairness = runCounterfactualFairnessAudit(parsed.cleanedText, analysis.spans);

    assert(analysis.spans.length > 0, "Downstream bias detector flags age proxy jargon ('digital native')");
    assert(analysis.neutrality_score < 100, "Neutrality score reflects detected bias signals");
    assert(fairness.disparate_impact_ratio !== undefined, "Counterfactual fairness audit completed successfully");
  }

  // ============================================================================
  // TEST 11: Complex Resume with Right-Aligned Dates beside Job & Education (PDF)
  // ============================================================================
  console.log("\n--------------------------------------------------------------------------------");
  console.log(" TEST 11: Right-Aligned Dates Beside Job & Education Entries (PDF)");
  console.log("--------------------------------------------------------------------------------");
  {
    const pdfDoc = new jsPDF({ unit: "pt", format: "letter" });
    const width = 612;

    // Candidate Header
    pdfDoc.setFont("helvetica", "bold");
    pdfDoc.setFontSize(20);
    pdfDoc.text("Samantha Vance", 54, 55);
    pdfDoc.setFont("helvetica", "normal");
    pdfDoc.setFontSize(9);
    pdfDoc.text("samantha.vance@example.com | (555) 234-5678 | San Francisco, CA", 54, 72);

    // Section 1: Work Experience
    pdfDoc.setFont("helvetica", "bold");
    pdfDoc.setFontSize(12);
    pdfDoc.text("WORK EXPERIENCE", 54, 105);

    // Entry 1: Job title on left, right-aligned date on right (SAME baseline Y=125)
    pdfDoc.setFont("helvetica", "bold");
    pdfDoc.setFontSize(10.5);
    pdfDoc.text("Software Developer | ABC Technologies", 54, 125);
    pdfDoc.setFont("helvetica", "normal");
    pdfDoc.setFontSize(9.5);
    pdfDoc.text("Jan 2024 – Dec 2025", 450, 125);

    // Entry 1 Bullets
    pdfDoc.text("• Developed web applications using React and distributed services.", 54, 142);
    pdfDoc.text("• Worked with APIs and high-throughput PostgreSQL databases.", 54, 158);

    // Entry 2: Second job title on left, right-aligned date on right (SAME baseline Y=185)
    pdfDoc.setFont("helvetica", "bold");
    pdfDoc.setFontSize(10.5);
    pdfDoc.text("Fullstack Engineer — Tech Solutions", 54, 185);
    pdfDoc.setFont("helvetica", "normal");
    pdfDoc.setFontSize(9.5);
    pdfDoc.text("Aug 2022 – Dec 2023", 450, 185);

    // Entry 2 Bullets
    pdfDoc.text("• Architected microservices with 99.99% availability.", 54, 202);

    // Section 2: Education
    pdfDoc.setFont("helvetica", "bold");
    pdfDoc.setFontSize(12);
    pdfDoc.text("EDUCATION", 54, 235);

    // Education Entry: Degree on left, graduation date on right (SAME baseline Y=255)
    pdfDoc.setFont("helvetica", "bold");
    pdfDoc.setFontSize(10.5);
    pdfDoc.text("B.Tech in Computer Science", 54, 255);
    pdfDoc.setFont("helvetica", "normal");
    pdfDoc.setFontSize(9.5);
    pdfDoc.text("2022 – 2026", 450, 255);

    pdfDoc.text("University Institute of Technology", 54, 272);

    // Section 3: Technical Skills
    pdfDoc.setFont("helvetica", "bold");
    pdfDoc.setFontSize(12);
    pdfDoc.text("TECHNICAL SKILLS", 54, 305);
    pdfDoc.setFont("helvetica", "normal");
    pdfDoc.setFontSize(9.5);
    pdfDoc.text("• Languages: TypeScript, JavaScript, Python, Go, SQL", 54, 325);
    pdfDoc.text("• Infrastructure: Docker, Kubernetes, AWS, Terraform", 54, 342);

    const pdfBuffer = Buffer.from(pdfDoc.output("arraybuffer"));
    const parsed = await extractResumeDocument(pdfBuffer, "right_aligned_dates_resume.pdf");

    // Layout check: must be recognized as single-column (dates must NOT trigger fake 2-column gutter!)
    assert(parsed.diagnostics.columnLayout === "single", "Layout detected as single-column despite right-aligned dates");

    // Association check: date preserved beside job entry
    assert(
      parsed.cleanedText.includes("Software Developer | ABC Technologies") &&
        /Jan 2024\s*[-–]\s*Dec 2025/.test(parsed.cleanedText),
      "Right-aligned employment date preserved directly beside job title",
    );

    // Association check: graduation date preserved beside education entry
    assert(
      parsed.cleanedText.includes("B.Tech in Computer Science") &&
        /2022\s*[-–]\s*2026/.test(parsed.cleanedText),
      "Right-aligned graduation date preserved directly beside education entry",
    );

    // Reading order check: Job title -> Bullets -> Education
    const idxJob = parsed.cleanedText.indexOf("Software Developer");
    const idxBullet = parsed.cleanedText.indexOf("Developed web applications");
    const idxEdu = parsed.cleanedText.indexOf("B.Tech in Computer Science");
    assert(idxJob < idxBullet && idxBullet < idxEdu, "Natural reading order preserved: Job -> Bullets -> Education");

    // Crucial check: Dates are NOT dumped at the end of the imported document!
    const last120Chars = parsed.cleanedText.slice(-120);
    assert(!last120Chars.includes("Jan 2024") && !last120Chars.includes("2026"), "Dates are NOT appended to document end");
  }

  // ============================================================================
  // TEST 12: DOCX Resume with Multi-Entry Tables for Title & Date
  // ============================================================================
  console.log("\n--------------------------------------------------------------------------------");
  console.log(" TEST 12: DOCX Table Row-by-Row Entry & Date Association");
  console.log("--------------------------------------------------------------------------------");
  {
    const zip = new JSZip();

    const docXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p><w:r><w:t>Arthur Pendelton</w:t></w:r></w:p>
    <w:p><w:r><w:t>arthur@example.com | 555-111-2233 | Austin, TX</w:t></w:r></w:p>
    <w:p><w:r><w:t>WORK EXPERIENCE</w:t></w:r></w:p>
    <w:tbl>
      <w:tr>
        <w:tc><w:p><w:r><w:t>Senior Cloud Architect</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>Acme Cloud Services</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>Jan 2024 – Present</w:t></w:r></w:p></w:tc>
      </w:tr>
      <w:tr>
        <w:tc><w:p><w:r><w:t>• Engineered distributed streaming pipeline processing 100M events/day.</w:t></w:r></w:p></w:tc>
      </w:tr>
    </w:tbl>
    <w:p><w:r><w:t>EDUCATION</w:t></w:r></w:p>
    <w:tbl>
      <w:tr>
        <w:tc><w:p><w:r><w:t>B.S. in Computer Engineering</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>University of Texas at Austin</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>2018 – 2022</w:t></w:r></w:p></w:tc>
      </w:tr>
    </w:tbl>
  </w:body>
</w:document>`;

    zip.file("word/document.xml", docXml);
    const docxBuffer = await zip.generateAsync({ type: "nodebuffer" });

    const parsed = await extractResumeDocument(docxBuffer, "table_entries.docx");

    assert(parsed.cleanedText.includes("Arthur Pendelton"), "DOCX candidate name extracted");
    assert(
      parsed.cleanedText.includes("Senior Cloud Architect  |  Acme Cloud Services") &&
        parsed.cleanedText.includes("Jan 2024"),
      "DOCX row-by-row table preserves Title | Company | Date",
    );
    assert(
      parsed.cleanedText.includes("B.S. in Computer Engineering  |  University of Texas at Austin") &&
        /2018\s*[-–]\s*2022/.test(parsed.cleanedText),
      "DOCX row-by-row table preserves Degree | University | Date",
    );
    assert(parsed.cleanedText.includes("Engineered distributed streaming"), "DOCX table bullet extracted");

    // Verify dates are not at the end
    const last100 = parsed.cleanedText.slice(-100);
    assert(!last100.includes("Jan 2024"), "DOCX table date not appended to document end");
  }

  // ============================================================================
  // TEST 13: Resume with Wrapped Dates on Line Below Entry
  // ============================================================================
  console.log("\n--------------------------------------------------------------------------------");
  console.log(" TEST 13: Wrapped Dates Directly Below Entry Title");
  console.log("--------------------------------------------------------------------------------");
  {
    const pdfDoc = new jsPDF({ unit: "pt", format: "letter" });

    pdfDoc.setFont("helvetica", "bold");
    pdfDoc.setFontSize(20);
    pdfDoc.text("Lucas Wright", 54, 55);
    pdfDoc.setFont("helvetica", "normal");
    pdfDoc.setFontSize(9);
    pdfDoc.text("lucas.wright@example.com", 54, 72);

    pdfDoc.setFont("helvetica", "bold");
    pdfDoc.setFontSize(12);
    pdfDoc.text("EXPERIENCE", 54, 105);

    // Line 1: Job title
    pdfDoc.setFont("helvetica", "bold");
    pdfDoc.setFontSize(10.5);
    pdfDoc.text("Principal Software Engineer — Vertex AI", 54, 125);

    // Line 2: Wrapped date directly below (gap = 13pt)
    pdfDoc.setFont("helvetica", "normal");
    pdfDoc.setFontSize(9);
    pdfDoc.text("March 2021 – Present", 54, 138);

    // Line 3: Bullet point
    pdfDoc.text("• Led team of 14 machine learning engineers developing core inference engine.", 54, 156);

    const pdfBuffer = Buffer.from(pdfDoc.output("arraybuffer"));
    const parsed = await extractResumeDocument(pdfBuffer, "wrapped_dates.pdf");

    assert(parsed.cleanedText.includes("Principal Software Engineer"), "Job title extracted");
    assert(/March 2021\s*[-–]\s*Present/.test(parsed.cleanedText), "Wrapped date extracted");

    const idxTitle = parsed.cleanedText.indexOf("Principal Software Engineer");
    const idxBullet = parsed.cleanedText.indexOf("Led team of 14");

    assert(idxTitle < idxBullet, "Title and date precede bullet point (not moved to bottom!)");
    assert(
      parsed.cleanedText.includes("Principal Software Engineer — Vertex AI | March 2021") ||
        parsed.cleanedText.includes("Principal Software Engineer — Vertex AI  |  March 2021"),
      "Wrapped date merged directly with entry header",
    );
  }

  // ============================================================================
  // TEST 14: Complex LaTeX Format Resume (Southwestern University / Jake's Resume)
  // ============================================================================
  console.log("\n--------------------------------------------------------------------------------");
  console.log(" TEST 14: Complex LaTeX Format Resume (Southwestern University)");
  console.log("--------------------------------------------------------------------------------");
  {
    const pdfDoc = new jsPDF({ unit: "pt", format: "letter" });

    // Header
    pdfDoc.setFont("helvetica", "bold");
    pdfDoc.setFontSize(20);
    pdfDoc.text("Jake Ryan", 54, 50);

    pdfDoc.setFont("helvetica", "normal");
    pdfDoc.setFontSize(9);
    pdfDoc.text("123-456-7890 | jake@example.com | linkedin.com/in/jake | github.com/jake", 54, 65);

    // Section 1: Education with horizontal rule
    pdfDoc.setFont("helvetica", "bold");
    pdfDoc.setFontSize(12);
    pdfDoc.text("EDUCATION", 54, 95);
    pdfDoc.setLineWidth(0.75);
    pdfDoc.line(54, 99, 558, 99);

    // Line 1: Southwestern University (left) ... Georgetown, TX (right)
    pdfDoc.setFont("helvetica", "bold");
    pdfDoc.setFontSize(10.5);
    pdfDoc.text("Southwestern University", 54, 115);
    pdfDoc.setFont("helvetica", "normal");
    pdfDoc.setFontSize(9.5);
    pdfDoc.text("Georgetown, TX", 470, 115);

    // Line 2: Bachelor of Arts in Computer Science, Minor in Business (left) ... Aug. 2018 – May 2021 (right)
    pdfDoc.setFont("helvetica", "normal");
    pdfDoc.setFontSize(10);
    pdfDoc.text("Bachelor of Arts in Computer Science, Minor in Business", 54, 130);
    pdfDoc.setFontSize(9.5);
    pdfDoc.text("Aug. 2018 – May 2021", 445, 130);

    // Line 3: Blinn College (left) ... Bryan, TX (right)
    pdfDoc.setFont("helvetica", "bold");
    pdfDoc.setFontSize(10.5);
    pdfDoc.text("Blinn College", 54, 150);
    pdfDoc.setFont("helvetica", "normal");
    pdfDoc.setFontSize(9.5);
    pdfDoc.text("Bryan, TX", 500, 150);

    // Line 4: Associate's in Liberal Arts (left) ... Aug. 2014 – May 2018 (right)
    pdfDoc.setFont("helvetica", "normal");
    pdfDoc.setFontSize(10);
    pdfDoc.text("Associate's in Liberal Arts", 54, 165);
    pdfDoc.setFontSize(9.5);
    pdfDoc.text("Aug. 2014 – May 2018", 445, 165);

    // Section 2: Experience with horizontal rule
    pdfDoc.setFont("helvetica", "bold");
    pdfDoc.setFontSize(12);
    pdfDoc.text("EXPERIENCE", 54, 195);
    pdfDoc.line(54, 199, 558, 199);

    // Line 5: Undergraduate Research Assistant (left)
    pdfDoc.setFont("helvetica", "bold");
    pdfDoc.setFontSize(10.5);
    pdfDoc.text("Undergraduate Research Assistant", 54, 215);

    // Line 6: Texas A&M University (left) ... June 2020 – Present College Station, TX (right)
    pdfDoc.setFont("helvetica", "normal");
    pdfDoc.setFontSize(10);
    pdfDoc.text("Texas A&M University", 54, 230);
    pdfDoc.setFontSize(9.5);
    pdfDoc.text("June 2020 – Present College Station, TX", 370, 230);

    // Bullets
    pdfDoc.setFontSize(9.5);
    pdfDoc.text("• Developed a REST API using FastAPI and PostgreSQL to process telemetry logs.", 64, 248);
    pdfDoc.text("• Developed a full-stack web application using Flask, React, PostgreSQL, and Docker.", 64, 263);

    const pdfBuffer = Buffer.from(pdfDoc.output("arraybuffer"));
    const parsed = await extractResumeDocument(pdfBuffer, "southwestern_resume.pdf");

    assert(parsed.diagnostics.columnLayout === "single", "Layout correctly classified as single-column");
    assert(parsed.cleanedText.includes("Southwestern University"), "Extracted Southwestern University");
    assert(parsed.cleanedText.includes("Georgetown, TX"), "Extracted Georgetown, TX");
    assert(
      /Southwestern University\s*\|\s*Georgetown,\s*TX/.test(parsed.cleanedText),
      "Georgetown, TX paired beside Southwestern University",
    );
    assert(
      /Bachelor of Arts in Computer Science.*\|\s*Aug\.\s*2018\s*[-–]\s*May\s*2021/.test(
        parsed.cleanedText,
      ),
      "Aug. 2018 – May 2021 paired beside Bachelor degree entry",
    );
    assert(
      /Blinn College\s*\|\s*Bryan,\s*TX/.test(parsed.cleanedText),
      "Bryan, TX paired beside Blinn College",
    );
    assert(
      /Associate's in Liberal Arts\s*\|\s*Aug\.\s*2014\s*[-–]\s*May\s*2018/.test(parsed.cleanedText),
      "Aug. 2014 – May 2018 paired beside Associate's degree entry",
    );
    assert(
      /Texas A&M University\s*\|\s*June 2020\s*[-–]\s*Present\s*College Station,\s*TX/.test(
        parsed.cleanedText,
      ),
      "June 2020 – Present College Station, TX paired beside Texas A&M University",
    );

    // Verify organizations and degrees are NOT clumped into a single line
    assert(
      !parsed.cleanedText.includes(
        "Southwestern University Bachelor of Arts in Computer Science",
      ),
      "Southwestern University and Bachelor degree are NOT clumped into single continuous line",
    );
    assert(
      !parsed.cleanedText.includes(
        "Undergraduate Research Assistant Texas A&M University",
      ),
      "Undergraduate Research Assistant and Texas A&M are NOT clumped into single continuous line",
    );

    // Verify zero dates or locations appear at the end of the text
    const lines = parsed.cleanedText.split("\n").map((l) => l.trim()).filter(Boolean);
    const last3Lines = lines.slice(-3).join(" ");
    assert(
      !/^(?:Georgetown,\s*TX|Bryan,\s*TX|Aug\.\s*2014|Aug\.\s*2018|June\s*2020)/.test(
        last3Lines,
      ),
      "Zero dates or locations appear disconnected at document end",
    );

    // Downstream bias analysis verification
    const biasResult = analyzeResumeText(parsed.cleanedText);
    assert(
      biasResult.neutrality_score === 100,
      "Neutral Southwestern resume receives 100% neutrality score",
      `Score was ${biasResult.neutrality_score}`,
    );
    assert(
      biasResult.spans.length === 0,
      "Downstream bias detector flags 0 spans (neutral dates not flagged as age bias!)",
      `Flagged spans: ${JSON.stringify(biasResult.spans.map((s) => s.matched_text))}`,
    );
  }

  // ============================================================================
  // SUMMARY
  // ============================================================================
  console.log("\n================================================================================");
  console.log(` Test Execution Completed: ${passedTests}/${totalTests} Passed (${failedTests} Failed)`);
  console.log("================================================================================");

  if (failedTests > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error("Test execution threw unhandled exception:", err);
  process.exit(1);
});
