/** Regression coverage that the required CI status runs the sidecar security wall. */
import { expect, test } from "bun:test";

const workflowUrl = new URL("../.github/workflows/ci.yml", import.meta.url);

const jobBlock = (workflow: string, name: string): string => {
  const normalized = workflow.replace(/\r\n/g, "\n");
  const marker = `\n  ${name}:\n`;
  const start = normalized.indexOf(marker);
  if (start < 0) return "";
  const bodyStart = start + marker.length;
  const nextJob = normalized.slice(bodyStart).search(/\n  [a-zA-Z0-9_-]+:\n/);
  return nextJob < 0
    ? normalized.slice(bodyStart)
    : normalized.slice(bodyStart, bodyStart + nextJob);
};

test("required test job vets, tests, and builds the sidecar", async () => {
  const workflow = await Bun.file(workflowUrl).text();
  const requiredJob = jobBlock(workflow, "test");

  expect(requiredJob).toContain("uses: actions/setup-go@v6");
  expect(requiredJob).toContain("go-version-file: sidecar/go.mod");
  expect(requiredJob).toContain("cache-dependency-path: sidecar/go.sum");
  expect(requiredJob).toContain("run: go vet -mod=readonly ./...");
  expect(requiredJob).toContain("run: go test -mod=readonly ./... -count=1");
  expect(requiredJob).toContain("run: go build -mod=readonly ./...");
  expect(requiredJob.match(/working-directory: sidecar/g)).toHaveLength(3);
});
