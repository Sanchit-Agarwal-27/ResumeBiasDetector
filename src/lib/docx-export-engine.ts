import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  AlignmentType,
  BorderStyle,
  WidthType,
  convertInchesToTwip,
} from "docx";
import type { CanvasTextBlock, CanvasPage, ColumnLayoutPreset } from "./pdf-cluster-engine";

export interface DocxExportOptions {
  fileName?: string;
  documentTitle?: string;
  candidateName?: string;
  targetRole?: string;
  paperFormat?: "letter" | "a4";
  columnLayout?: ColumnLayoutPreset;
}

function cleanFontName(fontFamily: string): string {
  if (!fontFamily) return "Calibri";
  const primary = fontFamily.split(",")[0]?.replace(/['"]/g, "").trim();
  return primary || "Calibri";
}

function hexToDocxColor(color?: string): string {
  if (!color) return "111827";
  const clean = color.replace("#", "").trim();
  if (clean.length === 3) {
    return clean
      .split("")
      .map((c) => c + c)
      .join("");
  }
  return clean.length === 6 ? clean : "111827";
}

function getAlignment(
  align?: CanvasTextBlock["align"],
): (typeof AlignmentType)[keyof typeof AlignmentType] {
  switch (align) {
    case "center":
      return AlignmentType.CENTER;
    case "right":
      return AlignmentType.RIGHT;
    case "justify":
      return AlignmentType.JUSTIFIED;
    default:
      return AlignmentType.LEFT;
  }
}

/**
 * Creates a docx Paragraph from a CanvasTextBlock
 */
function blockToParagraph(block: CanvasTextBlock): Paragraph {
  // 1. Horizontal Divider Block
  if (block.isDivider) {
    const borderStyle =
      block.dividerStyle === "dashed"
        ? BorderStyle.DASHED
        : block.dividerStyle === "dotted"
          ? BorderStyle.DOTTED
          : block.dividerStyle === "double"
            ? BorderStyle.DOUBLE
            : BorderStyle.SINGLE;

    return new Paragraph({
      border: {
        bottom: {
          style: borderStyle,
          size: block.dividerStyle === "thick" ? 12 : 6,
          color: hexToDocxColor(block.dividerColor || "#94a3b8"),
          space: 2,
        },
      },
      spacing: {
        before: 120, // 6pt
        after: 120,
      },
    });
  }

  // 2. Text Paragraph
  const rawText = block.text || "";
  const isBullet = Boolean(block.isBullet);
  const cleanText = isBullet
    ? rawText
        .replace(/^[\u2022\u25cf\u25cb\u25aa\u25b8\uf0b7\u00b7\u2013\u2014■●○►*•-]\s*/, "")
        .trim()
    : rawText;

  const fontName = cleanFontName(block.fontFamily);
  // docx uses half-points for font size (e.g. 10pt = 20)
  const sizeHalfPts = Math.round((block.fontSize || 10) * 2);

  const runOptions: Record<string, unknown> = {
    text: cleanText,
    font: fontName,
    size: sizeHalfPts,
    bold: Boolean(block.bold),
    italics: Boolean(block.italic),
    strike: Boolean(block.strikethrough),
    color: hexToDocxColor(block.color),
  };
  if (block.underline) {
    runOptions["underline"] = {};
  }

  const textRun = new TextRun(runOptions as unknown as ConstructorParameters<typeof TextRun>[0]);

  // Convert points to twips (1 pt = 20 twips)
  const spaceBeforeTwips = Math.round((block.spaceBefore ?? 2) * 20);
  const spaceAfterTwips = Math.round((block.spaceAfter ?? 2) * 20);
  const lineHeightTwips = Math.round((block.lineHeight || 1.25) * 240); // 240 = single line

  const paragraphOptions: Record<string, unknown> = {
    alignment: getAlignment(block.align),
    spacing: {
      before: spaceBeforeTwips,
      after: spaceAfterTwips,
      line: lineHeightTwips,
    },
    children: [textRun],
  };
  if (isBullet) {
    paragraphOptions["bullet"] = { level: 0 };
  }

  return new Paragraph(paragraphOptions as unknown as ConstructorParameters<typeof Paragraph>[0]);
}

/**
 * Creates a docx Table from a table CanvasTextBlock
 */
function blockToTable(block: CanvasTextBlock): Table {
  const tableData = block.tableData || {
    rows: 2,
    cols: 2,
    cells: [
      ["", ""],
      ["", ""],
    ],
  };
  const fontName = cleanFontName(block.fontFamily);
  const sizeHalfPts = Math.round((block.fontSize || 9.5) * 2);

  const tableRows: TableRow[] = [];

  for (let r = 0; r < tableData.rows; r++) {
    const rowCells: TableCell[] = [];
    const rowData = tableData.cells[r] || [];

    for (let c = 0; c < tableData.cols; c++) {
      const cellText = rowData[c] || "";
      const isHeader = r === 0 && Boolean(tableData.headers);

      rowCells.push(
        new TableCell({
          width: {
            size: Math.round(100 / tableData.cols),
            type: WidthType.PERCENTAGE,
          },
          children: [
            new Paragraph({
              children: [
                new TextRun({
                  text: cellText,
                  font: fontName,
                  size: sizeHalfPts,
                  bold: isHeader || Boolean(block.bold),
                  color: hexToDocxColor(block.color),
                }),
              ],
              spacing: { before: 80, after: 80 },
            }),
          ],
          borders: {
            top: { style: BorderStyle.SINGLE, size: 2, color: "E2E8F0" },
            bottom: { style: BorderStyle.SINGLE, size: 2, color: "E2E8F0" },
            left: { style: BorderStyle.SINGLE, size: 2, color: "E2E8F0" },
            right: { style: BorderStyle.SINGLE, size: 2, color: "E2E8F0" },
          },
        }),
      );
    }

    tableRows.push(new TableRow({ children: rowCells }));
  }

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: tableRows,
  });
}

/**
 * Generates an editable Microsoft Word (.docx) document as a Blob
 */
export async function generateDocxBlob(
  pages: CanvasPage[],
  blocks: CanvasTextBlock[],
  options: DocxExportOptions = {},
): Promise<Blob> {
  const {
    documentTitle = "Resume",
    candidateName = "Candidate",
    paperFormat = "letter",
    columnLayout = "single",
  } = options;

  // Page dimensions (Letter: 8.5 x 11 in, A4: 8.27 x 11.69 in)
  const isA4 = paperFormat === "a4";
  const pageWidthTwips = isA4 ? convertInchesToTwip(8.27) : convertInchesToTwip(8.5);
  const pageHeightTwips = isA4 ? convertInchesToTwip(11.69) : convertInchesToTwip(11);
  const marginTwips = convertInchesToTwip(0.65); // 0.65 in standard professional margins

  const docChildren: Array<Paragraph | Table> = [];

  // Sort blocks by pageIndex then y
  const sortedBlocks = [...blocks].sort(
    (a, b) => a.pageIndex - b.pageIndex || a.y - b.y || a.x - b.x,
  );

  if (columnLayout === "single") {
    // Standard Single-Column Flow
    for (const block of sortedBlocks) {
      if (block.isTable && block.tableData) {
        docChildren.push(blockToTable(block));
      } else {
        docChildren.push(blockToParagraph(block));
      }
    }
  } else {
    // Multi-Column Layout:
    // Split into full-width header blocks vs column blocks
    const fullWidthBlocks = sortedBlocks.filter(
      (b) => b.columnSlot === "full" || (!b.columnSlot && b.isTitle),
    );
    const leftColumnBlocks = sortedBlocks.filter((b) => b.columnSlot === "left");
    const rightColumnBlocks = sortedBlocks.filter(
      (b) => b.columnSlot === "right" || (!b.columnSlot && !b.isTitle),
    );

    // 1. Output Full-width headers (Name, Contact, Links)
    for (const block of fullWidthBlocks) {
      if (block.isTable && block.tableData) {
        docChildren.push(blockToTable(block));
      } else {
        docChildren.push(blockToParagraph(block));
      }
    }

    // 2. Output 2-Column Table (Industry standard for ATS-safe 2-column Word resumes)
    const leftColParagraphs: Array<Paragraph | Table> = leftColumnBlocks.map((b) =>
      b.isTable && b.tableData ? blockToTable(b) : blockToParagraph(b),
    );
    const rightColParagraphs: Array<Paragraph | Table> = rightColumnBlocks.map((b) =>
      b.isTable && b.tableData ? blockToTable(b) : blockToParagraph(b),
    );

    // Fallback if empty
    if (leftColParagraphs.length === 0) leftColParagraphs.push(new Paragraph({ text: "" }));
    if (rightColParagraphs.length === 0) rightColParagraphs.push(new Paragraph({ text: "" }));

    let leftColPercent = 35;
    let rightColPercent = 65;
    if (columnLayout === "two-column-right") {
      leftColPercent = 65;
      rightColPercent = 35;
    } else if (columnLayout === "two-column-equal") {
      leftColPercent = 50;
      rightColPercent = 50;
    }

    const twoColTable = new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          children: [
            new TableCell({
              width: { size: leftColPercent, type: WidthType.PERCENTAGE },
              borders: {
                top: { style: BorderStyle.NONE },
                bottom: { style: BorderStyle.NONE },
                left: { style: BorderStyle.NONE },
                right: { style: BorderStyle.NONE },
              },
              children: leftColParagraphs,
            }),
            new TableCell({
              width: { size: rightColPercent, type: WidthType.PERCENTAGE },
              borders: {
                top: { style: BorderStyle.NONE },
                bottom: { style: BorderStyle.NONE },
                left: { style: BorderStyle.NONE },
                right: { style: BorderStyle.NONE },
              },
              children: rightColParagraphs,
            }),
          ],
        }),
      ],
    });

    docChildren.push(twoColTable);
  }

  const doc = new Document({
    title: documentTitle,
    creator: "BiasLens Resume Studio",
    description: `ATS-Compliant Resume for ${candidateName}`,
    sections: [
      {
        properties: {
          page: {
            size: {
              width: pageWidthTwips,
              height: pageHeightTwips,
            },
            margin: {
              top: marginTwips,
              bottom: marginTwips,
              left: marginTwips,
              right: marginTwips,
            },
          },
        },
        children: docChildren,
      },
    ],
  });

  return await Packer.toBlob(doc);
}

/**
 * Convenience helper to download the .docx file directly in browser
 */
export async function downloadDocxFile(
  pages: CanvasPage[],
  blocks: CanvasTextBlock[],
  options: DocxExportOptions = {},
): Promise<void> {
  const blob = await generateDocxBlob(pages, blocks, options);
  const finalFileName = options.fileName?.replace(/\.[^.]+$/, "") || "Resume_Editable";
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${finalFileName}.docx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
