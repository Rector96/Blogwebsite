const allowedTags = new Set(["P","BR","STRONG","B","EM","I","U","H2","H3","UL","OL","LI","BLOCKQUOTE","A","IMG","DIV"]);

/** Server-safe sanitizer for trusted admin-authored rich article HTML. */
export function sanitizeArticleHtmlServer(input: string) {
  let html = String(input || "");
  html = html.replace(/<!--[\\s\\S]*?-->/g, "");
  html = html.replace(/<\\/?(script|style|iframe|object|embed|form|svg|math|link|meta|base)[^>]*>/gi, "");
  html = html.replace(/\\s+on[a-z0-9_-]+\\s*=\\s*(?:"[^"]*"|'[^']*'|[^\\s>]+)/gi, "");
  html = html.replace(/\\s+(style|class|id|srcdoc)\\s*=\\s*(?:"[^"]*"|'[^']*'|[^\\s>]+)/gi, "");
  html = html.replace(/<(\\/?)([a-z0-9-]+)([^>]*)>/gi, (full, slash, tag, attrs) => {
    const upper = String(tag).toUpperCase();
    if (!allowedTags.has(upper)) return "";
    if (slash) return "</" + String(tag).toLowerCase() + ">";
    if (upper === "BR") return "<br>";
    let safeAttrs = String(attrs || "");
    safeAttrs = safeAttrs.replace(/\\s+([^\\s=]+)\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))/g, (_m, name, dq, sq, bare) => {
      const key = String(name).toLowerCase();
      const value = String(dq ?? sq ?? bare ?? "").trim();
      if (key === "data-align") return /^(left|center|right)$/.test(value) ? ' data-align="' + value + '"' : "";
      if (key === "href") return /^https?:\\/\\//i.test(value) ? ' href="' + value.replace(/&/g, "&amp;").replace(/"/g, "&quot;") + '" target="_blank" rel="noopener noreferrer"' : "";
      if (key === "src") return /^https?:\\/\\//i.test(value) ? ' src="' + value.replace(/&/g, "&amp;").replace(/"/g, "&quot;") + '"' : "";
      if (key === "alt" || key === "title") return ' ' + key + '="' + value.replace(/&/g, "&amp;").replace(/"/g, "&quot;") + '"';
      return "";
    });
    return "<" + String(tag).toLowerCase() + safeAttrs + ">";
  });
  return html.slice(0, 100000);
}
