import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { chooseCatalogFile } from "@/lib/db";

describe("catalog database location", () => {
  it("stores sqlite beside the seed when that folder is writable", () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "parkpulse-writable-"));
    expect(chooseCatalogFile(directory, os.tmpdir())).toBe(path.join(directory, "catalog.sqlite"));
  });

  it("uses the temporary directory when the project folder cannot be written", () => {
    const blocker = path.join(os.tmpdir(), `parkpulse-not-a-directory-${process.pid}`);
    fs.writeFileSync(blocker, "not a directory");
    try {
      expect(chooseCatalogFile(path.join(blocker, "data"), os.tmpdir())).toBe(path.join(os.tmpdir(), "parkpulse", "catalog.sqlite"));
    } finally {
      fs.unlinkSync(blocker);
    }
  });
});
