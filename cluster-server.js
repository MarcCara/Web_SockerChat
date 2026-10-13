const cluster = require("node:cluster");
const { createAdapter, setupPrimary } = require("@socket.io/cluster-adapter");
const { createChatServer } = require("./server");

const ports = [3000, 3001];
const adapterEnabled = !process.argv.includes("--without-adapter");

if (cluster.isPrimary) {
  if (adapterEnabled) {
    setupPrimary();
  }

  for (const port of ports) {
    const worker = cluster.fork({
      PORT: String(port),
      CLUSTER_ADAPTER_ENABLED: String(adapterEnabled),
    });
    console.log(`S'ha iniciat el worker ${worker.process.pid} per al port ${port} (adaptador ${adapterEnabled ? "actiu" : "inactiu"})`);
  }
} else {
  const port = Number(process.env.PORT);
  const workerAdapterEnabled = process.env.CLUSTER_ADAPTER_ENABLED === "true";
  const { httpServer } = createChatServer({
    recoveryEnabled: false,
    configureSocketServer: workerAdapterEnabled
      ? (io) => io.adapter(createAdapter())
      : undefined,
  });

  httpServer.listen(port, () => {
    console.log(`Worker ${process.pid}: xat disponible a http://localhost:${port}`);
  });
}
