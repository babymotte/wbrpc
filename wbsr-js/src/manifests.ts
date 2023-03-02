import path from "path";
import fs from "fs";
import {
  ModuleApi,
  ModuleComponent,
  ModuleServiceProvider,
} from "./module.jtd";

export function loadApiManifest(moduleName: string): ModuleApi {
  return loadManifest(moduleName) as ModuleApi;
}

export function loadServiceManifest(moduleName: string): ModuleServiceProvider {
  return loadManifest(moduleName) as ModuleServiceProvider;
}

export function loadComponentManifest(moduleName: string): ModuleComponent {
  return loadManifest(moduleName) as ModuleComponent;
}

export function loadOwnManifest() {
  return loadManifestFromDir(".");
}

function loadManifest(
  moduleName: string
): ModuleApi | ModuleComponent | ModuleServiceProvider {
  const dir = path.join(path.join(".", "node_modules"), moduleName);
  return loadManifestFromDir(dir);
}

function loadManifestFromDir(
  dir: string
): ModuleApi | ModuleComponent | ModuleServiceProvider {
  const moduleManifest = path.join(dir, "package.json");

  let data;
  try {
    data = fs.readFileSync(moduleManifest, "utf8");
  } catch (err) {
    throw new Error(`Could not load manifest of module '${name}': ${err}`);
  }

  let parsed: ModuleApi;
  try {
    parsed = JSON.parse(data);
  } catch (err) {
    throw new Error(`Could not parse manifest of module '${name}': ${err}`);
  }

  return parsed;
}
