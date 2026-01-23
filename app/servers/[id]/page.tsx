import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Server,
  Cpu,
  MemoryStick,
  HardDrive,
  Container,
  Package,
  Clock,
  Globe,
  Terminal,
  Database,
  AppWindow,
  Bot,
  Network,
  ArrowRight,
} from "lucide-react";

interface ContainerData {
  id: number;
  containerId: string;
  name: string;
  image: string;
  status: "running" | "exited" | "paused" | "restarting";
  health: string | null;
  ports: string;
}

interface ServiceContainerData {
  id: number;
  containerId: string;
  name: string;
  status: "running" | "exited" | "paused" | "restarting";
  health: string | null;
}

type ServiceType =
  | "application"
  | "database"
  | "website"
  | "agent"
  | "infrastructure";

interface ServiceDependency {
  id: number;
  name: string;
  composeService: string | null;
  status: "healthy" | "degraded" | "down";
  dependencyType?: "requires" | "uses" | "optional";
  inferred?: boolean;
}

interface ServiceData {
  id: number;
  name: string;
  description: string | null;
  serviceType: ServiceType | null;
  composeProject: string | null;
  composeService: string | null;
  version: string | null;
  status: "healthy" | "degraded" | "down";
  containers: ServiceContainerData[];
  dependsOn: ServiceDependency[];
  dependedOnBy: ServiceDependency[];
}

interface ServerData {
  id: number;
  name: string;
  hostname: string | null;
  ipAddress: string | null;
  status: "online" | "offline" | "maintenance";
  cpuCores: number | null;
  totalMemoryGb: number | undefined;
  totalDiskGb: number | undefined;
  cpu: number | undefined;
  memory: number | undefined;
  disk: number | undefined;
  lastMetricsAt: string | null;
  createdAt: string;
  osName: string | null;
  osVersion: string | null;
  osKernel: string | null;
  osArch: string | null;
  dockerVersion: string | null;
  containers: ContainerData[];
  services: ServiceData[];
}

async function getServer(id: string): Promise<ServerData | null> {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
  const res = await fetch(`${baseUrl}/api/servers/${id}`, {
    cache: "no-store",
  });

  if (!res.ok) {
    if (res.status === 404) return null;
    throw new Error("Failed to fetch server");
  }

  return res.json();
}

const statusConfig = {
  online: { dot: "bg-emerald-400", text: "text-emerald-400", label: "Online" },
  offline: { dot: "bg-red-400", text: "text-red-400", label: "Offline" },
  maintenance: {
    dot: "bg-amber-400",
    text: "text-amber-400",
    label: "Maintenance",
  },
};

const containerStatusConfig = {
  running: { dot: "bg-emerald-400", text: "text-emerald-400" },
  exited: { dot: "bg-red-400", text: "text-red-400" },
  paused: { dot: "bg-amber-400", text: "text-amber-400" },
  restarting: { dot: "bg-cyan-400", text: "text-cyan-400" },
};

const serviceStatusConfig = {
  healthy: {
    dot: "bg-emerald-400",
    text: "text-emerald-400",
    bg: "bg-emerald-500/10",
    label: "Healthy",
  },
  degraded: {
    dot: "bg-amber-400",
    text: "text-amber-400",
    bg: "bg-amber-500/10",
    label: "Degraded",
  },
  down: {
    dot: "bg-red-400",
    text: "text-red-400",
    bg: "bg-red-500/10",
    label: "Down",
  },
};

const serviceTypeConfig: Record<
  ServiceType,
  { icon: typeof Database; color: string; label: string }
> = {
  database: { icon: Database, color: "text-blue-400", label: "Database" },
  application: {
    icon: Package,
    color: "text-purple-400",
    label: "Application",
  },
  website: { icon: AppWindow, color: "text-cyan-400", label: "Website" },
  agent: { icon: Bot, color: "text-amber-400", label: "Agent" },
  infrastructure: {
    icon: Network,
    color: "text-pink-400",
    label: "Infrastructure",
  },
};

function MetricGauge({
  label,
  value,
  total,
  unit,
  icon: Icon,
  gradient,
}: {
  label: string;
  value: number | undefined;
  total?: number | string;
  unit: string;
  icon: typeof Cpu;
  gradient: string;
}) {
  const percentage = value ?? 0;

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
      <div className="flex items-center gap-3 mb-4">
        <div className="rounded-lg bg-zinc-800 p-2">
          <Icon className="h-5 w-5 text-zinc-400" />
        </div>
        <div>
          <p className="text-sm text-zinc-400">{label}</p>
          <p className="text-lg font-semibold text-zinc-100">
            {value !== undefined ? `${value.toFixed(1)}${unit}` : "-"}
            {total && (
              <span className="text-sm text-zinc-500 font-normal">
                {" "}
                / {total}
              </span>
            )}
          </p>
        </div>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-zinc-800">
        <div
          className={`h-full ${gradient} transition-all duration-500`}
          style={{ width: `${Math.min(percentage, 100)}%` }}
        />
      </div>
    </div>
  );
}

function OsLogo({ osName }: { osName: string }) {
  const name = osName.toLowerCase();

  // Ubuntu
  if (name.includes("ubuntu")) {
    return (
      <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-[#E95420]/10 border border-[#E95420]/30">
        <svg viewBox="0 0 256 256" className="h-12 w-12">
          <circle cx="128" cy="128" r="128" fill="#E95420" />
          <circle
            cx="128"
            cy="128"
            r="113"
            fill="none"
            stroke="white"
            strokeWidth="14"
          />
          <circle cx="128" cy="37" r="18" fill="white" />
          <circle cx="207" cy="175" r="18" fill="white" />
          <circle cx="49" cy="175" r="18" fill="white" />
          <circle cx="128" cy="128" r="32" fill="white" />
        </svg>
      </div>
    );
  }

  // Debian
  if (name.includes("debian")) {
    return (
      <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-[#A80030]/10 border border-[#A80030]/30">
        <svg viewBox="0 0 256 256" className="h-12 w-12">
          <circle cx="128" cy="128" r="128" fill="#A80030" />
          <text
            x="128"
            y="160"
            textAnchor="middle"
            fill="white"
            fontSize="120"
            fontFamily="serif"
          >
            D
          </text>
        </svg>
      </div>
    );
  }

  // Windows
  if (name.includes("windows")) {
    return (
      <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-[#0078D4]/10 border border-[#0078D4]/30">
        <svg viewBox="0 0 256 256" className="h-12 w-12">
          <rect x="20" y="20" width="100" height="100" fill="#0078D4" />
          <rect x="136" y="20" width="100" height="100" fill="#0078D4" />
          <rect x="20" y="136" width="100" height="100" fill="#0078D4" />
          <rect x="136" y="136" width="100" height="100" fill="#0078D4" />
        </svg>
      </div>
    );
  }

  // macOS / Darwin
  if (
    name.includes("macos") ||
    name.includes("darwin") ||
    name.includes("mac os")
  ) {
    return (
      <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-zinc-500/10 border border-zinc-500/30">
        <svg viewBox="0 0 256 256" className="h-12 w-12">
          <path
            d="M128 28c-22 0-25 21-47 21-18 0-33-15-33-15s-7 20-7 50c0 55 35 144 65 144 12 0 17-8 22-8s10 8 22 8c30 0 65-89 65-144 0-30-7-50-7-50s-15 15-33 15c-22 0-25-21-47-21z"
            fill="#555"
          />
          <ellipse cx="170" cy="45" rx="15" ry="20" fill="#7CB342" />
        </svg>
      </div>
    );
  }

  // CentOS / RHEL
  if (
    name.includes("centos") ||
    name.includes("red hat") ||
    name.includes("rhel")
  ) {
    return (
      <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-[#932279]/10 border border-[#932279]/30">
        <svg viewBox="0 0 256 256" className="h-12 w-12">
          <circle
            cx="128"
            cy="128"
            r="120"
            fill="none"
            stroke="#932279"
            strokeWidth="16"
          />
          <circle cx="128" cy="128" r="60" fill="#932279" />
        </svg>
      </div>
    );
  }

  // Fedora
  if (name.includes("fedora")) {
    return (
      <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-[#3C6EB4]/10 border border-[#3C6EB4]/30">
        <svg viewBox="0 0 256 256" className="h-12 w-12">
          <circle cx="128" cy="128" r="120" fill="#3C6EB4" />
          <text
            x="128"
            y="160"
            textAnchor="middle"
            fill="white"
            fontSize="100"
            fontWeight="bold"
          >
            f
          </text>
        </svg>
      </div>
    );
  }

  // Alpine
  if (name.includes("alpine")) {
    return (
      <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-[#0D597F]/10 border border-[#0D597F]/30">
        <svg viewBox="0 0 256 256" className="h-12 w-12">
          <polygon points="128,30 220,200 36,200" fill="#0D597F" />
          <polygon points="128,80 180,180 76,180" fill="white" />
        </svg>
      </div>
    );
  }

  // Default / Generic Linux
  return (
    <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-zinc-800 border border-zinc-700">
      <Terminal className="h-10 w-10 text-zinc-400" />
    </div>
  );
}

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ServerDetailPage({ params }: PageProps) {
  const { id } = await params;
  const server = await getServer(id);

  if (!server) {
    notFound();
  }

  const status = statusConfig[server.status];

  return (
    <div className="h-full overflow-y-auto bg-zinc-950 p-8">
      <div className="mx-auto max-w-7xl space-y-8">
        {/* Header */}
        <div>
          <Link
            href="/servers"
            className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-zinc-100 transition-colors mb-4"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Servers
          </Link>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500/20 to-purple-500/20 border border-cyan-500/30">
                <Server className="h-7 w-7 text-cyan-400" />
              </div>
              <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                  {server.name}
                </h1>
                <div className="flex items-center gap-4 mt-1">
                  <span className="inline-flex items-center gap-1.5">
                    <span className={`h-2 w-2 rounded-full ${status.dot}`} />
                    <span className={`text-sm ${status.text}`}>
                      {status.label}
                    </span>
                  </span>
                  {server.ipAddress && (
                    <span className="flex items-center gap-1.5 text-sm text-zinc-400">
                      <Globe className="h-3.5 w-3.5" />
                      {server.ipAddress}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* System Environment Section */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
          <h2 className="text-lg font-semibold text-zinc-100 mb-4 flex items-center gap-2">
            <Terminal className="h-5 w-5 text-purple-400" />
            System Environment
          </h2>
          {server.osName ? (
            <div className="flex items-center gap-5">
              {/* OS Logo */}
              <OsLogo osName={server.osName} />

              {/* OS Details */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 flex-1">
                <div>
                  <p className="text-xs text-zinc-500 uppercase tracking-wider">
                    Distribution
                  </p>
                  <p className="text-sm font-medium text-zinc-100 mt-1">
                    {server.osName}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-zinc-500 uppercase tracking-wider">
                    Version
                  </p>
                  <p className="text-sm font-medium text-zinc-100 mt-1">
                    {server.osVersion || "-"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-zinc-500 uppercase tracking-wider">
                    Kernel
                  </p>
                  <p className="text-sm font-medium text-zinc-100 mt-1 font-mono">
                    {server.osKernel || "-"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-zinc-500 uppercase tracking-wider">
                    Architecture
                  </p>
                  <p className="text-sm font-medium text-zinc-100 mt-1 font-mono">
                    {server.osArch || "-"}
                  </p>
                </div>
              </div>

              {/* Vertical Divider */}
              <div className="hidden md:block h-12 border-l border-zinc-700" />

              {/* Docker */}
              <div className="hidden md:flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#2496ED]/10 border border-[#2496ED]/30">
                  <svg className="h-6 w-6 text-[#2496ED]" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M13.983 11.078h2.119a.186.186 0 00.186-.185V9.006a.186.186 0 00-.186-.186h-2.119a.186.186 0 00-.185.186v1.887c0 .102.083.185.185.185zm-2.954-5.43h2.118a.186.186 0 00.186-.186V3.574a.186.186 0 00-.186-.185h-2.118a.186.186 0 00-.185.185v1.888c0 .102.082.185.185.186zm0 2.716h2.118a.187.187 0 00.186-.186V6.29a.186.186 0 00-.186-.185h-2.118a.186.186 0 00-.185.185v1.887c0 .102.082.186.185.186zm-2.93 0h2.12a.186.186 0 00.184-.186V6.29a.185.185 0 00-.185-.185H8.1a.185.185 0 00-.185.185v1.887c0 .102.083.186.185.186zm-2.964 0h2.119a.186.186 0 00.185-.186V6.29a.186.186 0 00-.185-.185H5.136a.186.186 0 00-.186.185v1.887c0 .102.084.186.186.186zm5.893 2.715h2.118a.186.186 0 00.186-.185V9.006a.186.186 0 00-.186-.186h-2.118a.186.186 0 00-.185.186v1.887c0 .102.082.185.185.185zm-2.93 0h2.12a.185.185 0 00.184-.185V9.006a.185.185 0 00-.184-.186h-2.12a.185.185 0 00-.184.186v1.887c0 .102.083.185.185.185zm-2.964 0h2.119a.185.185 0 00.185-.185V9.006a.185.185 0 00-.185-.186h-2.12a.186.186 0 00-.185.186v1.887c0 .102.084.185.186.185zm-2.92 0h2.12a.185.185 0 00.184-.185V9.006a.185.185 0 00-.184-.186h-2.12a.185.185 0 00-.184.186v1.887c0 .102.082.185.185.185zM23.763 9.89c-.065-.051-.672-.51-1.954-.51-.338.001-.676.03-1.01.087-.248-1.7-1.653-2.53-1.716-2.566l-.344-.199-.226.327c-.284.438-.49.922-.612 1.43-.23.97-.09 1.882.403 2.661-.595.332-1.55.413-1.744.42H.751a.751.751 0 00-.75.748 11.376 11.376 0 00.692 4.062c.545 1.428 1.355 2.48 2.41 3.124 1.18.723 3.1 1.137 5.275 1.137.983.003 1.963-.086 2.93-.266a12.248 12.248 0 003.823-1.389c.98-.567 1.86-1.288 2.61-2.136 1.252-1.418 1.998-2.997 2.553-4.4h.221c1.372 0 2.215-.549 2.68-1.009.309-.293.55-.65.707-1.046l.098-.288z"/>
                  </svg>
                </div>
                <div>
                  <p className="text-xs text-zinc-500 uppercase tracking-wider">
                    Docker
                  </p>
                  <p className="text-sm font-medium text-zinc-100 mt-1 font-mono">
                    {server.dockerVersion || "-"}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-zinc-500">
              System information not available. Agent may need to re-register.
            </p>
          )}
        </div>

        {/* Metrics Section */}
        <div>
          <h2 className="text-lg font-semibold text-zinc-100 mb-4 flex items-center gap-2">
            <Cpu className="h-5 w-5 text-cyan-400" />
            System Metrics
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <MetricGauge
              label="CPU Usage"
              value={server.cpu}
              total={server.cpuCores ? `${server.cpuCores} cores` : undefined}
              unit="%"
              icon={Cpu}
              gradient="bg-gradient-to-r from-cyan-500 to-purple-500"
            />
            <MetricGauge
              label="Memory Usage"
              value={server.memory}
              total={
                server.totalMemoryGb
                  ? `${server.totalMemoryGb.toFixed(0)} GB`
                  : undefined
              }
              unit="%"
              icon={MemoryStick}
              gradient="bg-gradient-to-r from-purple-500 to-pink-500"
            />
            <MetricGauge
              label="Disk Usage"
              value={server.disk}
              total={
                server.totalDiskGb
                  ? `${server.totalDiskGb.toFixed(0)} GB`
                  : undefined
              }
              unit="%"
              icon={HardDrive}
              gradient="bg-gradient-to-r from-emerald-500 to-cyan-500"
            />
          </div>
          {server.lastMetricsAt && (
            <p className="text-xs text-zinc-500 mt-3 flex items-center gap-1">
              <Clock className="h-3 w-3" />
              Last updated: {new Date(server.lastMetricsAt).toLocaleString()}
            </p>
          )}
        </div>

        {/* Services Section */}
        <div>
          <h2 className="text-lg font-semibold text-zinc-100 mb-4 flex items-center gap-2">
            <Package className="h-5 w-5 text-emerald-400" />
            Services
            <span className="ml-2 rounded-full bg-zinc-800 px-2.5 py-0.5 text-xs font-medium text-zinc-400">
              {server.services.length}
            </span>
          </h2>
          {server.services.length === 0 ? (
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-8 text-center">
              <Package className="mx-auto h-10 w-10 text-zinc-600" />
              <p className="mt-3 text-sm text-zinc-500">
                No services discovered on this server
              </p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {server.services.map((service) => {
                const serviceStatus = serviceStatusConfig[service.status];
                const typeConfig = service.serviceType
                  ? serviceTypeConfig[service.serviceType]
                  : null;
                const TypeIcon = typeConfig?.icon || Package;

                return (
                  <div
                    key={service.id}
                    className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5 transition-all hover:border-zinc-700"
                  >
                    {/* Header */}
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-start gap-3">
                        <div
                          className={`rounded-lg bg-zinc-800 p-2 ${typeConfig?.color || "text-zinc-400"}`}
                        >
                          <TypeIcon className="h-4 w-4" />
                        </div>
                        <div>
                          <h3 className="font-medium text-zinc-100">
                            {service.name}
                            {service.version && (
                              <span className="ml-2 text-sm font-normal text-zinc-400">
                                {service.version}
                              </span>
                            )}
                          </h3>
                          <div className="flex items-center gap-2 mt-0.5">
                            {typeConfig && (
                              <span className="text-xs text-zinc-500">
                                {typeConfig.label}
                              </span>
                            )}
                            {service.composeProject && (
                              <span className="text-xs text-zinc-600 font-mono">
                                {service.composeProject}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full ${serviceStatus.bg} px-2 py-1 text-xs ${serviceStatus.text}`}
                      >
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${serviceStatus.dot}`}
                        />
                        {serviceStatus.label}
                      </span>
                    </div>

                    {/* Description */}
                    {service.description && (
                      <p className="text-xs text-zinc-400 mb-3">
                        {service.description}
                      </p>
                    )}

                    {/* Dependencies */}
                    {service.dependsOn && service.dependsOn.length > 0 && (
                      <div className="mb-3">
                        <p className="text-xs text-zinc-500 mb-1.5">
                          Depends on
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {service.dependsOn.map((dep) => {
                            const depStatus = serviceStatusConfig[dep.status];
                            return (
                              <span
                                key={dep.id}
                                className="inline-flex items-center gap-1 rounded bg-zinc-800/50 border border-zinc-700/50 px-2 py-1 text-xs text-zinc-300"
                              >
                                <ArrowRight className="h-3 w-3 text-zinc-500" />
                                <span
                                  className={`h-1.5 w-1.5 rounded-full ${depStatus.dot}`}
                                />
                                {dep.name}
                                {dep.inferred && (
                                  <span className="text-zinc-600 text-[10px]">
                                    *
                                  </span>
                                )}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Depended on by */}
                    {service.dependedOnBy &&
                      service.dependedOnBy.length > 0 && (
                        <div className="mb-3">
                          <p className="text-xs text-zinc-500 mb-1.5">
                            Depended on by
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {service.dependedOnBy.map((dep) => {
                              const depStatus = serviceStatusConfig[dep.status];
                              return (
                                <span
                                  key={dep.id}
                                  className="inline-flex items-center gap-1 rounded bg-zinc-800/50 border border-zinc-700/50 px-2 py-1 text-xs text-zinc-300"
                                >
                                  <span
                                    className={`h-1.5 w-1.5 rounded-full ${depStatus.dot}`}
                                  />
                                  {dep.name}
                                </span>
                              );
                            })}
                          </div>
                        </div>
                      )}

                    {/* Containers */}
                    <div className="border-t border-zinc-800 pt-3 mt-3">
                      <p className="text-xs text-zinc-500 mb-2">
                        Containers ({service.containers.length})
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {service.containers.map((container) => {
                          const containerStatus =
                            containerStatusConfig[container.status];
                          return (
                            <span
                              key={container.id}
                              className="inline-flex items-center gap-1 rounded bg-zinc-800 px-2 py-1 text-xs text-zinc-300"
                            >
                              <span
                                className={`h-1.5 w-1.5 rounded-full ${containerStatus.dot}`}
                              />
                              {container.name}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Containers Section */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-zinc-100 flex items-center gap-2">
              <Container className="h-5 w-5 text-pink-400" />
              Containers
              <span className="ml-2 rounded-full bg-zinc-800 px-2.5 py-0.5 text-xs font-medium text-zinc-400">
                {server.containers.length}
              </span>
            </h2>
            <Link
              href={`/containers?serverId=${server.id}`}
              className="text-sm text-cyan-400 hover:text-cyan-300 transition-colors"
            >
              View all →
            </Link>
          </div>
          {server.containers.length === 0 ? (
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-8 text-center">
              <Container className="mx-auto h-10 w-10 text-zinc-600" />
              <p className="mt-3 text-sm text-zinc-500">
                No containers running on this server
              </p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-zinc-800 bg-zinc-900/50">
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-400">
                      Name
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-400">
                      Image
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-400">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-400">
                      Ports
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800">
                  {server.containers.slice(0, 5).map((container) => {
                    const containerStatus =
                      containerStatusConfig[container.status];
                    return (
                      <tr
                        key={container.id}
                        className="transition-colors hover:bg-zinc-800/50"
                      >
                        <td className="px-4 py-3">
                          <span className="text-sm font-medium text-zinc-100">
                            {container.name}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-sm font-mono text-zinc-400">
                            {container.image}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-1.5">
                            <span
                              className={`h-1.5 w-1.5 rounded-full ${containerStatus.dot}`}
                            />
                            <span className={`text-sm ${containerStatus.text}`}>
                              {container.status}
                            </span>
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-sm font-mono text-zinc-400">
                            {container.ports || "-"}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {server.containers.length > 5 && (
                <div className="border-t border-zinc-800 px-4 py-3 text-center">
                  <Link
                    href={`/containers?serverId=${server.id}`}
                    className="text-sm text-cyan-400 hover:text-cyan-300 transition-colors"
                  >
                    View all {server.containers.length} containers →
                  </Link>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
