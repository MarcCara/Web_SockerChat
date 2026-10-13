const elements = {
  joinForm: document.querySelector("#join-form"),
  nameInput: document.querySelector("#name"),
  roomCodeInput: document.querySelector("#room-code"),
  roomError: document.querySelector("#room-error"),
  chatRoom: document.querySelector("#chat-room"),
  participantName: document.querySelector("#participant-name"),
  roomCodeDisplay: document.querySelector("#room-code-display"),
  connectionStatus: document.querySelector("#connection-status"),
  recoveryStatus: document.querySelector("#recovery-status"),
  simulateDisconnectButton: document.querySelector("#simulate-disconnect"),
  leaveRoomButton: document.querySelector("#leave-room"),
  messageForm: document.querySelector("#message-form"),
  messageInput: document.querySelector("#message-input"),
  characterCount: document.querySelector("#character-count"),
  sendButton: document.querySelector("#send-button"),
  messageError: document.querySelector("#message-error"),
  messages: document.querySelector("#messages"),
  participants: document.querySelector("#participants"),
};
const socket = io({
  reconnectionDelay: 10_000,
  reconnectionDelayMax: 10_000,
  randomizationFactor: 0,
});
const nameColors = window.chatNameColors;
const dateFormatter = new Intl.DateTimeFormat("ca-ES", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});
let participantColor;
let hasConnectedOnce = false;
let inRoom = false;

function updateCharacterCount() {
  elements.characterCount.value = `${elements.messageInput.value.length} / 500`;
}

function updateConnectionStatus() {
  const connected = socket.connected;
  elements.connectionStatus.textContent = connected ? "Connectat" : "Desconnectat";
  elements.connectionStatus.classList.toggle("connected", connected);
  elements.sendButton.disabled = !connected || !inRoom;
  elements.simulateDisconnectButton.disabled = !connected || !inRoom;
  elements.leaveRoomButton.disabled = !connected || !inRoom;

  for (const button of elements.joinForm.querySelectorAll('button[type="submit"]')) {
    button.disabled = !connected;
  }
}

function showLobby(errorMessage = "") {
  inRoom = false;
  elements.joinForm.hidden = false;
  elements.chatRoom.hidden = true;
  elements.roomError.textContent = errorMessage;
  elements.messages.replaceChildren();
  elements.participants.replaceChildren();
  updateConnectionStatus();
}

function enterRoom(name, roomCode) {
  inRoom = true;
  elements.participantName.textContent = name;
  elements.participantName.style.color = participantColor;
  elements.roomCodeDisplay.textContent = roomCode;
  elements.roomCodeInput.value = roomCode;
  elements.roomError.textContent = "";
  elements.messageError.textContent = "";
  elements.messages.replaceChildren();
  elements.participants.replaceChildren();
  elements.joinForm.hidden = true;
  elements.chatRoom.hidden = false;
  updateConnectionStatus();
  elements.messageInput.focus();
}

function showMessage(message) {
  const item = document.createElement("li");
  item.className = "message";

  const metadata = document.createElement("p");
  metadata.className = "message-metadata";

  const sender = document.createElement("strong");
  sender.textContent = message.name;
  sender.style.color = nameColors.includes(message.color) ? message.color : "#222";

  const time = document.createElement("time");
  const sentAt = new Date(message.time);
  time.dateTime = sentAt.toISOString();
  time.textContent = dateFormatter.format(sentAt);

  const content = document.createElement("p");
  content.className = "message-content";
  content.textContent = message.text;

  metadata.append(sender, time);
  item.append(metadata, content);
  elements.messages.append(item);
  elements.messages.scrollTop = elements.messages.scrollHeight;
}

socket.on("connect", () => {
  updateConnectionStatus();

  if (hasConnectedOnce) {
    elements.recoveryStatus.textContent = socket.recovered
      ? "Missatges recuperats."
      : "Sessió nova: no s'ha pogut recuperar l'estat.";

    if (!socket.recovered && inRoom) {
      const name = elements.participantName.textContent;
      const roomCode = elements.roomCodeDisplay.textContent;
      elements.nameInput.value = name;
      elements.roomCodeInput.value = roomCode;
      showLobby("La sessió de la sala no s'ha recuperat. Torna a unir-t'hi o crea una sala.");
    }
  }

  hasConnectedOnce = true;
});
socket.on("disconnect", updateConnectionStatus);
updateConnectionStatus();

socket.on("room:error", (error) => {
  elements.roomError.textContent = error;
});

socket.on("chat:error", (error) => {
  elements.messageError.textContent = error;
});

socket.on("room:participants", (participants) => {
  if (!Array.isArray(participants)) {
    return;
  }

  elements.participants.replaceChildren();
  for (const participant of participants) {
    if (!participant || typeof participant.name !== "string") {
      continue;
    }

    const item = document.createElement("li");
    const name = document.createElement("span");
    name.textContent = participant.name;
    name.style.color = nameColors.includes(participant.color) ? participant.color : "#222";
    item.append(name);
    elements.participants.append(item);
  }
});

socket.on("chat:message", showMessage);

elements.joinForm.addEventListener("submit", (event) => {
  event.preventDefault();

  if (!socket.connected) {
    updateConnectionStatus();
    return;
  }

  const name = elements.nameInput.value.trim();
  if (name.length === 0) {
    elements.roomError.textContent = "Escriu un nom per entrar al xat.";
    elements.nameInput.focus();
    return;
  }
  if (name.length > 20) {
    elements.roomError.textContent = "El nom no pot tenir més de 20 caràcters.";
    elements.nameInput.focus();
    return;
  }

  if (!participantColor) {
    participantColor = nameColors[Math.floor(Math.random() * nameColors.length)];
  }

  const action = event.submitter && event.submitter.value === "join" ? "join" : "create";
  const payload = { name, color: participantColor };
  const eventName = action === "join" ? "room:join" : "room:create";
  if (action === "join") {
    payload.roomCode = elements.roomCodeInput.value.trim().toUpperCase();
  }

  elements.roomError.textContent = "";
  socket.emit(eventName, payload, (response) => {
    if (!response || !response.ok) {
      elements.roomError.textContent = response?.error || "No s'ha pogut entrar a la sala.";
      return;
    }

    enterRoom(name, response.roomCode);
  });
});

elements.nameInput.addEventListener("input", () => {
  elements.roomError.textContent = "";
});

elements.roomCodeInput.addEventListener("input", () => {
  elements.roomError.textContent = "";
});

elements.simulateDisconnectButton.addEventListener("click", () => {
  if (socket.connected) {
    socket.io.engine.close();
  }
});

elements.leaveRoomButton.addEventListener("click", () => {
  if (!socket.connected || !inRoom) {
    return;
  }

  socket.emit("room:leave", (response) => {
    if (!response || !response.ok) {
      elements.roomError.textContent = response?.error || "No s'ha pogut abandonar la sala.";
      return;
    }

    elements.nameInput.value = elements.participantName.textContent;
    elements.roomCodeInput.value = "";
    participantColor = undefined;
    showLobby();
    elements.nameInput.focus();
  });
});

elements.messageForm.addEventListener("submit", (event) => {
  event.preventDefault();

  const message = elements.messageInput.value.trim();
  if (message.length === 0) {
    elements.messageInput.focus();
    return;
  }

  if (message.length > 500) {
    elements.messageError.textContent = "El missatge no pot tenir més de 500 caràcters.";
    elements.messageInput.focus();
    return;
  }

  if (!socket.connected || !inRoom) {
    updateConnectionStatus();
    return;
  }

  const submittedValue = elements.messageInput.value;
  elements.messageError.textContent = "";
  socket.emit("chat:send", { text: message }, (response) => {
    if (!response || !response.ok) {
      elements.messageError.textContent = response?.error || "No s'ha pogut enviar el missatge.";
      return;
    }

    if (elements.messageInput.value === submittedValue) {
      elements.messageInput.value = "";
      updateCharacterCount();
    }
  });
  elements.messageInput.focus();
});

elements.messageInput.addEventListener("input", () => {
  elements.messageError.textContent = "";
  updateCharacterCount();
});
