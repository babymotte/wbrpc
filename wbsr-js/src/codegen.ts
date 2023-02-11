#!/usr/bin/env node

import { fstat } from "fs";
import path from "path";
import { connect, Connection } from "worterbuch-js";
import {
  Interface,
  InterfaceRef,
  ModuleApi,
  ModuleRef,
  ModuleServiceProvider,
  Service,
} from "./module.jtd";

const fs = require("fs");

const index = `import { wbsrInit, ModuleServiceProvider, ServiceInstance } from "wbsr-js";
  import { Service } from "wbsr-js/dist/module.jtd";
  
  const services = new Map<Service, () => ServiceInstance>();
  
  const packageJson: ModuleServiceProvider = require("../package.json");
  const moduleServices = packageJson.services;
  for (const svc of moduleServices) {
    const { service } = require(\`./\${svc.name}\`);
    services.set(svc, service);
  }
  
  wbsrInit(services);
  `;

const indexFile = path.join(path.join(".", "src"), "index.ts");
fs.writeFile(indexFile, index, (err: any) => {
  if (err) {
    throw new Error(`Could not write generated index.ts file: ${err}`);
  }
});

fs.readFile("./package.json", "utf8", (err: any, data: string) => {
  if (err) {
    console.error(err);
    return;
  }
  const pkg: ModuleServiceProvider = JSON.parse(data);
  const serviceDeclarations = pkg.services;
  for (const svc of serviceDeclarations) {
    generateServiceFile(svc, pkg);
  }
});

function generateServiceFile(svc: Service, pkg: ModuleServiceProvider) {
  const functions: string[] = [];
  const functionNames: string[] = [];
  const imports: string[] = [];

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
            if (!module) {
              throw new Error(
                `Data type reference '${name}' is missing a module declaration.`
              );
            }
            generateTypes(module);
            type = name;
            imports.push(`import { ${type} from "./${module.name}"}`);
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
    }
    
    const deactivate = () => {
      console.log("${svc.name} deactivated.");
      // TODO auto-generated method stub
    }
    
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
  const [scope, moduleName] = module.name.split("/");
  const moduleManifest = path.join(
    path.join(path.join(path.join(".", "node_modules"), scope), moduleName),
    "package.json"
  );

  let data;
  try {
    data = fs.readFileSync(moduleManifest, "utf8");
  } catch (err) {
    if (err) {
      throw new Error(`Could not load manifest of module '${name}': ${err}`);
    }
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

function generateTypes(module: ModuleRef) {
  // TODO
  // throw new Error("Function not implemented.");
}
