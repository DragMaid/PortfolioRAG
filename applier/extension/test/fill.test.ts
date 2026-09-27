import { readPage } from "../src/fields";
import { fillField, wantsResume } from "../src/fill";

const read = (html: string) => {
  document.body.innerHTML = html;
  return readPage(document, "t");
};

/** An input as React keeps it: an instance-level `value` that remembers what was last set on
 * it, and state that only follows a change the DOM shows and the tracker has not seen. */
function controlled(input: HTMLInputElement) {
  const native = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!;
  let tracked = input.value;
  const state = { value: "" };
  Object.defineProperty(input, "value", {
    configurable: true,
    get() {
      return native.get!.call(this);
    },
    set(value: string) {
      tracked = value;
      native.set!.call(this, value);
    },
  });
  input.addEventListener("input", () => {
    const shown = native.get!.call(input) as string;
    if (shown !== tracked) {
      tracked = shown;
      state.value = shown;
    }
  });
  return state;
}

describe("writing answers into a page", () => {
  it("types into a framework-controlled input so the framework sees it", () => {
    const [handle] = read(`<label for="n">Full name</label><input id="n">`);
    const state = controlled(handle.elements[0] as HTMLInputElement);

    expect(fillField(handle, "Ada Lovelace")).toBe(true);
    expect(state.value).toBe("Ada Lovelace");
  });

  it("fires input and change, which is what a form's validation listens for", () => {
    const [handle] = read(`<input aria-label="City">`);
    const heard: string[] = [];
    handle.elements[0].addEventListener("input", () => heard.push("input"));
    handle.elements[0].addEventListener("change", () => heard.push("change"));

    fillField(handle, "Singapore");
    expect(heard).toEqual(["input", "change"]);
  });

  it("chooses a select's option by its text", () => {
    const [handle] = read(`
      <label for="s">Notice</label>
      <select id="s"><option value="">-</option><option value="0">Immediately</option><option value="30">1 month</option></select>`);
    expect(fillField(handle, "1 month")).toBe(true);
    expect((handle.elements[0] as HTMLSelectElement).value).toBe("30");
    expect(fillField(handle, "Next year")).toBe(false);
  });

  it("clicks the right radio in a group", () => {
    const [handle] = read(`
      <fieldset><legend>Right to work?</legend>
        <label><input type="radio" name="r" value="y"> Yes</label>
        <label><input type="radio" name="r" value="n"> No</label>
      </fieldset>`);
    expect(fillField(handle, "No")).toBe(true);
    const [yes, no] = handle.elements as HTMLInputElement[];
    expect([yes.checked, no.checked]).toEqual([false, true]);
  });

  it("sets every box of a checkbox group to match the answer", () => {
    const [handle] = read(`
      <fieldset><legend>Languages</legend>
        <label><input type="checkbox" name="l" checked> English</label>
        <label><input type="checkbox" name="l"> Mandarin</label>
        <label><input type="checkbox" name="l"> Malay</label>
      </fieldset>`);
    expect(fillField(handle, ["Mandarin", "Malay"])).toBe(true);
    expect((handle.elements as HTMLInputElement[]).map((box) => box.checked)).toEqual([false, true, true]);
  });

  it("answers a lone checkbox yes by ticking it", () => {
    const [handle] = read(`<label><input type="checkbox"> I agree</label>`);
    expect(fillField(handle, "Yes")).toBe(true);
    expect((handle.elements[0] as HTMLInputElement).checked).toBe(true);
  });

  it("writes a date the way a date input wants it", () => {
    const [handle] = read(`<input type="date" aria-label="Available from">`);
    expect(fillField(handle, "2026-10-01")).toBe(true);
    expect((handle.elements[0] as HTMLInputElement).value).toBe("2026-10-01");
  });

  it("never types into a file input", () => {
    const [handle] = read(`<input type="file" aria-label="Resume">`);
    expect(fillField(handle, "resume.pdf")).toBe(false);
  });

  it("knows a resume upload from a transcript's", () => {
    const [resume, transcript, other] = read(`
      <input type="file" aria-label="Upload your CV">
      <input type="file" aria-label="Academic transcript">
      <input type="file" aria-label="Attachment">`);
    expect(wantsResume(resume, false)).toBe(true);
    expect(wantsResume(transcript, true)).toBe(false);
    expect(wantsResume(other, false)).toBe(false);
    expect(wantsResume(other, true)).toBe(true);
  });
});
