import { connect, Connection } from "worterbuch-js";
import { loadApiManifest } from "./manifests";
import {
  ModuleComponent,
  ModuleServiceProvider,
  ServiceReference,
} from "./module.jtd";

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
  const wb = connect(wbAddress);
  // TODO last will and grave goods
  wb.onclose = () => process.exit(EXIT_CODES.DISCONNECTED);
  wb.onhandshake = async () => {
    console.log("Worterbuch connection established, initializing component …");

    const runtime = { wb, context: {} };
    const serviceInstance = componentConstructor(runtime);

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
        if (serviceInstance.activate) {
          serviceInstance.activate();
        }
      },
      () => {
        console.log(
          "Dependencies of component",
          componentName,
          "went away, deactivating component …"
        );
        if (serviceInstance.deactivate) {
          serviceInstance.deactivate();
        }
      }
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
  const wb = connect(wbAddress);
  // TODO last will and grave goods
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
        for (const iface of module.service.interfaces) {
          const manifest = loadApiManifest(iface.module);
          wb.set(
            `wbsr/services/${iface.module}/${manifest.version}/${iface.name}/${module.name}/${module.version}/${serviceDeclaration.name}`,
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
      }
    );
  };
}

async function resolveDependencies(
  references: ServiceReference[] | undefined,
  wb: Connection,
  resolved: () => void,
  unresolved: () => void
) {
  if (!references || references.length === 0) {
    resolved();
    return;
  }

  var initialized = false;

  for (const ref of references) {
  }

  // TODO
}
