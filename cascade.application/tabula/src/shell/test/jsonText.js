import assert from "assert";
import { jsonText, setAt, removeAt, duplicateAt, moveAt, itemPathAround, pathKey } from "../json/jsonText.js";

const textOf = ({ lines }) => lines.map((line) => line.tokens.map((token) => token.text).join("")).join("\n");

describe("JSON as text with places for a caret", function () {
  it("writes JSON as JSON.stringify does - short ones on a line", function () {
    const json = { type: "document", name: "plainText", properties: { text: "Hi", margins: { top: 1, left: 2 } }, list: [1, 2] };
    const written = textOf(jsonText(json));
    assert.deepStrictEqual(JSON.parse(written.replace(/↵/g, "\\n")), json);
    assert.ok(written.includes("\"margins\": { \"top\": 1, \"left\": 2 }"));
  });

  it("has stops before every property and item, in every string and number, and on atoms - where they are in the text", function () {
    const { lines, stops } = jsonText({ a: "xy", b: [true, 10] });
    const kinds = stops.map((stop) => stop.kind + ":" + pathKey(stop.path) + (stop.kind === "text" ? "@" + stop.offset : ""));
    assert.deepStrictEqual(kinds, [
      "node:[\"a\"]", "text:[\"a\"]@0", "text:[\"a\"]@1", "text:[\"a\"]@2",
      "node:[\"b\"]", "atom:[\"b\",0]", "node:[\"b\",1]", "text:[\"b\",1]@0", "text:[\"b\",1]@1", "text:[\"b\",1]@2",
    ]);
    // Each where it says: "xy" on the first line after `"a": "`.
    const line = lines[stops[1].line].tokens.map((token) => token.text).join("");
    assert.strictEqual(line.slice(stops[1].column, stops[3].column), "xy");
  });

  it("shows a draft where its value is, wavy - and lets the caret into it", function () {
    const { lines, stops } = jsonText({ n: 1 }, { drafts: new Map([[pathKey(["n"]), "1."]]) });
    assert.ok(lines.some((line) => line.tokens.some((token) => token.kind === "draft" && token.text === "1.")));
    assert.strictEqual(stops.filter((stop) => stop.kind === "text").length, 3);
  });

  it("changes JSON without touching the rest: set, remove, duplicate, move - and finds the item around a path", function () {
    const json = { list: [{ a: 1 }, { a: 2 }], other: { b: true } };
    const set = setAt(json, ["list", 1, "a"], 5);
    assert.strictEqual(set.list[1].a, 5);
    assert.strictEqual(set.other, json.other);
    assert.deepStrictEqual(removeAt(json, ["list", 0]).list, [{ a: 2 }]);
    assert.deepStrictEqual(removeAt(json, ["other"]), { list: json.list });
    assert.deepStrictEqual(duplicateAt(json, ["list", 0]).list, [{ a: 1 }, { a: 1 }, { a: 2 }]);
    assert.deepStrictEqual(moveAt(json, ["list", 0], 1).list, [{ a: 2 }, { a: 1 }]);
    assert.strictEqual(moveAt(json, ["list", 0], -1), json);
    assert.deepStrictEqual(itemPathAround(json, ["list", 1, "a"]), ["list", 1]);
    assert.strictEqual(itemPathAround(json, ["other", "b"]), null);
  });
});
