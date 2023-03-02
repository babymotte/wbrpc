#!/usr/bin/env node

import { spawn } from "child_process";
import path from "path";
import { loadApiManifest, loadOwnManifest } from "./manifests";
import {
  Interface,
  InterfaceRef,
  ModuleApi,
  ModuleComponent,
  ModuleServiceProvider,
} from "./module.jtd";
import fs from "fs";

const COMPONENT_INDEX = `import { wbsrInitComponent, ModuleComponent, ServiceInstance } from "wbsr-js";

const packageJson: ModuleComponent = require("../package.json");
const { component } = require(\`./\${packageJson.component}\`);

wbsrInitComponent(packageJson, component);
`;

const SERVICE_INDEX = `import { wbsrInitService, ModuleServiceProvider } from "wbsr-js";

const packageJson: ModuleServiceProvider = require("../package.json");
const { service } = require(\`./\${packageJson.service.name}\`);

wbsrInitService(packageJson, service);
`;

export function generateService(
  indexFile: string,
  manifest: ModuleServiceProvider
) {
  fs.writeFile(indexFile, SERVICE_INDEX, (err: any) => {
    if (err) {
      throw new Error(`Could not write generated index.ts file: ${err}`);
    }
  });
  generateServiceFile(manifest);
}

export function generateComponent(
  indexFile: string,
  manifest: ModuleComponent
) {
  fs.writeFile(indexFile, COMPONENT_INDEX, (err: any) => {
    if (err) {
      throw new Error(`Could not write generated index.ts file: ${err}`);
    }
  });
  generateComponentFile(manifest);
}

function generateComponentFile(pkg: ModuleComponent) {
  const code = `import { Runtime, ComponentInstance } from "wbsr-js";
  
export function component(runtime: Runtime): ComponentInstance {
  const activate = () => {
    console.log("${pkg.component} activated.");
    // TODO auto-generated method stub
  };

  const deactivate = () => {
    console.log("${pkg.component} deactivated.");
    // TODO auto-generated method stub
  };

  return { activate, deactivate };
}
`;

  const filePath = path.join(path.join(".", "src"), `${pkg.component}.ts`);

  fs.writeFile(filePath, code, (err: any) => {
    if (err) {
      throw new Error(
        `Could not write generated source file '${filePath}': ${err}`
      );
    }
  });
}

function generateServiceFile(pkg: ModuleServiceProvider) {
  const functions: string[] = [];
  const functionNames: string[] = [];
  const imports: string[] = [];

  const svc = pkg.service;

  for (const ifaceRef of svc.interfaces) {
    const iface = loadInterface(ifaceRef);
    if (!iface) {
      console.error(
        `Could not find interface '${ifaceRef.name}' in module '${ifaceRef.module}'`
      );
      return;
    }
    for (const fun of iface.functions) {
      const args: string[] = [];
      if (fun.arguments) {
        for (const arg of fun.arguments) {
          const name = arg.name;
          let type;
          if (arg.type.builtin) {
            type = arg.type.builtin;
          } else if (arg.type.import) {
            const { name, module } = arg.type.import;
            generateTypes(module || ifaceRef.module);
            type = name;
            imports.push(`import { ${type} } from "./${name}";`);
          } else {
            throw new Error(`No type defined for argument '${arg.name}'`);
          }
          args.push(`${name}: ${type}`);
        }
      }
      const code = `  const ${fun.name} = (${args.join(", ")}) => {
    // TODO auto-generated method stub
  };`;
      functions.push(code);
      functionNames.push(fun.name);
    }
  }

  const code = `import { Runtime, ServiceInstance } from "wbsr-js";
${imports.join("\n")}
  
export function service(runtime: Runtime): ServiceInstance {
  const activate = () => {
    console.log("${svc.name} activated.");
    // TODO auto-generated method stub
  };

  const deactivate = () => {
    console.log("${svc.name} deactivated.");
    // TODO auto-generated method stub
  };
    
${functions.join("\n\n")}

  return { activate, deactivate, functions: { ${functionNames.join(", ")} } };
}
`;

  const filePath = path.join(path.join(".", "src"), `${svc.name}.ts`);

  fs.writeFile(filePath, code, (err: any) => {
    if (err) {
      throw new Error(
        `Could not write generated source file '${filePath}': ${err}`
      );
    }
  });
}

function loadInterface(ifaceRef: InterfaceRef): Interface | undefined {
  const { name, module } = ifaceRef;
  if (!module) {
    throw new Error(
      `Interface reference '${name}' is missing a module declaration.`
    );
  }

  const apiModule = loadApiManifest(module);

  if (apiModule.interfaces) {
    for (const iface of apiModule.interfaces) {
      if (iface.name === ifaceRef.name) {
        return iface;
      }
    }
  }
}

function generateTypes(module: string) {
  const apiModule = loadApiManifest(module);

  if (apiModule.dataTypes) {
    for (const dt of Object.keys(apiModule.dataTypes)) {
      generateType(dt, apiModule.dataTypes[dt]);
    }
  } else {
    console.log("Module", module, "declares no data types");
  }
}

function generateType(name: string, dataType: any) {
  const srcDir = path.join(".", "src");

  if (!fs.existsSync(srcDir)) {
    fs.mkdirSync(srcDir);
  }

  const dtDir = path.join(srcDir, name);
  if (!fs.existsSync(dtDir)) {
    fs.mkdirSync(dtDir);
  }

  const codegen = spawn(
    "jtd-codegen",
    ["-", "--root-name", name, "--typescript-out", dtDir],
    {
      stdio: "pipe",
    }
  );
  codegen.stdout.on("data", (data) => {
    console.log(`${data}`);
  });
  codegen.stderr.on("data", (data) => {
    console.error(`${data}`);
  });

  codegen.stdin.write(JSON.stringify(dataType), console.error);
  codegen.stdin.end();
}
