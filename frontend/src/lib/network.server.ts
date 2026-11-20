// Server-only network initializer.
// Forces Node.js Undici runtime to connect strictly via IPv4 on Render containers.

if (typeof window === "undefined") {
  void (async () => {
    try {
      const dns = await import("node:dns");
      if (typeof dns?.setDefaultResultOrder === "function") {
        dns.setDefaultResultOrder("ipv4first");
      }
    } catch {}

    try {
      const { Agent, setGlobalDispatcher } = await import("undici");
      const agent = new Agent({
        connect: { family: 4 },
        pipelining: 0,
        keepAliveTimeout: 10_000,
        keepAliveMaxTimeout: 15_000,
      });
      setGlobalDispatcher(agent);
    } catch {}
  })();
}

export {};
