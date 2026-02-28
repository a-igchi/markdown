import { useRef, useState } from "react";
import { Plus, Eye, EyeOff, Upload, Download, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { exportMarkdown, importMarkdown } from "@/lib/markdown-io";

interface SpeedDialProps {
  value: string;
  onChange: (value: string) => void;
  showSource: boolean;
  onToggleSource: () => void;
}

export function SpeedDial({
  value,
  onChange,
  showSource,
  onToggleSource,
}: SpeedDialProps) {
  const [open, setOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const actions = [
    {
      icon: showSource ? <EyeOff size={18} /> : <Eye size={18} />,
      label: showSource ? "Hide Raw Markdown" : "Show Raw Markdown",
      onClick: () => { onToggleSource(); setOpen(false); },
    },
    {
      icon: <Upload size={18} />,
      label: "Import .md file",
      onClick: () => fileInputRef.current?.click(),
    },
    {
      icon: <Download size={18} />,
      label: "Export as .md",
      onClick: () => { exportMarkdown(value); setOpen(false); },
    },
    {
      icon: <Trash2 size={18} />,
      label: "Clear",
      onClick: () => { onChange(""); setOpen(false); },
    },
  ];

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    onChange(await importMarkdown(file));
    e.target.value = "";
    setOpen(false);
  }

  return (
    <TooltipProvider delayDuration={300}>
      {/*
        flex-col: actions (first) → FAB (last, at the bottom).
        Container anchors at bottom-6 right-6, growing upward.
        onMouseLeave covers both actions and FAB since they're siblings.
      */}
      <div
        className="fixed bottom-6 right-6 flex flex-col items-center"
        onMouseLeave={() => setOpen(false)}
      >
        {/* Collapsible actions wrapper — zero height when closed */}
        <div
          className={`overflow-hidden transition-all duration-200 ${
            open ? "max-h-64 opacity-100" : "max-h-0 opacity-0 pointer-events-none"
          }`}
        >
          {/*
            flex-col-reverse: Eye (first in DOM) appears at bottom,
            closest to FAB. Trash appears at top, furthest from FAB.
            pb-3 creates the gap between Eye and the FAB below.
          */}
          <div className="flex flex-col-reverse items-center gap-3 pb-3">
            {actions.map((action) => (
              <Tooltip key={action.label}>
                <TooltipTrigger asChild>
                  <Button
                    variant="secondary"
                    size="icon"
                    className="h-10 w-10 rounded-full shadow-md"
                    onClick={action.onClick}
                  >
                    {action.icon}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="left">
                  <p>{action.label}</p>
                </TooltipContent>
              </Tooltip>
            ))}
          </div>
        </div>

        {/* Main FAB — always at the physical bottom */}
        <Button
          size="icon"
          className="h-14 w-14 rounded-full shadow-lg"
          onMouseEnter={() => setOpen(true)}
          onClick={() => setOpen((o) => !o)}
          aria-label={open ? "Close actions" : "Open actions"}
        >
          <Plus
            size={24}
            className={`transition-transform duration-200 ${open ? "rotate-45" : ""}`}
          />
        </Button>

        <input
          ref={fileInputRef}
          type="file"
          accept=".md,text/markdown,text/plain"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>
    </TooltipProvider>
  );
}
