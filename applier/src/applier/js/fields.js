// Reads every question on a form, whatever control asks it, and tags each control with
// data-applier-field so the filler can find it again without a selector of its own.
//
// Called as (root, prefix) => FormField[]. Radios and checkboxes sharing a name are one
// question; its label is the group's legend (or aria-labelledby), each option its own label.
(root, prefix) => {
  const SKIPPED_TYPES = ["hidden", "submit", "button", "reset", "image", "search"];

  // Replace null with empty string and replace repeated space / new lines with single space
  const clean = (text) => (text || "").replace(/\s+/g, " ").trim();

  // Retrieve all inner-text of elements with id from idList and concat results single line
  const textFromIds = (idList) =>
    clean(
      (idList || "")
        .split(/\s+/)
        .map((id) => document.getElementById(id)?.innerText || "")
        .join(" ")
    );

  // Find the label element associated with form controllers (input, select, textarea)
  const labelFor = (el) => {
    if (el.id) {
      // The label is referenced using the for={id} syntax, CSS.escape to remove '.#;' beforehand
      const label = root.querySelector(`label[for="${CSS.escape(el.id)}"]`);
      if (label) return label;
    }
    return el.closest("label");
  };

  const isVisible = (el) => {
    if (el.type === "hidden") return false;

    const style = getComputedStyle(el);
    if (style.visibility === "hidden" || style.display === "none") {
      // Custom radios/checkboxes hide the real input and draw a styled label instead;
      // what matters is whether that label is visible.
      const label = labelFor(el);
      return !!label && label.getClientRects().length > 0;
    }
    // Avoid some mfs resizing the widget to 0 to hide it
    return el.getClientRects().length > 0 || !!labelFor(el);
  };

  const isRequired = (el) =>
    el.required || el.getAttribute("aria-required") === "true" || !!el.closest("[aria-required=true]");

  // The question text for a single control: its own <label>, an aria-labelledby target,
  // an aria-label, or (last resort) its placeholder.
  const ownLabel = (el) =>
    clean(labelFor(el)?.innerText) ||
    textFromIds(el.getAttribute("aria-labelledby")) ||
    clean(el.getAttribute("aria-label")) ||
    clean(el.getAttribute("placeholder"));

  // The question text shared by a group of radios/checkboxes: the enclosing
  // <fieldset>'s <legend>, or an aria-labelledby/aria-label on the group container.
  const groupLabel = (el) => {
    const group = el.closest("fieldset, [role=radiogroup], [role=group]");
    if (!group) return "";
    return (
      clean(group.querySelector(":scope > legend")?.innerText) ||
      textFromIds(group.getAttribute("aria-labelledby")) ||
      clean(group.getAttribute("aria-label"))
    );
  };

  let nextIndex = 0;
  const tagField = (el) => {
    const id = `${prefix}${nextIndex++}`;
    el.setAttribute("data-applier-field", id);
    return id;
  };

  const fields = [];

  // Radio - Checkbox handling
  const groupsByKey = new Map();

  const addToGroup = (el, type) => {
    const key = `${type}:${el.name || groupLabel(el) || ownLabel(el)}`;
    const option = ownLabel(el) || clean(el.value);
    const id = tagField(el);
    el.setAttribute("data-applier-option", option);

    let group = groupsByKey.get(key);
    if (!group) {
      // A checkbox with no surrounding group is really a standalone yes/no question,
      // asked by its own label rather than a shared group label.
      const isLoneCheckbox = type === "checkbox" && !groupLabel(el);
      group = {
        id,
        kind: type,
        label: isLoneCheckbox ? option : groupLabel(el) || option,
        required: false,
        options: [],
        current: type === "radio" ? null : [],
        members: [],
        lone: isLoneCheckbox,
      };
      groupsByKey.set(key, group);
      fields.push(group);
    }

    group.members.push(id);
    group.options.push(option);
    group.required ||= isRequired(el);
    // Process whehter its single or multi-check
    if (el.checked) {
      if (type === "radio") group.current = option;
      else group.current.push(option);
    }
  };

  const buildSimpleField = (el, type) => {
    const id = tagField(el);
    const field = {
      id,
      kind:
        el.tagName === "SELECT"
          ? "select"
          : el.tagName === "TEXTAREA"
          ? "textarea"
          : ["number", "date", "file"].includes(type)
          ? type
          : "text",
      label: ownLabel(el) || groupLabel(el),
      required: isRequired(el),
      options: [],
      current: el.value ? clean(el.value) : null,
      max_length: el.maxLength > 0 ? el.maxLength : null,
      members: [id],
    };

    if (el.tagName === "SELECT") {
      field.options = [...el.options]
        .filter((o) => o.value !== "" && !o.disabled)
        .map((o) => clean(o.textContent));
      field.current =
        el.selectedIndex >= 0 && el.options[el.selectedIndex].value !== ""
          ? clean(el.options[el.selectedIndex].textContent)
          : null;
    }

    return field;
  };

  // Setting up all the fields, either in group map or just field map (group is still appended to fields)
  for (const el of root.querySelectorAll("input, select, textarea")) {
    if (el.disabled || !isVisible(el)) continue;

    const type = (el.getAttribute("type") || el.tagName).toLowerCase();
    if (SKIPPED_TYPES.includes(type)) continue;

    if (type === "radio" || type === "checkbox") {
      addToGroup(el, type);
    } else {
      fields.push(buildSimpleField(el, type));
    }
  }

  // Normalize lone checkboxes into yes/no radio-style questions, and collapse
  // "no options checked" down to null instead of an empty array.
  for (const field of fields) {
    if (field.lone) {
      field.options = ["Yes", "No"];
      field.kind = "radio";
      field.current = field.current.length ? "Yes" : null;
      field.single_checkbox = true;
    }
    if (Array.isArray(field.current) && !field.current.length) {
      field.current = null;
    }
  }

  return fields;
};
