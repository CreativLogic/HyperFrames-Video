export function isMasterCompositionPath(path: string | null | undefined): boolean {
  return path == null || path === "index.html";
}

export function isSourceCompositionPath(path: string | null | undefined): path is string {
  return path === "index.html" || Boolean(path?.startsWith("compositions/"));
}

export function getCompositionLabel(path: string): string {
  if (path === "index.html") return "Master";
  return (
    path
      .split("/")
      .pop()
      ?.replace(/\.html$/, "") || path
  );
}

export function getCompositionPreviewUrl(projectId: string, path: string | null | undefined) {
  const base = `/api/projects/${encodeURIComponent(projectId)}/preview`;
  if (isMasterCompositionPath(path)) return base;
  return `${base}/comp/${encodeRoutePath(path ?? "")}`;
}

export function parseCompositionSourceMap(html: string): Map<string, string> {
  const result = new Map<string, string>();
  const tagRe = /<[^>]+>/g;
  let tagMatch: RegExpExecArray | null;
  while ((tagMatch = tagRe.exec(html)) !== null) {
    const attrs = parseHtmlAttributes(tagMatch[0] ?? "");
    const id = attrs.get("data-composition-id");
    const hostId = attrs.get("id");
    const src = attrs.get("data-composition-src") ?? attrs.get("data-composition-file");
    if (id && src) result.set(id, src);
    if (hostId && src) result.set(hostId, src);
  }
  return result;
}

function encodeRoutePath(path: string): string {
  return path
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");
}

function parseHtmlAttributes(tag: string): Map<string, string> {
  const attrs = new Map<string, string>();
  const attrRe = /\s([^\s"'=<>`]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  let match: RegExpExecArray | null;
  while ((match = attrRe.exec(tag)) !== null) {
    const name = match[1]?.toLowerCase();
    if (!name) continue;
    attrs.set(name, match[2] ?? match[3] ?? match[4] ?? "");
  }
  return attrs;
}
