import { jsPDF } from "jspdf";
import fs from "fs";

const pdfDoc = new jsPDF({ unit: "pt", format: "letter" });

// Header
pdfDoc.setFont("helvetica", "bold");
pdfDoc.setFontSize(20);
pdfDoc.text("Jake Ryan", 54, 50);

pdfDoc.setFont("helvetica", "normal");
pdfDoc.setFontSize(9);
pdfDoc.text("123-456-7890 | jake@example.com | linkedin.com/in/jake | github.com/jake", 54, 65);

// Education
pdfDoc.setFont("helvetica", "bold");
pdfDoc.setFontSize(12);
pdfDoc.text("EDUCATION", 54, 95);
pdfDoc.setLineWidth(0.75);
pdfDoc.line(54, 99, 558, 99);

pdfDoc.setFont("helvetica", "bold");
pdfDoc.setFontSize(10.5);
pdfDoc.text("Southwestern University", 54, 115);
pdfDoc.setFont("helvetica", "normal");
pdfDoc.setFontSize(9.5);
pdfDoc.text("Georgetown, TX", 470, 115);

pdfDoc.setFont("helvetica", "normal");
pdfDoc.setFontSize(10);
pdfDoc.text("Bachelor of Arts in Computer Science, Minor in Business", 54, 130);
pdfDoc.setFontSize(9.5);
pdfDoc.text("Aug. 2018 – May 2021", 445, 130);

pdfDoc.setFont("helvetica", "bold");
pdfDoc.setFontSize(10.5);
pdfDoc.text("Blinn College", 54, 150);
pdfDoc.setFont("helvetica", "normal");
pdfDoc.setFontSize(9.5);
pdfDoc.text("Bryan, TX", 500, 150);

pdfDoc.setFont("helvetica", "normal");
pdfDoc.setFontSize(10);
pdfDoc.text("Associate's in Liberal Arts", 54, 165);
pdfDoc.setFontSize(9.5);
pdfDoc.text("Aug. 2014 – May 2018", 445, 165);

// Experience
pdfDoc.setFont("helvetica", "bold");
pdfDoc.setFontSize(12);
pdfDoc.text("EXPERIENCE", 54, 195);
pdfDoc.line(54, 199, 558, 199);

pdfDoc.setFont("helvetica", "bold");
pdfDoc.setFontSize(10.5);
pdfDoc.text("Undergraduate Research Assistant", 54, 215);

pdfDoc.setFont("helvetica", "normal");
pdfDoc.setFontSize(10);
pdfDoc.text("Texas A&M University", 54, 230);
pdfDoc.setFontSize(9.5);
pdfDoc.text("June 2020 – Present College Station, TX", 370, 230);

pdfDoc.setFontSize(9.5);
pdfDoc.text(
  "• Developed a REST API using FastAPI and PostgreSQL to process telemetry logs.",
  64,
  248,
);
pdfDoc.text(
  "• Developed a full-stack web application using Flask, React, PostgreSQL, and Docker.",
  64,
  263,
);

fs.writeFileSync("sample_southwestern_resume.pdf", Buffer.from(pdfDoc.output("arraybuffer")));
console.log("Successfully created sample_southwestern_resume.pdf");
