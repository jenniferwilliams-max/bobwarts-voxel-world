import test from "node:test";
import assert from "node:assert/strict";
import { createToolChestPartsObjectsView } from "../../js/workshop/toolchest/tool-chest-parts-objects-view.mjs";

class Element {
  constructor(tag = "div") {
    this.tagName = tag.toUpperCase();
    this.children = [];
    this.dataset = {};
    this.attributes = {};
    this.listeners = {};
    this.disabled = false;
    this.textContent = "";
    this.scrollTop = 0;
  }
  append(...nodes) { nodes.forEach((node) => this.appendChild(node)); }
  appendChild(node) {
    if (node?.isFragment) node.children.forEach((child) => this.appendChild(child));
    else this.children.push(node);
    return node;
  }
  replaceChildren(...nodes) { this.children = []; this.append(...nodes); }
  setAttribute(name, value) { this.attributes[name] = String(value); }
  addEventListener(name, callback) { this.listeners[name] = callback; }
  querySelector(selector) {
    return this.querySelectorAll(selector)[0] || null;
  }
  querySelectorAll(selector) {
    const found = [];
    const matches = (node) => {
      if (selector === ".engineering-object-tile-name") return node.className === "engineering-object-tile-name";
      if (selector === "button[data-parts-object-key]") return node.tagName === "BUTTON" && !!node.dataset.partsObjectKey;
      return false;
    };
    const visit = (node) => {
      if (matches(node)) found.push(node);
      node.children.forEach(visit);
    };
    this.children.forEach(visit);
    return found;
  }
  get childElementCount() { return this.children.length; }
}

const documentRef = {
  createElement: (tag) => new Element(tag),
  createDocumentFragment: () => Object.assign(new Element("fragment"), { isFragment: true }),
};

test("renders grouped native controls, disables unsupported objects, and stays idempotent", () => {
  const root = new Element();
  const scrollOwner = new Element();
  const status = new Element("p");
  const placements = [];
  const adapter = {
    list: () => [
      { key: "tree", name: "Tree", symbol: "🌲", category: "Nature", missionRelevant: true, supported: true, disabledReason: "" },
      { key: "building", name: "Building", symbol: "🏢", category: "Magic", missionRelevant: false, supported: true, disabledReason: "" },
      { key: "plantCell", name: "Plant Cell", symbol: "🌱", category: "Cells", missionRelevant: false, supported: false, disabledReason: "Needs mission setup." },
    ],
    place: (key) => { placements.push(key); return { ok: true, code: "PLACED", key }; },
    reset: () => true,
  };
  const view = createToolChestPartsObjectsView({ root, scrollOwner, status, adapter, documentRef });
  assert.equal(view.refresh().code, "RENDERED");
  assert.equal(view.refresh().code, "IDEMPOTENT");
  const buttons = root.querySelectorAll("button[data-parts-object-key]");
  assert.equal(buttons.length, 3);
  assert.equal(buttons[0].tagName, "BUTTON");
  assert.equal(buttons[0].children[0].className, "engineering-parts-object-thumbnail");
  assert.equal(buttons[0].children[0].textContent, "🌲");
  assert.equal(buttons[2].disabled, true);
  assert.match(buttons[2].attributes["aria-label"], /Unavailable/);
  buttons[0].listeners.click({ currentTarget: buttons[0] });
  buttons[0].listeners.click({ currentTarget: buttons[0] });
  assert.deepEqual(placements, ["tree", "tree"]);
  assert.match(status.textContent, /placed/i);
});

test("reset clears status, rendered controls, and the single native scroll owner", () => {
  const root = new Element();
  const scrollOwner = new Element();
  const status = new Element("p");
  const adapter = { list: () => [], place: () => ({ ok: false }), reset: () => true };
  const view = createToolChestPartsObjectsView({ root, scrollOwner, status, adapter, documentRef });
  root.appendChild(new Element("button"));
  scrollOwner.scrollTop = 125;
  status.textContent = "Placed.";
  view.reset();
  assert.equal(root.childElementCount, 0);
  assert.equal(scrollOwner.scrollTop, 0);
  assert.equal(status.textContent, "");
});
