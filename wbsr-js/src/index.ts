import { connect, Connection, Key } from "worterbuch-js";
import { getIface, loadApiManifest } from "./manifests";
import {
  Interface,
  ModuleComponent,
  ModuleServiceProvider,
  ServiceReference,
} from "./module.jtd";
import { Rpc } from "./rpc.jtd";

export { ModuleServiceProvider, ModuleComponent } from "./module.jtd";

const EXIT_CODES = {
  DISCONNECTED: 1,
  DEPENDENCY_LOST: 2,
};

export type ServiceInstance = {
  activate?: () => void;
  deactivate?: () => void;
  functions: any;
};

export type ComponentInstance = {
  activate?: () => void;
  deactivate?: () => void;
};

export type Runtime = {
  wb: Connection;
  context: any;
};

export async function wbsrInitComponent(
  module: ModuleComponent,
  componentConstructor: (runtime: Runtime) => ComponentInstance
) {
  console.log("Initializing WBSR runtime …");

  const componentName = module.component;
  const references = module.serviceReferences;

  const wbAddress = process.argv[2] || "ws://worterbuch.local/ws";
  // TODO last will and grave goods
  const wb = connect(wbAddress, [], []);
  wb.onclose = () => process.exit(EXIT_CODES.DISCONNECTED);
  wb.onhandshake = async () => {
    console.log("Worterbuch connection established, initializing component …");

    const runtime = { wb, context: {} };
    const componentInstance = componentConstructor(runtime);

    console.log(
      "Component initialized successfully, resolving referenced services …"
    );

    resolveDependencies(
      references,
      wb,
      () => {
        console.log(
          "Dependecies of component",
          componentName,
          "resolved, activating component …"
        );
        if (componentInstance.activate) {
          componentInstance.activate();
        }
      },
      () => {
        console.log(
          "Dependencies of component",
          componentName,
          "went away, deactivating component …"
        );
        if (componentInstance.deactivate) {
          componentInstance.deactivate();
        }
        process.exit(EXIT_CODES.DEPENDENCY_LOST);
      },
      runtime
    );
  };
}

export async function wbsrInitService(
  module: ModuleServiceProvider,
  serviceConstructor: (runtime: Runtime) => ServiceInstance
) {
  console.log("Initializing WBSR runtime …");

  const serviceDeclaration = module.service;
  const references = module.serviceReferences;

  const wbAddress = process.argv[2] || "ws://worterbuch.local/ws";

  const graveGoods = [];

  for (const ifaceRef of module.service.interfaces) {
    const manifest = loadApiManifest(ifaceRef.module);
    const iface = getIface(ifaceRef, manifest);
    if (!iface) {
      throw new Error(
        `Interface ${ifaceRef.name} does not exist in module ${ifaceRef.module}`
      );
    }

    graveGoods.push(
      `wbsr/services/${ifaceRef.module}/${manifest.version}/${ifaceRef.name}/${module.name}/${module.version}/${serviceDeclaration.name}`
    );
  }

  const wb = connect(wbAddress, [], graveGoods);
  wb.onclose = () => process.exit(EXIT_CODES.DISCONNECTED);
  wb.onhandshake = async () => {
    console.log("Worterbuch connection established, initializing service …");

    const runtime = { wb, context: {} };
    const serviceInstance = serviceConstructor(runtime);

    console.log(
      "Service initialized successfully, resolving referenced services …"
    );

    resolveDependencies(
      references,
      wb,
      () => {
        console.log(
          "Dependecies of service",
          serviceDeclaration.name,
          "resolved, activating service …"
        );

        for (const ifaceRef of module.service.interfaces) {
          const manifest = loadApiManifest(ifaceRef.module);
          const iface = getIface(ifaceRef, manifest);
          if (!iface) {
            throw new Error(
              `Interface ${ifaceRef.name} does not exist in module ${ifaceRef.module}`
            );
          }
          for (const fun of iface.functions) {
            wb.subscribe(
              `wbsr/services/${ifaceRef.module}/${manifest.version}/${ifaceRef.name}/${module.name}/${module.version}/${serviceDeclaration.name}/${fun.name}`,
              (state) => {
                if (state.value) {
                  // TODO validate value object against Rpc schema
                  const rpc: Rpc = state.value;
                  const args = rpc.arguments ? rpc.arguments : [];
                  serviceInstance.functions[fun.name](...args);
                }
              }
            );
          }

          wb.set(
            `wbsr/services/${ifaceRef.module}/${manifest.version}/${ifaceRef.name}/${module.name}/${module.version}/${serviceDeclaration.name}`,
            "active"
          );
        }
        if (serviceInstance.activate) {
          serviceInstance.activate();
        }
      },
      () => {
        console.log(
          "Dependencies of service",
          serviceDeclaration.name,
          "went away, deactivating service …"
        );
        for (const iface of module.service.interfaces) {
          const manifest = loadApiManifest(iface.module);
          wb.del(
            `wbsr/services/${iface.module}/${manifest.version}/${iface.name}/${module.name}/${module.version}/${serviceDeclaration.name}`
          );
        }
        if (serviceInstance.deactivate) {
          serviceInstance.deactivate();
        }
        process.exit(EXIT_CODES.DEPENDENCY_LOST);
      },
      runtime
    );
  };
}

async function resolveDependencies(
  references: ServiceReference[] | undefined,
  wb: Connection,
  resolved: () => void,
  unresolved: () => void,
  runtime: Runtime
) {
  if (!references || references.length === 0) {
    resolved();
    return;
  }

  var initialized = false;

  const resolvedServices = new Map();

  const missingReferences = [...references];

  for (const ref of references) {
    const manifest = loadApiManifest(ref.module);
    const [scope, moduleName] = ref.module.split("/");
    const version = manifest.version;
    const ifaceName = ref.name;
    if (!manifest.interfaces) {
      throw new Error(
        "Interface " + ifaceName + " not defined in module " + ref.module
      );
    }
    var iface: Interface;
    for (const f of manifest.interfaces) {
      if (f.name === ifaceName) {
        iface = f;
        break;
      }
    }
    const topic = `wbsr/services/${scope}/${moduleName}/${version}/${ifaceName}/#`;

    wb.pSubscribe(topic, (pstate) => {
      if (pstate.keyValuePairs) {
        for (const kvp of pstate.keyValuePairs) {
          if (kvp.value == "active") {
            // TODO filter by properties
            // TODO handle different policies/cardinalities
            const index = missingReferences.indexOf(ref);
            if (index >= 0) {
              console.log(
                `Found service for ${ref.module}/${ref.name}: ${kvp.key}`
              );
              resolvedServices.set(ref, kvp.key);
              missingReferences.splice(index, 1);
              const service = stubService(ref, kvp.key, iface, wb);
              runtime.context[scope] = {};
              runtime.context[scope][moduleName] = {};
              runtime.context[scope][moduleName][ifaceName] = service;
              if (missingReferences.length == 0) {
                resolved();
              }
            }
          }
        }
      }
      if (pstate.deleted) {
        for (const kvp of pstate.deleted) {
          if (kvp.value == "active") {
            // TODO filter by properties
            // TODO handle different policies/cardinalities
            const index = references.indexOf(ref);
            if (index >= 0) {
              console.log(
                `Lost service for ${ref.module}/${ref.name}: ${kvp.key}`
              );
              // TODO stop component/service only if dependnecies are no longer met
              unresolved();
            }
          }
        }
      }
    });
  }

  function stubService(
    ref: ServiceReference,
    address: string,
    iface: Interface,
    wb: Connection
  ) {
    console.log("Stubbing interface", ref.name, "…");

    var ticket = 0;

    const stub: any = {};

    for (const fun of iface.functions) {
      stub[fun.name] = (...args: any[]) => {
        const timestamp = new Date();
        const deadline = new Date();
        deadline.setSeconds(timestamp.getSeconds() + 1);
        const rpc: Rpc = {
          timestamp: timestamp.toISOString(),
          deadline: deadline.toISOString(),
          ticket: ticket++,
          arguments: args,
        };
        wb.publish(`${address}/${fun.name}`, rpc);
      };
    }

    return stub;
  }
}
