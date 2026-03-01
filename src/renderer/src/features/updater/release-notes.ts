const ALLOWED_TAGS = new Set([
  'a',
  'b',
  'blockquote',
  'br',
  'code',
  'div',
  'em',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'hr',
  'i',
  'li',
  'ol',
  'p',
  'pre',
  'span',
  'strong',
  'ul',
]);

const ALLOWED_LINK_PROTOCOLS = new Set(['http:', 'https:', 'mailto:']);

function sanitizeLink(link: HTMLAnchorElement): void {
  const href = link.getAttribute('href');
  if (!href) {
    link.removeAttribute('href');
    return;
  }

  try {
    const url = new URL(href, 'https://archterm.app');
    if (!ALLOWED_LINK_PROTOCOLS.has(url.protocol)) {
      link.removeAttribute('href');
      return;
    }
  } catch {
    link.removeAttribute('href');
    return;
  }

  link.setAttribute('target', '_blank');
  link.setAttribute('rel', 'noopener noreferrer nofollow');
}

function sanitizeNode(node: Node): void {
  if (node.nodeType === Node.ELEMENT_NODE) {
    const element = node as HTMLElement;
    const tagName = element.tagName.toLowerCase();

    if (!ALLOWED_TAGS.has(tagName)) {
      const parent = element.parentNode;
      if (!parent) return;
      while (element.firstChild) {
        parent.insertBefore(element.firstChild, element);
      }
      parent.removeChild(element);
      return;
    }

    // Remove all attributes except safe link attributes.
    for (const attr of Array.from(element.attributes)) {
      const name = attr.name.toLowerCase();
      if (tagName !== 'a' || !['href', 'title'].includes(name)) {
        element.removeAttribute(attr.name);
      }
    }

    if (tagName === 'a') {
      sanitizeLink(element as HTMLAnchorElement);
    }
  }

  for (const child of Array.from(node.childNodes)) {
    sanitizeNode(child);
  }
}

export function sanitizeReleaseNotesHtml(input: string | null | undefined): string {
  if (!input) return '';
  const parser = new DOMParser();
  const doc = parser.parseFromString(`<div>${String(input)}</div>`, 'text/html');
  const root = doc.body.firstElementChild;
  if (!root) return '';
  sanitizeNode(root);
  return root.innerHTML;
}
