import {
  useState,
  useRef,
  useEffect,
  type PointerEvent as ReactPointerEvent,
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
  Plus,
  Trash2,
  Copy,
  ZoomIn,
  ZoomOut,
  Maximize2,
  FilePlus,
  Type,
  ChevronDown,
  Layout,
  Sliders,
  Check,
  Undo2,
  Redo2,
  Magnet,
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
import type { CanvasTextBlock, CanvasPage } from "@/lib/pdf-cluster-engine";
import type { BiasSpan } from "@/lib/resume-contract";

const FONT_FAMILIES = [
  { label: "Inter (Modern Sans)", value: "Inter, sans-serif" },
  { label: "Poppins (Clean Geometric)", value: "'Poppins', sans-serif" },
  { label: "Montserrat (Executive Sans)", value: "'Montserrat', sans-serif" },
  { label: "Roboto (Tech Standard)", value: "Roboto, sans-serif" },
  { label: "Lato (Professional Sans)", value: "Lato, sans-serif" },
  { label: "Arial (Standard Sans)", value: "Arial, sans-serif" },
  { label: "Calibri (Corporate Sans)", value: "Calibri, sans-serif" },
  { label: "Helvetica (Editorial Sans)", value: "Helvetica, Arial, sans-serif" },
  { label: "EB Garamond (Executive Serif)", value: "'EB Garamond', Georgia, serif" },
  { label: "Merriweather (Academic Serif)", value: "Merriweather, serif" },
  { label: "Georgia (Classic Serif)", value: "Georgia, serif" },
  { label: "Times New Roman (Formal Serif)", value: "'Times New Roman', serif" },
  { label: "Courier New (Monospace)", value: "'Courier New', monospace" },
];

const PRESET_COLORS = [
  "#111827", // Charcoal
  "#1e293b", // Slate
  "#4b5563", // Gray
  "#17365d", // Navy
  "#065f46", // Forest
  "#991b1b", // Ruby
  "#6b21a8", // Purple
  "#d97706", // Amber
];

const MARGIN_PRESETS = [
  { label: "Narrow (18pt)", value: 18 },
  { label: "Compact (24pt)", value: 24 },
  { label: "Normal (36pt)", value: 36 },
  { label: "Wide (54pt)", value: 54 },
];

interface MarqueeBox {
  startX: number;
  startY: number;
  x: number;
  y: number;
  width: number;
  height: number;
  pageIndex: number;
}

interface FigmaResumeEditorProps {
  pages: CanvasPage[];
  blocks: CanvasTextBlock[];
  activeBiasSpan?: BiasSpan;
  biasSpans?: BiasSpan[];
  onChange: (updatedBlocks: CanvasTextBlock[], updatedPages: CanvasPage[]) => void;
  onSelectBlock?: (blockId: string) => void;
}

export function FigmaResumeEditor({
  pages: initialPages,
  blocks: initialBlocks,
  activeBiasSpan,
  biasSpans = [],
  onChange,
  onSelectBlock,
}: FigmaResumeEditorProps) {
  const [pages, setPages] = useState<CanvasPage[]>(() =>
    initialPages.length > 0
      ? initialPages
      : [{ id: "page-1", pageNumber: 1, width: 595, height: 842 }],
  );
  const [blocks, setBlocks] = useState<CanvasTextBlock[]>(initialBlocks);
  const [selectedBlockIds, setSelectedBlockIds] = useState<string[]>([]);
  const [editingBlockId, setEditingBlockId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [activePageIndex, setActivePageIndex] = useState(0);

  // Configurable Margins
  const [pageMargin, setPageMargin] = useState<number>(36);
  const [showMarginGuides, setShowMarginGuides] = useState<boolean>(true);
  const [autoDocking, setAutoDocking] = useState<boolean>(true);

  // Marquee Selection Box
  const [marquee, setMarquee] = useState<MarqueeBox | null>(null);

  // Dynamic Alignment Docking Guides (Canva/Figma style)
  const [activeSnapGuides, setActiveSnapGuides] = useState<Array<{
    type: "x" | "y";
    pos: number;
    pageIndex: number;
    label?: string;
  }>>([]);

  // History Stacks (Undo / Redo)
  const [history, setHistory] = useState<Array<{ blocks: CanvasTextBlock[]; pages: CanvasPage[] }>>([]);
  const [redoStack, setRedoStack] = useState<Array<{ blocks: CanvasTextBlock[]; pages: CanvasPage[] }>>([]);

  // Spacebar Pan Navigation
  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const [isPanning, setIsPanning] = useState(false);

  const canvasContainerRef = useRef<HTMLDivElement>(null);

  const primarySelectedBlock = blocks.find((b) => b.id === selectedBlockIds[0]);

  // Sync state if props change externally
  useEffect(() => {
    if (initialBlocks !== blocks) {
      setBlocks(initialBlocks);
      setSelectedBlockIds((prev) => prev.filter((id) => initialBlocks.some((b) => b.id === id)));
      if (editingBlockId && !initialBlocks.some((b) => b.id === editingBlockId)) {
        setEditingBlockId(null);
      }
    }
  }, [initialBlocks]);

  useEffect(() => {
    if (initialPages.length > 0 && initialPages !== pages) {
      setPages(initialPages);
    }
  }, [initialPages]);

  // When an active bias issue is selected in the review queue, automatically focus its block
  useEffect(() => {
    if (!activeBiasSpan) return;
    const targetBlock = blocks.find((b) =>
      b.text.toLowerCase().includes(activeBiasSpan.matched_text.toLowerCase()),
    );
    if (targetBlock) {
      setSelectedBlockIds([targetBlock.id]);
      setActivePageIndex(targetBlock.pageIndex);
      onSelectBlock?.(targetBlock.id);
    }
  }, [activeBiasSpan]);

  // Push state to undo history
  const pushHistory = (currentBlocks: CanvasTextBlock[], currentPages: CanvasPage[]) => {
    setHistory((prev) => [...prev.slice(-30), { blocks: currentBlocks, pages: currentPages }]);
    setRedoStack([]);
  };

  const undo = () => {
    if (history.length === 0) return;
    const previous = history[history.length - 1]!;
    setRedoStack((prev) => [...prev, { blocks, pages }]);
    setHistory((prev) => prev.slice(0, prev.length - 1));
    setBlocks(previous.blocks);
    setPages(previous.pages);
    onChange(previous.blocks, previous.pages);
  };

  const redo = () => {
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1]!;
    setHistory((prev) => [...prev, { blocks, pages }]);
    setRedoStack((prev) => prev.slice(0, prev.length - 1));
    setBlocks(next.blocks);
    setPages(next.pages);
    onChange(next.blocks, next.pages);
  };

  const updateBlocksState = (
    nextBlocks: CanvasTextBlock[],
    customPages?: CanvasPage[],
    recordHistory = true,
  ) => {
    let nextPages = customPages || pages;

    if (recordHistory) {
      pushHistory(blocks, pages);
    }

    // Automatic Page Overflow Detection & Creation
    nextBlocks.forEach((block) => {
      const currentPage = nextPages[block.pageIndex] || nextPages[0];
      const bottom = block.y + (block.height || 30);
      const pageLimit = (currentPage?.height || 842) - pageMargin;

      if (bottom > pageLimit) {
        const neededPageIdx = block.pageIndex + 1;
        if (!nextPages[neededPageIdx]) {
          const newPage: CanvasPage = {
            id: `page-${neededPageIdx + 1}`,
            pageNumber: neededPageIdx + 1,
            width: currentPage?.width || 595,
            height: currentPage?.height || 842,
          };
          nextPages = [...nextPages, newPage];
        }
      }
    });

    setBlocks(nextBlocks);
    setPages(nextPages);
    onChange(nextBlocks, nextPages);
  };

  // Updates all currently selected blocks
  const updateSelectedBlocks = (patch: Partial<CanvasTextBlock>) => {
    if (selectedBlockIds.length === 0) return;
    const next = blocks.map((b) => (selectedBlockIds.includes(b.id) ? { ...b, ...patch } : b));
    updateBlocksState(next);
  };

  // Figma Frame Alignment (respects active pageMargin)
  const alignFrame = (type: "left" | "center" | "right" | "top" | "bottom") => {
    if (selectedBlockIds.length === 0) return;
    const page = pages[activePageIndex] || pages[0]!;

    const next = blocks.map((b) => {
      if (!selectedBlockIds.includes(b.id)) return b;

      let newX = b.x;
      let newY = b.y;

      switch (type) {
        case "left":
          newX = pageMargin;
          break;
        case "center":
          newX = Math.round((page.width - b.width) / 2);
          break;
        case "right":
          newX = Math.round(page.width - pageMargin - b.width);
          break;
        case "top":
          newY = pageMargin;
          break;
        case "bottom":
          newY = Math.round(page.height - pageMargin - (b.height || 30));
          break;
      }

      return { ...b, x: Math.max(8, newX), y: Math.max(8, newY) };
    });

    updateBlocksState(next);
  };

  // Add New Text Frame
  const handleAddNewTextBlock = (targetPageIdx = activePageIndex) => {
    const page = pages[targetPageIdx] || pages[0]!;
    const id = `frame-${Date.now()}`;
    const newBlock: CanvasTextBlock = {
      id,
      pageIndex: targetPageIdx,
      text: "New text frame",
      x: pageMargin,
      y: pageMargin + 40,
      width: Math.min(280, page.width - pageMargin * 2),
      height: 24,
      fontSize: 11,
      fontFamily: "Inter, sans-serif",
      bold: false,
      color: "#111827",
      align: "left",
      lineHeight: 1.25,
    };
    const next = [...blocks, newBlock];
    updateBlocksState(next);
    setSelectedBlockIds([id]);
    setEditingBlockId(id);
  };

  // Duplicate Selected Blocks
  const handleDuplicateBlocks = () => {
    if (selectedBlockIds.length === 0) return;
    const copies: CanvasTextBlock[] = [];
    const newIds: string[] = [];

    blocks.forEach((b) => {
      if (selectedBlockIds.includes(b.id)) {
        const id = `frame-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        copies.push({
          ...b,
          id,
          x: b.x + 14,
          y: b.y + 14,
        });
        newIds.push(id);
      }
    });

    const next = [...blocks, ...copies];
    updateBlocksState(next);
    setSelectedBlockIds(newIds);
  };

  // Delete Selected Blocks
  const handleDeleteBlocks = () => {
    if (selectedBlockIds.length === 0) return;
    const next = blocks.filter((b) => !selectedBlockIds.includes(b.id));
    updateBlocksState(next);
    setSelectedBlockIds([]);
    setEditingBlockId(null);
  };

  // Add Page
  const handleAddPage = () => {
    const newPageNum = pages.length + 1;
    const firstPage = pages[0]!;
    const newPage: CanvasPage = {
      id: `page-${newPageNum}`,
      pageNumber: newPageNum,
      width: firstPage.width,
      height: firstPage.height,
    };
    const nextPages = [...pages, newPage];
    setPages(nextPages);
    onChange(blocks, nextPages);
    setActivePageIndex(pages.length);
  };

  // Delete Page
  const handleDeletePage = (pageIdx: number) => {
    if (pages.length <= 1) return;
    const nextPages = pages
      .filter((_, idx) => idx !== pageIdx)
      .map((p, idx) => ({ ...p, pageNumber: idx + 1 }));
    const nextBlocks = blocks
      .filter((b) => b.pageIndex !== pageIdx)
      .map((b) => (b.pageIndex > pageIdx ? { ...b, pageIndex: b.pageIndex - 1 } : b));
    setPages(nextPages);
    updateBlocksState(nextBlocks, nextPages);
    setActivePageIndex(Math.max(0, pageIdx - 1));
  };

  // Multi-Block Drag & Move
  const handleStartDrag = (
    e: ReactPointerEvent<HTMLDivElement>,
    block: CanvasTextBlock,
  ) => {
    if (editingBlockId === block.id) return;
    e.preventDefault();
    e.stopPropagation();

    // Determine target selection set
    let targetIds = selectedBlockIds;
    if (e.shiftKey) {
      if (selectedBlockIds.includes(block.id)) {
        targetIds = selectedBlockIds.filter((id) => id !== block.id);
      } else {
        targetIds = [...selectedBlockIds, block.id];
      }
      setSelectedBlockIds(targetIds);
    } else if (!selectedBlockIds.includes(block.id)) {
      targetIds = [block.id];
      setSelectedBlockIds(targetIds);
    }

    onSelectBlock?.(block.id);

    const startX = e.clientX;
    const startY = e.clientY;
    const initialPositions = new Map(
      blocks.filter((b) => targetIds.includes(b.id)).map((b) => [b.id, { x: b.x, y: b.y }]),
    );

    const onPointerMove = (moveEvent: PointerEvent) => {
      let deltaX = (moveEvent.clientX - startX) / zoom;
      let deltaY = (moveEvent.clientY - startY) / zoom;

      const page = pages[block.pageIndex] || pages[0]!;
      const snapThreshold = 6;
      const detectedGuides: Array<{
        type: "x" | "y";
        pos: number;
        pageIndex: number;
        label?: string;
      }> = [];

      // Auto-docking / Snapping calculations for primary dragged block
      if (autoDocking) {
        const init = initialPositions.get(block.id);
        if (init) {
          const rawLeft = init.x + deltaX;
          const rawRight = rawLeft + block.width;
          const rawCenterX = rawLeft + block.width / 2;

          const rawTop = init.y + deltaY;
          const rawBottom = rawTop + (block.height || 24);
          const rawCenterY = rawTop + (block.height || 24) / 2;

          // 1. Page Margin Snapping (Left, Right)
          if (Math.abs(rawLeft - pageMargin) <= snapThreshold) {
            deltaX = pageMargin - init.x;
            detectedGuides.push({ type: "x", pos: pageMargin, pageIndex: block.pageIndex, label: "Margin" });
          } else if (Math.abs(rawRight - (page.width - pageMargin)) <= snapThreshold) {
            deltaX = page.width - pageMargin - block.width - init.x;
            detectedGuides.push({ type: "x", pos: page.width - pageMargin, pageIndex: block.pageIndex, label: "Margin" });
          }

          // 2. Page Horizontal Center Snapping
          const pageCenterX = Math.round(page.width / 2);
          if (Math.abs(rawCenterX - pageCenterX) <= snapThreshold) {
            deltaX = pageCenterX - block.width / 2 - init.x;
            detectedGuides.push({ type: "x", pos: pageCenterX, pageIndex: block.pageIndex, label: "Center" });
          }

          // 3. Page Vertical Center Snapping
          const pageCenterY = Math.round(page.height / 2);
          if (Math.abs(rawCenterY - pageCenterY) <= snapThreshold) {
            deltaY = pageCenterY - (block.height || 24) / 2 - init.y;
            detectedGuides.push({ type: "y", pos: pageCenterY, pageIndex: block.pageIndex, label: "Middle" });
          }

          // 4. Snap to other sibling blocks on the same page
          const siblings = blocks.filter(
            (b) => b.pageIndex === block.pageIndex && !targetIds.includes(b.id),
          );

          for (const sib of siblings) {
            const sibH = sib.height || 24;
            // Snap left edge
            if (Math.abs(rawLeft - sib.x) <= snapThreshold) {
              deltaX = sib.x - init.x;
              detectedGuides.push({ type: "x", pos: sib.x, pageIndex: block.pageIndex });
            }
            // Snap right edge
            else if (Math.abs(rawRight - (sib.x + sib.width)) <= snapThreshold) {
              deltaX = sib.x + sib.width - block.width - init.x;
              detectedGuides.push({ type: "x", pos: sib.x + sib.width, pageIndex: block.pageIndex });
            }
            // Snap top edge
            if (Math.abs(rawTop - sib.y) <= snapThreshold) {
              deltaY = sib.y - init.y;
              detectedGuides.push({ type: "y", pos: sib.y, pageIndex: block.pageIndex });
            }
            // Snap bottom to sibling top or bottom
            else if (Math.abs(rawTop - (sib.y + sibH)) <= snapThreshold) {
              deltaY = sib.y + sibH - init.y;
              detectedGuides.push({ type: "y", pos: sib.y + sibH, pageIndex: block.pageIndex });
            }
          }
        }
      }

      setActiveSnapGuides(detectedGuides);

      setBlocks((prev) =>
        prev.map((b) => {
          if (targetIds.includes(b.id)) {
            const init = initialPositions.get(b.id);
            if (init) {
              return {
                ...b,
                x: Math.max(0, Math.round(init.x + deltaX)),
                y: Math.max(0, Math.round(init.y + deltaY)),
              };
            }
          }
          return b;
        }),
      );
    };

    const onPointerUp = () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      setActiveSnapGuides([]);
      setBlocks((latest) => {
        pushHistory(blocks, pages);
        onChange(latest, pages);
        return latest;
      });
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
  };

  // Resize Handle Logic
  const handleStartResize = (
    e: ReactPointerEvent<HTMLDivElement>,
    block: CanvasTextBlock,
    direction: "se" | "e" | "s",
  ) => {
    e.preventDefault();
    e.stopPropagation();

    const startX = e.clientX;
    const startY = e.clientY;
    const initialWidth = block.width;
    const initialHeight = block.height || 24;

    const onPointerMove = (moveEvent: PointerEvent) => {
      const deltaX = (moveEvent.clientX - startX) / zoom;
      const deltaY = (moveEvent.clientY - startY) / zoom;

      let nextWidth = initialWidth;
      let nextHeight = initialHeight;

      if (direction === "se" || direction === "e") {
        nextWidth = Math.max(40, Math.round(initialWidth + deltaX));
      }
      if (direction === "se" || direction === "s") {
        nextHeight = Math.max(16, Math.round(initialHeight + deltaY));
      }

      setBlocks((prev) =>
        prev.map((b) =>
          b.id === block.id ? { ...b, width: nextWidth, height: nextHeight } : b,
        ),
      );
    };

    const onPointerUp = () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      setBlocks((latest) => {
        onChange(latest, pages);
        return latest;
      });
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
  };

  // Marquee Drag Selection on Page Sheet Background
  const handleStartMarquee = (
    e: ReactPointerEvent<HTMLDivElement>,
    pageElement: HTMLDivElement,
    pageIdx: number,
  ) => {
    if (e.target !== pageElement) return;
    e.preventDefault();

    if (!e.shiftKey) {
      setSelectedBlockIds([]);
    }
    setEditingBlockId(null);
    setActivePageIndex(pageIdx);

    const rect = pageElement.getBoundingClientRect();
    const startX = (e.clientX - rect.left) / zoom;
    const startY = (e.clientY - rect.top) / zoom;

    setMarquee({
      startX,
      startY,
      x: startX,
      y: startY,
      width: 0,
      height: 0,
      pageIndex: pageIdx,
    });

    const onPointerMove = (moveEvent: PointerEvent) => {
      const curX = (moveEvent.clientX - rect.left) / zoom;
      const curY = (moveEvent.clientY - rect.top) / zoom;

      const boxX = Math.min(startX, curX);
      const boxY = Math.min(startY, curY);
      const boxW = Math.abs(curX - startX);
      const boxH = Math.abs(curY - startY);

      setMarquee({
        startX,
        startY,
        x: boxX,
        y: boxY,
        width: boxW,
        height: boxH,
        pageIndex: pageIdx,
      });

      // Find all blocks on this page intersecting the marquee box
      const pageBlocks = blocks.filter((b) => b.pageIndex === pageIdx);
      const intersecting = pageBlocks.filter(
        (b) =>
          b.x < boxX + boxW &&
          b.x + b.width > boxX &&
          b.y < boxY + boxH &&
          b.y + (b.height || 20) > boxY,
      );

      setSelectedBlockIds(intersecting.map((b) => b.id));
    };

    const onPointerUp = () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      setMarquee(null);
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
  };

  // Spacebar pan navigation window listeners
  useEffect(() => {
    const handleGlobalKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.code === "Space" && !editingBlockId && (e.target as HTMLElement)?.tagName !== "INPUT" && (e.target as HTMLElement)?.tagName !== "TEXTAREA") {
        setIsSpacePressed(true);
      }
    };
    const handleGlobalKeyUp = (e: globalThis.KeyboardEvent) => {
      if (e.code === "Space") {
        setIsSpacePressed(false);
        setIsPanning(false);
      }
    };

    window.addEventListener("keydown", handleGlobalKeyDown);
    window.addEventListener("keyup", handleGlobalKeyUp);
    return () => {
      window.removeEventListener("keydown", handleGlobalKeyDown);
      window.removeEventListener("keyup", handleGlobalKeyUp);
    };
  }, [editingBlockId]);

  // Spacebar Drag Panning
  const handleStartPan = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!isSpacePressed) return;
    e.preventDefault();
    setIsPanning(true);

    const startX = e.clientX;
    const startY = e.clientY;
    const scrollLeft = canvasContainerRef.current?.scrollLeft || 0;
    const scrollTop = canvasContainerRef.current?.scrollTop || 0;

    const onPointerMove = (moveEv: PointerEvent) => {
      if (!canvasContainerRef.current) return;
      canvasContainerRef.current.scrollLeft = scrollLeft - (moveEv.clientX - startX);
      canvasContainerRef.current.scrollTop = scrollTop - (moveEv.clientY - startY);
    };

    const onPointerUp = () => {
      setIsPanning(false);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
  };

  // Keyboard Shortcuts: Delete, Duplicate, Undo, Redo, Arrow Nudging
  const handleKeyDown = (e: ReactKeyboardEvent) => {
    if (editingBlockId) return; // user is typing inside text box

    // Undo / Redo
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
      e.preventDefault();
      if (e.shiftKey) {
        redo();
      } else {
        undo();
      }
      return;
    }

    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") {
      e.preventDefault();
      redo();
      return;
    }

    // Bold (Ctrl+B / Meta+B)
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "b") {
      e.preventDefault();
      if (primarySelectedBlock) {
        updateSelectedBlocks({ bold: !primarySelectedBlock.bold });
      }
      return;
    }

    // Italic (Ctrl+I / Meta+I)
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "i") {
      e.preventDefault();
      if (primarySelectedBlock) {
        updateSelectedBlocks({ italic: !primarySelectedBlock.italic });
      }
      return;
    }

    // Underline (Ctrl+U / Meta+U)
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "u") {
      e.preventDefault();
      if (primarySelectedBlock) {
        updateSelectedBlocks({ underline: !primarySelectedBlock.underline });
      }
      return;
    }

    // Align Left: Ctrl+Shift+L
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "l") {
      e.preventDefault();
      updateSelectedBlocks({ align: "left" });
      return;
    }

    // Align Center: Ctrl+Shift+E
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "e") {
      e.preventDefault();
      updateSelectedBlocks({ align: "center" });
      return;
    }

    // Align Right: Ctrl+Shift+R
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "r") {
      e.preventDefault();
      updateSelectedBlocks({ align: "right" });
      return;
    }

    // Align Justify: Ctrl+Shift+J
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "j") {
      e.preventDefault();
      updateSelectedBlocks({ align: "justify" });
      return;
    }

    // Delete
    if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault();
      handleDeleteBlocks();
    }
    // Duplicate (Ctrl+D)
    else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "d") {
      e.preventDefault();
      handleDuplicateBlocks();
    }
    // Escape
    else if (e.key === "Escape") {
      setSelectedBlockIds([]);
      setEditingBlockId(null);
    }
    // Arrow Key Nudging (1pt or 10pt with Shift)
    else if (
      ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key) &&
      selectedBlockIds.length > 0
    ) {
      e.preventDefault();
      const step = e.shiftKey ? 10 : 1;
      let dx = 0;
      let dy = 0;
      if (e.key === "ArrowUp") dy = -step;
      if (e.key === "ArrowDown") dy = step;
      if (e.key === "ArrowLeft") dx = -step;
      if (e.key === "ArrowRight") dx = step;

      const next = blocks.map((b) =>
        selectedBlockIds.includes(b.id)
          ? { ...b, x: Math.max(0, b.x + dx), y: Math.max(0, b.y + dy) }
          : b,
      );
      updateBlocksState(next);
    }
  };

  return (
    <div
      tabIndex={0}
      onKeyDown={handleKeyDown}
      className="flex flex-col h-full w-full bg-muted/20 outline-none select-none relative overflow-hidden"
    >
      {/* --- FIGMA / CANVA TOP PROPERTIES TOOLBAR --- */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 border-b bg-card shadow-xs z-30 min-h-12">
        {/* Left: Document & Page Operations */}
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="outline"
            className="h-8 gap-1 text-xs font-semibold"
            onClick={() => handleAddNewTextBlock(activePageIndex)}
            title="Add a new text box (T)"
          >
            <Plus className="size-3.5" />
            <span>Add Text</span>
          </Button>

          <Button
            size="sm"
            variant="ghost"
            className="h-8 gap-1 text-xs text-muted-foreground hover:text-foreground"
            onClick={handleAddPage}
            title="Insert a new page frame"
          >
            <FilePlus className="size-3.5" />
            <span>Add Page</span>
          </Button>

          <div className="h-5 w-px bg-border mx-1" />

          {/* Margins Dropdown Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="sm"
                variant="outline"
                className="h-8 gap-1 text-xs font-medium px-2"
                title="Configure page margins and guidelines"
              >
                <Layout className="size-3.5 text-primary" />
                <span>Margin: {pageMargin}pt</span>
                <ChevronDown className="size-3 text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-48">
              <DropdownMenuLabel className="text-[11px] uppercase tracking-wider text-muted-foreground">
                Page Margins
              </DropdownMenuLabel>
              {MARGIN_PRESETS.map((m) => (
                <DropdownMenuItem
                  key={m.value}
                  onClick={() => setPageMargin(m.value)}
                  className="flex items-center justify-between text-xs cursor-pointer"
                >
                  <span>{m.label}</span>
                  {pageMargin === m.value && <Check className="size-3.5 text-primary" />}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <div className="px-2 py-1.5 flex items-center justify-between text-xs">
                <span>Custom:</span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setPageMargin((prev) => Math.max(12, prev - 4))}
                    className="size-5 rounded border flex items-center justify-center font-bold hover:bg-muted"
                  >
                    -
                  </button>
                  <span className="w-8 text-center font-semibold text-xs">{pageMargin}pt</span>
                  <button
                    type="button"
                    onClick={() => setPageMargin((prev) => Math.min(72, prev + 4))}
                    className="size-5 rounded border flex items-center justify-center font-bold hover:bg-muted"
                  >
                    +
                  </button>
                </div>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => setShowMarginGuides((prev) => !prev)}
                className="flex items-center justify-between text-xs cursor-pointer"
              >
                <span>Show Margin Guides</span>
                {showMarginGuides && <Check className="size-3.5 text-primary" />}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <div className="h-5 w-px bg-border mx-1" />

          {/* Undo / Redo controls */}
          <div className="flex items-center gap-0.5 bg-muted/60 p-0.5 rounded-md">
            <Button
              size="icon"
              variant="ghost"
              className="size-7"
              disabled={history.length === 0}
              onClick={undo}
              title="Undo (Ctrl+Z)"
            >
              <Undo2 className="size-3.5" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="size-7"
              disabled={redoStack.length === 0}
              onClick={redo}
              title="Redo (Ctrl+Y)"
            >
              <Redo2 className="size-3.5" />
            </Button>
          </div>

          <div className="h-5 w-px bg-border mx-1" />

          {/* Auto-Docking / Snapping Toggle (Figma/Canva style) */}
          <Button
            size="sm"
            variant={autoDocking ? "secondary" : "ghost"}
            className={cn(
              "h-8 gap-1.5 text-xs font-medium px-2.5",
              autoDocking && "bg-primary/10 text-primary hover:bg-primary/20",
            )}
            onClick={() => setAutoDocking((prev) => !prev)}
            title="Auto-dock & snap elements to page center, margins, and sibling boxes"
          >
            <Magnet className={cn("size-3.5", autoDocking ? "text-primary" : "text-muted-foreground")} />
            <span className="hidden sm:inline">Auto-Dock</span>
          </Button>

          <div className="h-5 w-px bg-border mx-1" />

          {/* Zoom controls */}
          <div className="flex items-center gap-0.5 bg-muted/60 p-0.5 rounded-md">
            <Button
              size="icon"
              variant="ghost"
              className="size-7"
              onClick={() => setZoom((z) => Math.max(0.4, Number((z - 0.1).toFixed(1))))}
              title="Zoom out"
            >
              <ZoomOut className="size-3.5" />
            </Button>
            <span className="text-[11px] font-semibold w-10 text-center text-muted-foreground">
              {Math.round(zoom * 100)}%
            </span>
            <Button
              size="icon"
              variant="ghost"
              className="size-7"
              onClick={() => setZoom((z) => Math.min(2.0, Number((z + 0.1).toFixed(1))))}
              title="Zoom in"
            >
              <ZoomIn className="size-3.5" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="size-7"
              onClick={() => setZoom(1)}
              title="Reset Zoom (100%)"
            >
              <Maximize2 className="size-3.5" />
            </Button>
          </div>
        </div>

        {/* Center / Right: Formatting Inspector */}
        {primarySelectedBlock ? (
          <div className="flex flex-wrap items-center gap-1.5 animate-in fade-in duration-150">
            {selectedBlockIds.length > 1 && (
              <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-semibold">
                {selectedBlockIds.length} selected
              </span>
            )}

            {/* Font Family */}
            <select
              aria-label="Font family"
              value={primarySelectedBlock.fontFamily}
              onChange={(e) => updateSelectedBlocks({ fontFamily: e.target.value })}
              className="h-8 rounded-md border bg-background px-2 text-xs font-medium outline-none focus:ring-1 focus:ring-primary w-28 truncate"
            >
              {FONT_FAMILIES.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>

            {/* Font Size Stepper & Direct Input */}
            <div className="flex items-center border rounded-md h-8 bg-background px-1">
              <button
                type="button"
                className="px-1.5 text-xs text-muted-foreground hover:text-foreground font-bold cursor-pointer"
                onClick={() =>
                  updateSelectedBlocks({ fontSize: Math.max(8, Number((primarySelectedBlock.fontSize - 1).toFixed(1))) })
                }
                title="Decrease font size"
              >
                -
              </button>
              <input
                type="number"
                min="6"
                max="96"
                step="0.5"
                value={primarySelectedBlock.fontSize}
                onChange={(e) => {
                  const val = Number.parseFloat(e.target.value);
                  if (!Number.isNaN(val) && val >= 4 && val <= 120) {
                    updateSelectedBlocks({ fontSize: val });
                  }
                }}
                className="w-10 text-center text-xs font-semibold bg-transparent border-none outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                title="Font size in pt (click to type)"
              />
              <button
                type="button"
                className="px-1.5 text-xs text-muted-foreground hover:text-foreground font-bold cursor-pointer"
                onClick={() =>
                  updateSelectedBlocks({ fontSize: Math.min(96, Number((primarySelectedBlock.fontSize + 1).toFixed(1))) })
                }
                title="Increase font size"
              >
                +
              </button>
            </div>

            {/* Style Toggles: Bold, Italic, Underline */}
            <div className="flex items-center gap-0.5 bg-muted/60 p-0.5 rounded-md">
              <Button
                size="icon"
                variant={primarySelectedBlock.bold ? "secondary" : "ghost"}
                className={cn("size-7", primarySelectedBlock.bold && "bg-background shadow-xs font-bold")}
                onClick={() => updateSelectedBlocks({ bold: !primarySelectedBlock.bold })}
                title="Bold (Ctrl+B)"
              >
                <Bold className="size-3.5" />
              </Button>
              <Button
                size="icon"
                variant={primarySelectedBlock.italic ? "secondary" : "ghost"}
                className={cn("size-7", primarySelectedBlock.italic && "bg-background shadow-xs italic")}
                onClick={() => updateSelectedBlocks({ italic: !primarySelectedBlock.italic })}
                title="Italic (Ctrl+I)"
              >
                <Italic className="size-3.5" />
              </Button>
              <Button
                size="icon"
                variant={primarySelectedBlock.underline ? "secondary" : "ghost"}
                className={cn("size-7", primarySelectedBlock.underline && "bg-background shadow-xs underline")}
                onClick={() => updateSelectedBlocks({ underline: !primarySelectedBlock.underline })}
                title="Underline (Ctrl+U)"
              >
                <Underline className="size-3.5" />
              </Button>
            </div>

            {/* Text Alignment */}
            <div className="flex items-center gap-0.5 bg-muted/60 p-0.5 rounded-md">
              <Button
                size="icon"
                variant={primarySelectedBlock.align === "left" || !primarySelectedBlock.align ? "secondary" : "ghost"}
                className="size-7"
                onClick={() => updateSelectedBlocks({ align: "left" })}
                title="Align text left (Ctrl+Shift+L)"
              >
                <AlignLeft className="size-3.5" />
              </Button>
              <Button
                size="icon"
                variant={primarySelectedBlock.align === "center" ? "secondary" : "ghost"}
                className="size-7"
                onClick={() => updateSelectedBlocks({ align: "center" })}
                title="Align text center (Ctrl+Shift+E)"
              >
                <AlignCenter className="size-3.5" />
              </Button>
              <Button
                size="icon"
                variant={primarySelectedBlock.align === "right" ? "secondary" : "ghost"}
                className="size-7"
                onClick={() => updateSelectedBlocks({ align: "right" })}
                title="Align text right (Ctrl+Shift+R)"
              >
                <AlignRight className="size-3.5" />
              </Button>
              <Button
                size="icon"
                variant={primarySelectedBlock.align === "justify" ? "secondary" : "ghost"}
                className="size-7"
                onClick={() => updateSelectedBlocks({ align: "justify" })}
                title="Justify text (Ctrl+Shift+J)"
              >
                <AlignJustify className="size-3.5" />
              </Button>
            </div>

            {/* Frame Alignment to Margins (Figma style) */}
            <div className="flex items-center gap-0.5 bg-muted/60 p-0.5 rounded-md">
              <Button
                size="icon"
                variant="ghost"
                className="size-7"
                onClick={() => alignFrame("left")}
                title={`Align frame to left margin (${pageMargin}pt)`}
              >
                <span className="text-[10px] font-bold">|◀</span>
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="size-7"
                onClick={() => alignFrame("center")}
                title="Center frame horizontally on page"
              >
                <span className="text-[10px] font-bold">▶|◀</span>
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="size-7"
                onClick={() => alignFrame("right")}
                title={`Align frame to right margin (${pageMargin}pt)`}
              >
                <span className="text-[10px] font-bold">▶|</span>
              </Button>
            </div>

            {/* Color Swatch Picker */}
            <div className="flex items-center gap-1 pl-1">
              <div className="flex items-center gap-1">
                {PRESET_COLORS.slice(0, 5).map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => updateSelectedBlocks({ color })}
                    className={cn(
                      "size-4 rounded-full border transition-transform",
                      primarySelectedBlock.color === color && "ring-2 ring-primary scale-110",
                    )}
                    style={{ backgroundColor: color }}
                    title={color}
                  />
                ))}
              </div>
              <input
                type="color"
                value={primarySelectedBlock.color || "#111827"}
                onChange={(e) => updateSelectedBlocks({ color: e.target.value })}
                className="size-6 cursor-pointer rounded-full border border-border p-0 bg-transparent"
                title="Custom color"
              />
            </div>

            <div className="h-5 w-px bg-border mx-1" />

            {/* Action buttons: Duplicate, Delete */}
            <Button
              size="icon"
              variant="ghost"
              className="size-7 text-muted-foreground hover:text-foreground"
              onClick={handleDuplicateBlocks}
              title="Duplicate selected (Ctrl+D)"
            >
              <Copy className="size-3.5" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="size-7 text-destructive hover:bg-destructive/10"
              onClick={handleDeleteBlocks}
              title="Delete selected (Del)"
            >
              <Trash2 className="size-3.5" />
            </Button>
          </div>
        ) : (
          <div className="text-xs text-muted-foreground italic flex items-center gap-1">
            <span>Drag on background to multi-select or click any text box</span>
          </div>
        )}
      </div>

      {/* --- FIGMA CANVAS ARTBOARD VIEW --- */}
      <div
        ref={canvasContainerRef}
        onPointerDown={handleStartPan}
        onClick={(e) => {
          if (e.target === canvasContainerRef.current) {
            setSelectedBlockIds([]);
            setEditingBlockId(null);
          }
        }}
        className={cn(
          "flex-1 overflow-auto p-8 flex flex-col items-center gap-10 bg-slate-100/90 dark:bg-zinc-950/70",
          isSpacePressed && "cursor-grab",
          isPanning && "cursor-grabbing select-none",
        )}
        style={{
          backgroundImage:
            "radial-gradient(circle, rgba(150, 150, 150, 0.15) 1px, transparent 1px)",
          backgroundSize: "20px 20px",
        }}
      >
        {pages.map((page, pageIdx) => {
          const pageBlocks = blocks.filter((b) => b.pageIndex === pageIdx);

          return (
            <div
              key={page.id}
              onClick={() => setActivePageIndex(pageIdx)}
              className="relative flex flex-col items-center group"
            >
              {/* Page Frame Label */}
              <div className="w-full flex items-center justify-between pb-1 px-1 text-xs text-muted-foreground">
                <span className="font-semibold text-[11px] uppercase tracking-wider text-muted-foreground/80">
                  Page {page.pageNumber} of {pages.length} (A4 Frame)
                </span>
                {pages.length > 1 && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 text-[11px] text-destructive hover:bg-destructive/10"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeletePage(pageIdx);
                    }}
                  >
                    Delete Page
                  </Button>
                )}
              </div>

              {/* White A4 Page Sheet */}
              <div
                id={`figma-page-${page.id}`}
                onPointerDown={(e) => handleStartMarquee(e, e.currentTarget, pageIdx)}
                className="relative bg-white text-zinc-900 shadow-2xl rounded-[2px] border border-zinc-200/80 transition-transform origin-top select-none"
                style={{
                  width: page.width * zoom,
                  height: page.height * zoom,
                  transform: `scale(1)`,
                }}
              >
                {/* Visual Margin Guides */}
                {showMarginGuides && (
                  <div
                    className="pointer-events-none absolute border border-dashed border-primary/25 rounded-xs transition-all"
                    style={{
                      left: pageMargin * zoom,
                      top: pageMargin * zoom,
                      right: pageMargin * zoom,
                      bottom: pageMargin * zoom,
                    }}
                    aria-hidden="true"
                  >
                    <span className="absolute -top-3.5 left-2 text-[9px] font-semibold text-primary/60 tracking-wider">
                      {pageMargin}pt Margin
                    </span>
                  </div>
                )}

                {/* Dynamic Alignment Snapping Guidelines (Canva/Figma Magenta/Blue Lines) */}
                {activeSnapGuides
                  .filter((g) => g.pageIndex === pageIdx)
                  .map((guide, gIdx) =>
                    guide.type === "x" ? (
                      <div
                        key={`guide-x-${gIdx}`}
                        className="pointer-events-none absolute top-0 bottom-0 border-l border-pink-500 z-40"
                        style={{ left: guide.pos * zoom }}
                      >
                        {guide.label && (
                          <span className="absolute top-2 left-1 bg-pink-500 text-white text-[8px] font-bold px-1 rounded-xs uppercase tracking-wider shadow-xs">
                            {guide.label}
                          </span>
                        )}
                      </div>
                    ) : (
                      <div
                        key={`guide-y-${gIdx}`}
                        className="pointer-events-none absolute left-0 right-0 border-t border-pink-500 z-40"
                        style={{ top: guide.pos * zoom }}
                      >
                        {guide.label && (
                          <span className="absolute left-2 -top-3.5 bg-pink-500 text-white text-[8px] font-bold px-1 rounded-xs uppercase tracking-wider shadow-xs">
                            {guide.label}
                          </span>
                        )}
                      </div>
                    ),
                  )}

                {/* Empty Page State Placeholder */}
                {pageBlocks.length === 0 && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center text-zinc-400 pointer-events-none">
                    <p className="text-xs font-medium">Page {page.pageNumber} is empty</p>
                    <p className="text-[11px] text-zinc-400/80 mt-1">
                      Click <strong className="text-zinc-600">Add Text</strong> above or drag text frames here
                    </p>
                  </div>
                )}

                {/* Marquee Selection Rectangle */}
                {marquee && marquee.pageIndex === pageIdx && (
                  <div
                    className="absolute border border-primary bg-primary/15 pointer-events-none z-50 rounded-xs"
                    style={{
                      left: marquee.x * zoom,
                      top: marquee.y * zoom,
                      width: marquee.width * zoom,
                      height: marquee.height * zoom,
                    }}
                  />
                )}

                {/* Unified Multi-Selection Bounding Box (Figma/Canva group outline) */}
                {(() => {
                  const selectedPageBlocks = pageBlocks.filter((b) => selectedBlockIds.includes(b.id));
                  if (selectedPageBlocks.length <= 1) return null;
                  const minX = Math.min(...selectedPageBlocks.map((b) => b.x));
                  const minY = Math.min(...selectedPageBlocks.map((b) => b.y));
                  const maxX = Math.max(...selectedPageBlocks.map((b) => b.x + b.width));
                  const maxY = Math.max(...selectedPageBlocks.map((b) => b.y + (b.height || 24)));
                  const pad = 4;
                  return (
                    <div
                      className="absolute border border-dashed border-primary pointer-events-none z-20 rounded-xs bg-primary/5"
                      style={{
                        left: (minX - pad) * zoom,
                        top: (minY - pad) * zoom,
                        width: (maxX - minX + pad * 2) * zoom,
                        height: (maxY - minY + pad * 2) * zoom,
                      }}
                    >
                      <span className="absolute -top-5 left-0 bg-primary text-primary-foreground text-[9px] font-bold px-1.5 py-0.5 rounded-xs shadow-xs">
                        {selectedPageBlocks.length} items
                      </span>
                    </div>
                  );
                })()}

                {/* Render Canvas Text Blocks inside this page frame */}
                {pageBlocks.map((block) => {
                  const isSelected = selectedBlockIds.includes(block.id);
                  const isPrimary = selectedBlockIds[0] === block.id;
                  const isEditing = editingBlockId === block.id;

                  // Check if this block contains any flagged bias spans
                  const blockBiasSpans = biasSpans.filter((s) =>
                    block.text.toLowerCase().includes(s.matched_text.toLowerCase()),
                  );
                  const hasBias = blockBiasSpans.length > 0;

                  return (
                    <div
                      key={block.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (e.shiftKey) {
                          if (selectedBlockIds.includes(block.id)) {
                            setSelectedBlockIds((prev) => prev.filter((id) => id !== block.id));
                          } else {
                            setSelectedBlockIds((prev) => [...prev, block.id]);
                          }
                        } else {
                          setSelectedBlockIds([block.id]);
                        }
                        onSelectBlock?.(block.id);
                      }}
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        setSelectedBlockIds([block.id]);
                        setEditingBlockId(block.id);
                      }}
                      onPointerDown={(e) => handleStartDrag(e, block)}
                      className={cn(
                        "absolute group/block transition-all",
                        isSelected
                          ? "ring-2 ring-primary ring-offset-1 z-30"
                          : "hover:outline hover:outline-1 hover:outline-primary/40",
                        hasBias && !isSelected && "border-b-2 border-amber-500/80",
                      )}
                      style={{
                        left: block.x * zoom,
                        top: block.y * zoom,
                        width: block.width * zoom,
                        minHeight: (block.height || Math.round(block.fontSize * 1.3)) * zoom,
                        cursor: isEditing ? "text" : "move",
                      }}
                    >
                      {/* Active Edit Mode: Auto-sizing textarea */}
                      {isEditing ? (
                        <textarea
                          autoFocus
                          value={block.text}
                          onChange={(e) => {
                            const newText = e.target.value;
                            const target = e.target;
                            const neededHeight = Math.max(block.height || 20, Math.ceil(target.scrollHeight / zoom));
                            updateSelectedBlocks({
                              text: newText,
                              height: neededHeight,
                            });
                          }}
                          onBlur={() => setEditingBlockId(null)}
                          onKeyDown={(e) => {
                            if (e.key === "Escape") {
                              setEditingBlockId(null);
                            }
                          }}
                          className="w-full h-full bg-white/95 text-zinc-900 border-none outline-none resize-none font-inherit"
                          style={{
                            fontSize: `${block.fontSize * zoom}px`,
                            fontFamily: block.fontFamily,
                            fontWeight: block.bold ? 700 : 400,
                            fontStyle: block.italic ? "italic" : "normal",
                            textDecoration: block.underline ? "underline" : "none",
                            textAlign: block.align || "left",
                            color: block.color || "#111827",
                            lineHeight: block.lineHeight || 1.25,
                            padding: "0 2px",
                          }}
                        />
                      ) : (
                        /* Normal Display Mode: formatted text */
                        <div
                          className={cn(
                            "w-full h-full select-none",
                            block.text.includes("\n") || (block.width > 350 && block.text.length > 55)
                              ? "whitespace-pre-wrap break-words"
                              : "whitespace-nowrap",
                          )}
                          style={{
                            fontSize: `${block.fontSize * zoom}px`,
                            fontFamily: block.fontFamily,
                            fontWeight: block.bold ? 700 : 400,
                            fontStyle: block.italic ? "italic" : "normal",
                            textDecoration: block.underline ? "underline" : "none",
                            textAlign: block.align || "left",
                            color: block.color || "#111827",
                            lineHeight: block.lineHeight || 1.25,
                            padding: "0 2px",
                          }}
                        >
                          {block.text}
                        </div>
                      )}

                      {/* Figma-Style Selection Handles */}
                      {isSelected && isPrimary && (
                        <>
                          <div
                            onPointerDown={(e) => handleStartResize(e, block, "se")}
                            className="absolute -bottom-1.5 -right-1.5 size-3 bg-white border-2 border-primary rounded-xs cursor-nwse-resize z-40 shadow-xs"
                          />
                          <div
                            onPointerDown={(e) => handleStartResize(e, block, "e")}
                            className="absolute top-1/2 -right-1.5 -translate-y-1/2 size-2.5 bg-white border-2 border-primary rounded-xs cursor-ew-resize z-40 shadow-xs"
                          />
                          <div
                            onPointerDown={(e) => handleStartResize(e, block, "s")}
                            className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 size-2.5 bg-white border-2 border-primary rounded-xs cursor-ns-resize z-40 shadow-xs"
                          />

                          {/* Dimension Badge */}
                          <div className="absolute -top-6 left-0 bg-primary text-primary-foreground text-[10px] px-1.5 py-0.5 rounded-sm font-semibold pointer-events-none shadow-xs whitespace-nowrap">
                            {Math.round(block.width)} × {Math.round(block.height || 24)}
                          </div>
                        </>
                      )}

                      {/* Bias Indicator Tag */}
                      {hasBias && !isSelected && (
                        <div className="absolute -top-2 -right-2 size-3.5 rounded-full bg-amber-500 text-white flex items-center justify-center text-[8px] font-bold shadow-xs">
                          !
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
