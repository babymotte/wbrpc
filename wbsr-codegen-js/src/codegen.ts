#!/usr/bin/env node

import path from "path";
import { loadOwnManifest } from "./manifests";
import fs from "fs";
import { generateComponent, generateService } from "./codegenLib";

const srcDir = path.join(".", "src");

if (!fs.existsSync(srcDir)) {
  fs.mkdirSync(srcDir);
}

const indexFile = path.join(srcDir, "index.ts");
const componentFile = path.join(srcDir, "component.json");

const manifest = loadOwnManifest();

if (manifest.moduleType == "COMPONENT") {
  generateComponent(indexFile, componentFile, manifest);
}

if (manifest.moduleType == "SERVICE_PROVIDER") {
  generateService(indexFile, manifest);
}
