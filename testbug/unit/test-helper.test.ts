import { expect, it } from "bun:test";
import { tmpdir } from "node:os";
import { resolve, sep } from "node:path";
import { TEST_UPLOAD_DIR } from "../helpers";

it("keeps generated integration-test uploads outside the repository", () => {
  const uploadPath = resolve(TEST_UPLOAD_DIR).toLowerCase();
  const tempRoot = `${resolve(tmpdir()).toLowerCase()}${sep}`;
  const repositoryTestRoot = `${resolve("testbug").toLowerCase()}${sep}`;
  expect(uploadPath.startsWith(tempRoot)).toBe(true);
  expect(uploadPath.startsWith(repositoryTestRoot)).toBe(false);
});
