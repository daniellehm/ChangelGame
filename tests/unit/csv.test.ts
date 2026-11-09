import { describe, expect, it } from "vitest";
import { parseCsv, parseCsvRecords } from "@/lib/content/csv";

describe("parseCsv", () => {
  it("handles quotes, escaped quotes, commas and newlines in fields", () => {
    expect(parseCsv('a,"b, c","say ""hi""","line1\nline2"\n1,2,3,4\n')).toEqual([
      ["a", "b, c", 'say "hi"', "line1\nline2"],
      ["1", "2", "3", "4"],
    ]);
  });
  it("handles CRLF, a BOM, empty fields and blank lines", () => {
    expect(parseCsv("﻿x,,z\r\n\r\n1,2,\r\n")).toEqual([["x", "", "z"], ["1", "2", ""]]);
  });
  it("throws on an unterminated quote", () => {
    expect(() => parseCsv('a,"b\n')).toThrow(SyntaxError);
  });
  it("maps records by header and rejects ragged rows", () => {
    expect(parseCsvRecords("a,b\n1,2\n")).toEqual([{ a: "1", b: "2" }]);
    expect(() => parseCsvRecords("a,b\n1\n")).toThrow(/Row 2/);
  });
});
