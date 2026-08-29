import { useEffect, useRef } from "react";
import { Bold, Eraser, Italic, List, ListOrdered, Underline } from "lucide-react";

export default function RichTextEditor({ value, onChange, placeholder = "", testid, minHeight = "min-h-24" }) {
  const ref = useRef(null);

  useEffect(() => {
    if (ref.current && ref.current.innerHTML !== (value || "")) {
      ref.current.innerHTML = value || "";
    }
  }, [value]);

  const exec = (cmd) => {
    ref.current?.focus();
    document.execCommand(cmd, false, null);
    onChange(ref.current.innerHTML);
  };

  const tools = [
    { cmd: "bold", icon: Bold, label: "Bold" },
    { cmd: "italic", icon: Italic, label: "Italic" },
    { cmd: "underline", icon: Underline, label: "Underline" },
    { cmd: "insertUnorderedList", icon: List, label: "Bullets" },
    { cmd: "insertOrderedList", icon: ListOrdered, label: "Numbered" },
    { cmd: "removeFormat", icon: Eraser, label: "Clear" },
  ];

  return (
    <div className="rounded-md border border-input bg-white focus-within:ring-2 focus-within:ring-primary/50 transition-shadow">
      <div className="flex gap-0.5 border-b border-border p-1">
        {tools.map(({ cmd, icon: Icon, label }) => (
          <button
            key={cmd}
            type="button"
            title={label}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => exec(cmd)}
            className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            data-testid={testid ? `${testid}-tool-${cmd}` : undefined}
          >
            <Icon className="w-3.5 h-3.5" />
          </button>
        ))}
      </div>
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        data-testid={testid}
        data-placeholder={placeholder}
        onInput={() => onChange(ref.current.innerHTML)}
        className={`rich-text ${minHeight} px-3 py-2 text-sm outline-none leading-relaxed`}
      />
    </div>
  );
}
