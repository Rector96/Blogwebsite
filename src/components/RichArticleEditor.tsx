import { useEffect, useRef, type ClipboardEvent } from "react";

type Props = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  onImageUpload?: (file: File) => Promise<string | null>;
  minWords?: number;
};

/** Clean Microsoft Word / Google Docs HTML while keeping structure */
function cleanWordHtml(html: string) {
  const doc = new DOMParser().parseFromString(html, "text/html");
  doc.querySelectorAll("script,style,meta,link,xml,o\\:p,w\\:sdt").forEach((n) => n.remove());

  // Convert Word-ish headings and bold paragraphs
  doc.querySelectorAll("p, span, div").forEach((el) => {
    const style = (el.getAttribute("style") || "").toLowerCase();
    const cls = (el.getAttribute("class") || "").toLowerCase();
    const isHeading =
      /heading\s*[123]|msogheading|title/i.test(cls) ||
      /mso-outline-level\s*:\s*[123]/i.test(style);
    const fontSize = style.match(/font-size\s*:\s*([\d.]+)pt/i);
    const sizePt = fontSize ? parseFloat(fontSize[1]) : 0;
    const bold = /font-weight\s*:\s*(bold|[6-9]00)/i.test(style);

    if (el.tagName === "P" || el.tagName === "DIV") {
      if (isHeading || sizePt >= 16) {
        const h = doc.createElement(sizePt >= 18 || /heading\s*1/i.test(cls) ? "h2" : "h3");
        h.innerHTML = el.innerHTML;
        el.replaceWith(h);
        return;
      }
    }
    if (bold && el.tagName === "SPAN" && sizePt >= 14) {
      // leave; parent may become heading
    }
  });

  doc.querySelectorAll("*").forEach((el) => {
    const style = el.getAttribute("style") || "";
    const align = style.match(/text-align\s*:\s*(left|center|right|justify)/i)?.[1];
    if (align) el.setAttribute("data-align", align.toLowerCase());

    // Keep semantic tags; strip junk attrs
    Array.from(el.attributes).forEach((a) => {
      const n = a.name.toLowerCase();
      if (["href", "src", "alt", "title", "data-align"].includes(n)) return;
      el.removeAttribute(a.name);
    });
  });

  // Normalize b/i to strong/em later on save; keep lists
  return doc.body.innerHTML;
}

function ToolbarButton({
  label,
  title,
  onClick,
  active,
}: {
  label: string;
  title: string;
  onClick: () => void;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={
        "grid h-9 min-w-9 place-items-center rounded-md border px-2 text-xs font-bold transition " +
        (active
          ? "border-neutral-900 bg-neutral-900 text-white"
          : "border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-100")
      }
    >
      {label}
    </button>
  );
}

export default function RichArticleEditor({
  value,
  onChange,
  placeholder,
  onImageUpload,
  minWords = 400,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ref.current && ref.current.innerHTML !== value) {
      ref.current.innerHTML = value || "";
    }
  }, [value]);

  const text = ref.current?.innerText || "";
  const wordCount = text.trim() ? text.trim().split(/\s+/).filter(Boolean).length : 0;

  const emit = () => onChange(ref.current?.innerHTML || "");

  const run = (command: string, arg?: string) => {
    ref.current?.focus();
    document.execCommand(command, false, arg);
    emit();
  };

  const block = (tag: string) => {
    ref.current?.focus();
    document.execCommand("formatBlock", false, tag);
    emit();
  };

  const onPaste = async (e: ClipboardEvent<HTMLDivElement>) => {
    const html = e.clipboardData.getData("text/html");
    const plain = e.clipboardData.getData("text/plain");
    const imageFiles = Array.from(e.clipboardData.files || []).filter((f) => f.type.startsWith("image/"));

    if (!html && !imageFiles.length && !plain) return;

    // Prefer structured HTML from Word/Docs
    if (html) {
      e.preventDefault();
      document.execCommand("insertHTML", false, cleanWordHtml(html));
    } else if (imageFiles.length === 0 && plain) {
      // plain text: keep paragraphs
      e.preventDefault();
      const safe = plain
        .split(/\n{2,}/)
        .map((p) => "<p>" + p.replace(/</g, "<").replace(/\n/g, "<br>") + "</p>")
        .join("");
      document.execCommand("insertHTML", false, safe);
    }

    if (onImageUpload && imageFiles.length) {
      e.preventDefault();
      for (const file of imageFiles.slice(0, 5)) {
        const url = await onImageUpload(file);
        if (url) document.execCommand("insertImage", false, url);
      }
    }
    emit();
  };

  return (
    <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm">
      {/* Sticky toolbar — Word-like, wraps on mobile */}
      <div className="sticky top-0 z-10 flex flex-wrap items-center gap-1 border-b border-neutral-200 bg-neutral-50 p-2">
        <ToolbarButton label="B" title="Bold" onClick={() => run("bold")} />
        <ToolbarButton label="I" title="Italic" onClick={() => run("italic")} />
        <ToolbarButton label="U" title="Underline" onClick={() => run("underline")} />
        <span className="mx-0.5 hidden h-5 w-px bg-neutral-300 sm:block" />
        <ToolbarButton label="H2" title="Heading 2" onClick={() => block("h2")} />
        <ToolbarButton label="H3" title="Heading 3" onClick={() => block("h3")} />
        <ToolbarButton label="¶" title="Normal paragraph" onClick={() => block("p")} />
        <span className="mx-0.5 hidden h-5 w-px bg-neutral-300 sm:block" />
        <ToolbarButton label="•" title="Bullet list" onClick={() => run("insertUnorderedList")} />
        <ToolbarButton label="1." title="Numbered list" onClick={() => run("insertOrderedList")} />
        <ToolbarButton label="“”" title="Quote" onClick={() => block("blockquote")} />
        <span className="mx-0.5 hidden h-5 w-px bg-neutral-300 sm:block" />
        <ToolbarButton label="⬅" title="Align left" onClick={() => run("justifyLeft")} />
        <ToolbarButton label="☰" title="Center" onClick={() => run("justifyCenter")} />
        <ToolbarButton label="➡" title="Align right" onClick={() => run("justifyRight")} />
        <ToolbarButton label="≡" title="Justify" onClick={() => run("justifyFull")} />
        <span className="mx-0.5 hidden h-5 w-px bg-neutral-300 sm:block" />
        <ToolbarButton
          label="Link"
          title="Insert link"
          onClick={() => {
            const url = window.prompt("Link URL (https://…)");
            if (url) run("createLink", url);
          }}
        />
        <ToolbarButton
          label="Img URL"
          title="Insert image by URL"
          onClick={() => {
            const url = window.prompt("Image URL (https://…)");
            if (url) run("insertImage", url);
          }}
        />
        {onImageUpload ? (
          <label className="grid h-9 cursor-pointer place-items-center rounded-md border border-neutral-200 bg-white px-2 text-xs font-bold text-neutral-700 hover:bg-neutral-100">
            Upload
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/avif"
              className="hidden"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                const url = await onImageUpload(f);
                if (url) run("insertImage", url);
                e.currentTarget.value = "";
              }}
            />
          </label>
        ) : null}
        <ToolbarButton label="↺" title="Undo" onClick={() => run("undo")} />
        <ToolbarButton label="Clear" title="Clear formatting" onClick={() => run("removeFormat")} />
      </div>

      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        onInput={emit}
        onPaste={onPaste}
        data-placeholder={placeholder || "Write or paste from Microsoft Word…"}
        className={
          "min-h-[min(55vh,420px)] max-h-[70vh] overflow-y-auto p-3 text-[16px] leading-7 outline-none sm:p-5 " +
          "empty:before:pointer-events-none empty:before:text-neutral-400 empty:before:content-[attr(data-placeholder)] " +
          "[&_h2]:mb-2 [&_h2]:mt-5 [&_h2]:text-xl [&_h2]:font-semibold " +
          "[&_h3]:mb-2 [&_h3]:mt-4 [&_h3]:text-lg [&_h3]:font-semibold " +
          "[&_p]:my-2 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-6 " +
          "[&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-6 " +
          "[&_blockquote]:my-3 [&_blockquote]:border-l-4 [&_blockquote]:border-amber-400 [&_blockquote]:pl-3 [&_blockquote]:italic " +
          "[&_img]:my-3 [&_img]:h-auto [&_img]:max-w-full [&_img]:rounded-lg " +
          "[&_a]:text-teal-800 [&_a]:underline"
        }
      />

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-neutral-200 bg-neutral-50 px-3 py-2 text-[11px]">
        <span className={wordCount >= minWords ? "font-semibold text-teal-700" : "font-semibold text-amber-700"}>
          {wordCount.toLocaleString()} words · {Math.max(1, Math.ceil(Math.max(wordCount, 1) / 180))} min read
          {wordCount >= minWords ? " · Ready to publish" : ` · Need ${Math.max(0, minWords - wordCount)} more for publish`}
        </span>
        <span className="text-neutral-500">Paste from Word keeps headings, lists and emphasis</span>
      </div>
    </div>
  );
}
