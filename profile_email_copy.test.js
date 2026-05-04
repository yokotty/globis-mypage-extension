const test = require("node:test");
const assert = require("node:assert/strict");
const {
  getProfileEmailRows,
  getProfileModalRoots,
  isProfileEmailLabel
} = require("./profile_email_copy.js");

class FakeElement {
  constructor(tagName, { id = "", textContent = "", attributes = {}, children = [] } = {}) {
    this.tagName = tagName.toLowerCase();
    this.id = id;
    this.textContent = textContent;
    this.attributes = attributes;
    this.children = children;
    this.parentElement = null;
    for (const child of children) {
      child.parentElement = this;
    }
  }

  getAttribute(name) {
    if (name === "id") return this.id;
    return this.attributes[name] || null;
  }

  matches(selector) {
    if (selector === '[id="base-modal"]') return this.id === "base-modal";
    if (selector === "label") return this.tagName === "label";
    if (selector === "h2") return this.tagName === "h2";
    if (selector === "span.text-\\[13px\\]") {
      return this.tagName === "span" && this.attributes.class === "text-[13px]";
    }
    return false;
  }

  querySelector(selector) {
    return this.querySelectorAll(selector)[0] || null;
  }

  querySelectorAll(selector) {
    const results = [];
    const visit = (node) => {
      for (const child of node.children) {
        if (child.matches(selector)) results.push(child);
        visit(child);
      }
    };
    visit(this);
    return results;
  }
}

function makeRow(labelFor, labelText, email) {
  const label = new FakeElement("label", {
    textContent: labelText,
    attributes: { for: labelFor }
  });
  const emailEl = new FakeElement("span", {
    textContent: email,
    attributes: { class: "text-[13px]" }
  });
  const valueWrap = new FakeElement("div", { children: [emailEl] });
  const valueCell = new FakeElement("div", { children: [valueWrap] });
  const labelCell = new FakeElement("div", { children: [label] });
  return new FakeElement("div", { children: [labelCell, valueCell] });
}

function makeModal(title, rows = []) {
  return new FakeElement("div", {
    id: "base-modal",
    children: [
      new FakeElement("h2", { textContent: title }),
      ...rows
    ]
  });
}

test("profile email rows are found when member and profile modals are both mounted", () => {
  const memberModal = makeModal("メンバー");
  const profileModal = makeModal("プロフィール", [
    makeRow("mailSpare", "メールアドレス（公開用）", "a-mori@globis.co.jp")
  ]);
  const root = new FakeElement("main", { children: [memberModal, profileModal] });

  assert.equal(getProfileModalRoots(root).length, 1);
  const rows = getProfileEmailRows(root);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].emailEl.textContent, "a-mori@globis.co.jp");
});

test("profile email labels include normal, alumni, spare, and text-based labels", () => {
  assert.equal(isProfileEmailLabel(new FakeElement("label", { attributes: { for: "mail" } })), true);
  assert.equal(isProfileEmailLabel(new FakeElement("label", { attributes: { for: "alumniMail" } })), true);
  assert.equal(isProfileEmailLabel(new FakeElement("label", { attributes: { for: "mailSpare" } })), true);
  assert.equal(isProfileEmailLabel(new FakeElement("label", { textContent: "メールアドレス（公開用）" })), true);
  assert.equal(isProfileEmailLabel(new FakeElement("label", { attributes: { for: "name" }, textContent: "氏名" })), false);
});
