import { useState, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Type, Upload, Trash2, Check, Sparkles, FileText, Loader2 } from "lucide-react";
import {
  uploadCustomFontFile,
  deleteCustomFont,
  type CustomFontRecord,
} from "@/lib/custom-font-service";

interface FontUploadModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customFonts: CustomFontRecord[];
  onFontsChanged: (fonts: CustomFontRecord[]) => void;
  onSelectFont?: (fontFamily: string) => void;
}

export function FontUploadModal({
  open,
  onOpenChange,
  customFonts,
  onFontsChanged,
  onSelectFont,
}: FontUploadModalProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fontDisplayName, setFontDisplayName] = useState<string>("");
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (file?: File) => {
    if (!file) return;
    const lower = file.name.toLowerCase();
    if (
      !lower.endsWith(".woff2") &&
      !lower.endsWith(".woff") &&
      !lower.endsWith(".ttf") &&
      !lower.endsWith(".otf")
    ) {
      toast.error("Unsupported file format", {
        description: "Please select a .woff2, .woff, .ttf, or .otf font file.",
      });
      return;
    }

    setSelectedFile(file);
    const rawName = file.name.replace(/\.[^/.]+$/, "");
    const cleanName = rawName
      .replace(/[_-]+/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase())
      .trim();
    setFontDisplayName(cleanName);
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setIsUploading(true);
    try {
      const record = await uploadCustomFontFile(selectedFile, fontDisplayName.trim());
      const updated = [...customFonts.filter((f) => f.id !== record.id), record];
      onFontsChanged(updated);
      if (onSelectFont) {
        onSelectFont(record.family);
      }
      toast.success(`Font "${record.name}" installed`, {
        description: "You can now use this font across your resume documents.",
      });
      setSelectedFile(null);
      setFontDisplayName("");
      onOpenChange(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to load font file.";
      toast.error("Font registration failed", { description: msg });
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = (fontId: string, fontName: string) => {
    deleteCustomFont(fontId);
    const updated = customFonts.filter((f) => f.id !== fontId);
    onFontsChanged(updated);
    toast.info(`Font "${fontName}" removed`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="grid size-9 place-items-center rounded-lg bg-primary/10 text-primary">
              <Type className="size-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold">Custom Font Studio</DialogTitle>
              <DialogDescription className="text-xs">
                Upload your own .woff2, .woff, .ttf, or .otf fonts for executive branding.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* File Upload Zone */}
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-border rounded-xl p-5 text-center cursor-pointer hover:border-primary/60 hover:bg-primary/5 transition-all"
          >
            <input
              ref={fileInputRef}
              type="file"
              hidden
              accept=".woff2,.woff,.ttf,.otf"
              onChange={(e) => handleFileSelect(e.target.files?.[0])}
            />
            <div className="mx-auto flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground mb-2">
              <Upload className="size-5" />
            </div>
            {selectedFile ? (
              <div className="space-y-1">
                <p className="text-xs font-semibold text-foreground truncate">
                  {selectedFile.name}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {(selectedFile.size / 1024).toFixed(1)} KB • Click to choose a different font
                </p>
              </div>
            ) : (
              <div className="space-y-1">
                <p className="text-xs font-medium text-foreground">Click to browse font file</p>
                <p className="text-[10px] text-muted-foreground">
                  Supports WOFF2, WOFF, TTF, and OTF (Max 5MB)
                </p>
              </div>
            )}
          </div>

          {/* Name & Live Preview */}
          {selectedFile && (
            <div className="space-y-3 rounded-lg border p-3 bg-muted/20 animate-in fade-in duration-150">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Font Family Name</Label>
                <Input
                  value={fontDisplayName}
                  onChange={(e) => setFontDisplayName(e.target.value)}
                  placeholder="e.g. Aptos, Proxima Nova, Charter"
                  className="h-8 text-xs"
                />
              </div>

              <div className="pt-1">
                <Label className="text-[10px] font-bold uppercase text-muted-foreground">
                  Sample Preview
                </Label>
                <div className="mt-1 p-3 bg-background rounded border text-sm text-foreground">
                  Curriculum Vitae — Senior Software Architect
                </div>
              </div>

              <Button
                size="sm"
                className="w-full h-8 text-xs font-semibold gap-1.5"
                onClick={handleUpload}
                disabled={isUploading || !fontDisplayName.trim()}
              >
                {isUploading ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Check className="size-3.5" />
                )}
                <span>Install & Apply Font</span>
              </Button>
            </div>
          )}

          {/* Installed Custom Fonts List */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="text-xs font-semibold text-foreground">
                Installed Fonts ({customFonts.length})
              </Label>
              {customFonts.length > 0 && (
                <span className="text-[10px] text-muted-foreground">Persisted in browser</span>
              )}
            </div>

            {customFonts.length === 0 ? (
              <p className="text-xs text-muted-foreground italic text-center py-3 bg-muted/20 rounded-lg">
                No custom fonts uploaded yet. Upload one above to get started.
              </p>
            ) : (
              <div className="max-h-44 overflow-y-auto space-y-1.5 pr-1">
                {customFonts.map((font) => (
                  <div
                    key={font.id}
                    className="flex items-center justify-between p-2 rounded-lg border bg-background text-xs hover:border-primary/40 transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <p
                        className="font-semibold text-foreground truncate"
                        style={{ fontFamily: font.family }}
                      >
                        {font.name}
                      </p>
                      <p className="text-[10px] text-muted-foreground uppercase">
                        {font.format} format
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0 ml-2">
                      {onSelectFont && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2 text-[10px] text-primary hover:bg-primary/10"
                          onClick={() => {
                            onSelectFont(font.family);
                            onOpenChange(false);
                            toast.success(`Font set to ${font.name}`);
                          }}
                        >
                          Use
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-6 text-muted-foreground hover:text-destructive"
                        onClick={() => handleDelete(font.id, font.name)}
                        title="Delete font"
                      >
                        <Trash2 className="size-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
