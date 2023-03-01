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
  componentName: string,
  references: ServiceReference[] | undefined,
  componentConstructor: (runtime: Runtime) => ComponentInstance
) {
  console.log("Initializing WBSR runtime …");

  const wbAddress = process.argv[2] || "ws://worterbuch.local/ws";
  const wb = connect(wbAddress);
  // TODO last will and grave goods
  wb.onclose = () => process.exit(EXIT_CODES.DISCONNECTED);
  wb.onhandshake = async () => {
    console.log("Worterbuch connection established, resolving services …");
    await resolveServiceDependencies(references);
    console.log(
      "Dependecies of service",
      componentName,
      "resolved, initializing service …"
    );
    const runtime = { wb, context: {} };
    const serviceInstance = componentConstructor(runtime);
    if (serviceInstance.activate) {
      serviceInstance.activate();
    }
    // TODO
  };
}

export async function wbsrInitService(
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
    await resolveServiceDependencies(references);
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
  references: ServiceReference[] | undefined
) {
  if (!references) {
    return;
  }

  console.log(references);

  // TODO
}
