import { describe, it, expect } from "vitest";
import { parse, isNode, getText } from "parser-cst";
import { cstToModel } from "./cst-to-model.js";
import { modelToMarkdown } from "./model-to-markdown.js";

describe("parser behavior for mixed-structure content", () => {
  it("A- aA\\n- aaA: block count and model", () => {
    const cst = parse("A- aA\n- aaA");
    const blockNodes = cst.children.filter(isNode);
    const model = cstToModel(cst);
    const md = modelToMarkdown(model);
    console.log("blocks:", blockNodes.map((n) => n.kind + ":" + JSON.stringify(getText(n))));
    console.log("model blocks:", JSON.stringify(model.blocks));
    console.log("markdown:", JSON.stringify(md));
    expect(blockNodes.length).toBeGreaterThanOrEqual(1);
  });

  it("- aA\\n- aaA: single list block", () => {
    const cst = parse("- aA\n- aaA");
    const blockNodes = cst.children.filter(isNode);
    const model = cstToModel(cst);
    console.log("blocks:", blockNodes.map((n) => n.kind + ":" + JSON.stringify(getText(n))));
    console.log("model:", JSON.stringify(model.blocks));
    expect(blockNodes.length).toBe(1);
    expect(model.blocks[0].type).toBe("list");
  });
});
