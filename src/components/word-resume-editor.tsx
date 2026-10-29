import {
  useState,
  useRef,
  useEffect,
  useCallback,
  lazy,
  Suspense,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import {
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Plus,
  Trash2,
  ZoomIn,
  ZoomOut,
  ChevronDown,
  Layout,
  Check,
  Undo2,
  Redo2,
  List,
  ListOrdered,
  MoveUp,
  MoveDown,
  Space,
  SplitSquareVertical,
  Minus,
  Highlighter,
  Indent,
  Outdent,
  RemoveFormatting,
  Columns2,
  Table as TableIcon,
  SeparatorHorizontal,
  Upload,
  Sun,
  Moon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn, matchesWordBoundary } from "@/lib/utils";
import { initializeCustomFonts, type CustomFontRecord } from "@/lib/custom-font-service";
const FontUploadModal = lazy<
  React.ComponentType<{
    open: boolean;
    onOpenChange: (open: boolean) => void;
    customFonts: CustomFontRecord[];
    onFontsChanged: (newFonts: CustomFontRecord[]) => void;
    onSelectFont?: (fontFamily: string) => void;
  }>
>(() =>
  import("./font-upload-modal").then((m) => ({ default: m.FontUploadModal })),
);
import type {
  CanvasTextBlock,
  CanvasPage,
  ColumnLayoutPreset,
  DividerStyle,
} from "@/lib/pdf-cluster-engine";
import type { BiasSpan, ResumeErrorFlag } from "@/lib/resume-contract";

export const FONT_FAMILIES = [
  { label: "Calibri (Default Word)", value: "Calibri, sans-serif" },
  { label: "Arial (Standard Sans)", value: "Arial, sans-serif" },
  { label: "Times New Roman (Classic Serif)", value: "'Times New Roman', Times, serif" },
  { label: "Georgia (Formal Serif)", value: "Georgia, serif" },
  { label: "Inter (Modern Document)", value: "Inter, sans-serif" },
  { label: "Roboto (Clean Standard)", value: "Roboto, sans-serif" },
  { label: "Lato (Professional Sans)", value: "Lato, sans-serif" },
  { label: "Montserrat (Executive Sans)", value: "'Montserrat', sans-serif" },
  { label: "Poppins (Modern Geometric)", value: "'Poppins', sans-serif" },
  { label: "Merriweather (Editorial Serif)", value: "Merriweather, serif" },
  { label: "EB Garamond (Executive Serif)", value: "'EB Garamond', Georgia, serif" },
  { label: "Courier New (Monospace / Code)", value: "'Courier New', monospace" },
];

export const PRESET_FONT_SIZES = [8, 9, 9.5, 10, 10.5, 11, 11.5, 12, 13, 14, 16, 18, 20, 24, 28];

export const PRESET_LINE_HEIGHTS = [
  { label: "Single (1.0)", value: 1.0 },
  { label: "Compact (1.15)", value: 1.15 },
  { label: "Standard Resume (1.25)", value: 1.25 },
  { label: "Relaxed (1.5)", value: 1.5 },
  { label: "Double (2.0)", value: 2.0 },
];

export const PRESET_LETTER_SPACINGS = [
  { label: "Tighter (-0.5pt)", value: -0.5 },
  { label: "Normal (0pt)", value: 0 },
  { label: "Expanded (+0.5pt)", value: 0.5 },
  { label: "Wide (+1.0pt)", value: 1.0 },
  { label: "Very Wide (+2.0pt)", value: 2.0 },
];

export const PRESET_COLORS = [
  { label: "Pure White", value: "#ffffff" },
  { label: "Off White / Silver", value: "#f8fafc" },
  { label: "Light Gray", value: "#cbd5e1" },
  { label: "Bright Cyan", value: "#38bdf8" },
  { label: "Electric Blue", value: "#60a5fa" },
  { label: "Bright Amber", value: "#fbbf24" },
  { label: "Bright Emerald", value: "#34d399" },
  { label: "Rose Pink", value: "#fb7185" },
  { label: "Standard Black", value: "#000000" },
  { label: "Charcoal Dark", value: "#111827" },
  { label: "Slate Corporate", value: "#1e293b" },
  { label: "Muted Gray", value: "#4b5563" },
  { label: "Navy Blue", value: "#1e3a8a" },
  { label: "Royal Blue", value: "#1d4ed8" },
  { label: "Forest Green", value: "#065f46" },
  { label: "Ruby Red", value: "#991b1b" },
  { label: "Purple Accent", value: "#6b21a8" },
  { label: "Warm Amber", value: "#b45309" },
];

export const PRESET_HIGHLIGHT_COLORS = [
  { label: "None", value: "transparent" },
  { label: "Pure White", value: "#ffffff" },
  { label: "Soft Yellow", value: "#fef08a" },
  { label: "Neon Yellow", value: "#fde047" },
  { label: "Soft Green", value: "#bbf7d0" },
  { label: "Bright Green", value: "#86efac" },
  { label: "Soft Cyan", value: "#bae6fd" },
  { label: "Sky Blue", value: "#7dd3fc" },
  { label: "Soft Pink", value: "#fbcfe8" },
  { label: "Coral Pink", value: "#f472b6" },
  { label: "Soft Amber", value: "#fed7aa" },
  { label: "Light Slate", value: "#e2e8f0" },
  { label: "Dark Slate", value: "#1e293b" },
  { label: "Navy", value: "#1e3a8a" },
];

export const PAPER_FORMAT_PRESETS = [
  {
    id: "letter",
    label: "US Letter (8.5 × 11 in)",
    width: 612,
    height: 792,
    desc: "Standard in North America (612 × 792 pt)",
  },
  {
    id: "a4",
    label: "A4 (210 × 297 mm)",
    width: 595.28,
    height: 841.89,
    desc: "Standard International (595 × 842 pt)",
  },
];

export const MARGIN_OPTIONS = [
  { label: "Normal (1 in / 54pt)", value: 54 },
  { label: "Compact (0.75 in / 40pt)", value: 40 },
  { label: "Narrow (0.5 in / 28pt)", value: 28 },
];

export const STYLE_PRESETS = [
  { label: "Normal text", fontSize: 9.5, bold: false, color: "#111827", spaceBefore: 2, spaceAfter: 2 },
  { label: "Title", fontSize: 20, bold: true, color: "#1e3a8a", spaceBefore: 4, spaceAfter: 6 },
  { label: "Subtitle", fontSize: 11, bold: false, color: "#4b5563", spaceBefore: 0, spaceAfter: 6 },
  { label: "Heading 1", fontSize: 12.5, bold: true, color: "#1e3a8a", spaceBefore: 12, spaceAfter: 4 },
  { label: "Heading 2", fontSize: 11, bold: true, color: "#111827", spaceBefore: 8, spaceAfter: 2 },
  { label: "Heading 3", fontSize: 10, bold: true, color: "#374151", spaceBefore: 6, spaceAfter: 2 },
];

export const COLUMN_LAYOUT_PRESETS: Array<{
  id: ColumnLayoutPreset;
  label: string;
  desc: string;
}> = [
  {
    id: "single",
    label: "Single Column",
    desc: "100% full width standard flow",
  },
  {
    id: "two-column-left",
    label: "2-Col (Left Sidebar)",
    desc: "35% left sidebar (skills/contact) + 65% main body",
  },
  {
    id: "two-column-right",
    label: "2-Col (Right Sidebar)",
    desc: "65% main body + 35% right sidebar",
  },
  {
    id: "two-column-equal",
    label: "2-Col (Balanced 50/50)",
    desc: "Two equal width columns side-by-side",
  },
];

export const SECTION_DIVIDER_PRESETS: Array<{
  label: string;
  style: DividerStyle;
  color: string;
}> = [
  { label: "Classic Thin Rule", style: "solid", color: "#cbd5e1" },
  { label: "Executive Charcoal", style: "solid", color: "#334155" },
  { label: "Corporate Accent Blue", style: "solid", color: "#2563eb" },
  { label: "Modern Thick Bar", style: "thick", color: "#0f172a" },
  { label: "Dashed Divider", style: "dashed", color: "#94a3b8" },
  { label: "Dotted Divider", style: "dotted", color: "#94a3b8" },
  { label: "Double Line Rule", style: "double", color: "#64748b" },
];

export const TABLE_PRESETS = [
  {
    label: "Skills Matrix (2×3)",
    rows: 3,
    cols: 2,
    headers: true,
    cells: [
      ["Technical Domain", "Core Competencies & Tools"],
      ["Programming", "Python, TypeScript, SQL, Go"],
      ["Cloud & Infra", "AWS, Docker, Kubernetes, CI/CD"],
    ],
  },
  {
    label: "Two-Column Key Grid (2×2)",
    rows: 2,
    cols: 2,
    headers: false,
    cells: [
      ["Degree: B.S. Computer Science", "Institution: Stanford University"],
      ["Graduation: June 2024", "GPA / Honors: Magna Cum Laude"],
    ],
  },
  {
    label: "Standard Project Table (3×3)",
    rows: 3,
    cols: 3,
    headers: true,
    cells: [
      ["Project / Scope", "Technology Stack", "Key Impact"],
      ["Cloud Migration", "Terraform, GCP", "Reduced latency by 35%"],
      ["ML Pipeline", "PyTorch, FastAPI", "Scaled inference to 10k RPS"],
    ],
  },
];

export const BULLET_PREFIX_REGEX =
  /^[\u2022\u25cf\u25cb\u25aa\u25b8\uf0b7\u00b7\u2013\u2014■●○►*•]\s*|^-\s+/;
export const NUMBERED_PREFIX_REGEX = /^(\d+[.)])\s*/;

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function getCaretOffsetWithin(el: HTMLElement): number {
  try {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return 0;
    const range = sel.getRangeAt(0);
    const preCaretRange = range.cloneRange();
    preCaretRange.selectNodeContents(el);
    preCaretRange.setEnd(range.endContainer, range.endOffset);
    return preCaretRange.toString().length;
  } catch {
    return 0;
  }
}

function restoreCaretOffsetWithin(el: HTMLElement, targetOffset: number) {
  try {
    const sel = window.getSelection();
    if (!sel) return;
    let currentOffset = 0;
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    let node = walker.nextNode();
    while (node) {
      const len = node.textContent?.length || 0;
      if (currentOffset + len >= targetOffset) {
        const range = document.createRange();
        range.setStart(node, Math.min(targetOffset - currentOffset, len));
        range.collapse(true);
        sel.removeAllRanges();
        sel.addRange(range);
        return;
      }
      currentOffset += len;
      node = walker.nextNode();
    }
  } catch {
    // Graceful fallback
  }
}

function parseBlocksToHtml(blocks: CanvasTextBlock[], paperTheme: "white" | "dark" = "white"): string {
  if (!blocks || blocks.length === 0) {
    return `<div class="doc-block" style="font-size: 9.5pt; font-family: Calibri, sans-serif; line-height: 1.25; margin-top: 2px; margin-bottom: 2px;"><br></div>`;
  }

  const defaultTextColor = paperTheme === "dark" ? "#f8fafc" : "#111827";
  const defaultHeadingColor = paperTheme === "dark" ? "#60a5fa" : "#1e3a8a";

  return blocks
    .map((b) => {
      if (b.isDivider) {
        let borderStyle = "solid";
        let borderWidth = "1px";
        if (b.dividerStyle === "dashed") borderStyle = "dashed";
        else if (b.dividerStyle === "dotted") borderStyle = "dotted";
        else if (b.dividerStyle === "double") {
          borderStyle = "double";
          borderWidth = "3px";
        } else if (b.dividerStyle === "thick") {
          borderWidth = "2px";
        }
        const divColor = b.dividerColor || (paperTheme === "dark" ? "#3f3f46" : "#cbd5e1");
        return `<div data-block-id="${b.id}" data-divider="true" contenteditable="false" style="border: none; border-bottom: ${borderWidth} ${borderStyle} ${divColor}; margin: 10px 0; user-select: none;"></div>`;
      }

      if (b.isTable && b.tableData) {
        const rowsHtml = b.tableData.cells
          .map((rowCells, rIdx) => {
            const isHeaderRow = rIdx === 0 && b.tableData?.headers;
            const cellsHtml = rowCells
              .map(
                (cText) =>
                  `<td style="border: 1px solid ${paperTheme === "dark" ? "#3f3f46" : "#cbd5e1"}; padding: 6px 8px; font-size: ${b.fontSize || 9.5}pt; ${isHeaderRow ? `font-weight: 600; background-color: ${paperTheme === "dark" ? "rgba(39, 39, 42, 0.6)" : "rgba(241, 245, 249, 0.6)"};` : ""}">${escapeHtml(cText) || "<br>"}</td>`,
              )
              .join("");
            return `<tr>${cellsHtml}</tr>`;
          })
          .join("");

        return `<div data-block-id="${b.id}" data-table="true" style="margin: 8px 0; overflow-x: auto;"><table style="width: 100%; border-collapse: collapse; border: 1px solid ${paperTheme === "dark" ? "#3f3f46" : "#cbd5e1"}; font-family: ${b.fontFamily || "Calibri, sans-serif"};"><tbody>${rowsHtml}</tbody></table></div>`;
      }

      const isTitle = Boolean(b.isTitle) || (b.fontSize && b.fontSize >= 18);
      const isHeading =
        Boolean(b.isHeading) ||
        (b.fontSize && b.fontSize >= 12.5) ||
        (b.bold && b.text.length < 50 && /^[A-Z\s]{4,}$/.test(b.text.trim()));
      const isBullet = Boolean(b.isBullet) || BULLET_PREFIX_REGEX.test(b.text.trim());

      const fontSize = b.fontSize || (isTitle ? 20 : isHeading ? 12.5 : 9.5);
      const fontWeight = b.bold || isTitle || isHeading ? "700" : "400";
      const fontStyle = b.italic ? "italic" : "normal";
      const textDecor = b.underline
        ? "underline"
        : b.strikethrough
          ? "line-through"
          : "none";
      let color = b.color;
      if (paperTheme === "dark") {
        if (!color || color === "#111827" || color === "#1f2937" || color === "#0f172a" || color === "#000000") {
          color = "#f8fafc";
        } else if (color === "#1e3a8a") {
          color = "#60a5fa";
        }
      } else {
        if (!color || color === "#f8fafc" || color === "#f1f5f9" || color === "#e2e8f0" || color === "#ffffff") {
          color = "#111827";
        } else if (color === "#60a5fa") {
          color = "#1e3a8a";
        }
      }
      if (!color) {
        color = isTitle || isHeading ? defaultHeadingColor : defaultTextColor;
      }
      const bgColor =
        b.backgroundColor && b.backgroundColor !== "transparent"
          ? b.backgroundColor
          : "transparent";
      const align = b.align || "left";
      const lineHeight = b.lineHeight || 1.25;
      const spaceBefore = b.spaceBefore ?? (isTitle ? 6 : isHeading ? 12 : 2);
      const spaceAfter = b.spaceAfter ?? (isTitle ? 4 : isHeading ? 4 : 2);
      const indent = b.indent ?? (isBullet ? 14 : 0);

      const cleanText = escapeHtml(b.text || "");
      const innerContent = cleanText.length > 0 ? cleanText : "<br>";

      return `<div data-block-id="${b.id}" class="doc-block ${isHeading ? "doc-heading" : ""} ${isTitle ? "doc-title" : ""}" style="font-size: ${fontSize}pt; font-family: ${b.fontFamily || "Calibri, sans-serif"}; font-weight: ${fontWeight}; font-style: ${fontStyle}; text-decoration: ${textDecor}; color: ${color}; background-color: ${bgColor}; text-align: ${align}; line-height: ${lineHeight}; margin-top: ${spaceBefore}px; margin-bottom: ${spaceAfter}px; padding-left: ${indent}px;">${innerContent}</div>`;
    })
    .join("");
}

function serializeHtmlToBlocks(
  editorEl: HTMLElement,
  pageIndex: number,
  pageWidth: number,
): CanvasTextBlock[] {
  const blocks: CanvasTextBlock[] = [];
  const children = Array.from(editorEl.children) as HTMLElement[];
  let curY = 40;

  for (let i = 0; i < children.length; i++) {
    const el = children[i]!;
    const isDivider =
      el.getAttribute("data-divider") === "true" ||
      el.tagName === "HR" ||
      el.querySelector("hr") !== null;
    const isTable =
      el.getAttribute("data-table") === "true" ||
      el.tagName === "TABLE" ||
      el.querySelector("table") !== null;

    const blockId = el.getAttribute("data-block-id") || `block-${pageIndex}-${i}-${Date.now()}`;

    if (isDivider) {
      blocks.push({
        id: blockId,
        pageIndex,
        text: "---",
        x: 40,
        y: curY,
        width: pageWidth - 80,
        height: 12,
        fontSize: 9.5,
        fontFamily: "Calibri, sans-serif",
        isDivider: true,
        dividerStyle: "solid",
        dividerColor: "#cbd5e1",
      });
      curY += 16;
      continue;
    }

    if (isTable) {
      const tableEl = el.tagName === "TABLE" ? (el as HTMLTableElement) : el.querySelector("table");
      const rows: string[][] = [];
      if (tableEl) {
        const trs = Array.from(tableEl.querySelectorAll("tr"));
        trs.forEach((tr) => {
          const cells = Array.from(tr.querySelectorAll("td, th")).map(
            (c) => (c as HTMLElement).innerText.trim() || "",
          );
          if (cells.length > 0) rows.push(cells);
        });
      }

      blocks.push({
        id: blockId,
        pageIndex,
        text: rows.map((r) => r.join(" | ")).join("\n"),
        x: 40,
        y: curY,
        width: pageWidth - 80,
        height: Math.max(30, rows.length * 20),
        fontSize: 9.5,
        fontFamily: "Calibri, sans-serif",
        isTable: true,
        tableData: {
          rows: rows.length || 2,
          cols: rows[0]?.length || 2,
          cells: rows.length > 0 ? rows : [["", ""], ["", ""]],
          headers: true,
        },
      });
      curY += Math.max(30, rows.length * 20) + 10;
      continue;
    }

    const rawText = (el.innerText || el.textContent || "")
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n")
      .replace(/\n$/, "");

    const computed = window.getComputedStyle(el);
    const inlineStyle = el.style;

    const fontSize =
      parseFloat(inlineStyle.fontSize) ||
      Math.round((parseFloat(computed.fontSize) / 1.333) * 10) / 10 ||
      9.5;
    const fontFamily = inlineStyle.fontFamily || computed.fontFamily || "Calibri, sans-serif";
    const fontWeight = inlineStyle.fontWeight || computed.fontWeight;
    const isBold =
      fontWeight === "bold" ||
      parseInt(fontWeight, 10) >= 600 ||
      el.tagName === "H1" ||
      el.tagName === "H2" ||
      el.tagName === "H3" ||
      el.querySelector("strong, b") !== null;
    const isItalic =
      inlineStyle.fontStyle === "italic" ||
      computed.fontStyle === "italic" ||
      el.querySelector("em, i") !== null;
    const textDecoration = inlineStyle.textDecoration || computed.textDecoration || "";
    const isUnderline =
      textDecoration.includes("underline") || el.querySelector("u") !== null;
    const isStrikethrough =
      textDecoration.includes("line-through") || el.querySelector("s, strike") !== null;

    const color = inlineStyle.color || computed.color || "#111827";
    const bgColor = inlineStyle.backgroundColor || computed.backgroundColor;
    const align = (inlineStyle.textAlign ||
      computed.textAlign ||
      "left") as "left" | "center" | "right" | "justify";

    const isBullet = BULLET_PREFIX_REGEX.test(rawText.trim()) || el.tagName === "LI";
    const isNumbered = NUMBERED_PREFIX_REGEX.test(rawText.trim());
    const isTitle = fontSize >= 18 || el.tagName === "H1";
    const isHeading =
      isTitle ||
      fontSize >= 12 ||
      (fontSize >= 10.5 && isBold) ||
      el.tagName === "H2" ||
      el.tagName === "H3";

    const blockHeight = Math.max(16, fontSize * 1.3);

    blocks.push({
      id: blockId,
      pageIndex,
      text: rawText,
      x: 40,
      y: curY,
      width: pageWidth - 80,
      height: blockHeight,
      fontSize,
      fontFamily,
      bold: isBold,
      italic: isItalic,
      underline: isUnderline,
      strikethrough: isStrikethrough,
      color,
      backgroundColor: bgColor && bgColor !== "transparent" ? bgColor : undefined,
      align,
      lineHeight: parseFloat(inlineStyle.lineHeight) || 1.25,
      isTitle,
      isHeading,
      isBullet,
      isNumbered,
      indent: parseFloat(inlineStyle.paddingLeft) || (isBullet ? 14 : 0),
      spaceBefore: parseFloat(inlineStyle.marginTop) || (isHeading ? 10 : 2),
      spaceAfter: parseFloat(inlineStyle.marginBottom) || (isHeading ? 4 : 2),
    });

    curY += blockHeight + 4;
  }

  return blocks;
}

interface WordResumeEditorProps {
  pages: CanvasPage[];
  blocks: CanvasTextBlock[];
  activeBiasSpan?: BiasSpan;
  biasSpans?: BiasSpan[];
  errorFlags?: ResumeErrorFlag[];
  columnLayout?: ColumnLayoutPreset;
  onColumnLayoutChange?: (layout: ColumnLayoutPreset) => void;
  onChange: (updatedBlocks: CanvasTextBlock[], updatedPages: CanvasPage[]) => void;
  onSelectBlock?: (blockId: string) => void;
}

export function WordResumeEditor({
  pages: initialPages,
  blocks: initialBlocks,
  activeBiasSpan,
  biasSpans = [],
  errorFlags = [],
  columnLayout: initialColumnLayout = "single",
  onColumnLayoutChange,
  onChange,
  onSelectBlock,
}: WordResumeEditorProps) {
  const [columnLayout, setColumnLayout] = useState<ColumnLayoutPreset>(
    initialColumnLayout || "single",
  );
  const [paperTheme, setPaperTheme] = useState<"white" | "dark">("white");
  const [customFonts, setCustomFonts] = useState<CustomFontRecord[]>([]);
  const [fontUploadModalOpen, setFontUploadModalOpen] = useState(false);

  useEffect(() => {
    if (initialColumnLayout) {
      setColumnLayout(initialColumnLayout);
    }
  }, [initialColumnLayout]);

  useEffect(() => {
    initializeCustomFonts().then((fonts) => {
      setCustomFonts(fonts);
    });
  }, []);

  const [paperFormat, setPaperFormat] = useState<"letter" | "a4">(() => {
    if (initialPages[0] && initialPages[0].width < 605) return "a4";
    return "letter";
  });

  const targetPreset =
    PAPER_FORMAT_PRESETS.find((p) => p.id === paperFormat) || PAPER_FORMAT_PRESETS[0]!;

  const [pageMargin, setPageMargin] = useState<number>(40);
  const [zoom, setZoom] = useState<number>(1);
  const [activePageIndex, setActivePageIndex] = useState<number>(0);

  const [pages, setPages] = useState<CanvasPage[]>(() => {
    const count = Math.max(initialPages.length, 1);
    return Array.from({ length: count }, (_, i) => ({
      id: `page-${i + 1}`,
      pageNumber: i + 1,
      width: targetPreset.width,
      height: targetPreset.height,
    }));
  });

  // Track active toolbar styling states
  const [isBold, setIsBold] = useState(false);
  const [isItalic, setIsItalic] = useState(false);
  const [isUnderline, setIsUnderline] = useState(false);
  const [isStrikethrough, setIsStrikethrough] = useState(false);
  const [currentAlign, setCurrentAlign] = useState<"left" | "center" | "right" | "justify">("left");
  const [currentFontFamily, setCurrentFontFamily] = useState<string>("Calibri, sans-serif");
  const [currentFontSize, setCurrentFontSize] = useState<number>(9.5);
  const [currentColor, setCurrentColor] = useState<string>("#111827");
  const [currentStyle, setCurrentStyle] = useState<string>("Normal text");
  const [currentLineHeight, setCurrentLineHeight] = useState<number>(1.25);
  const [currentLetterSpacing, setCurrentLetterSpacing] = useState<number>(0);

  // History stack for Undo / Redo
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const historyStack = useRef<string[]>([]);
  const redoStack = useRef<string[]>([]);

  // Page editable container refs
  const pageRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastEmittedBlocksJsonRef = useRef<string>("");
  const isLocalTypingRef = useRef<boolean>(false);
  const prevPaperThemeRef = useRef<string>(paperTheme);
  const initializedPagesRef = useRef<Set<number>>(new Set());

  // Synchronize initialPages prop changes
  useEffect(() => {
    if (initialPages && initialPages.length > 0) {
      const isDifferentLength = initialPages.length !== pages.length;
      const isDifferentIds = initialPages.some((p, i) => pages[i]?.id !== p.id);
      if (isDifferentLength || isDifferentIds) {
        setPages(
          initialPages.map((p, i) => ({
            ...p,
            pageNumber: i + 1,
            id: p.id || `page-${i + 1}`,
            width: targetPreset.width,
            height: targetPreset.height,
          })),
        );
      }
    }
  }, [initialPages, pages, targetPreset.height, targetPreset.width]);

  // Load and synchronize HTML into page editable areas without blowing away user caret
  useEffect(() => {
    const incomingJson = JSON.stringify(initialBlocks);
    const isSelfUpdate = incomingJson === lastEmittedBlocksJsonRef.current;
    const themeChanged = prevPaperThemeRef.current !== paperTheme;
    prevPaperThemeRef.current = paperTheme;

    // If update was emitted by our own editor and theme did not change, NEVER touch the DOM!
    if (isSelfUpdate && !themeChanged) {
      return;
    }

    lastEmittedBlocksJsonRef.current = incomingJson;

    pages.forEach((_, pageIdx) => {
      const pageEl = pageRefs.current.get(pageIdx);
      if (pageEl) {
        const isFocusedInThisPage =
          pageEl === document.activeElement || pageEl.contains(document.activeElement);

        // If user is actively typing in this page and this isn't a theme change, don't overwrite
        if (isFocusedInThisPage && isLocalTypingRef.current && !themeChanged) {
          return;
        }

        const savedOffset = isFocusedInThisPage ? getCaretOffsetWithin(pageEl) : 0;
        const pageBlocks = initialBlocks.filter((b) => (b.pageIndex ?? 0) === pageIdx);
        pageEl.innerHTML = parseBlocksToHtml(pageBlocks, paperTheme);
        initializedPagesRef.current.add(pageIdx);

        if (isFocusedInThisPage && savedOffset > 0) {
          restoreCaretOffsetWithin(pageEl, savedOffset);
        }
      }
    });
  }, [initialBlocks, pages, paperTheme]);

  // Clean up debounce timer
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, []);

  // Update selection styles and active states when user moves caret or clicks
  const updateActiveFormatStates = useCallback(() => {
    try {
      setIsBold(document.queryCommandState("bold"));
      setIsItalic(document.queryCommandState("italic"));
      setIsUnderline(document.queryCommandState("underline"));
      setIsStrikethrough(document.queryCommandState("strikeThrough"));

      if (document.queryCommandState("justifyCenter")) setCurrentAlign("center");
      else if (document.queryCommandState("justifyRight")) setCurrentAlign("right");
      else if (document.queryCommandState("justifyFull")) setCurrentAlign("justify");
      else setCurrentAlign("left");

      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0) {
        let node: Node | null = sel.anchorNode;
        if (node && node.nodeType === Node.TEXT_NODE) node = node.parentNode;
        const el = (node as HTMLElement)?.closest?.(".doc-block, h1, h2, h3, p, div") as HTMLElement | null;
        if (el) {
          const comp = window.getComputedStyle(el);
          const sz =
            parseFloat(el.style.fontSize) ||
            Math.round((parseFloat(comp.fontSize) / 1.333) * 10) / 10 ||
            9.5;
          setCurrentFontSize(sz);

          const font = el.style.fontFamily || comp.fontFamily;
          if (font) setCurrentFontFamily(font);

          const clr = el.style.color || comp.color;
          if (clr) setCurrentColor(clr);

          const lh = parseFloat(el.style.lineHeight) || 1.25;
          setCurrentLineHeight(lh);

          // Detect style preset
          if (el.classList.contains("doc-title") || sz >= 18 || el.tagName === "H1") {
            setCurrentStyle("Title");
          } else if (el.classList.contains("doc-heading") || sz >= 12.5 || el.tagName === "H2") {
            setCurrentStyle("Heading 1");
          } else if (sz >= 11 && (el.style.fontWeight === "bold" || parseInt(comp.fontWeight, 10) >= 600)) {
            setCurrentStyle("Heading 2");
          } else if (sz >= 10 && (el.style.fontWeight === "bold" || parseInt(comp.fontWeight, 10) >= 600)) {
            setCurrentStyle("Heading 3");
          } else if (sz <= 11.5 && sz >= 10.5 && comp.color.includes("100")) {
            setCurrentStyle("Subtitle");
          } else {
            setCurrentStyle("Normal text");
          }

          const blockId = el.getAttribute("data-block-id");
          if (blockId && onSelectBlock) {
            onSelectBlock(blockId);
          }
        }
      }
    } catch {
      // Ignore if document query is not supported in environment
    }
  }, [onSelectBlock]);

  // Synchronize document DOM state back to CanvasTextBlock[]
  const syncToBlocks = useCallback(() => {
    isLocalTypingRef.current = true;
    const allBlocks: CanvasTextBlock[] = [];

    pages.forEach((_, pIdx) => {
      const pageEl = pageRefs.current.get(pIdx);
      if (pageEl) {
        const pageBlocks = serializeHtmlToBlocks(pageEl, pIdx, targetPreset.width);
        allBlocks.push(...pageBlocks);
      }
    });

    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      lastEmittedBlocksJsonRef.current = JSON.stringify(allBlocks);
      onChange(allBlocks, pages);
      setTimeout(() => {
        isLocalTypingRef.current = false;
      }, 400);
    }, 250);
  }, [pages, targetPreset.width, onChange]);

  // Capture snapshot for history stack
  const captureHistory = useCallback(() => {
    const pageEl = pageRefs.current.get(activePageIndex);
    if (!pageEl) return;
    const currentHtml = pageEl.innerHTML;
    historyStack.current.push(currentHtml);
    if (historyStack.current.length > 40) historyStack.current.shift();
    redoStack.current = [];
    setCanUndo(true);
    setCanRedo(false);
  }, [activePageIndex]);

  const handleUndo = useCallback(() => {
    const pageEl = pageRefs.current.get(activePageIndex);
    if (!pageEl || historyStack.current.length === 0) return;
    const prev = historyStack.current.pop()!;
    redoStack.current.push(pageEl.innerHTML);
    pageEl.innerHTML = prev;
    setCanUndo(historyStack.current.length > 0);
    setCanRedo(true);
    syncToBlocks();
    updateActiveFormatStates();
  }, [activePageIndex, syncToBlocks, updateActiveFormatStates]);

  const handleRedo = useCallback(() => {
    const pageEl = pageRefs.current.get(activePageIndex);
    if (!pageEl || redoStack.current.length === 0) return;
    const next = redoStack.current.pop()!;
    historyStack.current.push(pageEl.innerHTML);
    pageEl.innerHTML = next;
    setCanUndo(true);
    setCanRedo(redoStack.current.length > 0);
    syncToBlocks();
    updateActiveFormatStates();
  }, [activePageIndex, syncToBlocks, updateActiveFormatStates]);

  // Rich-text execution helpers
  const execFormat = useCallback(
    (command: string, value: string | undefined = undefined) => {
      captureHistory();
      document.execCommand(command, false, value);
      syncToBlocks();
      updateActiveFormatStates();
    },
    [captureHistory, syncToBlocks, updateActiveFormatStates],
  );

  // Toggle bold, italic, underline, strikethrough with Word / Google Docs auto-word selection
  const handleToggleFormat = useCallback(
    (command: "bold" | "italic" | "underline" | "strikeThrough") => {
      captureHistory();
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0 && sel.isCollapsed) {
        // Expand selection to word under cursor
        sel.modify("move", "backward", "word");
        sel.modify("extend", "forward", "word");
      }
      document.execCommand(command, false);
      syncToBlocks();
      updateActiveFormatStates();
    },
    [captureHistory, syncToBlocks, updateActiveFormatStates],
  );

  // Apply color with Word / Google Docs auto-word selection
  const handleApplyColor = useCallback(
    (colorValue: string) => {
      captureHistory();
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0 && sel.isCollapsed) {
        sel.modify("move", "backward", "word");
        sel.modify("extend", "forward", "word");
      }
      document.execCommand("foreColor", false, colorValue);
      setCurrentColor(colorValue);
      syncToBlocks();
      updateActiveFormatStates();
    },
    [captureHistory, syncToBlocks, updateActiveFormatStates],
  );

  // Apply highlight with Word / Google Docs auto-word selection
  const handleApplyHighlight = useCallback(
    (bgColorValue: string) => {
      captureHistory();
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0 && sel.isCollapsed) {
        sel.modify("move", "backward", "word");
        sel.modify("extend", "forward", "word");
      }
      if (bgColorValue === "transparent") {
        document.execCommand("removeFormat", false);
      } else {
        document.execCommand("hiliteColor", false, bgColorValue);
      }
      syncToBlocks();
      updateActiveFormatStates();
    },
    [captureHistory, syncToBlocks, updateActiveFormatStates],
  );

  // Apply style preset (Normal text, Title, Heading 1, etc.) to currently active block
  const handleApplyStylePreset = useCallback(
    (preset: (typeof STYLE_PRESETS)[0]) => {
      captureHistory();
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) return;

      let node: Node | null = sel.anchorNode;
      if (node && node.nodeType === Node.TEXT_NODE) node = node.parentNode;
      const el = (node as HTMLElement)?.closest?.(".doc-block, h1, h2, h3, p, div") as HTMLElement | null;

      if (el) {
        el.style.fontSize = `${preset.fontSize}pt`;
        el.style.fontWeight = preset.bold ? "700" : "400";
        el.style.color = preset.color;
        el.style.marginTop = `${preset.spaceBefore}px`;
        el.style.marginBottom = `${preset.spaceAfter}px`;
        if (preset.label === "Title") {
          el.className = "doc-block doc-title";
        } else if (preset.label.startsWith("Heading")) {
          el.className = "doc-block doc-heading";
        } else {
          el.className = "doc-block";
        }
      }
      setCurrentStyle(preset.label);
      setCurrentFontSize(preset.fontSize);
      setCurrentColor(preset.color);
      setIsBold(preset.bold);
      syncToBlocks();
    },
    [captureHistory, syncToBlocks],
  );

  // Apply font size adjustment
  const handleApplyFontSize = useCallback(
    (newSize: number) => {
      captureHistory();
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) return;

      const sizePt = Math.max(7, Math.min(36, newSize));
      let node: Node | null = sel.anchorNode;
      if (node && node.nodeType === Node.TEXT_NODE) node = node.parentNode;
      const el = (node as HTMLElement)?.closest?.(".doc-block, div, p") as HTMLElement | null;

      if (el) {
        el.style.fontSize = `${sizePt}pt`;
      }
      setCurrentFontSize(sizePt);
      syncToBlocks();
    },
    [captureHistory, syncToBlocks],
  );

  // Apply Font Family
  const handleApplyFontFamily = useCallback(
    (fontFamily: string) => {
      captureHistory();
      execFormat("fontName", fontFamily);
      setCurrentFontFamily(fontFamily);
      syncToBlocks();
    },
    [captureHistory, execFormat, syncToBlocks],
  );

  // Apply Line Height
  const handleApplyLineHeight = useCallback(
    (lh: number) => {
      captureHistory();
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) return;

      let node: Node | null = sel.anchorNode;
      if (node && node.nodeType === Node.TEXT_NODE) node = node.parentNode;
      const el = (node as HTMLElement)?.closest?.(".doc-block, div, p") as HTMLElement | null;
      if (el) {
        el.style.lineHeight = `${lh}`;
      }
      setCurrentLineHeight(lh);
      syncToBlocks();
    },
    [captureHistory, syncToBlocks],
  );

  // Bullet toggle on current line / selection
  const handleToggleBullet = useCallback(() => {
    captureHistory();
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;

    let node: Node | null = sel.anchorNode;
    if (node && node.nodeType === Node.TEXT_NODE) node = node.parentNode;
    const el = (node as HTMLElement)?.closest?.(".doc-block, div, p") as HTMLElement | null;

    if (el) {
      const currentText = el.innerText || "";
      if (currentText.trim().startsWith("•")) {
        el.innerText = currentText.replace(/^[\u2022\u25cf\u25cb\u25aa\u25b8\uf0b7\u00b7\u2013\u2014■●○►*•]\s*/, "");
        el.style.paddingLeft = "0px";
      } else {
        el.innerText = "• " + currentText.trim();
        el.style.paddingLeft = "14px";
      }
    }
    syncToBlocks();
    updateActiveFormatStates();
  }, [captureHistory, syncToBlocks, updateActiveFormatStates]);

  // Numbered list toggle
  const handleToggleNumbered = useCallback(() => {
    captureHistory();
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;

    let node: Node | null = sel.anchorNode;
    if (node && node.nodeType === Node.TEXT_NODE) node = node.parentNode;
    const el = (node as HTMLElement)?.closest?.(".doc-block, div, p") as HTMLElement | null;

    if (el) {
      const currentText = el.innerText || "";
      if (NUMBERED_PREFIX_REGEX.test(currentText.trim())) {
        el.innerText = currentText.replace(NUMBERED_PREFIX_REGEX, "");
        el.style.paddingLeft = "0px";
      } else {
        el.innerText = "1. " + currentText.trim();
        el.style.paddingLeft = "14px";
      }
    }
    syncToBlocks();
    updateActiveFormatStates();
  }, [captureHistory, syncToBlocks, updateActiveFormatStates]);

  // Indent / Outdent
  const handleIndent = useCallback(
    (deltaPx: number) => {
      captureHistory();
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) return;

      let node: Node | null = sel.anchorNode;
      if (node && node.nodeType === Node.TEXT_NODE) node = node.parentNode;
      const el = (node as HTMLElement)?.closest?.(".doc-block, div, p") as HTMLElement | null;

      if (el) {
        const curIndent = parseFloat(el.style.paddingLeft) || 0;
        const newIndent = Math.max(0, curIndent + deltaPx);
        el.style.paddingLeft = `${newIndent}px`;
      }
      syncToBlocks();
    },
    [captureHistory, syncToBlocks],
  );

  // Insert a new empty line at cursor
  const handleInsertEmptyLine = useCallback(() => {
    captureHistory();
    const pageEl = pageRefs.current.get(activePageIndex);
    if (!pageEl) return;

    const newDiv = document.createElement("div");
    newDiv.className = "doc-block";
    newDiv.style.fontSize = "9.5pt";
    newDiv.style.fontFamily = currentFontFamily;
    newDiv.style.color = "#111827";
    newDiv.style.lineHeight = "1.25";
    newDiv.style.marginTop = "2px";
    newDiv.style.marginBottom = "2px";
    newDiv.innerHTML = "<br>";

    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      let node: Node | null = sel.anchorNode;
      if (node && node.nodeType === Node.TEXT_NODE) node = node.parentNode;
      const curBlock = (node as HTMLElement)?.closest?.(".doc-block, div, p, table") as HTMLElement | null;
      if (curBlock && curBlock.parentNode === pageEl) {
        curBlock.insertAdjacentElement("afterend", newDiv);
      } else {
        pageEl.appendChild(newDiv);
      }
    } else {
      pageEl.appendChild(newDiv);
    }

    // Set caret into new line
    const range = document.createRange();
    range.setStart(newDiv, 0);
    range.collapse(true);
    sel?.removeAllRanges();
    sel?.addRange(range);

    syncToBlocks();
    updateActiveFormatStates();
  }, [activePageIndex, currentFontFamily, captureHistory, syncToBlocks, updateActiveFormatStates]);

  // Insert a divider line
  const handleInsertDivider = useCallback(
    (style: DividerStyle = "solid", color: string = "#cbd5e1") => {
      captureHistory();
      const pageEl = pageRefs.current.get(activePageIndex);
      if (!pageEl) return;

      const dividerDiv = document.createElement("div");
      dividerDiv.setAttribute("data-divider", "true");
      dividerDiv.setAttribute("contenteditable", "false");
      let borderStyle = "solid";
      let borderWidth = "1px";
      if (style === "dashed") borderStyle = "dashed";
      else if (style === "dotted") borderStyle = "dotted";
      else if (style === "double") {
        borderStyle = "double";
        borderWidth = "3px";
      } else if (style === "thick") {
        borderWidth = "2px";
      }

      dividerDiv.style.border = "none";
      dividerDiv.style.borderBottom = `${borderWidth} ${borderStyle} ${color}`;
      dividerDiv.style.margin = "10px 0";
      dividerDiv.style.userSelect = "none";

      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0) {
        let node: Node | null = sel.anchorNode;
        if (node && node.nodeType === Node.TEXT_NODE) node = node.parentNode;
        const curBlock = (node as HTMLElement)?.closest?.(".doc-block, div, p, table") as HTMLElement | null;
        if (curBlock && curBlock.parentNode === pageEl) {
          curBlock.insertAdjacentElement("afterend", dividerDiv);
        } else {
          pageEl.appendChild(dividerDiv);
        }
      } else {
        pageEl.appendChild(dividerDiv);
      }

      syncToBlocks();
    },
    [activePageIndex, captureHistory, syncToBlocks],
  );

  // Insert a table
  const handleInsertTable = useCallback(
    (tbl: (typeof TABLE_PRESETS)[0]) => {
      captureHistory();
      const pageEl = pageRefs.current.get(activePageIndex);
      if (!pageEl) return;

      const tableWrapper = document.createElement("div");
      tableWrapper.setAttribute("data-table", "true");
      tableWrapper.style.margin = "8px 0";
      tableWrapper.style.overflowX = "auto";

      const table = document.createElement("table");
      table.style.width = "100%";
      table.style.borderCollapse = "collapse";
      table.style.border = "1px solid #cbd5e1";
      table.style.fontFamily = currentFontFamily;

      const tbody = document.createElement("tbody");
      tbl.cells.forEach((rowCells, rIdx) => {
        const tr = document.createElement("tr");
        const isHeaderRow = rIdx === 0 && tbl.headers;
        rowCells.forEach((cellText) => {
          const td = document.createElement("td");
          td.style.border = "1px solid #cbd5e1";
          td.style.padding = "6px 8px";
          td.style.fontSize = "9.5pt";
          if (isHeaderRow) {
            td.style.fontWeight = "600";
            td.style.backgroundColor = "rgba(241, 245, 249, 0.6)";
          }
          td.innerText = cellText;
          tr.appendChild(td);
        });
        tbody.appendChild(tr);
      });
      table.appendChild(tbody);
      tableWrapper.appendChild(table);

      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0) {
        let node: Node | null = sel.anchorNode;
        if (node && node.nodeType === Node.TEXT_NODE) node = node.parentNode;
        const curBlock = (node as HTMLElement)?.closest?.(".doc-block, div, p, table") as HTMLElement | null;
        if (curBlock && curBlock.parentNode === pageEl) {
          curBlock.insertAdjacentElement("afterend", tableWrapper);
        } else {
          pageEl.appendChild(tableWrapper);
        }
      } else {
        pageEl.appendChild(tableWrapper);
      }

      syncToBlocks();
    },
    [activePageIndex, currentFontFamily, captureHistory, syncToBlocks],
  );

  // Move current block up or down
  const handleMoveBlock = useCallback(
    (direction: "up" | "down") => {
      captureHistory();
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) return;

      let node: Node | null = sel.anchorNode;
      if (node && node.nodeType === Node.TEXT_NODE) node = node.parentNode;
      const el = (node as HTMLElement)?.closest?.(".doc-block, div, p, table") as HTMLElement | null;

      if (el && el.parentElement) {
        if (direction === "up" && el.previousElementSibling) {
          el.parentElement.insertBefore(el, el.previousElementSibling);
        } else if (direction === "down" && el.nextElementSibling) {
          el.parentElement.insertBefore(el.nextElementSibling, el);
        }
      }
      syncToBlocks();
    },
    [captureHistory, syncToBlocks],
  );

  // Delete current block or selected text
  const handleDelete = useCallback(() => {
    captureHistory();
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;

    if (!sel.isCollapsed) {
      document.execCommand("delete");
    } else {
      let node: Node | null = sel.anchorNode;
      if (node && node.nodeType === Node.TEXT_NODE) node = node.parentNode;
      const el = (node as HTMLElement)?.closest?.(".doc-block, div, p, table") as HTMLElement | null;
      if (el) {
        el.remove();
      }
    }
    syncToBlocks();
    updateActiveFormatStates();
  }, [captureHistory, syncToBlocks, updateActiveFormatStates]);

  // Clear Formatting
  const handleClearFormatting = useCallback(() => {
    captureHistory();
    document.execCommand("removeFormat");
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      let node: Node | null = sel.anchorNode;
      if (node && node.nodeType === Node.TEXT_NODE) node = node.parentNode;
      const el = (node as HTMLElement)?.closest?.(".doc-block, div, p") as HTMLElement | null;
      if (el) {
        el.style.fontSize = "9.5pt";
        el.style.fontWeight = "400";
        el.style.fontStyle = "normal";
        el.style.textDecoration = "none";
        el.style.color = "#111827";
        el.style.backgroundColor = "transparent";
        el.style.textAlign = "left";
        el.className = "doc-block";
      }
    }
    syncToBlocks();
    updateActiveFormatStates();
  }, [captureHistory, syncToBlocks, updateActiveFormatStates]);

  // Add Page
  const handleAddPage = useCallback(() => {
    const newPageIdx = pages.length;
    const newPages: CanvasPage[] = [
      ...pages,
      {
        id: `page-${newPageIdx + 1}`,
        pageNumber: newPageIdx + 1,
        width: targetPreset.width,
        height: targetPreset.height,
      },
    ];
    setPages(newPages);
    setActivePageIndex(newPageIdx);
  }, [pages, targetPreset]);

  // Remove Page
  const handleRemovePage = useCallback(
    (pageIndex: number) => {
      if (pages.length <= 1) return;
      const updated = pages
        .filter((_, idx) => idx !== pageIndex)
        .map((p, i) => ({ ...p, pageNumber: i + 1, id: `page-${i + 1}` }));
      setPages(updated);
      setActivePageIndex(Math.max(0, pageIndex - 1));
      syncToBlocks();
    },
    [pages, syncToBlocks],
  );

  // Toggle Paper Theme (White Paper vs Dark Paper)
  const handleTogglePaperTheme = useCallback(() => {
    setPaperTheme((prev) => {
      const nextTheme = prev === "white" ? "dark" : "white";
      const fromDefaultText = nextTheme === "dark" ? "#111827" : "#f8fafc";
      const toDefaultText = nextTheme === "dark" ? "#f8fafc" : "#111827";
      const fromHeading = nextTheme === "dark" ? "#1e3a8a" : "#60a5fa";
      const toHeading = nextTheme === "dark" ? "#60a5fa" : "#1e3a8a";

      pages.forEach((_, pIdx) => {
        const pageEl = pageRefs.current.get(pIdx);
        if (!pageEl) return;
        const blocks = Array.from(pageEl.querySelectorAll<HTMLElement>(".doc-block, p, div"));
        blocks.forEach((b) => {
          const curColor = b.style.color;
          if (
            !curColor ||
            curColor === "rgb(17, 24, 39)" ||
            curColor === "#111827" ||
            curColor === fromDefaultText
          ) {
            b.style.color = toDefaultText;
          } else if (
            curColor === "rgb(30, 58, 138)" ||
            curColor === "#1e3a8a" ||
            curColor === fromHeading
          ) {
            b.style.color = toHeading;
          }
        });
      });
      syncToBlocks();
      return nextTheme;
    });
  }, [pages, syncToBlocks]);

  // Global Keyboard Shortcuts (Ctrl+B, Ctrl+I, Ctrl+Z, etc.)
  const handleGlobalKeyDown = useCallback(
    (e: ReactKeyboardEvent) => {
      const isMac =
        typeof navigator !== "undefined" && navigator.platform?.toUpperCase().indexOf("MAC") >= 0;
      const ctrlKey = isMac ? e.metaKey : e.ctrlKey;

      if (ctrlKey) {
        if (e.key === "b" || e.key === "B") {
          e.preventDefault();
          handleToggleFormat("bold");
        } else if (e.key === "i" || e.key === "I") {
          e.preventDefault();
          handleToggleFormat("italic");
        } else if (e.key === "u" || e.key === "U") {
          e.preventDefault();
          handleToggleFormat("underline");
        } else if (e.shiftKey && (e.key === "x" || e.key === "X")) {
          e.preventDefault();
          handleToggleFormat("strikeThrough");
        } else if (e.key === "z" || e.key === "Z") {
          e.preventDefault();
          if (e.shiftKey) handleRedo();
          else handleUndo();
        } else if (e.key === "y" || e.key === "Y") {
          e.preventDefault();
          handleRedo();
        } else if (e.key === "l" || e.key === "L") {
          e.preventDefault();
          execFormat("justifyLeft");
          setCurrentAlign("left");
        } else if (e.key === "e" || e.key === "E") {
          e.preventDefault();
          execFormat("justifyCenter");
          setCurrentAlign("center");
        } else if (e.key === "r" || e.key === "R") {
          e.preventDefault();
          execFormat("justifyRight");
          setCurrentAlign("right");
        } else if (e.key === "j" || e.key === "J") {
          e.preventDefault();
          execFormat("justifyFull");
          setCurrentAlign("justify");
        } else if (e.key === "]" || (e.shiftKey && e.key === ">")) {
          e.preventDefault();
          handleApplyFontSize(currentFontSize + 1);
        } else if (e.key === "[" || (e.shiftKey && e.key === "<")) {
          e.preventDefault();
          handleApplyFontSize(currentFontSize - 1);
        } else if (e.key === "\\") {
          e.preventDefault();
          handleClearFormatting();
        } else if (e.shiftKey && e.key === "8") {
          e.preventDefault();
          handleToggleBullet();
        } else if (e.shiftKey && e.key === "7") {
          e.preventDefault();
          handleToggleNumbered();
        }
      }
    },
    [
      handleToggleFormat,
      execFormat,
      handleUndo,
      handleRedo,
      currentFontSize,
      handleApplyFontSize,
      handleClearFormatting,
      handleToggleBullet,
      handleToggleNumbered,
    ],
  );

  const handleEditorInput = useCallback(
    (pageIdx: number) => {
      isLocalTypingRef.current = true;
      const pageEl = pageRefs.current.get(pageIdx);
      if (pageEl) {
        // If user backspaced all content on the page, ensure a blank line exists so caret never breaks
        if (
          pageEl.children.length === 0 ||
          !pageEl.innerHTML ||
          pageEl.innerHTML.trim() === "" ||
          pageEl.innerHTML === "<br>"
        ) {
          pageEl.innerHTML = `<div class="doc-block" style="font-size: 9.5pt; font-family: ${currentFontFamily}; line-height: 1.25; margin-top: 2px; margin-bottom: 2px;"><br></div>`;
          const sel = window.getSelection();
          if (sel) {
            const firstChild = pageEl.firstElementChild;
            if (firstChild) {
              const range = document.createRange();
              range.setStart(firstChild, 0);
              range.collapse(true);
              sel.removeAllRanges();
              sel.addRange(range);
            }
          }
        }
      }
      syncToBlocks();
      updateActiveFormatStates();
    },
    [currentFontFamily, syncToBlocks, updateActiveFormatStates],
  );

  // Handle typing Enter inside contenteditable: continue bullets naturally
  const handleEditorKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    isLocalTypingRef.current = true;
    if (e.key === "Enter" && !e.shiftKey) {
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0) {
        let node: Node | null = sel.anchorNode;
        if (node && node.nodeType === Node.TEXT_NODE) node = node.parentNode;
        const curBlock = (node as HTMLElement)?.closest?.(".doc-block, div, p") as HTMLElement | null;

        if (curBlock) {
          const text = curBlock.innerText.trim();
          // If bullet line was empty, exit bullet mode
          if (text === "•" || text === "-") {
            e.preventDefault();
            curBlock.innerText = "";
            curBlock.style.paddingLeft = "0px";
            syncToBlocks();
            return;
          }

          // If bullet line had text, continue bullet point
          if (text.startsWith("• ") || text.startsWith("•")) {
            e.preventDefault();
            const newBlock = document.createElement("div");
            newBlock.className = "doc-block";
            newBlock.style.fontSize = curBlock.style.fontSize || "9.5pt";
            newBlock.style.fontFamily = curBlock.style.fontFamily || currentFontFamily;
            newBlock.style.color = curBlock.style.color || "#111827";
            newBlock.style.lineHeight = curBlock.style.lineHeight || "1.25";
            newBlock.style.marginTop = "2px";
            newBlock.style.marginBottom = "2px";
            newBlock.style.paddingLeft = curBlock.style.paddingLeft || "14px";
            newBlock.textContent = "• ";

            curBlock.insertAdjacentElement("afterend", newBlock);

            const range = document.createRange();
            range.setStart(newBlock.firstChild || newBlock, 2);
            range.collapse(true);
            sel.removeAllRanges();
            sel.addRange(range);

            syncToBlocks();
            updateActiveFormatStates();
            return;
          }
        }
      }
    }
  };

  const lastFocusedSpanIdRef = useRef<string | undefined>(undefined);

  // Focus matching text when active bias span changes from review queue
  useEffect(() => {
    if (!activeBiasSpan || !activeBiasSpan.matched_text) return;
    if (activeBiasSpan.id === lastFocusedSpanIdRef.current) return;
    lastFocusedSpanIdRef.current = activeBiasSpan.id;

    // NEVER auto-scroll or steal focus while user is actively editing inside any page
    const isEditorFocused = Array.from(pageRefs.current.values()).some(
      (el) => el === document.activeElement || el.contains(document.activeElement),
    );
    if (isEditorFocused || isLocalTypingRef.current) {
      return;
    }

    pages.forEach((_, pIdx) => {
      const pageEl = pageRefs.current.get(pIdx);
      if (!pageEl) return;
      const divs = Array.from(pageEl.querySelectorAll(".doc-block, div, p"));
      for (const d of divs) {
        const htmlEl = d as HTMLElement;
        if (matchesWordBoundary(htmlEl.innerText, activeBiasSpan.matched_text)) {
          htmlEl.scrollIntoView({ behavior: "smooth", block: "nearest" });
          htmlEl.classList.add("ring-2", "ring-amber-500", "rounded");
          setTimeout(() => {
            htmlEl.classList.remove("ring-2", "ring-amber-500", "rounded");
          }, 2500);
          break;
        }
      }
    });
  }, [activeBiasSpan, pages]);

  return (
    <div
      className="flex flex-col h-full w-full bg-slate-100 dark:bg-zinc-950 rounded-xl border border-border shadow-xs overflow-hidden"
      onKeyDown={handleGlobalKeyDown}
    >
      {/* 1. PROFESSIONAL GOOGLE DOCS / WORD RIBBON TOOLBAR */}
      <div className="bg-card border-b border-border px-3 py-1.5 flex flex-wrap items-center gap-1.5 shadow-xs z-20 select-none">
        {/* Undo / Redo */}
        <div className="flex items-center gap-0.5 shrink-0">
          <Button
            variant="ghost"
            size="icon"
            className="size-7 rounded hover:bg-accent shrink-0"
            title="Undo (Ctrl+Z)"
            disabled={!canUndo}
            onMouseDown={(e) => e.preventDefault()}
            onClick={handleUndo}
          >
            <Undo2 className="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-7 rounded hover:bg-accent shrink-0"
            title="Redo (Ctrl+Y)"
            disabled={!canRedo}
            onMouseDown={(e) => e.preventDefault()}
            onClick={handleRedo}
          >
            <Redo2 className="size-3.5" />
          </Button>
        </div>

        <div className="h-4 w-px bg-border/80 mx-1 shrink-0" />

        {/* Paragraph Style Dropdown */}
        <div className="flex items-center shrink-0">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs font-medium px-2.5 w-[114px] shrink-0 justify-between gap-1 text-foreground"
                title="Paragraph Style (Normal, Heading 1, etc.)"
              >
                <span className="truncate text-left flex-1">{currentStyle}</span>
                <ChevronDown className="size-3 opacity-60 shrink-0" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-52">
              <DropdownMenuLabel className="text-[10px] text-muted-foreground uppercase font-semibold">
                Paragraph Style
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {STYLE_PRESETS.map((st) => (
                <DropdownMenuItem
                  key={st.label}
                  className="cursor-pointer flex items-center justify-between py-2 px-3 hover:bg-accent focus:bg-accent"
                  onSelect={() => handleApplyStylePreset(st)}
                >
                  <span
                    className={cn(
                      st.label === "Title" && "text-base font-bold text-foreground",
                      st.label === "Subtitle" && "text-xs font-normal text-muted-foreground",
                      st.label === "Heading 1" && "text-sm font-bold text-foreground",
                      st.label === "Heading 2" && "text-xs font-semibold text-foreground",
                      st.label === "Heading 3" && "text-xs font-medium text-foreground",
                      st.label === "Normal text" && "text-xs font-normal text-foreground",
                    )}
                  >
                    {st.label}
                  </span>
                  {currentStyle === st.label && <Check className="size-3 text-primary ml-2" />}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Font Family Selector */}
        <div className="flex items-center shrink-0">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs font-medium px-2.5 w-[124px] shrink-0 justify-between gap-1 text-foreground"
                title="Font Family"
              >
                <span className="truncate text-left flex-1">
                  {FONT_FAMILIES.find((f) => f.value === currentFontFamily)?.label.split(" ")[0] ||
                    currentFontFamily.split(",")[0]?.replace(/['"]/g, "") ||
                    "Calibri"}
                </span>
                <ChevronDown className="size-3 shrink-0 opacity-60" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-60 max-h-72 overflow-y-auto">
              {customFonts.length > 0 && (
                <>
                  <DropdownMenuLabel className="text-[10px] text-muted-foreground uppercase font-semibold">
                    Custom Fonts
                  </DropdownMenuLabel>
                  {customFonts.map((font) => (
                    <DropdownMenuItem
                      key={font.id}
                      className={cn(
                        "cursor-pointer text-xs flex items-center justify-between text-foreground",
                        currentFontFamily === font.family && "bg-accent font-semibold",
                      )}
                      style={{ fontFamily: font.family }}
                      onSelect={() => handleApplyFontFamily(font.family)}
                    >
                      <span className="truncate">{font.name}</span>
                      {currentFontFamily === font.family && (
                        <Check className="size-3.5 text-primary" />
                      )}
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator />
                </>
              )}
              <DropdownMenuLabel className="text-[10px] text-muted-foreground uppercase font-semibold">
                Document Fonts
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {FONT_FAMILIES.map((font) => (
                <DropdownMenuItem
                  key={font.value}
                  className={cn(
                    "cursor-pointer text-xs flex items-center justify-between text-foreground",
                    currentFontFamily === font.value && "bg-accent font-semibold",
                  )}
                  style={{ fontFamily: font.value }}
                  onSelect={() => handleApplyFontFamily(font.value)}
                >
                  <span>{font.label}</span>
                  {currentFontFamily === font.value && <Check className="size-3.5 text-primary" />}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="cursor-pointer text-xs font-medium text-primary flex items-center gap-2"
                onSelect={() => setFontUploadModalOpen(true)}
              >
                <Upload className="size-3.5" />
                <span>+ Upload Custom Font...</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Font Size Selector (- / Dropdown / +) */}
        <div className="flex items-center border border-border rounded overflow-hidden shrink-0">
          <Button
            variant="ghost"
            size="icon"
            className="w-6 h-7 rounded-none px-1 text-xs hover:bg-accent shrink-0"
            title="Decrease Font Size (Ctrl+[)"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => handleApplyFontSize(currentFontSize - 0.5)}
          >
            -
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="h-7 w-9 text-xs font-mono font-semibold hover:bg-accent focus:outline-hidden text-foreground text-center shrink-0 cursor-pointer"
                title="Font Size in Points"
              >
                {currentFontSize}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="min-w-16 max-h-48 overflow-y-auto">
              {PRESET_FONT_SIZES.map((sz) => (
                <DropdownMenuItem
                  key={sz}
                  className="text-xs font-mono justify-center cursor-pointer text-foreground"
                  onSelect={() => handleApplyFontSize(sz)}
                >
                  {sz}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            variant="ghost"
            size="icon"
            className="w-6 h-7 rounded-none px-1 text-xs hover:bg-accent shrink-0"
            title="Increase Font Size (Ctrl+])"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => handleApplyFontSize(currentFontSize + 0.5)}
          >
            +
          </Button>
        </div>

        <div className="h-4 w-px bg-border/80 mx-1 shrink-0" />

        {/* Bold, Italic, Underline, Strikethrough, Color, Highlight */}
        <div className="flex items-center gap-0.5 shrink-0">
          <Button
            variant={isBold ? "secondary" : "ghost"}
            size="icon"
            className={cn("size-7 rounded font-bold shrink-0", isBold && "bg-accent text-accent-foreground")}
            title="Bold (Ctrl+B)"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => handleToggleFormat("bold")}
          >
            <Bold className="size-3.5" />
          </Button>
          <Button
            variant={isItalic ? "secondary" : "ghost"}
            size="icon"
            className={cn("size-7 rounded shrink-0", isItalic && "bg-accent text-accent-foreground")}
            title="Italic (Ctrl+I)"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => handleToggleFormat("italic")}
          >
            <Italic className="size-3.5" />
          </Button>
          <Button
            variant={isUnderline ? "secondary" : "ghost"}
            size="icon"
            className={cn("size-7 rounded shrink-0", isUnderline && "bg-accent text-accent-foreground")}
            title="Underline (Ctrl+U)"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => handleToggleFormat("underline")}
          >
            <Underline className="size-3.5" />
          </Button>
          <Button
            variant={isStrikethrough ? "secondary" : "ghost"}
            size="icon"
            className={cn("size-7 rounded shrink-0", isStrikethrough && "bg-accent text-accent-foreground")}
            title="Strikethrough (Ctrl+Shift+X)"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => handleToggleFormat("strikeThrough")}
          >
            <Strikethrough className="size-3.5" />
          </Button>

          {/* Text Color Picker */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onMouseDown={(e) => e.preventDefault()}
                className="size-7 rounded flex flex-col items-center justify-center p-0 hover:bg-accent shrink-0"
                title="Text Color"
              >
                <span className="text-[11px] font-bold leading-none">A</span>
                <span
                  className="h-1 w-3.5 rounded-full mt-0.5"
                  style={{ backgroundColor: currentColor }}
                />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56 p-2">
              <DropdownMenuLabel className="text-[10px] text-muted-foreground uppercase font-semibold">
                Text Color
              </DropdownMenuLabel>
              <div className="grid grid-cols-6 gap-1.5 py-1">
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    title={c.label}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => handleApplyColor(c.value)}
                    className={cn(
                      "size-6 rounded-md border border-border/80 flex items-center justify-center transition-transform hover:scale-110",
                      currentColor === c.value && "ring-2 ring-primary ring-offset-1",
                      c.value === "#ffffff" && "border-slate-400 bg-white shadow-xs",
                    )}
                    style={{ backgroundColor: c.value }}
                  >
                    {c.value === "#ffffff" && (
                      <span className="text-[8px] font-bold text-slate-400">W</span>
                    )}
                  </button>
                ))}
              </div>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Highlight Color Picker */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onMouseDown={(e) => e.preventDefault()}
                className="size-7 rounded flex flex-col items-center justify-center p-0 hover:bg-accent shrink-0"
                title="Highlight Color"
              >
                <Highlighter className="size-3.5" />
                <span className="h-1 w-3.5 rounded-full bg-amber-300" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56 p-2">
              <DropdownMenuLabel className="text-[10px] text-muted-foreground uppercase font-semibold">
                Highlight Color
              </DropdownMenuLabel>
              <div className="grid grid-cols-7 gap-1.5 py-1">
                {PRESET_HIGHLIGHT_COLORS.map((hc) => (
                  <button
                    key={hc.value}
                    type="button"
                    title={hc.label}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => handleApplyHighlight(hc.value)}
                    className={cn(
                      "size-6 rounded-md border border-border flex items-center justify-center transition-transform hover:scale-110",
                      hc.value === "#ffffff" && "border-slate-400 bg-white shadow-xs",
                    )}
                    style={{ backgroundColor: hc.value === "transparent" ? "#ffffff" : hc.value }}
                  >
                    {hc.value === "transparent" ? (
                      <Minus className="size-3 text-slate-400" />
                    ) : hc.value === "#ffffff" ? (
                      <span className="text-[8px] font-bold text-slate-400">W</span>
                    ) : null}
                  </button>
                ))}
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="h-4 w-px bg-border/80 mx-1 shrink-0" />

        {/* Alignment Controls */}
        <div className="flex items-center gap-0.5 shrink-0">
          <Button
            variant={currentAlign === "left" ? "secondary" : "ghost"}
            size="icon"
            className="size-7 rounded shrink-0"
            title="Align Left (Ctrl+L)"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              execFormat("justifyLeft");
              setCurrentAlign("left");
            }}
          >
            <AlignLeft className="size-3.5" />
          </Button>
          <Button
            variant={currentAlign === "center" ? "secondary" : "ghost"}
            size="icon"
            className="size-7 rounded shrink-0"
            title="Align Center (Ctrl+E)"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              execFormat("justifyCenter");
              setCurrentAlign("center");
            }}
          >
            <AlignCenter className="size-3.5" />
          </Button>
          <Button
            variant={currentAlign === "right" ? "secondary" : "ghost"}
            size="icon"
            className="size-7 rounded shrink-0"
            title="Align Right (Ctrl+R)"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              execFormat("justifyRight");
              setCurrentAlign("right");
            }}
          >
            <AlignRight className="size-3.5" />
          </Button>
          <Button
            variant={currentAlign === "justify" ? "secondary" : "ghost"}
            size="icon"
            className="size-7 rounded shrink-0"
            title="Justify (Ctrl+J)"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              execFormat("justifyFull");
              setCurrentAlign("justify");
            }}
          >
            <AlignJustify className="size-3.5" />
          </Button>
        </div>

        <div className="h-4 w-px bg-border/80 mx-1 shrink-0" />

        {/* Line Spacing */}
        <div className="flex items-center gap-1 shrink-0">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs px-2 w-[72px] shrink-0 justify-between gap-1"
                title="Line Spacing (1.0x, 1.25x, 1.5x, etc.)"
              >
                <SplitSquareVertical className="size-3.5 text-muted-foreground shrink-0" />
                <span className="text-[11px] font-mono text-center flex-1">
                  {currentLineHeight ? `${currentLineHeight}x` : "1.25x"}
                </span>
                <ChevronDown className="size-3 opacity-60 shrink-0" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-48">
              <DropdownMenuLabel className="text-[10px] text-muted-foreground uppercase font-semibold">
                Line Spacing
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {PRESET_LINE_HEIGHTS.map((lh) => (
                <DropdownMenuItem
                  key={lh.value}
                  className={cn(
                    "text-xs cursor-pointer justify-between text-foreground",
                    currentLineHeight === lh.value && "bg-accent font-semibold",
                  )}
                  onSelect={() => handleApplyLineHeight(lh.value)}
                >
                  <span>{lh.label}</span>
                  {currentLineHeight === lh.value && <Check className="size-3.5 text-primary" />}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Letter Spacing */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs px-2 w-[70px] shrink-0 justify-between gap-1"
                title="Letter Spacing (Kerning)"
              >
                <Space className="size-3.5 text-muted-foreground shrink-0" />
                <span className="text-[11px] font-mono text-center flex-1">
                  {`${currentLetterSpacing}pt`}
                </span>
                <ChevronDown className="size-3 opacity-60 shrink-0" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-44">
              <DropdownMenuLabel className="text-[10px] text-muted-foreground uppercase font-semibold">
                Letter Spacing
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {PRESET_LETTER_SPACINGS.map((ls) => (
                <DropdownMenuItem
                  key={ls.value}
                  className={cn(
                    "text-xs cursor-pointer justify-between text-foreground",
                    currentLetterSpacing === ls.value && "bg-accent font-semibold",
                  )}
                  onSelect={() => {
                    setCurrentLetterSpacing(ls.value);
                    const sel = window.getSelection();
                    if (sel && sel.rangeCount > 0) {
                      let node: Node | null = sel.anchorNode;
                      if (node && node.nodeType === Node.TEXT_NODE) node = node.parentNode;
                      const el = (node as HTMLElement)?.closest?.(".doc-block, div, p") as HTMLElement | null;
                      if (el) el.style.letterSpacing = `${ls.value}pt`;
                    }
                    syncToBlocks();
                  }}
                >
                  <span>{ls.label}</span>
                  {currentLetterSpacing === ls.value && <Check className="size-3.5 text-primary" />}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="h-4 w-px bg-border/80 mx-1 shrink-0" />

        {/* Lists & Indentation Controls */}
        <div className="flex items-center gap-0.5 shrink-0">
          <Button
            variant="ghost"
            size="icon"
            className="size-7 rounded shrink-0"
            title="Bulleted List (Ctrl+Shift+8)"
            onMouseDown={(e) => e.preventDefault()}
            onClick={handleToggleBullet}
          >
            <List className="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-7 rounded shrink-0"
            title="Numbered List (Ctrl+Shift+7)"
            onMouseDown={(e) => e.preventDefault()}
            onClick={handleToggleNumbered}
          >
            <ListOrdered className="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-7 rounded shrink-0"
            title="Decrease Indent (Shift+Tab)"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => handleIndent(-14)}
          >
            <Outdent className="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-7 rounded shrink-0"
            title="Increase Indent (Tab)"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => handleIndent(14)}
          >
            <Indent className="size-3.5" />
          </Button>
        </div>

        <div className="h-4 w-px bg-border/80 mx-1 shrink-0" />

        {/* Quick Insert Actions - NOTICE: "Section" button is completely removed! */}
        <div className="flex items-center gap-1 shrink-0">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs px-2.5 gap-1.5 shrink-0 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
            title="Insert Bullet Point"
            onMouseDown={(e) => e.preventDefault()}
            onClick={handleToggleBullet}
          >
            <List className="size-3.5 text-emerald-600 dark:text-emerald-400" />
            <span className="hidden sm:inline font-medium">Bullet</span>
          </Button>

          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs px-2.5 gap-1.5 shrink-0"
            title="Insert Empty Line"
            onMouseDown={(e) => e.preventDefault()}
            onClick={handleInsertEmptyLine}
          >
            <Plus className="size-3.5 text-primary" />
            <span className="hidden sm:inline font-medium">Line</span>
          </Button>

          {/* Section Divider Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs px-2.5 gap-1.5 shrink-0 hover:bg-slate-100 dark:hover:bg-zinc-800"
                title="Insert Section Divider Rule"
                onMouseDown={(e) => e.preventDefault()}
              >
                <SeparatorHorizontal className="size-3.5 text-slate-600 dark:text-slate-300" />
                <span className="hidden sm:inline font-medium">Divider</span>
                <ChevronDown className="size-2.5 opacity-60" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56">
              <DropdownMenuLabel className="text-[10px] text-muted-foreground uppercase font-semibold">
                Insert Divider Line
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {SECTION_DIVIDER_PRESETS.map((preset) => (
                <DropdownMenuItem
                  key={preset.label}
                  className="cursor-pointer text-xs flex flex-col items-start gap-1 py-1.5"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => handleInsertDivider(preset.style, preset.color)}
                >
                  <span className="font-medium text-foreground">{preset.label}</span>
                  <div
                    className={cn(
                      "w-full h-0 border-t",
                      preset.style === "dashed" && "border-dashed",
                      preset.style === "dotted" && "border-dotted",
                      preset.style === "double" && "border-double border-t-2",
                      preset.style === "thick" && "border-t-2",
                    )}
                    style={{ borderColor: preset.color }}
                  />
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Table / Grid Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs px-2.5 gap-1.5 shrink-0 hover:bg-indigo-50 dark:hover:bg-indigo-950/40"
                title="Insert Table Grid (Skills, Key-Value, Projects)"
                onMouseDown={(e) => e.preventDefault()}
              >
                <TableIcon className="size-3.5 text-indigo-600 dark:text-indigo-400" />
                <span className="hidden sm:inline font-medium">Table</span>
                <ChevronDown className="size-2.5 opacity-60" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56">
              <DropdownMenuLabel className="text-[10px] text-muted-foreground uppercase font-semibold">
                Insert Table Grid
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {TABLE_PRESETS.map((tbl) => (
                <DropdownMenuItem
                  key={tbl.label}
                  className="cursor-pointer text-xs flex flex-col items-start gap-0.5 py-1.5"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => handleInsertTable(tbl)}
                >
                  <span className="font-medium text-foreground">{tbl.label}</span>
                  <span className="text-[10px] text-muted-foreground">
                    {tbl.rows} rows × {tbl.cols} cols {tbl.headers ? "• With Header" : ""}
                  </span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Move Up / Down */}
          <Button
            variant="ghost"
            size="icon"
            className="size-7 rounded shrink-0"
            title="Move Line Up"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => handleMoveBlock("up")}
          >
            <MoveUp className="size-3" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-7 rounded shrink-0"
            title="Move Line Down"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => handleMoveBlock("down")}
          >
            <MoveDown className="size-3" />
          </Button>

          {/* Delete */}
          <Button
            variant="ghost"
            size="icon"
            className="size-7 rounded shrink-0 text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
            title="Delete Selected Text or Line"
            onMouseDown={(e) => e.preventDefault()}
            onClick={handleDelete}
          >
            <Trash2 className="size-3.5" />
          </Button>

          {/* Clear Formatting */}
          <Button
            variant="ghost"
            size="icon"
            className="size-7 rounded shrink-0"
            title="Clear Formatting (Ctrl+\)"
            onMouseDown={(e) => e.preventDefault()}
            onClick={handleClearFormatting}
          >
            <RemoveFormatting className="size-3.5" />
          </Button>
        </div>

        <div className="h-4 w-px bg-border/80 mx-1 shrink-0" />

        {/* Page / Layout Controls */}
        <div className="flex items-center gap-1.5 shrink-0 ml-auto">
          {/* Column Layout */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                onMouseDown={(e) => e.preventDefault()}
                className="h-7 text-xs font-medium px-2.5 gap-1.5 shrink-0"
                title="Page Column Layout"
              >
                <Columns2 className="size-3.5 text-muted-foreground shrink-0" />
                <span className="hidden sm:inline">
                  {COLUMN_LAYOUT_PRESETS.find((c) => c.id === columnLayout)?.label.split(" ")[0] ||
                    "Single"}
                </span>
                <ChevronDown className="size-3 opacity-60 shrink-0" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="text-[10px] text-muted-foreground uppercase font-semibold">
                Column Layout
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {COLUMN_LAYOUT_PRESETS.map((col) => (
                <DropdownMenuItem
                  key={col.id}
                  className="cursor-pointer text-xs flex flex-col items-start gap-0.5 py-1.5"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    setColumnLayout(col.id);
                    if (onColumnLayoutChange) onColumnLayoutChange(col.id);
                  }}
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="font-medium text-foreground">{col.label}</span>
                    {columnLayout === col.id && <Check className="size-3.5 text-primary" />}
                  </div>
                  <span className="text-[10px] text-muted-foreground">{col.desc}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Paper Format (Letter / A4) */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                onMouseDown={(e) => e.preventDefault()}
                className="h-7 text-xs font-medium px-2.5 gap-1.5 shrink-0"
                title="Paper Size Format"
              >
                <Layout className="size-3.5 text-muted-foreground shrink-0" />
                <span className="hidden sm:inline">
                  {paperFormat === "letter" ? "US Letter" : "A4"}
                </span>
                <ChevronDown className="size-3 opacity-60 shrink-0" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuLabel className="text-[10px] text-muted-foreground uppercase font-semibold">
                Paper Dimensions
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {PAPER_FORMAT_PRESETS.map((fmt) => (
                <DropdownMenuItem
                  key={fmt.id}
                  className="cursor-pointer text-xs flex flex-col items-start gap-0.5 py-1.5"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => setPaperFormat(fmt.id as "letter" | "a4")}
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="font-medium text-foreground">{fmt.label}</span>
                    {paperFormat === fmt.id && <Check className="size-3.5 text-primary" />}
                  </div>
                  <span className="text-[10px] text-muted-foreground">{fmt.desc}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Margins */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                onMouseDown={(e) => e.preventDefault()}
                className="h-7 text-xs font-medium px-2 gap-1 shrink-0"
                title="Page Margins"
              >
                <span className="text-[11px] font-mono">
                  {pageMargin === 54 ? "1 in" : pageMargin === 40 ? "0.75 in" : "0.5 in"}
                </span>
                <ChevronDown className="size-3 opacity-60 shrink-0" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel className="text-[10px] text-muted-foreground uppercase font-semibold">
                Page Margins
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {MARGIN_OPTIONS.map((m) => (
                <DropdownMenuItem
                  key={m.value}
                  className="cursor-pointer text-xs justify-between"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => setPageMargin(m.value)}
                >
                  <span>{m.label}</span>
                  {pageMargin === m.value && <Check className="size-3.5 text-primary" />}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Add Page */}
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs px-2.5 gap-1.5 shrink-0 bg-primary/5 hover:bg-primary/10 border-primary/20 text-primary"
            title="Add New Document Page"
            onMouseDown={(e) => e.preventDefault()}
            onClick={handleAddPage}
          >
            <Plus className="size-3.5" />
            <span className="hidden sm:inline font-medium">Add Page</span>
          </Button>

          {/* Paper Theme Mode Toggle (White Paper / Dark Paper) */}
          <Button
            variant="outline"
            size="sm"
            className={cn(
              "h-7 text-xs px-2.5 gap-1.5 shrink-0 transition-colors",
              paperTheme === "white"
                ? "bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500/30"
                : "bg-blue-500/10 hover:bg-blue-500/20 text-blue-500 dark:text-blue-400 border-blue-500/30",
            )}
            title={paperTheme === "white" ? "Switch to Dark Paper Mode" : "Switch to Crisp White Paper Mode"}
            onMouseDown={(e) => e.preventDefault()}
            onClick={handleTogglePaperTheme}
          >
            {paperTheme === "white" ? (
              <>
                <Sun className="size-3.5" />
                <span className="hidden sm:inline font-medium">White Paper</span>
              </>
            ) : (
              <>
                <Moon className="size-3.5" />
                <span className="hidden sm:inline font-medium">Dark Paper</span>
              </>
            )}
          </Button>

          {/* Zoom Controls */}
          <div className="flex items-center border border-border rounded overflow-hidden shrink-0">
            <Button
              variant="ghost"
              size="icon"
              className="size-7 rounded-none p-0 text-xs hover:bg-accent shrink-0"
              title="Zoom Out"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setZoom((z) => Math.max(0.6, Math.round((z - 0.1) * 10) / 10))}
            >
              <ZoomOut className="size-3.5" />
            </Button>
            <span className="h-7 px-1.5 flex items-center text-[10px] font-mono font-semibold text-foreground select-none">
              {Math.round(zoom * 100)}%
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="size-7 rounded-none p-0 text-xs hover:bg-accent shrink-0"
              title="Zoom In"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setZoom((z) => Math.min(1.6, Math.round((z + 0.1) * 10) / 10))}
            >
              <ZoomIn className="size-3.5" />
            </Button>
          </div>
        </div>
      </div>

      {/* 2. DOCUMENT CANVAS WORKSPACE */}
      <div className="flex-1 overflow-auto p-4 md:p-8 flex flex-col items-center gap-8 select-text">
        {pages.map((page, index) => {
          return (
            <div
              key={page.id}
              onClick={() => setActivePageIndex(index)}
              className={cn(
                "relative mx-auto border transition-all flex flex-col justify-between rounded-xs shadow-2xl h-auto shrink-0",
                paperTheme === "white"
                  ? "bg-white text-slate-900 border-slate-300"
                  : "bg-zinc-900 text-zinc-100 border-zinc-700",
              )}
              style={{
                width: `${targetPreset.width * zoom}px`,
                minHeight: `${targetPreset.height * zoom}px`,
                boxShadow:
                  "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1), 0 10px 15px -3px rgba(0, 0, 0, 0.05)",
              }}
            >
              {/* Document Page Header Indicator & Delete Page Option */}
              <div
                className={cn(
                  "flex items-center justify-between text-[10px] select-none px-4 pt-2 border-b shrink-0",
                  paperTheme === "white"
                    ? "text-slate-400 border-slate-100"
                    : "text-zinc-500 border-zinc-800",
                )}
                style={{
                  paddingLeft: `${pageMargin * zoom}px`,
                  paddingRight: `${pageMargin * zoom}px`,
                }}
              >
                <span className="font-semibold uppercase tracking-wider text-[9px]">
                  Page {index + 1} of {pages.length} ({paperFormat === "letter" ? "Letter" : "A4"})
                </span>
                {pages.length > 1 && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemovePage(index);
                    }}
                    title="Delete this page"
                    className="hover:text-rose-500 transition-colors p-0.5 rounded cursor-pointer"
                  >
                    <Trash2 className="size-3" />
                  </button>
                )}
              </div>

              {/* SINGLE UNIFIED CONTINUOUS BODY OF TEXT FOR THE PAGE */}
              <div
                className="flex-auto flex flex-col min-h-0"
                style={{
                  paddingLeft: `${pageMargin * zoom}px`,
                  paddingRight: `${pageMargin * zoom}px`,
                  paddingTop: `${(pageMargin + 8) * zoom}px`,
                  paddingBottom: `${(pageMargin + 8) * zoom}px`,
                }}
              >
                <div
                  ref={(el) => {
                    if (el) {
                      pageRefs.current.set(index, el);
                      if (el.children.length === 0 && (!el.innerHTML || el.innerHTML.trim() === "")) {
                        const pageBlocks = initialBlocks.filter(
                          (b) => (b.pageIndex ?? 0) === index,
                        );
                        el.innerHTML = parseBlocksToHtml(pageBlocks, paperTheme);
                      }
                    } else {
                      pageRefs.current.delete(index);
                    }
                  }}
                  contentEditable={true}
                  suppressContentEditableWarning={true}
                  spellCheck={true}
                  onFocus={() => {
                    setActivePageIndex(index);
                    updateActiveFormatStates();
                  }}
                  onBlur={() => {
                    isLocalTypingRef.current = false;
                  }}
                  onInput={() => handleEditorInput(index)}
                  onSelect={updateActiveFormatStates}
                  onMouseUp={updateActiveFormatStates}
                  onKeyUp={updateActiveFormatStates}
                  onKeyDown={handleEditorKeyDown}
                  className={cn(
                    "outline-none min-h-[500px] w-full select-text font-['Calibri'] text-[9.5pt] leading-[1.25]",
                    paperTheme === "white" ? "text-slate-900" : "text-zinc-100",
                  )}
                  style={{
                    fontFamily: currentFontFamily,
                  }}
                />
              </div>

              {/* Document Page Footer Stamp */}
              <div
                className={cn(
                  "mt-auto border-t text-[9px] select-none flex justify-center py-2 shrink-0",
                  paperTheme === "white"
                    ? "border-slate-100 text-slate-400"
                    : "border-zinc-800 text-zinc-500",
                )}
                style={{
                  paddingLeft: `${pageMargin * zoom}px`,
                  paddingRight: `${pageMargin * zoom}px`,
                }}
              >
                <span>— {index + 1} —</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Custom Font Studio Modal */}
      {fontUploadModalOpen && (
        <Suspense fallback={null}>
          <FontUploadModal
            open={fontUploadModalOpen}
            onOpenChange={setFontUploadModalOpen}
            customFonts={customFonts}
            onFontsChanged={(newFonts) => setCustomFonts(newFonts)}
            onSelectFont={(fontFamily) => handleApplyFontFamily(fontFamily)}
          />
        </Suspense>
      )}
    </div>
  );
}
