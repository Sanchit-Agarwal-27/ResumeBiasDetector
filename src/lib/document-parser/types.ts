export type ColumnSlot = "full" | "left" | "right";
export type DividerStyle = "solid" | "dashed" | "dotted" | "double" | "thick";
export type ColumnLayoutPreset =
  "single" | "two-column-left" | "two-column-right" | "two-column-equal" | "multi-column";

export interface CanvasPage {
  id: string;
  pageNumber: number;
  width: number;
  height: number;
  preview?: string;
}

export interface CanvasTextBlock {
  id: string;
  pageIndex: number;
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
  fontFamily: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
  color?: string;
  backgroundColor?: string;
  align?: "left" | "center" | "right" | "justify";
  lineHeight?: number;
  letterSpacing?: number;
  spaceBefore?: number;
  spaceAfter?: number;
  indent?: number;
  isTitle?: boolean;
  isHeading?: boolean;
  isBullet?: boolean;
  isNumbered?: boolean;
  listNumber?: number;
  columnSlot?: ColumnSlot;
  isDivider?: boolean;
  dividerStyle?: DividerStyle;
  dividerColor?: string;
  isTable?: boolean;
  tableData?: {
    rows: number;
    cols: number;
    cells: string[][];
    headers?: boolean;
  };
}

export type DocumentType = "pdf" | "docx" | "txt" | "unknown";

export type ExtractionMethod =
  "pdf-native-layout" | "pdf-ocr" | "docx-xml-structured" | "docx-mammoth-fallback" | "raw-text";

export interface ValidationIssue {
  code:
    | "EMPTY_TEXT"
    | "TOO_SHORT"
    | "GARBLED_CHARS"
    | "REPEATED_SYMBOLS"
    | "DUPLICATE_LAYERS"
    | "INTERLEAVED_COLUMNS"
    | "MISSING_PAGES";
  severity: "low" | "medium" | "high" | "critical";
  message: string;
}

export interface ExtractionValidationResult {
  isValid: boolean;
  qualityScore: number; // 0 - 100
  issues: ValidationIssue[];
  requiresFallback: boolean;
  fallbackReason?: string;
}

export interface ExtractionDiagnostics {
  fileName: string;
  fileType: DocumentType;
  pageCount: number;
  characterCount: number;
  wordCount: number;
  method: ExtractionMethod;
  ocrTriggered: boolean;
  columnLayout: ColumnLayoutPreset;
  validationScore: number;
  validationIssues: string[];
  warnings: string[];
  processingTimeMs: number;
}

export interface ParsedResumeDocument {
  rawText: string;
  cleanedText: string;
  canvasBlocks: CanvasTextBlock[];
  canvasPages: CanvasPage[];
  diagnostics: ExtractionDiagnostics;
  validation: ExtractionValidationResult;
}

export interface ParserOptions {
  pdfWorkerUrl?: string;
  allowOcr?: boolean;
  maxPages?: number;
  targetWidth?: number;
  targetHeight?: number;
}
