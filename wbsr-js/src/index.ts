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

export function loadServices(packageJson: ModuleServiceProvider) {
  return packageJson.services;
}

export async function wbsrInit(services: Map<Service, () => ServiceInstance>) {
  console.log("Initializing WBSR runtime …");
  return new Promise((resolve, reject) => runModule(services, resolve, reject));
}

function runModule(
  services: Map<Service, (runtime: Runtime) => ServiceInstance>,
  resolve: (value: any) => void,
  reject: (reason: any) => void
) {
  const wbAddress = process.argv[2] || "ws://worterbuch.local/ws";
  const wb = connect(wbAddress);
  wb.onclose = () => process.exit(EXIT_CODES.DISCONNECTED);
  wb.onhandshake = async () => {
    console.log("Worterbuch connection established, resolving services …");
    services.forEach(async (serviceConstructor, serviceDeclaration) => {
      await resolveServiceDependencies(serviceDeclaration);
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
    });
    // TODO
  };
}

async function resolveServiceDependencies(serviceDeclaration: Service) {
  console.log(
    "Resolving dependencies of service",
    serviceDeclaration.name,
    "…"
  );
  // TODO
}
