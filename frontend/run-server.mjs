import dns from "node:dns";

if (typeof dns?.setDefaultResultOrder === "function") {
  dns.setDefaultResultOrder("ipv4first");
}

try {
  const { Agent, setGlobalDispatcher } = await import("undici");
  const agent = new Agent({
    connect: { family: 4 },
    pipelining: 0,
    keepAliveTimeout: 10_000,
    keepAliveMaxTimeout: 15_000,
  });
  setGlobalDispatcher(agent);
  console.log("[server] Undici IPv4 dispatcher configured");
} catch (err) {
  console.warn("[server] Could not set Undici dispatcher:", err);
}

// Delegate to the compiled Nitro server
await import("./.output/server/index.mjs");
