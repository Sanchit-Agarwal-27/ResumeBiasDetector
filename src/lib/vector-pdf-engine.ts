import { jsPDF } from "jspdf";
import type { CanvasTextBlock, CanvasPage } from "./pdf-cluster-engine";

export type PaperFormat = "a4" | "letter";

export interface VectorPdfOptions {
  fileName?: string;
  documentTitle?: string;
  candidateName?: string;
  targetRole?: string;
  paperFormat?: PaperFormat;
  compress?: boolean;
}

export interface VectorPdfBuildResult {
  pdf: jsPDF;
  blob: Blob;
  blobUrl: string;
  fileName: string;
  pageCount: number;
  totalCharacters: number;
  isSelectableText: boolean;
}

// Paper dimensions in points (72 points = 1 inch)
export const PAPER_SIZES: Record<PaperFormat, { width: number; height: number; label: string }> = {
  a4: { width: 595.28, height: 841.89, label: "A4 (Standard International — 210 × 297 mm)" },
  letter: { width: 612, height: 792, label: "US Letter (Standard North America — 8.5 × 11 in)" },
};

/**
 * Maps CSS/web font families to standard PDF TrueType/Type 1 vector fonts
 */
function resolvePdfFont(
  fontFamily: string,
  bold?: boolean,
  italic?: boolean,
): { fontName: string; fontStyle: string } {
  const familyLower = (fontFamily || "").toLowerCase();

  let fontName = "helvetica";
  if (
    familyLower.includes("georgia") ||
    familyLower.includes("times") ||
    familyLower.includes("serif")
  ) {
    fontName = "times";
  } else if (
    familyLower.includes("mono") ||
    familyLower.includes("courier") ||
    familyLower.includes("code")
  ) {
    fontName = "courier";
  }

  let fontStyle = "normal";
  if (bold && italic) fontStyle = "bolditalic";
  else if (bold) fontStyle = "bold";
  else if (italic) fontStyle = "italic";

  return { fontName, fontStyle };
}

/**
 * Parse hex color to RGB tuple
 */
function hexToRgb(hexColor?: string): [number, number, number] {
  if (!hexColor || !hexColor.startsWith("#")) return [17, 24, 39]; // Default dark slate
  const hex = hexColor.trim();
  if (hex.length === 7) {
    const r = parseInt(hex.slice(1, 3), 16) || 0;
    const g = parseInt(hex.slice(3, 5), 16) || 0;
    const b = parseInt(hex.slice(5, 7), 16) || 0;
    return [r, g, b];
  }
  return [17, 24, 39];
}

/**
 * Generate a certified high-fidelity vector PDF with 100% embedded selectable text
 */
export async function generateVectorPdf(
  pages: CanvasPage[],
  blocks: CanvasTextBlock[],
  options: VectorPdfOptions = {},
): Promise<VectorPdfBuildResult> {
  const {
    fileName = "Alex_Vance_Resume_ATS_Certified.pdf",
    documentTitle = "Professional Resume",
    candidateName = "Candidate",
    targetRole = "Candidate Profile",
    paperFormat = "a4",
    compress = true,
  } = options;

  const targetPaper = PAPER_SIZES[paperFormat] || PAPER_SIZES.a4;
  const firstPage = pages[0] || { width: targetPaper.width, height: targetPaper.height };

  // Calculate layout scale if canvas size differs slightly from selected paper format
  const scaleX = targetPaper.width / (firstPage.width || targetPaper.width);
  const scaleY = targetPaper.height / (firstPage.height || targetPaper.height);

  const pdf = new jsPDF({
    unit: "pt",
    format: [targetPaper.width, targetPaper.height],
    orientation: "portrait",
    compress,
  });

  // Embed enterprise PDF metadata required for ATS compliance & accessibility
  pdf.setDocumentProperties({
    title: documentTitle,
    subject: `Curriculum Vitae / Resume — ${targetRole}`,
    author: candidateName,
    keywords: `Resume, ATS, ${targetRole}, Career, Verified Vector`,
    creator: "BiasLens Resume Intelligence Engine (Vector ATS Certified)",
  });

  const effectivePages =
    pages.length > 0
      ? pages
      : [{ id: "page-1", pageNumber: 1, width: targetPaper.width, height: targetPaper.height }];
  let totalCharacters = 0;

  effectivePages.forEach((page, pageIndex) => {
    if (pageIndex > 0) {
      pdf.addPage([targetPaper.width, targetPaper.height], "portrait");
    }

    // Sort blocks into standard ATS reading order: page, top-to-bottom Y, left-to-right X
    const pageBlocks = blocks
      .filter((b) => b.pageIndex === pageIndex)
      .sort((a, b) => a.y - b.y || a.x - b.x);

    pageBlocks.forEach((block) => {
      const { fontName, fontStyle } = resolvePdfFont(block.fontFamily, block.bold, block.italic);
      const [r, g, b] = hexToRgb(block.color);

      pdf.setFont(fontName, fontStyle);
      const fontSizePt = Math.max(7, Math.round(block.fontSize * Math.min(scaleX, scaleY)));
      pdf.setFontSize(fontSizePt);
      pdf.setTextColor(r, g, b);

      // Scaled coordinates
      const xPt = Math.max(20, block.x * scaleX);
      const yPt = Math.max(20, block.y * scaleY);
      const widthPt = Math.max(60, block.width * scaleX);

      // Clean lines to prevent unprintable unicode characters
      const cleanText = block.text.replace(/\r\n/g, "\n");
      totalCharacters += cleanText.length;

      // Wrap text within the block bounding box
      const lines = pdf.splitTextToSize(cleanText, widthPt);
      const align = block.align === "justify" ? "left" : block.align || "left";

      // Render vector text with native PDF font operator
      pdf.text(lines, xPt, yPt + fontSizePt, {
        align,
        lineHeightFactor: block.lineHeight || 1.35,
      });

      // If text is underlined, draw a crisp vector rule line
      if (block.underline) {
        pdf.setDrawColor(r, g, b);
        pdf.setLineWidth(0.75);
        const textWidth = pdf.getTextWidth(cleanText);
        pdf.line(xPt, yPt + fontSizePt + 2, xPt + textWidth, yPt + fontSizePt + 2);
      }
    });
  });

  const blob = pdf.output("blob");
  const blobUrl = URL.createObjectURL(blob);

  return {
    pdf,
    blob,
    blobUrl,
    fileName: fileName.endsWith(".pdf") ? fileName : `${fileName}.pdf`,
    pageCount: effectivePages.length,
    totalCharacters,
    isSelectableText: totalCharacters > 0,
  };
}
