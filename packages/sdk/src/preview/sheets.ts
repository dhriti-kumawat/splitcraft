/**
 * Add CSS without a <style> element where the browser allows it (constructable style
 * sheets), so a page's Content-Security-Policy `style-src` can't block the preview.
 * Returns a function that removes it.
 */
export function addSheet(css: string): () => void {
  const doc = document as Document & { adoptedStyleSheets?: CSSStyleSheet[] };
  try {
    if (doc.adoptedStyleSheets && 'replaceSync' in CSSStyleSheet.prototype) {
      const sheet = new CSSStyleSheet();
      sheet.replaceSync(css);
      doc.adoptedStyleSheets = [...doc.adoptedStyleSheets, sheet];
      return () => {
        doc.adoptedStyleSheets = doc.adoptedStyleSheets!.filter((s) => s !== sheet);
      };
    }
  } catch {
    // Fall back to a style element.
  }
  const style = document.createElement('style');
  style.setAttribute('data-splitcraft-preview', '');
  style.textContent = css;
  (document.head ?? document.documentElement).appendChild(style);
  return () => style.remove();
}
