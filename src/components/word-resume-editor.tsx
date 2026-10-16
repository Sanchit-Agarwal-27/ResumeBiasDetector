import {
  useState,
  useRef,
  useEffect,
  useLayoutEffect,
  useCallback,
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
  FilePlus,
  Type,
  ChevronDown,
  Layout,
  Check,
  Undo2,
  Redo2,
  FileText,
  List,
  ListOrdered,
  MoveUp,
  MoveDown,
  Space,
  SplitSquareVertical,
  Minus,
  Sparkles,
  Highlighter,
  Indent,
  Outdent,
  RemoveFormatting,
  Columns2,
  Table as TableIcon,
  SeparatorHorizontal,
  Upload,
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
import { cn } from "@/lib/utils";
import { FontUploadModal } from "./font-upload-modal";
import { initializeCustomFonts, type CustomFontRecord } from "@/lib/custom-font-service";
import type {
  CanvasTextBlock,
  CanvasPage,
  ColumnLayoutPreset,
  ColumnSlot,
  DividerStyle,
} from "@/lib/pdf-cluster-engine";
import type { BiasSpan } from "@/lib/resume-contract";

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
  { label: "Soft Yellow", value: "#fef08a" },
  { label: "Soft Green", value: "#bbf7d0" },
  { label: "Soft Cyan", value: "#bae6fd" },
  { label: "Soft Pink", value: "#fbcfe8" },
  { label: "Light Gray", value: "#e2e8f0" },
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
  { label: "Normal text", fontSize: 9.5, bold: false, spaceBefore: 2, spaceAfter: 2 },
  { label: "Title", fontSize: 20, bold: true, spaceBefore: 4, spaceAfter: 4 },
  { label: "Subtitle", fontSize: 13, bold: false, spaceBefore: 0, spaceAfter: 6 },
  { label: "Heading 1", fontSize: 12.5, bold: true, spaceBefore: 10, spaceAfter: 4 },
  { label: "Heading 2", fontSize: 11, bold: true, spaceBefore: 6, spaceAfter: 2 },
  { label: "Heading 3", fontSize: 10, bold: true, spaceBefore: 4, spaceAfter: 2 },
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

/**
 * Calculates accurate start and end character offsets within a contentEditable container
 */
function getSelectionOffsetsWithin(element: HTMLElement): { start: number; end: number } {
  let start = 0;
  let end = 0;
  const doc = element.ownerDocument || document;
  const win = doc.defaultView || window;
  const sel = win.getSelection();
  if (sel && sel.rangeCount > 0) {
    const range = sel.getRangeAt(0);
    if (element.contains(range.startContainer) && element.contains(range.endContainer)) {
      const preStartRange = range.cloneRange();
      preStartRange.selectNodeContents(element);
      preStartRange.setEnd(range.startContainer, range.startOffset);
      start = preStartRange.toString().length;

      const preEndRange = range.cloneRange();
      preEndRange.selectNodeContents(element);
      preEndRange.setEnd(range.endContainer, range.endOffset);
      end = preEndRange.toString().length;
    }
  }
  return { start, end };
}

/**
 * Calculates accurate character offset within a contentEditable container
 */
function getCaretCharacterOffsetWithin(element: HTMLElement): number {
  return getSelectionOffsetsWithin(element).start;
}

/**
 * Sets DOM selection range inside contentEditable element with 100% precision.
 * Supports both collapsed caret (start === end) and non-collapsed text selections.
 * Correctly anchors before <br> on empty lines so the blinking cursor never disappears.
 */
function setSelectionRange(element: HTMLElement, start: number, end: number = start) {
  element.focus();
  const doc = element.ownerDocument || document;
  const win = doc.defaultView || window;
  const sel = win.getSelection();
  if (!sel) return;

  const range = doc.createRange();

  // Empty or only a <br> placeholder
  if (!element.childNodes || element.childNodes.length === 0) {
    range.selectNodeContents(element);
    range.collapse(true);
    sel.removeAllRanges();
    sel.addRange(range);
    return;
  }

  if (element.childNodes.length === 1 && element.childNodes[0]?.nodeName === "BR") {
    range.setStart(element, 0);
    range.collapse(true);
    sel.removeAllRanges();
    sel.addRange(range);
    return;
  }

  let currentOffset = 0;
  let startNode: Node | null = null;
  let startNodeOffset = 0;
  let endNode: Node | null = null;
  let endNodeOffset = 0;

  function traverse(node: Node) {
    if (node.nodeType === Node.TEXT_NODE) {
      const textLen = (node.textContent || "").length;
      if (!startNode && currentOffset + textLen >= start) {
        startNode = node;
        startNodeOffset = Math.min(Math.max(0, start - currentOffset), textLen);
      }
      if (!endNode && currentOffset + textLen >= end) {
        endNode = node;
        endNodeOffset = Math.min(Math.max(0, end - currentOffset), textLen);
      }
      currentOffset += textLen;
    } else {
      for (let i = 0; i < node.childNodes.length; i++) {
        traverse(node.childNodes[i]!);
        if (startNode && endNode) break;
      }
    }
  }

  traverse(element);

  if (startNode && endNode) {
    range.setStart(startNode, startNodeOffset);
    range.setEnd(endNode, endNodeOffset);
  } else if (startNode) {
    range.setStart(startNode, startNodeOffset);
    range.collapse(true);
  } else {
    range.selectNodeContents(element);
    range.collapse(false);
  }

  sel.removeAllRanges();
  sel.addRange(range);
}

/**
 * Sets DOM caret position inside contentEditable element with 100% precision.
 * Correctly anchors before <br> on empty lines so the blinking cursor never disappears.
 */
function setCaretPosition(element: HTMLElement, offset: number) {
  setSelectionRange(element, offset, offset);
}

/**
 * Computes estimated block height and distributes blocks across formal fixed pages
 * so that pages NEVER stretch vertically.
 */
function paginateBlocks(
  rawBlocks: CanvasTextBlock[],
  pageHeight: number,
  contentWidth: number,
): { paginatedBlocks: CanvasTextBlock[]; pageCount: number } {
  // Available printable height (accounting for header/footer margins)
  const availableHeight = Math.max(450, pageHeight - 96);
  let curPageIndex = 0;
  let curPageAccumHeight = 0;

  const paginatedBlocks = rawBlocks.map((b) => {
    // If block was explicitly placed on a later page (e.g. from imported multi-page PDF)
    if (typeof b.pageIndex === "number" && b.pageIndex > curPageIndex) {
      curPageIndex = b.pageIndex;
      curPageAccumHeight = 0;
    }

    const effectiveWidth = Math.max(100, contentWidth - (b.indent || 0));
    const charsPerLine = Math.max(
      25,
      Math.floor(effectiveWidth / Math.max(4.2, b.fontSize * 0.48)),
    );

    const textLines = (b.text || "").split("\n");
    let lineCount = 0;
    for (const tl of textLines) {
      lineCount += Math.max(1, Math.ceil((tl.length || 1) / charsPerLine));
    }

    const blockHeight =
      lineCount * (b.fontSize * (b.lineHeight || 1.25) * 1.3) +
      (b.spaceBefore || 2) +
      (b.spaceAfter || 2) +
      4;

    if (curPageAccumHeight + blockHeight > availableHeight && curPageAccumHeight > 45) {
      curPageIndex++;
      curPageAccumHeight = blockHeight;
    } else {
      curPageAccumHeight += blockHeight;
    }

    return {
      ...b,
      pageIndex: curPageIndex,
    };
  });

  return {
    paginatedBlocks,
    pageCount: Math.max(1, curPageIndex + 1),
  };
}

interface ParagraphBlockItemProps {
  block: CanvasTextBlock;
  zoom: number;
  biasSpans: BiasSpan[];
  isSelected: boolean;
  onSelect: () => void;
  onTextChange: (newText: string) => void;
  onCellChange?: (blockId: string, row: number, col: number, text: string) => void;
  onEnter: (e: ReactKeyboardEvent<HTMLDivElement>, currentText: string, selOffset: number) => void;
  onBackspace: (
    e: ReactKeyboardEvent<HTMLDivElement>,
    currentText: string,
    selOffset: number,
  ) => void;
  onDelete: (e: ReactKeyboardEvent<HTMLDivElement>, currentText: string, selOffset: number) => void;
  onArrowUp: (e: ReactKeyboardEvent<HTMLDivElement>, selOffset: number) => void;
  onArrowDown: (e: ReactKeyboardEvent<HTMLDivElement>, selOffset: number, textLen: number) => void;
  onTab: (
    e: ReactKeyboardEvent<HTMLDivElement>,
    currentText: string,
    selStart: number,
    selEnd: number,
  ) => void;
  registerRef: (el: HTMLDivElement | null) => void;
}

function ParagraphBlockItem({
  block,
  zoom,
  biasSpans,
  isSelected,
  onSelect,
  onTextChange,
  onCellChange,
  onEnter,
  onBackspace,
  onDelete,
  onArrowUp,
  onArrowDown,
  onTab,
  registerRef,
}: ParagraphBlockItemProps) {
  const domRef = useRef<HTMLDivElement | null>(null);
  const isInitializedRef = useRef<boolean>(false);

  // Attach ref and initialize text content once upon mount
  const handleSetRef = useCallback(
    (el: HTMLDivElement | null) => {
      domRef.current = el;
      registerRef(el);
      if (el && !isInitializedRef.current) {
        isInitializedRef.current = true;
        if (!block.text) {
          el.innerHTML = "<br />";
        } else {
          el.textContent = block.text;
        }
      }
    },
    [block.text, registerRef],
  );

  // Sync DOM if block text changes externally (e.g. Undo/Redo, external rewrites)
  useEffect(() => {
    if (domRef.current) {
      const currentDomText = (domRef.current.innerText || "")
        .replace(/\r\n/g, "")
        .replace(/\n$/, "");
      if (currentDomText !== block.text) {
        if (!block.text) {
          domRef.current.innerHTML = "<br />";
        } else {
          domRef.current.textContent = block.text;
        }
      }
    }
  }, [block.text]);

  // 1. Horizontal Divider Block Rendering
  if (block.isDivider) {
    let borderClass = "border-b";
    if (block.dividerStyle === "dashed") borderClass = "border-b border-dashed";
    else if (block.dividerStyle === "dotted") borderClass = "border-b border-dotted";
    else if (block.dividerStyle === "double") borderClass = "border-b-4 border-double";
    else if (block.dividerStyle === "thick") borderClass = "border-b-2";

    return (
      <div
        onClick={(e) => {
          e.stopPropagation();
          onSelect();
        }}
        className={cn(
          "relative my-2.5 py-1.5 cursor-pointer group transition-all select-none",
          isSelected && "ring-1 ring-primary/60 rounded px-1",
        )}
      >
        <div
          className={cn("w-full transition-colors", borderClass)}
          style={{ borderColor: block.dividerColor || "#cbd5e1" }}
        />
        {isSelected && (
          <span className="absolute right-0 -top-2.5 bg-primary text-primary-foreground text-[8px] font-bold px-1.5 py-0.5 rounded shadow-xs">
            Divider Line
          </span>
        )}
      </div>
    );
  }

  // 2. Table / Grid Block Rendering
  if (block.isTable && block.tableData) {
    return (
      <div
        onClick={(e) => {
          e.stopPropagation();
          onSelect();
        }}
        className={cn(
          "my-2.5 w-full overflow-x-auto rounded border border-border/80 transition-all select-text",
          isSelected && "ring-2 ring-primary/60",
        )}
        style={{
          fontFamily: block.fontFamily || "Calibri, sans-serif",
          fontSize: `${(block.fontSize || 9.5) * zoom}pt`,
          color: block.color || "#111827",
        }}
      >
        <table className="w-full border-collapse text-left">
          <tbody>
            {block.tableData.cells.map((rowCells, rIdx) => (
              <tr
                key={rIdx}
                className={cn(
                  "border-b border-border/60 last:border-0",
                  rIdx === 0 && block.tableData?.headers && "bg-muted/30 font-semibold",
                )}
              >
                {rowCells.map((cellText, cIdx) => (
                  <td
                    key={cIdx}
                    contentEditable
                    suppressContentEditableWarning
                    onBlur={(e) => {
                      const updatedText = e.currentTarget.innerText;
                      onCellChange?.(block.id, rIdx, cIdx, updatedText);
                    }}
                    className="border-r border-border/60 p-2 last:border-0 outline-hidden focus:bg-primary/5 min-w-[80px]"
                  >
                    {cellText}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  const matchingBias = biasSpans.filter((s) =>
    block.text.toLowerCase().includes(s.matched_text.toLowerCase()),
  );

  return (
    <div
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
      style={{
        fontSize: `${(block.fontSize || 9.5) * zoom}pt`,
        fontFamily: block.fontFamily || "Calibri, sans-serif",
        fontWeight: block.bold ? 700 : 400,
        fontStyle: block.italic ? "italic" : "normal",
        textDecoration: block.underline
          ? "underline"
          : block.strikethrough
            ? "line-through"
            : "none",
        color: block.color || "#111827",
        backgroundColor:
          block.backgroundColor && block.backgroundColor !== "transparent"
            ? block.backgroundColor
            : undefined,
        textAlign: block.align || "left",
        lineHeight: block.lineHeight || 1.25,
        letterSpacing:
          typeof block.letterSpacing === "number" ? `${block.letterSpacing * zoom}pt` : "0pt",
        marginTop: `${(block.spaceBefore || 2) * zoom}px`,
        marginBottom: `${(block.spaceAfter || 2) * zoom}px`,
        paddingLeft: block.indent ? `${block.indent * zoom}px` : undefined,
      }}
      className="relative outline-hidden cursor-text transition-none"
    >
      <div
        ref={handleSetRef}
        contentEditable
        suppressContentEditableWarning
        onFocus={onSelect}
        onInput={(e) => {
          const raw = e.currentTarget.innerText
            .replace(/\r\n/g, "\n")
            .replace(/\r/g, "\n")
            .replace(/\n$/, "");

          // Typing "- " or "* " at start of line auto-formats into standard bullet "• "
          if (/^[-*]\s/.test(raw) && !raw.startsWith("• ")) {
            const converted = "• " + raw.replace(/^[-*]\s*/, "");
            e.currentTarget.textContent = converted;
            setCaretPosition(e.currentTarget, 2);
            onTextChange(converted);
            return;
          }
          onTextChange(raw);
        }}
        onKeyDown={(e) => {
          const currentText = (e.currentTarget.innerText || "")
            .replace(/\r\n/g, "\n")
            .replace(/\r/g, "\n")
            .replace(/\n$/, "");
          const { start: selStart, end: selEnd } = getSelectionOffsetsWithin(e.currentTarget);
          const selOffset = selStart;

          if (e.key === "Enter" && !e.shiftKey) {
            onEnter(e, currentText, selOffset);
          } else if (e.key === "Backspace") {
            onBackspace(e, currentText, selOffset);
          } else if (e.key === "Delete") {
            onDelete(e, currentText, selOffset);
          } else if (e.key === "ArrowUp") {
            onArrowUp(e, selOffset);
          } else if (e.key === "ArrowDown") {
            onArrowDown(e, selOffset, currentText.length);
          } else if (e.key === "Tab") {
            onTab(e, currentText, selStart, selEnd);
          }
        }}
        className="outline-hidden min-h-[1.25em] whitespace-pre-wrap break-words"
      />

      {/* Subtle Inline Bias Marker Tag */}
      {matchingBias.length > 0 && (
        <div className="absolute right-0 top-0 select-none pointer-events-none opacity-40 hover:opacity-100 transition-opacity">
          <span className="bg-amber-100 text-amber-800 text-[8px] font-bold px-1 py-0.5 rounded border border-amber-300">
            {matchingBias[0]?.category.replace("_", " ")}
          </span>
        </div>
      )}
    </div>
  );
}

interface WordResumeEditorProps {
  pages: CanvasPage[];
  blocks: CanvasTextBlock[];
  activeBiasSpan?: BiasSpan;
  biasSpans?: BiasSpan[];
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
  columnLayout: initialColumnLayout = "single",
  onColumnLayoutChange,
  onChange,
  onSelectBlock,
}: WordResumeEditorProps) {
  const [columnLayout, setColumnLayout] = useState<ColumnLayoutPreset>(
    initialColumnLayout || "single",
  );
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
  const contentWidth = targetPreset.width - pageMargin * 2;

  // Auto-paginate initial blocks so pages never stretch
  const { paginatedBlocks: initPBlocks, pageCount: initPCount } = paginateBlocks(
    initialBlocks,
    targetPreset.height,
    contentWidth,
  );

  const [pages, setPages] = useState<CanvasPage[]>(() => {
    const count = Math.max(initialPages.length, initPCount, 1);
    return Array.from({ length: count }, (_, i) => ({
      id: `page-${i + 1}`,
      pageNumber: i + 1,
      width: targetPreset.width,
      height: targetPreset.height,
    }));
  });

  const [blocks, setBlocks] = useState<CanvasTextBlock[]>(initPBlocks);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(() => {
    return initPBlocks[0]?.id ?? null;
  });

  const [activePageIndex, setActivePageIndex] = useState<number>(0);
  const [zoom, setZoom] = useState<number>(1);

  // History Stacks
  const [history, setHistory] = useState<Array<{ blocks: CanvasTextBlock[]; pages: CanvasPage[] }>>(
    [],
  );
  const [redoStack, setRedoStack] = useState<
    Array<{ blocks: CanvasTextBlock[]; pages: CanvasPage[] }>
  >([]);

  // Focus & Caret Management
  const isLocalEditRef = useRef<boolean>(false);
  const pendingFocusRef = useRef<{ blockId: string; offset: number } | null>(null);
  const editableRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const editorContainerRef = useRef<HTMLDivElement>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clean up debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  // Synchronously position caret after block updates before browser paint
  useLayoutEffect(() => {
    if (pendingFocusRef.current) {
      const { blockId, offset } = pendingFocusRef.current;
      pendingFocusRef.current = null;
      const el = editableRefs.current.get(blockId);
      if (el) {
        setCaretPosition(el, offset);
      }
    }
  });

  // Synchronize internal state when props change externally (import / reset)
  // Protected by isLocalEditRef to prevent incoming prop updates from wiping caret
  useEffect(() => {
    if (isLocalEditRef.current) {
      isLocalEditRef.current = false;
      return;
    }

    const { paginatedBlocks, pageCount } = paginateBlocks(
      initialBlocks,
      targetPreset.height,
      targetPreset.width - pageMargin * 2,
    );
    setBlocks(paginatedBlocks);

    const neededPages = Math.max(initialPages.length, pageCount, 1);
    setPages(
      Array.from({ length: neededPages }, (_, i) => ({
        id: `page-${i + 1}`,
        pageNumber: i + 1,
        width: targetPreset.width,
        height: targetPreset.height,
      })),
    );

    if (!selectedBlockId && paginatedBlocks.length > 0) {
      setSelectedBlockId(paginatedBlocks[0]!.id);
    }
  }, [
    initialBlocks,
    initialPages,
    targetPreset.height,
    targetPreset.width,
    pageMargin,
    selectedBlockId,
  ]);

  // Focus matching block when active bias span changes from review queue
  useEffect(() => {
    if (activeBiasSpan) {
      const match = blocks.find((b) =>
        b.text.toLowerCase().includes(activeBiasSpan.matched_text.toLowerCase()),
      );
      if (match) {
        setSelectedBlockId(match.id);
        setActivePageIndex(match.pageIndex);
        const el = editableRefs.current.get(match.id);
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "nearest" });
        }
      }
    }
  }, [activeBiasSpan, blocks]);

  const pushHistory = useCallback(
    (newBlocks: CanvasTextBlock[], newPages: CanvasPage[], markLocal = true) => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      if (markLocal) {
        isLocalEditRef.current = true;
      }

      const { paginatedBlocks, pageCount } = paginateBlocks(
        newBlocks,
        targetPreset.height,
        targetPreset.width - pageMargin * 2,
      );

      const effectivePagesCount = Math.max(newPages.length, pageCount, 1);
      const effectivePages: CanvasPage[] = Array.from({ length: effectivePagesCount }, (_, i) => ({
        id: `page-${i + 1}`,
        pageNumber: i + 1,
        width: targetPreset.width,
        height: targetPreset.height,
      }));

      setHistory((prev) => [...prev.slice(-30), { blocks, pages }]);
      setRedoStack([]);
      setBlocks(paginatedBlocks);
      setPages(effectivePages);
      onChange(paginatedBlocks, effectivePages);
    },
    [blocks, pages, targetPreset, pageMargin, onChange],
  );

  const handleUndo = useCallback(() => {
    if (history.length === 0) return;
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    isLocalEditRef.current = true;
    const previous = history[history.length - 1]!;
    setRedoStack((prev) => [...prev, { blocks, pages }]);
    setHistory((prev) => prev.slice(0, -1));
    setBlocks(previous.blocks);
    setPages(previous.pages);
    onChange(previous.blocks, previous.pages);
  }, [history, blocks, pages, onChange]);

  const handleRedo = useCallback(() => {
    if (redoStack.length === 0) return;
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    isLocalEditRef.current = true;
    const next = redoStack[redoStack.length - 1]!;
    setHistory((prev) => [...prev, { blocks, pages }]);
    setRedoStack((prev) => prev.slice(0, -1));
    setBlocks(next.blocks);
    setPages(next.pages);
    onChange(next.blocks, next.pages);
  }, [redoStack, blocks, pages, onChange]);

  // Active block under editing
  const selectedBlock = blocks.find((b) => b.id === selectedBlockId) || blocks[0];

  const updateSelectedBlock = useCallback(
    (updater: (prev: CanvasTextBlock) => CanvasTextBlock) => {
      if (!selectedBlock) return;
      const el = editableRefs.current.get(selectedBlock.id);
      const currentOffset = el ? getCaretCharacterOffsetWithin(el) : 0;
      pendingFocusRef.current = { blockId: selectedBlock.id, offset: currentOffset };
      const updated = blocks.map((b) => (b.id === selectedBlock.id ? updater(b) : b));
      pushHistory(updated, pages);
    },
    [blocks, pages, selectedBlock, pushHistory],
  );

  const handleParagraphTextChange = useCallback(
    (blockId: string, newText: string) => {
      isLocalEditRef.current = true;
      const isBullet = BULLET_PREFIX_REGEX.test(newText.trim());
      const isNumbered = NUMBERED_PREFIX_REGEX.test(newText.trim());

      setBlocks((prev) => {
        const updated = prev.map((b) => {
          if (b.id !== blockId) return b;
          return {
            ...b,
            text: newText,
            isBullet,
            isNumbered,
            indent: isBullet || isNumbered ? (b.indent && b.indent > 0 ? b.indent : 14) : b.indent,
          };
        });

        if (debounceTimerRef.current) {
          clearTimeout(debounceTimerRef.current);
        }
        debounceTimerRef.current = setTimeout(() => {
          onChange(updated, pages);
        }, 250);

        return updated;
      });
    },
    [pages, onChange],
  );

  // Enter key handler: splits lines, continues bullets/numbering, never loses caret
  const handleBlockEnter = useCallback(
    (
      e: ReactKeyboardEvent<HTMLDivElement>,
      block: CanvasTextBlock,
      currentDomText: string,
      selOffset: number,
    ) => {
      e.preventDefault();
      isLocalEditRef.current = true;
      const textBefore = currentDomText.slice(0, selOffset);
      const textAfter = currentDomText.slice(selOffset);

      const isBulletLine =
        BULLET_PREFIX_REGEX.test(currentDomText.trim()) ||
        BULLET_PREFIX_REGEX.test(block.text.trim()) ||
        Boolean(block.isBullet);

      const isNumberedLine =
        NUMBERED_PREFIX_REGEX.test(currentDomText.trim()) ||
        NUMBERED_PREFIX_REGEX.test(block.text.trim()) ||
        Boolean(block.isNumbered);

      // 1. Bullet list item handling
      if (isBulletLine) {
        const pureText = currentDomText.replace(BULLET_PREFIX_REGEX, "").trim();
        if (pureText.length === 0) {
          // Empty bullet -> exit bullet mode, turn into normal paragraph
          e.currentTarget.innerHTML = "<br />";
          setCaretPosition(e.currentTarget, 0);
          pendingFocusRef.current = { blockId: block.id, offset: 0 };
          const updated = blocks.map((b) =>
            b.id === block.id
              ? {
                  ...b,
                  text: "",
                  isBullet: false,
                  indent: 0,
                }
              : b,
          );
          pushHistory(updated, pages);
          setSelectedBlockId(block.id);
          return;
        }

        const newBlockId = `para-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        const cleanAfter = textAfter.replace(BULLET_PREFIX_REGEX, "");
        const newBlock: CanvasTextBlock = {
          ...block,
          id: newBlockId,
          text: "• " + cleanAfter,
          isBullet: true,
          indent: block.indent || 14,
          spaceBefore: 2,
          spaceAfter: 2,
        };

        const updatedCurBlock: CanvasTextBlock = {
          ...block,
          text: textBefore,
        };

        e.currentTarget.textContent = textBefore;

        const selIdx = blocks.findIndex((b) => b.id === block.id);
        const updated = [
          ...blocks.slice(0, selIdx),
          updatedCurBlock,
          newBlock,
          ...blocks.slice(selIdx + 1),
        ];

        pendingFocusRef.current = { blockId: newBlockId, offset: 2 };
        pushHistory(updated, pages);
        setSelectedBlockId(newBlockId);
        return;
      }

      // 2. Numbered list item handling
      if (isNumberedLine) {
        const match = currentDomText.trim().match(/^(\d+)[.)]\s*(.*)/);
        const num = match ? parseInt(match[1] || "1", 10) : 1;
        const pureText = match ? match[2]?.trim() || "" : "";
        if (pureText.length === 0) {
          // Empty numbered item -> exit numbered mode
          e.currentTarget.innerHTML = "<br />";
          setCaretPosition(e.currentTarget, 0);
          pendingFocusRef.current = { blockId: block.id, offset: 0 };
          const updated = blocks.map((b) =>
            b.id === block.id
              ? {
                  ...b,
                  text: "",
                  isNumbered: false,
                  indent: 0,
                }
              : b,
          );
          pushHistory(updated, pages);
          setSelectedBlockId(block.id);
          return;
        }

        const newBlockId = `para-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        const cleanAfter = textAfter.replace(NUMBERED_PREFIX_REGEX, "");
        const newNumPrefix = `${num + 1}. `;
        const newBlock: CanvasTextBlock = {
          ...block,
          id: newBlockId,
          text: newNumPrefix + cleanAfter,
          isNumbered: true,
          indent: block.indent || 14,
          spaceBefore: 2,
          spaceAfter: 2,
        };

        const updatedCurBlock: CanvasTextBlock = {
          ...block,
          text: textBefore,
        };

        e.currentTarget.textContent = textBefore;

        const selIdx = blocks.findIndex((b) => b.id === block.id);
        const updated = [
          ...blocks.slice(0, selIdx),
          updatedCurBlock,
          newBlock,
          ...blocks.slice(selIdx + 1),
        ];

        pendingFocusRef.current = { blockId: newBlockId, offset: newNumPrefix.length };
        pushHistory(updated, pages);
        setSelectedBlockId(newBlockId);
        return;
      }

      // 3. Normal paragraph split (Zero placeholder text, pure clean line)
      const newBlockId = `para-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const newBlock: CanvasTextBlock = {
        ...block,
        id: newBlockId,
        text: textAfter,
        fontSize: block.isTitle || block.isHeading ? 9.5 : block.fontSize,
        bold: block.isTitle || block.isHeading ? false : block.bold,
        color: block.isTitle || block.isHeading ? "#111827" : block.color,
        isTitle: false,
        isHeading: false,
        spaceBefore: 2,
        spaceAfter: 2,
      };

      const updatedCurBlock: CanvasTextBlock = {
        ...block,
        text: textBefore,
      };

      if (!textBefore) {
        e.currentTarget.innerHTML = "<br />";
      } else {
        e.currentTarget.textContent = textBefore;
      }

      const selIdx = blocks.findIndex((b) => b.id === block.id);
      const updated = [
        ...blocks.slice(0, selIdx),
        updatedCurBlock,
        newBlock,
        ...blocks.slice(selIdx + 1),
      ];

      pendingFocusRef.current = { blockId: newBlockId, offset: 0 };
      pushHistory(updated, pages);
      setSelectedBlockId(newBlockId);
    },
    [blocks, pages, pushHistory],
  );

  // Backspace key handler: deletes empty lines, merges paragraphs, exits lists
  const handleBlockBackspace = useCallback(
    (
      e: ReactKeyboardEvent<HTMLDivElement>,
      block: CanvasTextBlock,
      currentDomText: string,
      selOffset: number,
    ) => {
      const isBulletLine =
        BULLET_PREFIX_REGEX.test(currentDomText.trim()) ||
        BULLET_PREFIX_REGEX.test(block.text.trim()) ||
        Boolean(block.isBullet);

      const isNumberedLine =
        NUMBERED_PREFIX_REGEX.test(currentDomText.trim()) ||
        NUMBERED_PREFIX_REGEX.test(block.text.trim()) ||
        Boolean(block.isNumbered);

      // 1. Bullet list backspace exit / remove bullet
      if (isBulletLine) {
        const bulletMatch = currentDomText.match(BULLET_PREFIX_REGEX);
        const prefixLen = bulletMatch ? bulletMatch[0].length : 2;
        const pureText = currentDomText.replace(BULLET_PREFIX_REGEX, "").trim();

        // If caret is at or before the bullet prefix (e.g. |• or •|), OR line is an empty bullet (• |):
        if (selOffset <= prefixLen || pureText.length === 0) {
          e.preventDefault();
          isLocalEditRef.current = true;
          const remainingText = currentDomText.replace(BULLET_PREFIX_REGEX, "");

          // Synchronously wipe/update the DOM element so the bullet immediately vanishes
          if (!remainingText.trim()) {
            e.currentTarget.innerHTML = "<br />";
          } else {
            e.currentTarget.textContent = remainingText;
          }

          // Instantly anchor the blinking caret at the start of the line
          setCaretPosition(e.currentTarget, 0);
          pendingFocusRef.current = { blockId: block.id, offset: 0 };

          // Directly update the exact block in state
          const updated = blocks.map((b) =>
            b.id === block.id
              ? {
                  ...b,
                  text: remainingText,
                  isBullet: false,
                  indent: 0,
                }
              : b,
          );

          pushHistory(updated, pages);
          setSelectedBlockId(block.id);
          return;
        }
      }

      // 2. Numbered list backspace exit / remove numbering
      if (isNumberedLine) {
        const numMatch = currentDomText.match(NUMBERED_PREFIX_REGEX);
        const prefixLen = numMatch ? numMatch[0].length : 3;
        const pureNumText = currentDomText.replace(NUMBERED_PREFIX_REGEX, "").trim();

        if (selOffset <= prefixLen || pureNumText.length === 0) {
          e.preventDefault();
          isLocalEditRef.current = true;
          const remainingText = currentDomText.replace(NUMBERED_PREFIX_REGEX, "");

          if (!remainingText.trim()) {
            e.currentTarget.innerHTML = "<br />";
          } else {
            e.currentTarget.textContent = remainingText;
          }

          setCaretPosition(e.currentTarget, 0);
          pendingFocusRef.current = { blockId: block.id, offset: 0 };

          const updated = blocks.map((b) =>
            b.id === block.id
              ? {
                  ...b,
                  text: remainingText,
                  isNumbered: false,
                  indent: 0,
                }
              : b,
          );

          pushHistory(updated, pages);
          setSelectedBlockId(block.id);
          return;
        }
      }

      const selIdx = blocks.findIndex((b) => b.id === block.id);

      // 3. Backspace on an empty line: remove line, move focus to end of previous line
      if (currentDomText.trim() === "") {
        if (selIdx > 0) {
          e.preventDefault();
          isLocalEditRef.current = true;
          const prevBlock = blocks[selIdx - 1]!;
          const prevLen = prevBlock.text.length;
          const updated = blocks.filter((b) => b.id !== block.id);

          pendingFocusRef.current = { blockId: prevBlock.id, offset: prevLen };
          pushHistory(updated, pages);
          setSelectedBlockId(prevBlock.id);
          return;
        }
      }

      // 4. Backspace at start of a line (offset 0): merge line into previous line
      if (selOffset === 0 && selIdx > 0) {
        e.preventDefault();
        isLocalEditRef.current = true;
        const prevBlock = blocks[selIdx - 1]!;
        const prevLen = prevBlock.text.length;
        const separator = prevBlock.text.endsWith(" ") || prevBlock.text.length === 0 ? "" : " ";
        const mergedText = prevBlock.text + separator + currentDomText;
        const updatedPrev: CanvasTextBlock = {
          ...prevBlock,
          text: mergedText,
        };

        const updated = [...blocks.slice(0, selIdx - 1), updatedPrev, ...blocks.slice(selIdx + 1)];

        pendingFocusRef.current = { blockId: prevBlock.id, offset: prevLen + separator.length };
        pushHistory(updated, pages);
        setSelectedBlockId(prevBlock.id);
      }
    },
    [blocks, pages, pushHistory],
  );

  // Delete key handler: deletes empty lines forward, merges next paragraph, deletes bullets
  const handleBlockDelete = useCallback(
    (
      e: ReactKeyboardEvent<HTMLDivElement>,
      block: CanvasTextBlock,
      currentDomText: string,
      selOffset: number,
    ) => {
      const isBulletLine =
        BULLET_PREFIX_REGEX.test(currentDomText.trim()) ||
        BULLET_PREFIX_REGEX.test(block.text.trim()) ||
        Boolean(block.isBullet);

      const isNumberedLine =
        NUMBERED_PREFIX_REGEX.test(currentDomText.trim()) ||
        NUMBERED_PREFIX_REGEX.test(block.text.trim()) ||
        Boolean(block.isNumbered);

      // 0a. Delete at start of bullet line: remove bullet
      if (isBulletLine) {
        const bulletMatch = currentDomText.match(BULLET_PREFIX_REGEX);
        const prefixLen = bulletMatch ? bulletMatch[0].length : 2;
        if (selOffset < prefixLen) {
          e.preventDefault();
          isLocalEditRef.current = true;
          const remainingText = currentDomText.replace(BULLET_PREFIX_REGEX, "");
          if (!remainingText.trim()) {
            e.currentTarget.innerHTML = "<br />";
          } else {
            e.currentTarget.textContent = remainingText;
          }
          setCaretPosition(e.currentTarget, 0);
          pendingFocusRef.current = { blockId: block.id, offset: 0 };
          const updated = blocks.map((b) =>
            b.id === block.id ? { ...b, text: remainingText, isBullet: false, indent: 0 } : b,
          );
          pushHistory(updated, pages);
          setSelectedBlockId(block.id);
          return;
        }
      }

      // 0b. Delete at start of numbered line: remove numbering
      if (isNumberedLine) {
        const numMatch = currentDomText.match(NUMBERED_PREFIX_REGEX);
        const prefixLen = numMatch ? numMatch[0].length : 3;
        if (selOffset < prefixLen) {
          e.preventDefault();
          isLocalEditRef.current = true;
          const remainingText = currentDomText.replace(NUMBERED_PREFIX_REGEX, "");
          if (!remainingText.trim()) {
            e.currentTarget.innerHTML = "<br />";
          } else {
            e.currentTarget.textContent = remainingText;
          }
          setCaretPosition(e.currentTarget, 0);
          pendingFocusRef.current = { blockId: block.id, offset: 0 };
          const updated = blocks.map((b) =>
            b.id === block.id ? { ...b, text: remainingText, isNumbered: false, indent: 0 } : b,
          );
          pushHistory(updated, pages);
          setSelectedBlockId(block.id);
          return;
        }
      }

      const selIdx = blocks.findIndex((b) => b.id === block.id);

      // 1. Delete on an empty line: remove current line and focus next (or previous)
      if (currentDomText.trim() === "") {
        if (blocks.length > 1) {
          e.preventDefault();
          isLocalEditRef.current = true;
          const updated = blocks.filter((b) => b.id !== block.id);

          if (selIdx < blocks.length - 1) {
            const nextBlock = blocks[selIdx + 1]!;
            pendingFocusRef.current = { blockId: nextBlock.id, offset: 0 };
            setSelectedBlockId(nextBlock.id);
          } else if (selIdx > 0) {
            const prevBlock = blocks[selIdx - 1]!;
            pendingFocusRef.current = { blockId: prevBlock.id, offset: prevBlock.text.length };
            setSelectedBlockId(prevBlock.id);
          }

          pushHistory(updated, pages);
          return;
        }
      }

      // 2. Delete at end of line: merge next line into current line
      if (selOffset >= currentDomText.length && selIdx < blocks.length - 1) {
        e.preventDefault();
        isLocalEditRef.current = true;
        const nextBlock = blocks[selIdx + 1]!;

        if (nextBlock.text.trim() === "") {
          // Next line is empty: simply delete next line
          const updated = blocks.filter((b) => b.id !== nextBlock.id);
          pendingFocusRef.current = { blockId: block.id, offset: currentDomText.length };
          pushHistory(updated, pages);
        } else {
          // Next line has text: merge it into current line
          const separator = currentDomText.endsWith(" ") || currentDomText.length === 0 ? "" : " ";
          const mergedText = currentDomText + separator + nextBlock.text;
          const updatedCur: CanvasTextBlock = {
            ...block,
            text: mergedText,
          };

          const updated = [...blocks.slice(0, selIdx), updatedCur, ...blocks.slice(selIdx + 2)];

          e.currentTarget.textContent = mergedText;
          setCaretPosition(e.currentTarget, currentDomText.length);
          pendingFocusRef.current = { blockId: block.id, offset: currentDomText.length };
          pushHistory(updated, pages);
        }
      }
    },
    [blocks, pages, pushHistory],
  );

  // Arrow Up: navigate to previous paragraph when caret is at beginning
  const handleBlockArrowUp = useCallback(
    (e: ReactKeyboardEvent<HTMLDivElement>, block: CanvasTextBlock, selOffset: number) => {
      if (selOffset === 0) {
        const bIdx = blocks.findIndex((b) => b.id === block.id);
        if (bIdx > 0) {
          e.preventDefault();
          const prev = blocks[bIdx - 1]!;
          setSelectedBlockId(prev.id);
          setActivePageIndex(prev.pageIndex);
          const prevEl = editableRefs.current.get(prev.id);
          if (prevEl) {
            setCaretPosition(prevEl, prev.text.length);
          }
        }
      }
    },
    [blocks],
  );

  // Arrow Down: navigate to next paragraph when caret is at end
  const handleBlockArrowDown = useCallback(
    (
      e: ReactKeyboardEvent<HTMLDivElement>,
      block: CanvasTextBlock,
      selOffset: number,
      textLen: number,
    ) => {
      if (selOffset >= textLen) {
        const bIdx = blocks.findIndex((b) => b.id === block.id);
        if (bIdx >= 0 && bIdx < blocks.length - 1) {
          e.preventDefault();
          const next = blocks[bIdx + 1]!;
          setSelectedBlockId(next.id);
          setActivePageIndex(next.pageIndex);
          const nextEl = editableRefs.current.get(next.id);
          if (nextEl) {
            setCaretPosition(nextEl, 0);
          }
        }
      }
    },
    [blocks],
  );

  // Tab key handler: Inserts spaces at cursor position or indents line/block
  const handleBlockTab = useCallback(
    (
      e: ReactKeyboardEvent<HTMLDivElement>,
      block: CanvasTextBlock,
      currentDomText: string,
      selStart: number,
      selEnd: number,
    ) => {
      e.preventDefault();
      isLocalEditRef.current = true;

      // 1. Shift+Tab: Decrease block-level indent (outdent) or remove leading tab spaces
      if (e.shiftKey) {
        if ((block.indent || 0) > 0) {
          updateSelectedBlock((b) => ({
            ...b,
            indent: Math.max(0, (b.indent || 0) - 12),
          }));
          return;
        }
        // If indent is 0, check if line starts with 4 spaces or tab, remove them
        if (currentDomText.startsWith("    ")) {
          const newText = currentDomText.slice(4);
          e.currentTarget.textContent = newText;
          const newOffset = Math.max(0, selStart - 4);
          setCaretPosition(e.currentTarget, newOffset);
          pendingFocusRef.current = { blockId: block.id, offset: newOffset };
          const updated = blocks.map((b) => (b.id === block.id ? { ...b, text: newText } : b));
          pushHistory(updated, pages);
        }
        return;
      }

      // 2. Tab with text selected: Indent selection or entire block if cursor at start
      if (selStart !== selEnd) {
        const textBefore = currentDomText.slice(0, selStart);
        const textSelected = currentDomText.slice(selStart, selEnd);
        const textAfter = currentDomText.slice(selEnd);

        // Standard Word/Docs tab spacing: 4 spaces for aligned monospace/variable tabs
        const tabString = "    ";
        const newText = textBefore + tabString + textSelected + textAfter;

        e.currentTarget.textContent = newText;
        setSelectionRange(e.currentTarget, selStart + tabString.length, selEnd + tabString.length);
        pendingFocusRef.current = { blockId: block.id, offset: selStart + tabString.length };

        const updated = blocks.map((b) => (b.id === block.id ? { ...b, text: newText } : b));
        pushHistory(updated, pages);
        return;
      }

      // 3. Tab at beginning of line (selStart === 0) on a bullet or list item:
      // In Word/Docs, pressing Tab at the start of a bullet indents the sub-bullet level
      const isBulletOrNum =
        BULLET_PREFIX_REGEX.test(currentDomText.trim()) ||
        NUMBERED_PREFIX_REGEX.test(currentDomText.trim()) ||
        Boolean(block.isBullet) ||
        Boolean(block.isNumbered);

      if (selStart === 0 && isBulletOrNum) {
        updateSelectedBlock((b) => ({
          ...b,
          indent: Math.min(72, (b.indent || 0) + 12),
        }));
        return;
      }

      // 4. Tab at cursor position anywhere in the text:
      // Insert tab spaces (4 spaces) exactly where the cursor is, pushing subsequent text forward
      const tabString = "    ";
      const textBefore = currentDomText.slice(0, selStart);
      const textAfter = currentDomText.slice(selStart);
      const newText = textBefore + tabString + textAfter;

      e.currentTarget.textContent = newText;
      const newCaretOffset = selStart + tabString.length;
      setCaretPosition(e.currentTarget, newCaretOffset);
      pendingFocusRef.current = { blockId: block.id, offset: newCaretOffset };

      const updated = blocks.map((b) => (b.id === block.id ? { ...b, text: newText } : b));
      pushHistory(updated, pages);
    },
    [blocks, pages, pushHistory, updateSelectedBlock],
  );

  // Insert a new paragraph from toolbar buttons (Heading, Bullet, Normal, Divider)
  const handleInsertToolbarParagraph = useCallback(
    (presetType: "heading" | "bullet" | "normal" | "divider") => {
      const pageIdx = activePageIndex;
      const selIdx = blocks.findIndex((b) => b.id === selectedBlockId);
      const newId = `para-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

      let text = "";
      let fontSize = 9.5;
      let bold = false;
      let color = "#111827";
      let spaceBefore = 2;
      let spaceAfter = 2;
      let isBullet = false;

      if (presetType === "heading") {
        text = "WORK EXPERIENCE";
        fontSize = 11.5;
        bold = true;
        color = "#1e3a8a";
        spaceBefore = 8;
        spaceAfter = 3;
      } else if (presetType === "bullet") {
        text = "• ";
        fontSize = 9.5;
        bold = false;
        color = "#1f2937";
        spaceBefore = 2;
        spaceAfter = 2;
        isBullet = true;
      } else if (presetType === "normal") {
        text = "";
        fontSize = 9.5;
        bold = false;
        color = "#111827";
        spaceBefore = 2;
        spaceAfter = 2;
      } else if (presetType === "divider") {
        text = "________________________________________________________________________________";
        fontSize = 7;
        color = "#cbd5e1";
        spaceBefore = 4;
        spaceAfter = 4;
      }

      const newBlock: CanvasTextBlock = {
        id: newId,
        pageIndex: pageIdx,
        text,
        x: pageMargin,
        y: 60,
        width: targetPreset.width - pageMargin * 2,
        height: Math.round(fontSize * 1.3),
        fontSize,
        fontFamily: selectedBlock?.fontFamily || "Calibri, sans-serif",
        bold,
        italic: false,
        underline: false,
        color,
        align: "left",
        lineHeight: 1.25,
        letterSpacing: 0,
        spaceBefore,
        spaceAfter,
        indent: isBullet ? 14 : 0,
        isTitle: false,
        isHeading: presetType === "heading",
        isBullet,
      };

      let updated: CanvasTextBlock[];
      if (selIdx >= 0) {
        updated = [...blocks.slice(0, selIdx + 1), newBlock, ...blocks.slice(selIdx + 1)];
      } else {
        updated = [...blocks, newBlock];
      }

      pendingFocusRef.current = { blockId: newId, offset: text.length };
      pushHistory(updated, pages);
      setSelectedBlockId(newId);
    },
    [
      activePageIndex,
      blocks,
      selectedBlockId,
      pageMargin,
      targetPreset,
      selectedBlock?.fontFamily,
      pushHistory,
      pages,
    ],
  );

  // Insert Horizontal Rule Divider Block
  const handleInsertDivider = useCallback(
    (style: DividerStyle = "solid", color = "#cbd5e1") => {
      const newBlockId = `div-${Date.now()}`;
      const newBlock: CanvasTextBlock = {
        id: newBlockId,
        pageIndex: activePageIndex,
        text: "---",
        x: pageMargin,
        y: 100,
        width: targetPreset.width - pageMargin * 2,
        height: 12,
        fontSize: 10,
        fontFamily: "Calibri, sans-serif",
        isDivider: true,
        dividerStyle: style,
        dividerColor: color,
        columnSlot: selectedBlock?.columnSlot || "full",
        spaceBefore: 6,
        spaceAfter: 6,
      };

      const selIdx = blocks.findIndex((b) => b.id === selectedBlockId);
      const updated =
        selIdx >= 0
          ? [...blocks.slice(0, selIdx + 1), newBlock, ...blocks.slice(selIdx + 1)]
          : [...blocks, newBlock];

      pushHistory(updated, pages);
      setSelectedBlockId(newBlockId);
    },
    [
      activePageIndex,
      pageMargin,
      targetPreset,
      selectedBlock?.columnSlot,
      blocks,
      selectedBlockId,
      pushHistory,
      pages,
    ],
  );

  // Insert Table / Grid Block
  const handleInsertTable = useCallback(
    (preset: (typeof TABLE_PRESETS)[0]) => {
      const newBlockId = `tbl-${Date.now()}`;
      const newBlock: CanvasTextBlock = {
        id: newBlockId,
        pageIndex: activePageIndex,
        text: preset.cells.map((row) => row.join(" | ")).join("\n"),
        x: pageMargin,
        y: 100,
        width: targetPreset.width - pageMargin * 2,
        height: preset.rows * 24,
        fontSize: 9.5,
        fontFamily: selectedBlock?.fontFamily || "Calibri, sans-serif",
        isTable: true,
        tableData: {
          rows: preset.rows,
          cols: preset.cols,
          headers: preset.headers,
          cells: JSON.parse(JSON.stringify(preset.cells)),
        },
        columnSlot: selectedBlock?.columnSlot || "full",
        spaceBefore: 8,
        spaceAfter: 8,
      };

      const selIdx = blocks.findIndex((b) => b.id === selectedBlockId);
      const updated =
        selIdx >= 0
          ? [...blocks.slice(0, selIdx + 1), newBlock, ...blocks.slice(selIdx + 1)]
          : [...blocks, newBlock];

      pushHistory(updated, pages);
      setSelectedBlockId(newBlockId);
    },
    [
      activePageIndex,
      pageMargin,
      targetPreset,
      selectedBlock?.fontFamily,
      selectedBlock?.columnSlot,
      blocks,
      selectedBlockId,
      pushHistory,
      pages,
    ],
  );

  // Insert Paragraph explicitly into Left or Right Column slot
  const handleInsertInSlot = useCallback(
    (slot: ColumnSlot) => {
      const newBlockId = `para-${Date.now()}`;
      const newBlock: CanvasTextBlock = {
        id: newBlockId,
        pageIndex: activePageIndex,
        text: "",
        x: pageMargin,
        y: 100,
        width: targetPreset.width - pageMargin * 2,
        height: 14,
        fontSize: 9.5,
        fontFamily: selectedBlock?.fontFamily || "Calibri, sans-serif",
        columnSlot: slot,
        spaceBefore: 2,
        spaceAfter: 2,
      };

      const updated = [...blocks, newBlock];
      pendingFocusRef.current = { blockId: newBlockId, offset: 0 };
      pushHistory(updated, pages);
      setSelectedBlockId(newBlockId);
    },
    [
      activePageIndex,
      pageMargin,
      targetPreset.width,
      selectedBlock?.fontFamily,
      blocks,
      pushHistory,
      pages,
    ],
  );

  // Handle cell edit inside a table block
  const handleTableCellChange = useCallback(
    (blockId: string, row: number, col: number, val: string) => {
      isLocalEditRef.current = true;
      setBlocks((prev) => {
        const updated = prev.map((b) => {
          if (b.id !== blockId || !b.tableData) return b;
          const newCells = b.tableData.cells.map((r, rIdx) =>
            rIdx === row ? r.map((c, cIdx) => (cIdx === col ? val : c)) : [...r],
          );
          const newText = newCells.map((r) => r.join(" | ")).join("\n");
          return {
            ...b,
            text: newText,
            tableData: { ...b.tableData, cells: newCells },
          };
        });

        if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = setTimeout(() => {
          onChange(updated, pages);
        }, 250);

        return updated;
      });
    },
    [pages, onChange],
  );

  // Delete currently selected paragraph
  const handleDeleteParagraph = useCallback(() => {
    if (!selectedBlock || blocks.length <= 1) return;
    const curIdx = blocks.findIndex((b) => b.id === selectedBlock.id);
    const updated = blocks.filter((b) => b.id !== selectedBlock.id);
    const nextBlock = updated[Math.min(curIdx, updated.length - 1)];

    if (nextBlock) {
      pendingFocusRef.current = { blockId: nextBlock.id, offset: nextBlock.text.length };
      setSelectedBlockId(nextBlock.id);
    }
    pushHistory(updated, pages);
  }, [selectedBlock, blocks, pushHistory, pages]);

  // Move paragraph up or down in document flow
  const handleMoveParagraph = useCallback(
    (direction: "up" | "down") => {
      if (!selectedBlock) return;
      const index = blocks.findIndex((b) => b.id === selectedBlock.id);
      if (index === -1) return;
      if (direction === "up" && index === 0) return;
      if (direction === "down" && index === blocks.length - 1) return;

      const targetIndex = direction === "up" ? index - 1 : index + 1;
      const copy = [...blocks];
      const [item] = copy.splice(index, 1);
      if (!item) return;
      copy.splice(targetIndex, 0, item);

      const el = editableRefs.current.get(item.id);
      const currentOffset = el ? getCaretCharacterOffsetWithin(el) : item.text.length;
      pendingFocusRef.current = { blockId: item.id, offset: currentOffset };
      setSelectedBlockId(item.id);
      pushHistory(copy, pages);
    },
    [selectedBlock, blocks, pushHistory, pages],
  );

  // Toggle Bullet List
  const handleToggleBullet = useCallback(() => {
    if (!selectedBlock) return;
    const isCurrentlyBullet =
      BULLET_PREFIX_REGEX.test(selectedBlock.text.trim()) || Boolean(selectedBlock.isBullet);
    const newText = isCurrentlyBullet
      ? selectedBlock.text.replace(BULLET_PREFIX_REGEX, "")
      : "• " + selectedBlock.text.replace(BULLET_PREFIX_REGEX, "").trim();

    const updated = blocks.map((b) =>
      b.id === selectedBlock.id
        ? {
            ...b,
            text: newText,
            isBullet: !isCurrentlyBullet,
            indent: !isCurrentlyBullet ? 14 : 0,
          }
        : b,
    );

    const el = editableRefs.current.get(selectedBlock.id);
    if (el) {
      if (!newText.trim()) {
        el.innerHTML = "<br />";
      } else {
        el.textContent = newText;
      }
      setCaretPosition(el, isCurrentlyBullet ? 0 : 2);
    }

    pendingFocusRef.current = {
      blockId: selectedBlock.id,
      offset: isCurrentlyBullet ? 0 : 2,
    };

    pushHistory(updated, pages);
  }, [selectedBlock, blocks, pushHistory, pages]);

  // Toggle Numbered List
  const handleToggleNumbered = useCallback(() => {
    if (!selectedBlock) return;
    const isCurrentlyNumbered =
      NUMBERED_PREFIX_REGEX.test(selectedBlock.text.trim()) || Boolean(selectedBlock.isNumbered);
    const newText = isCurrentlyNumbered
      ? selectedBlock.text.replace(NUMBERED_PREFIX_REGEX, "")
      : "1. " + selectedBlock.text.replace(NUMBERED_PREFIX_REGEX, "").trim();

    const updated = blocks.map((b) =>
      b.id === selectedBlock.id
        ? {
            ...b,
            text: newText,
            isNumbered: !isCurrentlyNumbered,
            indent: !isCurrentlyNumbered ? 14 : 0,
          }
        : b,
    );

    const el = editableRefs.current.get(selectedBlock.id);
    if (el) {
      if (!newText.trim()) {
        el.innerHTML = "<br />";
      } else {
        el.textContent = newText;
      }
      setCaretPosition(el, isCurrentlyNumbered ? 0 : 3);
    }

    pendingFocusRef.current = {
      blockId: selectedBlock.id,
      offset: isCurrentlyNumbered ? 0 : 3,
    };

    pushHistory(updated, pages);
  }, [selectedBlock, blocks, pushHistory, pages]);

  // Adjust Indentation
  const handleIndent = useCallback(
    (delta: number) => {
      if (!selectedBlock) return;
      updateSelectedBlock((b) => {
        const curIndent = b.indent || 0;
        const newIndent = Math.max(0, Math.min(72, curIndent + delta));
        return { ...b, indent: newIndent };
      });
    },
    [selectedBlock, updateSelectedBlock],
  );

  // Clear Formatting
  const handleClearFormatting = useCallback(() => {
    if (!selectedBlock) return;
    updateSelectedBlock((b) => ({
      ...b,
      fontSize: 9.5,
      bold: false,
      italic: false,
      underline: false,
      strikethrough: false,
      color: "#111827",
      backgroundColor: "transparent",
      align: "left",
      lineHeight: 1.25,
      letterSpacing: 0,
    }));
  }, [selectedBlock, updateSelectedBlock]);

  // Paper Format Switcher (US Letter vs A4)
  const handleSwitchPaperFormat = useCallback(
    (formatId: "letter" | "a4") => {
      setPaperFormat(formatId);
      const target =
        PAPER_FORMAT_PRESETS.find((p) => p.id === formatId) || PAPER_FORMAT_PRESETS[0]!;
      const updatedPages = pages.map((p) => ({
        ...p,
        width: target.width,
        height: target.height,
      }));
      const updatedBlocks = blocks.map((b) => ({
        ...b,
        width: target.width - pageMargin * 2,
      }));
      pushHistory(updatedBlocks, updatedPages);
    },
    [pages, blocks, pageMargin, pushHistory],
  );

  // Add Page to document
  const handleAddPage = useCallback(() => {
    const newPageNum = pages.length + 1;
    const newPage: CanvasPage = {
      id: `page-${newPageNum}`,
      pageNumber: newPageNum,
      width: targetPreset.width,
      height: targetPreset.height,
    };
    const updatedPages = [...pages, newPage];

    const newBlock: CanvasTextBlock = {
      id: `para-p${newPageNum}-${Date.now()}`,
      pageIndex: newPageNum - 1,
      text: "",
      x: pageMargin,
      y: 40,
      width: targetPreset.width - pageMargin * 2,
      height: 18,
      fontSize: 9.5,
      fontFamily: "Calibri, sans-serif",
      bold: false,
      align: "left",
      lineHeight: 1.25,
      letterSpacing: 0,
      spaceBefore: 2,
      spaceAfter: 2,
    };
    const updatedBlocks = [...blocks, newBlock];
    pendingFocusRef.current = { blockId: newBlock.id, offset: 0 };
    pushHistory(updatedBlocks, updatedPages);
    setActivePageIndex(newPageNum - 1);
    setSelectedBlockId(newBlock.id);
  }, [pages, targetPreset, pageMargin, blocks, pushHistory]);

  // Remove active page if multiple pages exist
  const handleRemovePage = useCallback(
    (pageIndexToRemove: number) => {
      if (pages.length <= 1) return;
      const updatedPages = pages
        .filter((_, idx) => idx !== pageIndexToRemove)
        .map((p, idx) => ({ ...p, pageNumber: idx + 1 }));

      const updatedBlocks = blocks
        .filter((b) => b.pageIndex !== pageIndexToRemove)
        .map((b) => ({
          ...b,
          pageIndex: b.pageIndex > pageIndexToRemove ? b.pageIndex - 1 : b.pageIndex,
        }));

      pushHistory(updatedBlocks, updatedPages);
      setActivePageIndex(Math.max(0, pageIndexToRemove - 1));
      if (updatedBlocks.length > 0) {
        setSelectedBlockId(updatedBlocks[0]!.id);
      }
    },
    [pages, blocks, pushHistory],
  );

  // Standard Word / Google Docs Keyboard Shortcuts
  const handleGlobalKeyDown = useCallback(
    (e: ReactKeyboardEvent) => {
      const isMac =
        typeof navigator !== "undefined" && navigator.platform?.toUpperCase().indexOf("MAC") >= 0;
      const ctrlKey = isMac ? e.metaKey : e.ctrlKey;

      if (ctrlKey) {
        if (e.key === "b" || e.key === "B") {
          e.preventDefault();
          updateSelectedBlock((b) => ({ ...b, bold: !b.bold }));
        } else if (e.key === "i" || e.key === "I") {
          e.preventDefault();
          updateSelectedBlock((b) => ({ ...b, italic: !b.italic }));
        } else if (e.key === "u" || e.key === "U") {
          e.preventDefault();
          updateSelectedBlock((b) => ({ ...b, underline: !b.underline }));
        } else if (e.shiftKey && (e.key === "x" || e.key === "X")) {
          e.preventDefault();
          updateSelectedBlock((b) => ({ ...b, strikethrough: !b.strikethrough }));
        } else if (e.key === "z" || e.key === "Z") {
          e.preventDefault();
          if (e.shiftKey) {
            handleRedo();
          } else {
            handleUndo();
          }
        } else if (e.key === "y" || e.key === "Y") {
          e.preventDefault();
          handleRedo();
        } else if (e.key === "l" || e.key === "L") {
          e.preventDefault();
          updateSelectedBlock((b) => ({ ...b, align: "left" }));
        } else if (e.key === "e" || e.key === "E") {
          e.preventDefault();
          updateSelectedBlock((b) => ({ ...b, align: "center" }));
        } else if (e.key === "r" || e.key === "R") {
          e.preventDefault();
          updateSelectedBlock((b) => ({ ...b, align: "right" }));
        } else if (e.key === "j" || e.key === "J") {
          e.preventDefault();
          updateSelectedBlock((b) => ({ ...b, align: "justify" }));
        } else if (e.key === "]" || (e.shiftKey && e.key === ">")) {
          e.preventDefault();
          updateSelectedBlock((b) => ({
            ...b,
            fontSize: Math.min(36, Math.round((b.fontSize + 1) * 10) / 10),
          }));
        } else if (e.key === "[" || (e.shiftKey && e.key === "<")) {
          e.preventDefault();
          updateSelectedBlock((b) => ({
            ...b,
            fontSize: Math.max(7, Math.round((b.fontSize - 1) * 10) / 10),
          }));
        } else if (e.key === "\\" || e.key === " ") {
          e.preventDefault();
          handleClearFormatting();
        } else if (e.key === "1" && !e.shiftKey) {
          e.preventDefault();
          updateSelectedBlock((b) => ({ ...b, lineHeight: 1.0 }));
        } else if (e.key === "2" && !e.shiftKey) {
          e.preventDefault();
          updateSelectedBlock((b) => ({ ...b, lineHeight: 2.0 }));
        } else if (e.key === "5" && !e.shiftKey) {
          e.preventDefault();
          updateSelectedBlock((b) => ({ ...b, lineHeight: 1.5 }));
        } else if (e.shiftKey && e.key === "8") {
          e.preventDefault();
          handleToggleBullet();
        } else if (e.shiftKey && e.key === "7") {
          e.preventDefault();
          handleToggleNumbered();
        } else if (e.key === "Enter") {
          // Ctrl+Enter = Page break
          e.preventDefault();
          handleAddPage();
        }
      }
    },
    [
      updateSelectedBlock,
      handleUndo,
      handleRedo,
      handleClearFormatting,
      handleToggleBullet,
      handleToggleNumbered,
      handleAddPage,
    ],
  );

  // Group blocks by page index
  const pagesData = pages.map((page, index) => {
    const pageBlocks = blocks.filter((b) => b.pageIndex === index);
    return { page, index, blocks: pageBlocks };
  });

  const totalWordCount = blocks.reduce((acc, b) => acc + (b.text.match(/\S+/g)?.length || 0), 0);

  return (
    <div
      className="flex flex-col h-full w-full bg-slate-100 dark:bg-zinc-950 rounded-xl border border-border shadow-xs overflow-hidden"
      onKeyDown={handleGlobalKeyDown}
    >
      {/* 1. PROFESSIONAL GOOGLE DOCS / WORD RIBBON TOOLBAR */}
      <div className="bg-card border-b border-border px-3 py-1.5 flex flex-wrap items-center gap-1.5 shadow-xs z-20 select-none">
        {/* History Group (Undo / Redo) */}
        <div className="flex items-center gap-0.5 shrink-0">
          <Button
            variant="ghost"
            size="icon"
            className="size-7 rounded hover:bg-accent shrink-0"
            title="Undo (Ctrl+Z)"
            disabled={history.length === 0}
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
            disabled={redoStack.length === 0}
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
                onMouseDown={(e) => e.preventDefault()}
                className="h-7 text-xs font-medium px-2.5 w-[114px] shrink-0 justify-between gap-1 text-foreground"
                title="Paragraph Style (Ctrl+Alt+1, etc.)"
              >
                <span className="truncate text-left flex-1">
                  {selectedBlock?.isTitle
                    ? "Title"
                    : selectedBlock?.fontSize && selectedBlock.fontSize >= 12.5
                      ? "Heading 1"
                      : selectedBlock?.fontSize && selectedBlock.fontSize >= 11
                        ? "Heading 2"
                        : "Normal text"}
                </span>
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
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() =>
                    updateSelectedBlock((b) => ({
                      ...b,
                      fontSize: st.fontSize,
                      bold: st.bold,
                      spaceBefore: st.spaceBefore,
                      spaceAfter: st.spaceAfter,
                      isTitle: st.label === "Title",
                      isHeading: st.label.startsWith("Heading"),
                    }))
                  }
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
                onMouseDown={(e) => e.preventDefault()}
                className="h-7 text-xs font-medium px-2.5 w-[124px] shrink-0 justify-between gap-1 text-foreground"
                title="Font Family"
              >
                <span className="truncate text-left flex-1">
                  {FONT_FAMILIES.find((f) => f.value === selectedBlock?.fontFamily)?.label.split(
                    " ",
                  )[0] ||
                    selectedBlock?.fontFamily?.split(",")[0]?.replace(/['"]/g, "") ||
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
                        selectedBlock?.fontFamily === font.family && "bg-accent font-semibold",
                      )}
                      style={{ fontFamily: font.family }}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() =>
                        updateSelectedBlock((b) => ({ ...b, fontFamily: font.family }))
                      }
                    >
                      <span className="truncate">{font.name}</span>
                      {selectedBlock?.fontFamily === font.family && (
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
                    selectedBlock?.fontFamily === font.value && "bg-accent font-semibold",
                  )}
                  style={{ fontFamily: font.value }}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() =>
                    updateSelectedBlock((b) => ({ ...b, fontFamily: font.family || font.value }))
                  }
                >
                  <span>{font.label}</span>
                  {selectedBlock?.fontFamily === font.value && (
                    <Check className="size-3.5 text-primary" />
                  )}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="cursor-pointer text-xs font-medium text-primary flex items-center gap-2"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => setFontUploadModalOpen(true)}
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
            onClick={() =>
              updateSelectedBlock((b) => ({
                ...b,
                fontSize: Math.max(7, Math.round((b.fontSize - 0.5) * 10) / 10),
              }))
            }
          >
            -
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                className="h-7 w-9 text-xs font-mono font-semibold hover:bg-accent focus:outline-hidden text-foreground text-center shrink-0"
                title="Font Size in Points"
              >
                {selectedBlock?.fontSize || 9.5}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="min-w-16 max-h-48 overflow-y-auto">
              {PRESET_FONT_SIZES.map((sz) => (
                <DropdownMenuItem
                  key={sz}
                  className="text-xs font-mono justify-center cursor-pointer text-foreground"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => updateSelectedBlock((b) => ({ ...b, fontSize: sz }))}
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
            onClick={() =>
              updateSelectedBlock((b) => ({
                ...b,
                fontSize: Math.min(36, Math.round((b.fontSize + 0.5) * 10) / 10),
              }))
            }
          >
            +
          </Button>
        </div>

        <div className="h-4 w-px bg-border/80 mx-1 shrink-0" />

        {/* Character Formatting (Bold, Italic, Underline, Strikethrough, Color, Highlight) */}
        <div className="flex items-center gap-0.5 shrink-0">
          <Button
            variant={selectedBlock?.bold ? "secondary" : "ghost"}
            size="icon"
            className={cn(
              "size-7 rounded font-bold shrink-0",
              selectedBlock?.bold && "bg-accent text-accent-foreground",
            )}
            title="Bold (Ctrl+B)"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => updateSelectedBlock((b) => ({ ...b, bold: !b.bold }))}
          >
            <Bold className="size-3.5" />
          </Button>
          <Button
            variant={selectedBlock?.italic ? "secondary" : "ghost"}
            size="icon"
            className={cn(
              "size-7 rounded shrink-0",
              selectedBlock?.italic && "bg-accent text-accent-foreground",
            )}
            title="Italic (Ctrl+I)"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => updateSelectedBlock((b) => ({ ...b, italic: !b.italic }))}
          >
            <Italic className="size-3.5" />
          </Button>
          <Button
            variant={selectedBlock?.underline ? "secondary" : "ghost"}
            size="icon"
            className={cn(
              "size-7 rounded shrink-0",
              selectedBlock?.underline && "bg-accent text-accent-foreground",
            )}
            title="Underline (Ctrl+U)"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => updateSelectedBlock((b) => ({ ...b, underline: !b.underline }))}
          >
            <Underline className="size-3.5" />
          </Button>
          <Button
            variant={selectedBlock?.strikethrough ? "secondary" : "ghost"}
            size="icon"
            className={cn(
              "size-7 rounded shrink-0",
              selectedBlock?.strikethrough && "bg-accent text-accent-foreground",
            )}
            title="Strikethrough (Ctrl+Shift+X)"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => updateSelectedBlock((b) => ({ ...b, strikethrough: !b.strikethrough }))}
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
                  style={{ backgroundColor: selectedBlock?.color || "#111827" }}
                />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-48 p-2">
              <DropdownMenuLabel className="text-[10px] text-muted-foreground uppercase font-semibold">
                Text Color
              </DropdownMenuLabel>
              <div className="grid grid-cols-5 gap-1.5 py-1">
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    title={c.label}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => updateSelectedBlock((b) => ({ ...b, color: c.value }))}
                    className={cn(
                      "size-6 rounded-md border border-border/80 flex items-center justify-center transition-transform hover:scale-110",
                      selectedBlock?.color === c.value && "ring-2 ring-primary ring-offset-1",
                    )}
                    style={{ backgroundColor: c.value }}
                  />
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
                <span
                  className="h-1 w-3.5 rounded-full"
                  style={{
                    backgroundColor:
                      selectedBlock?.backgroundColor &&
                      selectedBlock.backgroundColor !== "transparent"
                        ? selectedBlock.backgroundColor
                        : "transparent",
                    border:
                      !selectedBlock?.backgroundColor ||
                      selectedBlock.backgroundColor === "transparent"
                        ? "1px solid #94a3b8"
                        : "none",
                  }}
                />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-44 p-2">
              <DropdownMenuLabel className="text-[10px] text-muted-foreground uppercase font-semibold">
                Highlight Color
              </DropdownMenuLabel>
              <div className="grid grid-cols-6 gap-1.5 py-1">
                {PRESET_HIGHLIGHT_COLORS.map((hc) => (
                  <button
                    key={hc.value}
                    type="button"
                    title={hc.label}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() =>
                      updateSelectedBlock((b) => ({ ...b, backgroundColor: hc.value }))
                    }
                    className={cn(
                      "size-6 rounded-md border border-border flex items-center justify-center transition-transform hover:scale-110",
                      selectedBlock?.backgroundColor === hc.value &&
                        "ring-2 ring-primary ring-offset-1",
                    )}
                    style={{ backgroundColor: hc.value === "transparent" ? "#ffffff" : hc.value }}
                  >
                    {hc.value === "transparent" && <Minus className="size-3 text-slate-400" />}
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
            variant={
              selectedBlock?.align === "left" || !selectedBlock?.align ? "secondary" : "ghost"
            }
            size="icon"
            className="size-7 rounded shrink-0"
            title="Align Left (Ctrl+L)"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => updateSelectedBlock((b) => ({ ...b, align: "left" }))}
          >
            <AlignLeft className="size-3.5" />
          </Button>
          <Button
            variant={selectedBlock?.align === "center" ? "secondary" : "ghost"}
            size="icon"
            className="size-7 rounded shrink-0"
            title="Align Center (Ctrl+E)"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => updateSelectedBlock((b) => ({ ...b, align: "center" }))}
          >
            <AlignCenter className="size-3.5" />
          </Button>
          <Button
            variant={selectedBlock?.align === "right" ? "secondary" : "ghost"}
            size="icon"
            className="size-7 rounded shrink-0"
            title="Align Right (Ctrl+R)"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => updateSelectedBlock((b) => ({ ...b, align: "right" }))}
          >
            <AlignRight className="size-3.5" />
          </Button>
          <Button
            variant={selectedBlock?.align === "justify" ? "secondary" : "ghost"}
            size="icon"
            className="size-7 rounded shrink-0"
            title="Justify (Ctrl+J)"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => updateSelectedBlock((b) => ({ ...b, align: "justify" }))}
          >
            <AlignJustify className="size-3.5" />
          </Button>
        </div>

        <div className="h-4 w-px bg-border/80 mx-1 shrink-0" />

        {/* Spacing & Letter Spacing */}
        <div className="flex items-center gap-1 shrink-0">
          {/* Line Height Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onMouseDown={(e) => e.preventDefault()}
                className="h-7 text-xs px-2 w-[72px] shrink-0 justify-between gap-1"
                title="Line Spacing (Ctrl+1, Ctrl+2, Ctrl+5)"
              >
                <SplitSquareVertical className="size-3.5 text-muted-foreground shrink-0" />
                <span className="text-[11px] font-mono text-center flex-1">
                  {selectedBlock?.lineHeight ? `${selectedBlock.lineHeight}x` : "1.25x"}
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
                    (selectedBlock?.lineHeight || 1.25) === lh.value && "bg-accent font-semibold",
                  )}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => updateSelectedBlock((b) => ({ ...b, lineHeight: lh.value }))}
                >
                  <span>{lh.label}</span>
                  {(selectedBlock?.lineHeight || 1.25) === lh.value && (
                    <Check className="size-3.5 text-primary" />
                  )}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-xs cursor-pointer text-primary"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() =>
                  updateSelectedBlock((b) => ({
                    ...b,
                    spaceBefore: (b.spaceBefore || 0) + 4,
                  }))
                }
              >
                <MoveUp className="size-3.5 mr-1" /> Add Space Before Paragraph
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-xs cursor-pointer text-primary"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() =>
                  updateSelectedBlock((b) => ({
                    ...b,
                    spaceAfter: (b.spaceAfter || 0) + 4,
                  }))
                }
              >
                <MoveDown className="size-3.5 mr-1" /> Add Space After Paragraph
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Letter Spacing (Kerning) */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onMouseDown={(e) => e.preventDefault()}
                className="h-7 text-xs px-2 w-[70px] shrink-0 justify-between gap-1"
                title="Letter Spacing (Kerning)"
              >
                <Space className="size-3.5 text-muted-foreground shrink-0" />
                <span className="text-[11px] font-mono text-center flex-1">
                  {typeof selectedBlock?.letterSpacing === "number"
                    ? `${selectedBlock.letterSpacing}pt`
                    : "0pt"}
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
                    (selectedBlock?.letterSpacing || 0) === ls.value && "bg-accent font-semibold",
                  )}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => updateSelectedBlock((b) => ({ ...b, letterSpacing: ls.value }))}
                >
                  <span>{ls.label}</span>
                  {(selectedBlock?.letterSpacing || 0) === ls.value && (
                    <Check className="size-3.5 text-primary" />
                  )}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="h-4 w-px bg-border/80 mx-1 shrink-0" />

        {/* Lists & Indentation Controls */}
        <div className="flex items-center gap-0.5 shrink-0">
          <Button
            variant={
              selectedBlock &&
              (selectedBlock.isBullet || BULLET_PREFIX_REGEX.test(selectedBlock.text.trim()))
                ? "secondary"
                : "ghost"
            }
            size="icon"
            className="size-7 rounded shrink-0"
            title="Bulleted List (Ctrl+Shift+8)"
            onMouseDown={(e) => e.preventDefault()}
            onClick={handleToggleBullet}
          >
            <List className="size-3.5" />
          </Button>
          <Button
            variant={
              selectedBlock &&
              (selectedBlock.isNumbered || NUMBERED_PREFIX_REGEX.test(selectedBlock.text.trim()))
                ? "secondary"
                : "ghost"
            }
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
            onClick={() => handleIndent(-12)}
          >
            <Outdent className="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-7 rounded shrink-0"
            title="Increase Indent (Tab)"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => handleIndent(12)}
          >
            <Indent className="size-3.5" />
          </Button>
        </div>

        <div className="h-4 w-px bg-border/80 mx-1 shrink-0" />

        {/* Quick Insert Actions */}
        <div className="flex items-center gap-1 shrink-0">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs px-2.5 gap-1.5 shrink-0 hover:bg-sky-50 dark:hover:bg-sky-950/40"
            title="Insert Section Header"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => handleInsertToolbarParagraph("heading")}
          >
            <Type className="size-3.5 text-sky-600 dark:text-sky-400" />
            <span className="hidden sm:inline font-medium">Section</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs px-2.5 gap-1.5 shrink-0 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
            title="Insert Bullet Point"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => handleInsertToolbarParagraph("bullet")}
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
            onClick={() => handleInsertToolbarParagraph("normal")}
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
                Insert Section Divider
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
            title="Move Paragraph Up"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => handleMoveParagraph("up")}
          >
            <MoveUp className="size-3" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-7 rounded shrink-0"
            title="Move Paragraph Down"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => handleMoveParagraph("down")}
          >
            <MoveDown className="size-3" />
          </Button>

          {/* Delete Paragraph */}
          <Button
            variant="ghost"
            size="icon"
            className="size-7 rounded text-destructive hover:bg-destructive/10 shrink-0"
            title="Delete Paragraph"
            onMouseDown={(e) => e.preventDefault()}
            onClick={handleDeleteParagraph}
            disabled={blocks.length <= 1}
          >
            <Trash2 className="size-3" />
          </Button>

          {/* Clear Formatting */}
          <Button
            variant="ghost"
            size="icon"
            className="size-7 rounded hover:bg-accent shrink-0"
            title="Clear Formatting (Ctrl+\)"
            onMouseDown={(e) => e.preventDefault()}
            onClick={handleClearFormatting}
          >
            <RemoveFormatting className="size-3.5" />
          </Button>
        </div>

        {/* Block Column Slot Selector (Active in Multi-Column Mode) */}
        {columnLayout !== "single" && (
          <div className="flex items-center gap-1 bg-muted/70 px-1.5 py-0.5 rounded border border-border shrink-0">
            <span className="text-[10px] text-muted-foreground font-semibold">Slot:</span>
            <Button
              variant={
                !selectedBlock?.columnSlot || selectedBlock.columnSlot === "full"
                  ? "secondary"
                  : "ghost"
              }
              size="sm"
              className={cn(
                "h-6 text-[10px] px-2 font-medium rounded",
                (!selectedBlock?.columnSlot || selectedBlock.columnSlot === "full") &&
                  "bg-background text-foreground shadow-xs font-semibold",
              )}
              title="Span 100% full width banner"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => updateSelectedBlock((b) => ({ ...b, columnSlot: "full" }))}
            >
              Full Width
            </Button>
            <Button
              variant={selectedBlock?.columnSlot === "left" ? "secondary" : "ghost"}
              size="sm"
              className={cn(
                "h-6 text-[10px] px-2 font-medium rounded",
                selectedBlock?.columnSlot === "left" &&
                  "bg-background text-foreground shadow-xs font-semibold",
              )}
              title="Place in Left Column"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => updateSelectedBlock((b) => ({ ...b, columnSlot: "left" }))}
            >
              Left Col
            </Button>
            <Button
              variant={selectedBlock?.columnSlot === "right" ? "secondary" : "ghost"}
              size="sm"
              className={cn(
                "h-6 text-[10px] px-2 font-medium rounded",
                selectedBlock?.columnSlot === "right" &&
                  "bg-background text-foreground shadow-xs font-semibold",
              )}
              title="Place in Right Column"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => updateSelectedBlock((b) => ({ ...b, columnSlot: "right" }))}
            >
              Right Col
            </Button>
          </div>
        )}

        {/* Document Page Setup & Zoom */}
        <div className="flex items-center gap-1.5 ml-auto shrink-0">
          {/* Column Layout Selector */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                onMouseDown={(e) => e.preventDefault()}
                className="h-7 text-xs px-2 w-[112px] shrink-0 justify-between gap-1 font-medium text-foreground"
                title="Resume Column Layout"
              >
                <Columns2 className="size-3.5 text-muted-foreground shrink-0" />
                <span className="truncate flex-1 text-left">
                  {COLUMN_LAYOUT_PRESETS.find((p) => p.id === columnLayout)?.label.split(" ")[0] ||
                    "Layout"}
                </span>
                <ChevronDown className="size-3 opacity-60 shrink-0" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuLabel className="text-[10px] text-muted-foreground uppercase font-semibold">
                Resume Column Layout
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {COLUMN_LAYOUT_PRESETS.map((preset) => (
                <DropdownMenuItem
                  key={preset.id}
                  className={cn(
                    "cursor-pointer text-xs flex flex-col items-start gap-0.5 text-foreground py-1.5",
                    columnLayout === preset.id && "bg-accent font-semibold",
                  )}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    setColumnLayout(preset.id);
                    onColumnLayoutChange?.(preset.id);
                  }}
                >
                  <div className="flex items-center justify-between w-full">
                    <span>{preset.label}</span>
                    {columnLayout === preset.id && <Check className="size-3.5 text-primary" />}
                  </div>
                  <span className="text-[10px] text-muted-foreground font-normal">
                    {preset.desc}
                  </span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Paper Size Switcher (US Letter vs A4) */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                onMouseDown={(e) => e.preventDefault()}
                className="h-7 text-xs px-2 w-[96px] shrink-0 justify-between gap-1 font-medium text-foreground"
                title="Paper Size Format"
              >
                <Layout className="size-3.5 text-muted-foreground shrink-0" />
                <span className="truncate flex-1 text-left">
                  {paperFormat === "letter" ? "US Letter" : "A4"}
                </span>
                <ChevronDown className="size-3 opacity-60 shrink-0" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="text-[10px] text-muted-foreground uppercase font-semibold">
                Resume Paper Format
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {PAPER_FORMAT_PRESETS.map((pf) => (
                <DropdownMenuItem
                  key={pf.id}
                  className={cn(
                    "cursor-pointer text-xs flex flex-col items-start gap-0.5 text-foreground",
                    paperFormat === pf.id && "bg-accent font-semibold",
                  )}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => handleSwitchPaperFormat(pf.id as "letter" | "a4")}
                >
                  <div className="flex items-center justify-between w-full">
                    <span>{pf.label}</span>
                    {paperFormat === pf.id && <Check className="size-3.5 text-primary" />}
                  </div>
                  <span className="text-[10px] text-muted-foreground font-normal">{pf.desc}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Margins Presets */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onMouseDown={(e) => e.preventDefault()}
                className="h-7 text-xs px-2 w-[74px] shrink-0 justify-between gap-1 text-muted-foreground"
                title="Page Margins"
              >
                <span className="text-[11px] truncate flex-1 text-center font-mono">
                  {pageMargin === 54 ? "1.0 in" : pageMargin === 40 ? "0.75 in" : "0.50 in"}
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
                  className={cn(
                    "text-xs cursor-pointer justify-between text-foreground",
                    pageMargin === m.value && "bg-accent font-semibold",
                  )}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    setPageMargin(m.value);
                    const updated = blocks.map((b) => ({
                      ...b,
                      x: m.value,
                      width: targetPreset.width - m.value * 2,
                    }));
                    pushHistory(updated, pages);
                  }}
                >
                  <span>{m.label}</span>
                  {pageMargin === m.value && <Check className="size-3.5 text-primary" />}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Add Page Button */}
          <Button
            variant="outline"
            size="sm"
            onMouseDown={(e) => e.preventDefault()}
            className="h-7 text-xs px-2.5 gap-1.5 shrink-0 font-medium hover:bg-accent text-foreground"
            onClick={handleAddPage}
            title="Add Page to Document (Ctrl+Enter)"
          >
            <FilePlus className="size-3.5 text-primary" />
            <span className="hidden sm:inline">Add Page</span>
          </Button>

          {/* Zoom controls */}
          <div className="flex items-center border border-border rounded overflow-hidden shrink-0">
            <Button
              variant="ghost"
              size="icon"
              className="w-6 h-7 rounded-none px-1 text-xs hover:bg-accent shrink-0"
              title="Zoom Out"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setZoom((z) => Math.max(0.65, Math.round((z - 0.1) * 10) / 10))}
            >
              <ZoomOut className="size-3" />
            </Button>
            <span className="text-[11px] font-mono w-11 text-center text-foreground shrink-0 select-none">
              {Math.round(zoom * 100)}%
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="w-6 h-7 rounded-none px-1 text-xs hover:bg-accent shrink-0"
              title="Zoom In"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setZoom((z) => Math.min(1.75, Math.round((z + 0.1) * 10) / 10))}
            >
              <ZoomIn className="size-3" />
            </Button>
          </div>
        </div>
      </div>

      {/* 2. DOCUMENT METADATA RULER / STATUS BAR */}
      <div className="bg-muted/40 border-b border-border/60 px-4 py-1 flex items-center justify-between text-[11px] text-muted-foreground select-none">
        <div className="flex items-center gap-3">
          <span className="font-medium flex items-center gap-1.5 text-foreground">
            <FileText className="size-3.5 text-primary" />
            <span>Document Editor</span>
          </span>
          <span className="text-border">|</span>
          <span>
            Page {activePageIndex + 1} of {pages.length}
          </span>
          <span className="text-border">|</span>
          <span>{totalWordCount} words</span>
          <span className="text-border">|</span>
          <span>{blocks.length} paragraphs</span>
        </div>

        <div className="flex items-center gap-3">
          {biasSpans.length > 0 && (
            <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400 font-medium">
              <Sparkles className="size-3" />
              <span>{biasSpans.length} bias highlights tracked</span>
            </span>
          )}
          <span className="text-[10px] bg-secondary/80 text-muted-foreground px-2 py-0.5 rounded font-mono">
            {paperFormat === "letter" ? "US Letter (612 × 792 pt)" : "A4 (595 × 842 pt)"}
          </span>
        </div>
      </div>

      {/* 3. PAGINATED WORD / GOOGLE DOCS CANVAS CONTAINER (STRICT FORMAL DIMENSIONS, NEVER STRETCHES) */}
      <div
        ref={editorContainerRef}
        className="flex-1 overflow-auto p-4 sm:p-8 flex flex-col items-center gap-8 bg-slate-200/70 dark:bg-zinc-950/90 select-text"
      >
        {pagesData.map(({ page, index, blocks: pageBlocks }) => {
          const pageWidth = page.width || (paperFormat === "letter" ? 612 : 595.28);
          const pageHeight = page.height || (paperFormat === "letter" ? 792 : 841.89);

          return (
            <div
              key={page.id}
              onClick={() => setActivePageIndex(index)}
              style={{
                width: `${pageWidth * zoom}px`,
                height: `${pageHeight * zoom}px`,
                minHeight: `${pageHeight * zoom}px`,
                maxHeight: `${pageHeight * zoom}px`,
                transformOrigin: "top center",
              }}
              className={cn(
                "relative bg-white text-slate-900 rounded-sm shadow-md border border-slate-300 dark:border-zinc-800 flex flex-col overflow-hidden",
                activePageIndex === index && "ring-1 ring-primary/30",
              )}
            >
              {/* Subtle Document Header Stamp */}
              <div
                className="flex items-center justify-between text-[10px] text-slate-400 font-mono select-none border-b border-slate-100 shrink-0"
                style={{
                  paddingLeft: `${pageMargin * zoom}px`,
                  paddingRight: `${pageMargin * zoom}px`,
                  paddingTop: `${10 * zoom}px`,
                  paddingBottom: `${6 * zoom}px`,
                }}
              >
                <span>Curriculum Vitae</span>
                <div className="flex items-center gap-2">
                  <span>
                    Page {index + 1} of {pages.length}
                  </span>
                  {pages.length > 1 && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemovePage(index);
                      }}
                      className="text-slate-400 hover:text-red-600 transition-colors cursor-pointer"
                      title="Delete this page"
                    >
                      <Trash2 className="size-3" />
                    </button>
                  )}
                </div>
              </div>

              {/* Natural Document Body (Clean Text, No Boxes, Natural Cursor, Strict Fixed Page Height) */}
              <div
                className="flex-1 flex flex-col overflow-hidden"
                style={{
                  paddingLeft: `${pageMargin * zoom}px`,
                  paddingRight: `${pageMargin * zoom}px`,
                  paddingTop: `${14 * zoom}px`,
                  paddingBottom: `${20 * zoom}px`,
                }}
              >
                {pageBlocks.length === 0 ? (
                  <div
                    className="p-8 text-center text-slate-400 border border-dashed border-slate-200 rounded-md cursor-pointer hover:border-primary/50 transition-colors"
                    onClick={() => handleInsertToolbarParagraph("normal")}
                  >
                    <Plus className="size-5 mx-auto mb-1 text-slate-400" />
                    <p className="text-xs">Page is empty. Click to add text.</p>
                  </div>
                ) : columnLayout === "single" ? (
                  pageBlocks.map((block) => (
                    <ParagraphBlockItem
                      key={block.id}
                      block={block}
                      zoom={zoom}
                      biasSpans={biasSpans}
                      isSelected={selectedBlockId === block.id}
                      onSelect={() => {
                        setSelectedBlockId(block.id);
                        setActivePageIndex(block.pageIndex);
                        if (onSelectBlock) onSelectBlock(block.id);
                      }}
                      onTextChange={(newText) => handleParagraphTextChange(block.id, newText)}
                      onCellChange={handleTableCellChange}
                      onEnter={(e, currentText, selOffset) =>
                        handleBlockEnter(e, block, currentText, selOffset)
                      }
                      onBackspace={(e, currentText, selOffset) =>
                        handleBlockBackspace(e, block, currentText, selOffset)
                      }
                      onDelete={(e, currentText, selOffset) =>
                        handleBlockDelete(e, block, currentText, selOffset)
                      }
                      onArrowUp={(e, selOffset) => handleBlockArrowUp(e, block, selOffset)}
                      onArrowDown={(e, selOffset, textLen) =>
                        handleBlockArrowDown(e, block, selOffset, textLen)
                      }
                      onTab={(e, currentText, selStart, selEnd) =>
                        handleBlockTab(e, block, currentText, selStart, selEnd)
                      }
                      registerRef={(el) => {
                        if (el) editableRefs.current.set(block.id, el);
                        else editableRefs.current.delete(block.id);
                      }}
                    />
                  ))
                ) : (
                  (() => {
                    const topFullBlocks: CanvasTextBlock[] = [];
                    const leftColBlocks: CanvasTextBlock[] = [];
                    const rightColBlocks: CanvasTextBlock[] = [];
                    const bottomFullBlocks: CanvasTextBlock[] = [];

                    let inColumnSection = false;
                    for (const b of pageBlocks) {
                      if (b.columnSlot === "left") {
                        inColumnSection = true;
                        leftColBlocks.push(b);
                      } else if (b.columnSlot === "right") {
                        inColumnSection = true;
                        rightColBlocks.push(b);
                      } else if (b.columnSlot === "full") {
                        if (!inColumnSection) {
                          topFullBlocks.push(b);
                        } else {
                          bottomFullBlocks.push(b);
                        }
                      } else {
                        // Unassigned slot
                        if (!inColumnSection) {
                          topFullBlocks.push(b);
                        } else {
                          if (columnLayout === "two-column-left") {
                            rightColBlocks.push(b);
                          } else {
                            leftColBlocks.push(b);
                          }
                        }
                      }
                    }

                    // If user enabled multi-column but has not assigned left blocks yet
                    if (
                      leftColBlocks.length === 0 &&
                      rightColBlocks.length === 0 &&
                      topFullBlocks.length > 2
                    ) {
                      const splitIdx = Math.min(2, topFullBlocks.length);
                      const moved = topFullBlocks.splice(splitIdx);
                      if (columnLayout === "two-column-left") {
                        rightColBlocks.push(...moved);
                      } else {
                        leftColBlocks.push(...moved);
                      }
                    }

                    let leftColPercent = "35%";
                    let rightColPercent = "65%";
                    if (columnLayout === "two-column-right") {
                      leftColPercent = "65%";
                      rightColPercent = "35%";
                    } else if (columnLayout === "two-column-equal") {
                      leftColPercent = "50%";
                      rightColPercent = "50%";
                    }

                    const renderBlock = (block: CanvasTextBlock) => (
                      <ParagraphBlockItem
                        key={block.id}
                        block={block}
                        zoom={zoom}
                        biasSpans={biasSpans}
                        isSelected={selectedBlockId === block.id}
                        onSelect={() => {
                          setSelectedBlockId(block.id);
                          setActivePageIndex(block.pageIndex);
                          if (onSelectBlock) onSelectBlock(block.id);
                        }}
                        onTextChange={(newText) => handleParagraphTextChange(block.id, newText)}
                        onCellChange={handleTableCellChange}
                        onEnter={(e, currentText, selOffset) =>
                          handleBlockEnter(e, block, currentText, selOffset)
                        }
                        onBackspace={(e, currentText, selOffset) =>
                          handleBlockBackspace(e, block, currentText, selOffset)
                        }
                        onDelete={(e, currentText, selOffset) =>
                          handleBlockDelete(e, block, currentText, selOffset)
                        }
                        onArrowUp={(e, selOffset) => handleBlockArrowUp(e, block, selOffset)}
                        onArrowDown={(e, selOffset, textLen) =>
                          handleBlockArrowDown(e, block, selOffset, textLen)
                        }
                        onTab={(e, currentText, selStart, selEnd) =>
                          handleBlockTab(e, block, currentText, selStart, selEnd)
                        }
                        registerRef={(el) => {
                          if (el) editableRefs.current.set(block.id, el);
                          else editableRefs.current.delete(block.id);
                        }}
                      />
                    );

                    return (
                      <div className="flex flex-col flex-1">
                        {/* Top Full Width Section (Banner, Name, Contact) */}
                        {topFullBlocks.map(renderBlock)}

                        {/* 2-Column Responsive Body */}
                        <div className="flex items-start w-full gap-4 mt-2 flex-1">
                          {/* Left Column */}
                          <div
                            style={{ width: leftColPercent }}
                            className={cn(
                              "flex flex-col min-h-[80px]",
                              columnLayout === "two-column-left" &&
                                "pr-3 border-r border-slate-200 dark:border-zinc-800",
                            )}
                          >
                            {leftColBlocks.length === 0 ? (
                              <button
                                type="button"
                                onClick={() => handleInsertInSlot("left")}
                                className="p-3 text-center text-slate-400 hover:text-primary border border-dashed border-slate-200 dark:border-zinc-800 rounded text-xs cursor-pointer transition-colors"
                              >
                                + Add Left Column Block
                              </button>
                            ) : (
                              leftColBlocks.map(renderBlock)
                            )}
                          </div>

                          {/* Right Column */}
                          <div
                            style={{ width: rightColPercent }}
                            className={cn(
                              "flex flex-col min-h-[80px]",
                              columnLayout === "two-column-right" &&
                                "pl-3 border-l border-slate-200 dark:border-zinc-800",
                            )}
                          >
                            {rightColBlocks.length === 0 ? (
                              <button
                                type="button"
                                onClick={() => handleInsertInSlot("right")}
                                className="p-3 text-center text-slate-400 hover:text-primary border border-dashed border-slate-200 dark:border-zinc-800 rounded text-xs cursor-pointer transition-colors"
                              >
                                + Add Right Column Block
                              </button>
                            ) : (
                              rightColBlocks.map(renderBlock)
                            )}
                          </div>
                        </div>

                        {/* Bottom Full Width Section */}
                        {bottomFullBlocks.map(renderBlock)}
                      </div>
                    );
                  })()
                )}
              </div>

              {/* Document Page Footer Stamp */}
              <div
                className="mt-auto border-t border-slate-100 text-[9px] text-slate-400 select-none flex justify-center py-2 shrink-0"
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
      <FontUploadModal
        open={fontUploadModalOpen}
        onOpenChange={setFontUploadModalOpen}
        customFonts={customFonts}
        onFontsChanged={(newFonts) => setCustomFonts(newFonts)}
        onSelectFont={(fontFamily) => {
          updateSelectedBlock((b) => ({ ...b, fontFamily }));
        }}
      />
    </div>
  );
}
