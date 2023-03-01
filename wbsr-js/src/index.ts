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
  ServiceReference,
} from "./module.jtd";

export { ModuleServiceProvider } from "./module.jtd";

const EXIT_CODES = {
  DISCONNECTED: 1,
  DEPENDENCY_LOST: 2,
};

export type ServiceInstance = {
  activate?: () => void;
  deactivate?: () => void;
  functions: any;
};

export type Runtime = {
  wb: Connection;
  context: any;
};

export async function wbsrInit(
  serviceDeclaration: Service,
  references: ServiceReference[] | undefined,
  serviceConstructor: (runtime: Runtime) => ServiceInstance
) {
  console.log("Initializing WBSR runtime …");

  const wbAddress = process.argv[2] || "ws://worterbuch.local/ws";
  const wb = connect(wbAddress);
  // TODO last will and grave goods
  wb.onclose = () => process.exit(EXIT_CODES.DISCONNECTED);
  wb.onhandshake = async () => {
    console.log("Worterbuch connection established, resolving services …");
    await resolveServiceDependencies(serviceDeclaration, references);
    console.log(
      "Dependecies of service",
      serviceDeclaration.name,
      "resolved, initializing service …"
    );
    const runtime = { wb, context: {} };
    const serviceInstance = serviceConstructor(runtime);
    if (serviceInstance.activate) {
      serviceInstance.activate();
    }
    // TODO
  };
}

async function resolveServiceDependencies(
  serviceDeclaration: Service,
  references: ServiceReference[] | undefined
) {
  console.log(
    "Resolving dependencies of service",
    serviceDeclaration.name,
    "…"
  );

  if (!references) {
    return;
  }

  console.log(references);

  // TODO
}
