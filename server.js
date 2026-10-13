const express = require("express");
const { createServer } = require("node:http");
const { randomBytes } = require("node:crypto");
const { Server } = require("socket.io");
const path = require("node:path");
const nameColors = require("./public/chat-config");

function createChatServer({
  recoveryEnabled = process.env.SOCKET_RECOVERY_ENABLED !== "false",
  configureSocketServer,
} = {}) {
  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer, recoveryEnabled ? {
    connectionStateRecovery: {
      maxDisconnectionDuration: 2 * 60 * 1000,
    },
  } : {});

  app.use(express.static(path.join(__dirname, "public")));

  if (configureSocketServer) {
    configureSocketServer(io);
  }

  function respond(socket, acknowledge, response, eventName) {
    if (typeof acknowledge === "function") {
      acknowledge(response);
    } else if (!response.ok) {
      socket.emit(eventName, response.error);
    }
  }

  function getIdentity(payload) {
    if (
      !payload ||
      typeof payload.name !== "string" ||
      typeof payload.color !== "string"
    ) {
      return null;
    }

    const name = payload.name.trim();
    if (name.length === 0 || name.length > 20 || !nameColors.includes(payload.color)) {
      return null;
    }

    return { name, color: payload.color };
  }

  function createRoomCode() {
    return randomBytes(3).toString("hex").toUpperCase();
  }

  async function broadcastParticipants(roomCode) {
    const roomSockets = await io.in(roomCode).fetchSockets();
    const participants = roomSockets
      .filter((roomSocket) => typeof roomSocket.data.name === "string")
      .map((roomSocket) => ({
        name: roomSocket.data.name,
        color: roomSocket.data.color,
      }));

    io.to(roomCode).emit("room:participants", participants);
  }

  async function notifyParticipants(roomCode) {
    try {
      await broadcastParticipants(roomCode);
    } catch (error) {
      console.error(`No s'ha pogut actualitzar la llista de participants de ${roomCode}:`, error);
    }
  }

  async function handleRoomOperation(socket, acknowledge, operation, callback) {
    if (socket.data.roomOperation) {
      respond(socket, acknowledge, {
        ok: false,
        error: "Espera que acabi l'operació de sala actual.",
      }, "room:error");
      return;
    }

    socket.data.roomOperation = operation;
    try {
      await callback();
    } catch (error) {
      console.error(`Error en l'operació de sala "${operation}":`, error);
      respond(socket, acknowledge, {
        ok: false,
        error: "No s'ha pogut completar l'operació de sala.",
      }, "room:error");
    } finally {
      delete socket.data.roomOperation;
    }
  }

  io.on("connection", (socket) => {
    console.log(`Client connectat: ${socket.id}`);

    if (socket.recovered && socket.data.room) {
      notifyParticipants(socket.data.room);
    }

    socket.on("room:create", (payload, acknowledge) => {
      handleRoomOperation(socket, acknowledge, "create", async () => {
        if (socket.data.room) {
          respond(socket, acknowledge, {
            ok: false,
            error: "Ja ets dins d'una sala. Abandona-la abans de crear-ne una altra.",
          }, "room:error");
          return;
        }

        const identity = getIdentity(payload);
        if (!identity) {
          respond(socket, acknowledge, {
            ok: false,
            error: "El nom o el color no són vàlids.",
          }, "room:error");
          return;
        }

        let roomCode;
        let roomSockets;
        do {
          roomCode = createRoomCode();
          roomSockets = await io.in(roomCode).fetchSockets();
        } while (roomSockets.length > 0);

        await socket.join(roomCode);
        socket.data.room = roomCode;
        socket.data.name = identity.name;
        socket.data.color = identity.color;
        respond(socket, acknowledge, { ok: true, roomCode }, "room:error");
        await notifyParticipants(roomCode);
      });
    });

    socket.on("room:join", (payload, acknowledge) => {
      handleRoomOperation(socket, acknowledge, "join", async () => {
        if (socket.data.room) {
          respond(socket, acknowledge, {
            ok: false,
            error: "Ja ets dins d'una sala. Abandona-la abans d'unir-te a una altra.",
          }, "room:error");
          return;
        }

        if (!payload || typeof payload.roomCode !== "string") {
          respond(socket, acknowledge, {
            ok: false,
            error: "El codi de la sala no és vàlid.",
          }, "room:error");
          return;
        }

        const roomCode = payload.roomCode.trim().toUpperCase();
        if (!/^[A-F0-9]{6}$/.test(roomCode)) {
          respond(socket, acknowledge, {
            ok: false,
            error: "El codi de la sala no és vàlid.",
          }, "room:error");
          return;
        }

        const roomSockets = await io.in(roomCode).fetchSockets();
        if (roomSockets.length === 0) {
          respond(socket, acknowledge, {
            ok: false,
            error: "No existeix cap sala amb aquest codi.",
          }, "room:error");
          return;
        }

        const identity = getIdentity(payload);
        if (!identity) {
          respond(socket, acknowledge, {
            ok: false,
            error: "El nom o el color no són vàlids.",
          }, "room:error");
          return;
        }

        await socket.join(roomCode);
        socket.data.room = roomCode;
        socket.data.name = identity.name;
        socket.data.color = identity.color;
        respond(socket, acknowledge, { ok: true, roomCode }, "room:error");
        await notifyParticipants(roomCode);
      });
    });

    socket.on("room:leave", (acknowledge) => {
      handleRoomOperation(socket, acknowledge, "leave", async () => {
        const roomCode = socket.data.room;
        if (!roomCode) {
          respond(socket, acknowledge, {
            ok: false,
            error: "No ets dins de cap sala.",
          }, "room:error");
          return;
        }

        await socket.leave(roomCode);
        delete socket.data.room;
        delete socket.data.name;
        delete socket.data.color;
        respond(socket, acknowledge, { ok: true }, "room:error");
        await notifyParticipants(roomCode);
      });
    });

    socket.on("chat:send", (payload, acknowledge) => {
      if (socket.data.roomOperation) {
        respond(socket, acknowledge, {
          ok: false,
          error: "Espera que acabi l'operació de sala actual.",
        }, "chat:error");
        return;
      }

      if (!socket.data.room || !socket.data.name) {
        respond(socket, acknowledge, {
          ok: false,
          error: "Entra en una sala abans d'enviar missatges.",
        }, "chat:error");
        return;
      }

      if (!payload || typeof payload.text !== "string") {
        respond(socket, acknowledge, {
          ok: false,
          error: "El missatge no és vàlid.",
        }, "chat:error");
        return;
      }

      const text = payload.text.trim();
      if (text.length === 0 || text.length > 500) {
        respond(socket, acknowledge, {
          ok: false,
          error: "El missatge no és vàlid.",
        }, "chat:error");
        return;
      }

      io.to(socket.data.room).emit("chat:message", {
        name: socket.data.name,
        color: socket.data.color,
        text,
        time: new Date().toISOString(),
      });
      respond(socket, acknowledge, { ok: true }, "chat:error");
    });

    socket.on("disconnect", () => {
      if (socket.data.room) {
        notifyParticipants(socket.data.room);
      }
    });
  });

  return { httpServer, io };
}

module.exports = { createChatServer };

if (require.main === module) {
  const port = process.env.PORT || 3000;
  const { httpServer } = createChatServer();
  const recoveryEnabled = process.env.SOCKET_RECOVERY_ENABLED !== "false";
  httpServer.listen(port, () => {
    console.log(`Xat disponible a http://localhost:${port} (recuperació ${recoveryEnabled ? "activa" : "desactivada"})`);
  });
}
