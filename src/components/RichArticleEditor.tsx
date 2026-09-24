import { useEffect, useRef } from "react";

type Props = { value: string; onChange: (value: string) => void; placeholder?: string };

const commands = [
  ["bold","B"],["italic","I"],["underline","U"],["formatBlock","H2"],["insertUnorderedList","•"],["insertOrderedList","1."],["justifyLeft","L"],["justifyCenter","C"],["justifyRight","R"],
] as const;

function cleanWordHtml(html: string) {
  const doc = new DOMParser().parseFromString(html, "text/html");
  doc.querySelectorAll("script,style,meta,link,xml,o\\:p").forEach((n) => n.remove());
  doc.querySelectorAll("*").forEach((el) => {
    [...el.attributes].forEach((a) => {
      if (!["href","src","alt","title"].includes(a.name.toLowerCase())) el.removeAttribute(a.name);
    });
  });
  return doc.body.innerHTML;
}

export default function RichArticleEditor({ value, onChange, placeholder }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { if (ref.current && ref.current.innerHTML !== value) ref.current.innerHTML = value; }, [value]);

  const run = (command: string, arg?: string) => {
    ref.current?.focus();
    document.execCommand(command, false, arg);
    onChange(ref.current?.innerHTML || "");
  };

  const onPaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    const html = e.clipboardData.getData("text/html");
    if (!html) return;
    e.preventDefault();
    document.execCommand("insertHTML", false, cleanWordHtml(html));
    onChange(ref.current?.innerHTML || "");
  };

  return <div className="overflow-hidden border bg-white">
    <div className="flex flex-wrap items-center gap-1 border-b bg-neutral-50 p-2">
      {commands.map(([cmd,label]) => <button key={cmd+label} type="button" title={cmd} onMouseDown={e=>e.preventDefault()} onClick={()=>run(cmd, cmd==="formatBlock" ? "<h2>" : undefined)} className="grid h-8 min-w-8 place-items-center rounded border bg-white px-2 text-xs font-bold text-neutral-700 hover:bg-neutral-100">{label}</button>)}
      <button type="button" onMouseDown={e=>e.preventDefault()} onClick={()=>{const url=window.prompt("Link URL"); if(url) run("createLink",url)}} className="grid h-8 place-items-center rounded border bg-white px-2 text-xs font-bold">Link</button>
      <button type="button" onMouseDown={e=>e.preventDefault()} onClick={()=>run("removeFormat")} className="grid h-8 place-items-center rounded border bg-white px-2 text-xs font-bold">Clear</button>
    </div>
    <div ref={ref} contentEditable suppressContentEditableWarning onInput={()=>onChange(ref.current?.innerHTML || "")} onPaste={onPaste} data-placeholder={placeholder || "Write the article here…"} className="min-h-[360px] p-4 text-[16px] leading-7 outline-none empty:before:content-[attr(data-placeholder)] empty:before:text-neutral-400" />
    <div className="border-t px-3 py-2 text-[11px] text-neutral-500">Paste from Word is cleaned and preserved where supported. Use the image button below to add inline media.</div>
  </div>;
}
