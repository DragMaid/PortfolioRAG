// jsdom lays nothing out and has no innerText. The reader needs both: a label's text, and
// whether a control takes up room on the page. Every element here is treated as visible.
Object.defineProperty(HTMLElement.prototype, "innerText", {
  configurable: true,
  get(this: HTMLElement) {
    return this.textContent ?? "";
  },
});

HTMLElement.prototype.getClientRects = function (this: HTMLElement) {
  const hidden = this.hidden || this.style.display === "none";
  return (hidden ? [] : [{ x: 0, y: 0, width: 10, height: 10 }]) as unknown as DOMRectList;
};

const scope = globalThis as { CSS?: { escape?: (value: string) => string } };
if (!scope.CSS?.escape) {
  scope.CSS = { ...scope.CSS, escape: (value: string) => value.replace(/["\\]/g, "\\$&") };
}
