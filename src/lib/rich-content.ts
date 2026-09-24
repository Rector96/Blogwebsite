const allowed = new Set(["P","BR","STRONG","B","EM","I","U","H2","H3","UL","OL","LI","BLOCKQUOTE","A","IMG","DIV"]);

export function sanitizeArticleHtml(input: string) {
  if (typeof window === "undefined") return input;
  const doc = new DOMParser().parseFromString(input || "", "text/html");
  doc.querySelectorAll("script,style,iframe,object,embed,form,svg").forEach(n=>n.remove());
  doc.body.querySelectorAll("*").forEach((el) => {
    if (!allowed.has(el.tagName)) { el.replaceWith(...Array.from(el.childNodes)); return; }
    [...el.attributes].forEach(a => {
      const name=a.name.toLowerCase(), val=a.value.trim();
      if (name.startsWith("on") || name==="style" || name==="class") el.removeAttribute(a.name);
      if (name==="data-align" && !/^(left|center|right)$/.test(val)) el.removeAttribute(a.name);
      if (name==="href" && !/^https?:\/\//i.test(val)) el.removeAttribute(a.name);
      if (name==="src" && !/^https?:\\/\\//i.test(val)) el.removeAttribute(a.name);
    });
  });
  return doc.body.innerHTML;
}
