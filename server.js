const express = require("express");
const { createServer } = require("node:http");
const { Server } = require("socket.io");
const path = require("node:path");

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer);
const port = process.env.PORT || 3000;
const nameColors = [
  "#1d4ed8",
  "#047857",
  "#b45309",
  "#b91c1c",
  "#6d28d9",
  "#0f766e",
  "#be185d",
  "#4d7c0f",
];

app.use(express.static(path.join(__dirname, "public")));

io.on("connection", (socket) => {
  console.log(`Client connectat: ${socket.id}`);

  socket.on("chat:send", (payload, acknowledge) => {
    const rejectMessage = () => {
      if (typeof acknowledge === "function") {
        acknowledge({ ok: false, error: "El missatge no és vàlid." });
      } else {
        socket.emit("chat:error", "El missatge no és vàlid.");
      }
    };

    if (
      !payload ||
      typeof payload.name !== "string" ||
      typeof payload.color !== "string" ||
      typeof payload.text !== "string"
    ) {
      rejectMessage();
      return;
    }

    const name = payload.name.trim();
    const text = payload.text.trim();

    if (
      name.length === 0 ||
      name.length > 20 ||
      !nameColors.includes(payload.color) ||
      text.length === 0 ||
      text.length > 500
    ) {
      rejectMessage();
      return;
    }

    io.emit("chat:message", {
      name,
      color: payload.color,
      text,
      time: new Date().toISOString(),
    });

    if (typeof acknowledge === "function") {
      acknowledge({ ok: true });
    }
  });
});

httpServer.listen(port, () => {
  console.log(`Xat disponible a http://localhost:${port}`);
});
