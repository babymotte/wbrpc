#!/usr/bin/env node

import { spawn } from "child_process";
import path from "path";
import {
  DataType,
  Interface,
  InterfaceRef,
  ModuleApi,
  ModuleComponent,
  ModuleServiceProvider,
} from "./module.jtd";

const fs = require("fs");

const componentIndex = `import { wbsrInitComponent, ModuleComponent, ServiceInstance } from "wbsr-js";

const packageJson: ModuleComponent = require("../package.json");
const moduleComponent = packageJson.component;
const serviceReferences = packageJson.serviceReferences;
const { component } = require(\`./\${moduleComponent}\`);

wbsrInitComponent(moduleComponent, serviceReferences, component);
`;

const serviceIndex = `import { wbsrInitService, ModuleServiceProvider, ServiceInstance } from "wbsr-js";

const packageJson: ModuleServiceProvider = require("../package.json");
const moduleService = packageJson.service;
const serviceReferences = packageJson.serviceReferences;
const { service } = require(\`./\${moduleService.name}\`);

wbsrInitService(moduleService, serviceReferences, service);
`;

const srcDir = path.join(".", "src");

if (!fs.existsSync(srcDir)) {
  fs.mkdirSync(srcDir);
}

const indexFile = path.join(srcDir, "index.ts");

fs.readFile("./package.json", "utf8", (err: any, data: string) => {
  if (err) {
    console.error(err);
    return;
  }
  const pkg: ModuleServiceProvider | ModuleComponent = JSON.parse(data);
  if (pkg.moduleType == "COMPONENT") {
    fs.writeFile(indexFile, componentIndex, (err: any) => {
      if (err) {
        throw new Error(`Could not write generated index.ts file: ${err}`);
      }
    });
    generateComponentFile(pkg);
  }
  if (pkg.moduleType == "SERVICE_PROVIDER") {
    fs.writeFile(indexFile, serviceIndex, (err: any) => {
      if (err) {
        throw new Error(`Could not write generated index.ts file: ${err}`);
      }
    });
    generateServiceFile(pkg);
  }
});

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
  const [scope, moduleName] = module.split("/");
  const moduleManifest = path.join(
    path.join(path.join(path.join(".", "node_modules"), scope), moduleName),
    "package.json"
  );

  let data;
  try {
    data = fs.readFileSync(moduleManifest, "utf8");
  } catch (err) {
    throw new Error(`Could not load manifest of module '${name}': ${err}`);
  }

  const apiModule: ModuleApi = JSON.parse(data);
  if (apiModule.interfaces) {
    for (const iface of apiModule.interfaces) {
      if (iface.name === ifaceRef.name) {
        return iface;
      }
    }
  }
}

function generateTypes(module: string) {
  const [scope, moduleName] = module.split("/");
  const moduleManifest = path.join(
    path.join(path.join(path.join(".", "node_modules"), scope), moduleName),
    "package.json"
  );

  let data;
  try {
    data = fs.readFileSync(moduleManifest, "utf8");
  } catch (err) {
    throw new Error(`Could not load manifest of module '${module}': ${err}`);
  }

  let parsed: ModuleApi;
  try {
    parsed = JSON.parse(data);
  } catch (err) {
    throw new Error(`Could not parse manifest of module '${module}': ${err}`);
  }

  if (parsed.dataTypes) {
    for (const dt of parsed.dataTypes) {
      generateType(dt);
    }
  } else {
    console.log("Module", module, "declares no data types");
  }
}

function generateType(dataType: DataType) {
  const srcDir = path.join(".", "src");

  if (!fs.existsSync(srcDir)) {
    fs.mkdirSync(srcDir);
  }

  const dtDir = path.join(srcDir, dataType.name);
  if (!fs.existsSync(dtDir)) {
    fs.mkdirSync(dtDir);
  }

  const codegen = spawn(
    "jtd-codegen",
    ["-", "--root-name", dataType.name, "--typescript-out", dtDir],
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

  codegen.stdin.write(JSON.stringify(dataType.struct), console.error);
  codegen.stdin.end();
}
