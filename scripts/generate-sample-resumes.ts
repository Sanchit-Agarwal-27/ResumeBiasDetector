/**
 * @file generate-sample-resumes.ts
 * Generates sample complex resumes in a local 'sample-resumes/' directory
 * so developers and users can easily drag and drop them into the BiasLens web UI.
 */

import fs from "fs";
import path from "path";
import { jsPDF } from "jspdf";
import JSZip from "jszip";

const OUTPUT_DIR = path.resolve("./sample-resumes");
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

console.log("Generating sample complex test resumes in:", OUTPUT_DIR);

// 1. Two-Column Modern Sidebar Resume (PDF)
{
  const pdf = new jsPDF({ unit: "pt", format: "letter" });
  
  // Header across top
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(22);
  pdf.setTextColor(15, 23, 42);
  pdf.text("Marcus Sterling", 54, 55);

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9.5);
  pdf.setTextColor(71, 85, 105);
  pdf.text("marcus.sterling@example.com | (555) 234-5678 | San Francisco, CA | github.com/msterling", 54, 72);

  // Left Column Sidebar (X: 54 to 200, ~30% width)
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(11);
  pdf.setTextColor(30, 58, 138);
  pdf.text("CORE SKILLS", 54, 110);

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.setTextColor(17, 24, 39);
  pdf.text("• TypeScript / Node.js", 54, 128);
  pdf.text("• Python / FastAPI", 54, 144);
  pdf.text("• React / Vite / Tailwind", 54, 160);
  pdf.text("• PostgreSQL / Redis", 54, 176);
  pdf.text("• Docker / Kubernetes / AWS", 54, 192);

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(11);
  pdf.setTextColor(30, 58, 138);
  pdf.text("EDUCATION", 54, 230);

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(9.5);
  pdf.setTextColor(15, 23, 42);
  pdf.text("B.S. in Computer Science", 54, 248);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.text("University of Michigan, 2018", 54, 262);

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(11);
  pdf.setTextColor(30, 58, 138);
  pdf.text("LANGUAGES", 54, 298);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.text("• English (Native)", 54, 314);
  pdf.text("• Spanish (Fluent)", 54, 328);

  // Right Column Main Content (X: 230 to 550, ~70% width)
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(12);
  pdf.setTextColor(30, 58, 138);
  pdf.text("PROFESSIONAL EXPERIENCE", 230, 110);

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(10);
  pdf.setTextColor(15, 23, 42);
  pdf.text("Lead Backend Architect — CloudFin Systems", 230, 130);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8.5);
  pdf.setTextColor(100, 116, 139);
  pdf.text("2021 - Present", 480, 130);

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.setTextColor(17, 24, 39);
  pdf.text("• Architected high-throughput transaction routing gateway supporting 45,000 requests/sec.", 230, 146, { maxWidth: 320 });
  pdf.text("• Reduced database query latency by 55% via multi-tier caching and distributed Redis cluster.", 230, 174, { maxWidth: 320 });
  pdf.text("• Mentored junior engineers across four product teams, running weekly architecture reviews.", 230, 202, { maxWidth: 320 });

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(10);
  pdf.setTextColor(15, 23, 42);
  pdf.text("Senior Software Engineer — TechSphere Solutions", 230, 240);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8.5);
  pdf.setTextColor(100, 116, 139);
  pdf.text("2018 - 2021", 480, 240);

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.setTextColor(17, 24, 39);
  pdf.text("• Developed event-driven microservices processing over $850M in annual customer invoices.", 230, 256, { maxWidth: 320 });
  pdf.text("• Optimized CI/CD deployment pipelines, cutting build verification times from 35m to 4m.", 230, 284, { maxWidth: 320 });

  const filePath = path.join(OUTPUT_DIR, "1_Two_Column_Modern_Sidebar.pdf");
  fs.writeFileSync(filePath, Buffer.from(pdf.output("arraybuffer")));
  console.log("  ✓ Created:", filePath);
}

// 2. Complex Tables & Text Boxes Resume (DOCX)
(async () => {
  const zip = new JSZip();
  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p><w:r><w:t>Elena Rostova</w:t></w:r></w:p>
    <w:p><w:r><w:t>elena.rostova@example.com | (555) 321-9876 | Chicago, IL | linkedin.com/in/erostova</w:t></w:r></w:p>
    
    <!-- Text Box Sidebar (Normally dropped by basic extractors!) -->
    <w:txbxContent>
      <w:p><w:r><w:t>AREAS OF EXPERTISE</w:t></w:r></w:p>
      <w:p><w:numPr><w:ilvl w:val="0"/></w:numPr><w:r><w:t>Cloud Infrastructure &amp; Terraform</w:t></w:r></w:p>
      <w:p><w:numPr><w:ilvl w:val="0"/></w:numPr><w:r><w:t>Kubernetes Cluster Orchestration</w:t></w:r></w:p>
      <w:p><w:numPr><w:ilvl w:val="0"/></w:numPr><w:r><w:t>Distributed Telemetry &amp; Prometheus</w:t></w:r></w:p>
    </w:txbxContent>
    
    <w:p><w:r><w:t>PROFESSIONAL SUMMARY</w:t></w:r></w:p>
    <w:p><w:r><w:t>Staff Site Reliability Engineer with 9 years of experience engineering zero-downtime distributed platforms and automating multi-region cloud resilience.</w:t></w:r></w:p>
    
    <w:p><w:r><w:t>EXPERIENCE</w:t></w:r></w:p>
    <!-- Multi-Column Layout Table -->
    <w:tbl>
      <w:tr>
        <w:tc><w:p><w:r><w:t>Staff SRE Lead — Apex Cloud Global</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>2021 - Present</w:t></w:r></w:p></w:tc>
      </w:tr>
      <w:tr>
        <w:tc><w:p><w:r><w:t>• Engineered automated multi-region failover handling 99.999% availability SLAs.</w:t></w:r></w:p></w:tc>
      </w:tr>
      <w:tr>
        <w:tc><w:p><w:r><w:t>• Reduced cloud operating expenditure by $2.4M annually through dynamic autoscaling.</w:t></w:r></w:p></w:tc>
      </w:tr>
    </w:tbl>
  </w:body>
</w:document>`;

  zip.file("word/document.xml", documentXml);
  const buf = await zip.generateAsync({ type: "nodebuffer" });
  const filePath = path.join(OUTPUT_DIR, "2_Tables_And_TextBoxes.docx");
  fs.writeFileSync(filePath, buf);
  console.log("  ✓ Created:", filePath);
})();

// 3. Multi-Page Executive Resume with Repeated Headers & Footers (PDF)
{
  const pdf = new jsPDF({ unit: "pt", format: "letter" });
  
  // Page 1
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(22);
  pdf.text("Dr. Jonathan Hayes", 54, 55);

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9.5);
  pdf.text("jonathan.hayes@example.com | (212) 555-0144 | New York, NY", 54, 75);

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(12);
  pdf.text("EXECUTIVE SUMMARY", 54, 110);

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(10);
  pdf.text("Technology executive with 15+ years scaling enterprise engineering organizations and managing multi-million dollar technology budgets.", 54, 130, { maxWidth: 500 });

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(12);
  pdf.text("EXECUTIVE EXPERIENCE", 54, 175);

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(10.5);
  pdf.text("Chief Technology Officer — Horizon Health Systems", 54, 195);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.text("2020 - Present", 460, 195);
  pdf.text("• Led organization of 240 engineers, data scientists, and product managers.", 54, 215);
  pdf.text("• Delivered HIPAA-compliant electronic health records platform serving 4.5M patients.", 54, 230);

  // Page 1 footer
  pdf.setFontSize(8.5);
  pdf.setTextColor(148, 163, 184);
  pdf.text("Page 1 of 2", 280, 765);

  // Page 2
  pdf.addPage();
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(9);
  pdf.setTextColor(148, 163, 184);
  pdf.text("Dr. Jonathan Hayes — Curriculum Vitae", 54, 45); // Repeated header

  pdf.setTextColor(15, 23, 42);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(12);
  pdf.text("EDUCATION & CREDENTIALS", 54, 90);

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(10);
  pdf.text("Ph.D. in Computer Science — Columbia University, 2012", 54, 110);
  pdf.text("B.S. in Computer Engineering — Cornell University, 2007", 54, 128);

  pdf.setFontSize(8.5);
  pdf.setTextColor(148, 163, 184);
  pdf.text("Page 2 of 2", 280, 765);

  const filePath = path.join(OUTPUT_DIR, "3_MultiPage_Executive_Resume.pdf");
  fs.writeFileSync(filePath, Buffer.from(pdf.output("arraybuffer")));
  console.log("  ✓ Created:", filePath);
}
