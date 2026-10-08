import { createHash } from "node:crypto";
import { lstat, readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";

const directory = resolve(process.argv[2] ?? "site");
if ((await lstat(directory)).isSymbolicLink()) throw new Error("Publish directory must not be a symbolic link");
const allowed = ["index.html", "knowledge-base.json", "knowledge-base.md", "video-study.json", "video-study.md", "mechanics-study.md", "release.json", "404.html", ".nojekyll"];
const manifest = JSON.parse(await readFile(resolve(directory, "release-manifest.json"), "utf8"));
const actual = (await readdir(directory)).sort();
if (JSON.stringify(actual) !== JSON.stringify([...allowed, "release-manifest.json"].sort())) throw new Error("Unexpected or missing public files");
if (JSON.stringify(Object.keys(manifest.files).sort()) !== JSON.stringify([...allowed].sort())) throw new Error("Invalid manifest allowlist");
for (const name of [...allowed, "release-manifest.json"]) {
  const info = await lstat(resolve(directory, name));
  if (!info.isFile() || info.isSymbolicLink()) throw new Error(`Not a regular file: ${name}`);
  if (name === "release-manifest.json") continue;
  const contents = await readFile(resolve(directory, name));
  const expected = manifest.files[name];
  if (contents.length !== expected.bytes || createHash("sha256").update(contents).digest("hex") !== expected.sha256) throw new Error(`Checksum mismatch: ${name}`);
}
for (const name of ["knowledge-base.json", "video-study.json"]) {
  const library = JSON.parse(await readFile(resolve(directory, name), "utf8"));
  if (Object.keys(library.mechanicsProgress ?? {}).length || library.entries.some((entry) => entry.notes || entry.favorite || entry.archived || entry.learning !== "未学习" || entry.id.startsWith("custom-"))) throw new Error(`Personal records in ${name}`);
}
const release = JSON.parse(await readFile(resolve(directory, "release.json"), "utf8"));
if (release.version !== manifest.version || release.contentDigest !== manifest.contentDigest) throw new Error("Release and manifest do not match");
console.log(`Verified public release ${manifest.version}: ${actual.length} files`);
