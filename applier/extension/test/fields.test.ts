import { readPage } from "../src/fields";

const page = (html: string) => {
  document.body.innerHTML = html;
  return readPage(document, "t");
};

const summary = (html: string) =>
  page(html).map(({ field }) => ({
    kind: field.kind,
    label: field.label,
    required: field.required,
    options: field.options,
  }));

describe("reading a form with the board adapters' own reader", () => {
  it("reads labels however the page attaches them", () => {
    expect(
      summary(`
        <form>
          <label for="a">Full name</label><input id="a" required>
          <label>Email <input type="email"></label>
          <span id="p">Mobile number</span><input aria-labelledby="p">
          <textarea aria-label="Why us?"></textarea>
        </form>`),
    ).toEqual([
      { kind: "text", label: "Full name", required: true, options: [] },
      { kind: "text", label: "Email", required: false, options: [] },
      { kind: "text", label: "Mobile number", required: false, options: [] },
      { kind: "textarea", label: "Why us?", required: false, options: [] },
    ]);
  });

  it("makes one question of a radio group, asked by its legend", () => {
    const [group] = summary(`
      <fieldset><legend>Right to work?</legend>
        <label><input type="radio" name="rtw" value="y" required> Yes</label>
        <label><input type="radio" name="rtw" value="n"> No</label>
      </fieldset>`);
    expect(group).toEqual({ kind: "radio", label: "Right to work?", required: true, options: ["Yes", "No"] });
  });

  it("asks a lone checkbox as a yes-or-no question", () => {
    const [handle] = page(`<label><input type="checkbox"> I agree to the terms</label>`);
    expect(handle.field).toMatchObject({ kind: "radio", label: "I agree to the terms", options: ["Yes", "No"] });
    expect(handle.field.single_checkbox).toBe(true);
  });

  it("offers a select's options without its placeholder", () => {
    const [handle] = page(`
      <label for="s">Notice period</label>
      <select id="s"><option value="">Choose…</option><option>Immediately</option><option>1 month</option></select>`);
    expect(handle.field.options).toEqual(["Immediately", "1 month"]);
  });

  it("leaves the site's own search box and navigation out", () => {
    expect(
      summary(`
        <header><input aria-label="Search jobs"></header>
        <nav><input aria-label="Jump to"></nav>
        <form><input aria-label="Surname"></form>`).map((one) => one.label),
    ).toEqual(["Surname"]);
  });

  it("holds each field's elements, so a later read re-tagging them changes nothing", () => {
    const [first] = page(`<input aria-label="City">`);
    readPage(document, "again");
    expect(first.elements[0]).toBe(document.querySelector("input"));
  });
});
