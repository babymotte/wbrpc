#!/usr/bin/env node

import { spawn } from "child_process";
import path from "path";
import { loadApiManifest } from "./manifests";
import {
  ArgumentType,
  Interface,
  InterfaceRef,
  ModuleComponent,
  ModuleServiceProvider,
} from "./module.jtd";
import fs from "fs";

const COMPONENT_INDEX = `import { wbsrInitComponent, ModuleComponent, ServiceInstance } from "wbsr-js";
import { component } from "./{{component}}";
import module from "./component.json";

wbsrInitComponent(module as ModuleComponent, component);
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
  componentFile: string,
  manifest: ModuleComponent
) {
  const indexContent = COMPONENT_INDEX.replace(
    "{{component}}",
    manifest.component
  );
  const component = {
    moduleType: "COMPONENT",
    component: manifest.component,
    name: manifest.name,
    version: manifest.version,
    serviceReferences: manifest.serviceReferences,
  };
  const componentJSON = JSON.stringify(component, null, 2);
  fs.writeFile(indexFile, indexContent, (err: any) => {
    if (err) {
      throw new Error(
        `Could not write generated ${manifest.component}.ts file: ${err}`
      );
    }
  });
  fs.writeFile(componentFile, componentJSON, (err: any) => {
    if (err) {
      throw new Error(`Could not write generated component.json file: ${err}`);
    }
  });
  generateComponentFile(manifest);
}

function generateComponentFile(pkg: ModuleComponent) {
  if (pkg.serviceReferences) {
    for (const ref of pkg.serviceReferences) {
      generateInterfaces(ref.module);
      generateTypes(ref.module);
    }
  }

  const imports = [`import { Runtime, ComponentInstance } from "wbsr-js";`];

  // TODO this works for static mandatory refs, dynamic or multiple refs need different handling
  const references = pkg.serviceReferences
    ? pkg.serviceReferences.map((ref) => {
        const varName = ref.name.toLowerCase();
        const [scope, moduleName] = ref.module.split("/");
        const iface = ref.name;
        imports.push(`import { ${iface} } from "${ref.module}/${iface}";`);
        return `const ${varName} = runtime.context["${scope}"]["${moduleName}"]["${iface}"] as ${iface};`;
      })
    : undefined;

  const code = `${imports.join("\n")}
  
export function component(runtime: Runtime): ComponentInstance {
  const activate = () => {
    console.log("${pkg.component} activated.");${
    references ? "\n    " + references.join("\n") : ""
  }
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

  if (pkg.serviceReferences) {
    for (const ref of pkg.serviceReferences) {
      generateTypes(ref.module);
    }
  }

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
            imports.push(
              `import { ${type} } from "./${
                module || ifaceRef.module
              }/${name}";`
            );
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

  // TODO this works for static mandatory refs, dynamic or multiple refs need different handling
  const references = pkg.serviceReferences
    ? pkg.serviceReferences.map((ref) => {
        const varName = ref.name.toLowerCase();
        const [scope, moduleName] = ref.module.split("/");
        const iface = ref.name;
        return `const ${varName} = runtime.context["${scope}"]["${moduleName}"]["${iface}"];`;
      })
    : undefined;

  const code = `import { Runtime, ServiceInstance } from "wbsr-js";
${imports.join("\n")}
  
export function service(runtime: Runtime): ServiceInstance {
  const activate = () => {
    console.log("${svc.name} activated.");${
    references ? "\n    " + references.join("\n") : ""
  }
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

function generateInterfaces(module: string) {
  console.log("Generating interfaces from module", module, "…");

  const apiModule = loadApiManifest(module);

  if (apiModule.interfaces) {
    for (const iface of apiModule.interfaces) {
      generateInterface(apiModule.name, iface);
    }
  } else {
    console.log("Module", module, "declares no data types");
  }
}

function generateInterface(module: string, iface: Interface) {
  const [scope, moduleName] = module.split("/");

  const srcDir = path.join(".", "src");
  if (!fs.existsSync(srcDir)) {
    fs.mkdirSync(srcDir);
  }

  const scopeDir = path.join(srcDir, scope);
  if (!fs.existsSync(scopeDir)) {
    fs.mkdirSync(scopeDir);
  }

  const moduleDir = path.join(scopeDir, moduleName);
  if (!fs.existsSync(moduleDir)) {
    fs.mkdirSync(moduleDir);
  }

  const ifaceFile = path.join(moduleDir, iface.name + ".ts");
  const imports: string[] = [];

  const functions = iface.functions.map((fun) => {
    const args = fun.arguments
      ? fun.arguments.map(
          (arg) => `${arg.name}: ${formatArgType(arg.type, imports, module)}`
        )
      : [];
    const returnType = fun.returnType
      ? formatArgType(fun.returnType, imports, module)
      : "void";
    return `${fun.name}: (${args.join(", ")}) => ${returnType}`;
  });

  const code = `${imports.join("\n")}
  
export interface ${iface.name} {
  ${functions.join("\n\n")}
}
`;

  fs.writeFile(ifaceFile, code, (err: any) => {
    if (err) {
      throw new Error(
        `Could not write generated source file '${ifaceFile}': ${err}`
      );
    }
  });
}

function formatArgType(
  argType: ArgumentType,
  imports: string[],
  ifaceModule: string
): string {
  if (argType.builtin) {
    return argType.builtin;
  } else if (argType.import) {
    imports.push(
      `import { ${argType.import.name} } from "${
        argType.import.module || ifaceModule
      }/${argType.import.name}";`
    );

    return argType.import.name;
  } else {
    throw new Error("Argument has no type.");
  }
}

function generateTypes(module: string) {
  console.log("Generating types from module", module, "…");

  const apiModule = loadApiManifest(module);

  if (apiModule.dataTypes) {
    for (const dt of Object.keys(apiModule.dataTypes)) {
      generateType(apiModule.name, dt, apiModule.dataTypes[dt]);
    }
  } else {
    console.log("Module", module, "declares no data types");
  }
}

function generateType(module: string, name: string, dataType: any) {
  const [scope, moduleName] = module.split("/");

  const srcDir = path.join(".", "src");
  if (!fs.existsSync(srcDir)) {
    fs.mkdirSync(srcDir);
  }

  const scopeDir = path.join(srcDir, scope);
  if (!fs.existsSync(scopeDir)) {
    fs.mkdirSync(scopeDir);
  }

  const moduleDir = path.join(scopeDir, moduleName);
  if (!fs.existsSync(moduleDir)) {
    fs.mkdirSync(moduleDir);
  }

  const dtDir = path.join(moduleDir, name);
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
