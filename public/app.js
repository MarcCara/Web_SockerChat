const joinForm = document.querySelector("#join-form");
const nameInput = document.querySelector("#name");
const nameError = document.querySelector("#name-error");
const chatRoom = document.querySelector("#chat-room");
const participantName = document.querySelector("#participant-name");
const connectionStatus = document.querySelector("#connection-status");
const messageForm = document.querySelector("#message-form");
const messageInput = document.querySelector("#message-input");
const characterCount = document.querySelector("#character-count");
const sendButton = document.querySelector("#send-button");
const messageError = document.querySelector("#message-error");
const messages = document.querySelector("#messages");
const socket = io();
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
let participantColor;

function updateCharacterCount() {
  characterCount.value = `${messageInput.value.length} / 500`;
}

function updateConnectionStatus() {
  connectionStatus.textContent = socket.connected ? "Connectat" : "Desconnectat";
  connectionStatus.classList.toggle("connected", socket.connected);
  sendButton.disabled = !socket.connected;
}

socket.on("connect", updateConnectionStatus);
socket.on("disconnect", updateConnectionStatus);
updateConnectionStatus();

socket.on("chat:error", (error) => {
  messageError.textContent = error;
});

socket.on("chat:message", (message) => {
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
  time.textContent = new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).format(sentAt);

  const content = document.createElement("p");
  content.className = "message-content";
  content.textContent = message.text;

  metadata.append(sender, time);
  item.append(metadata, content);
  messages.append(item);
  messages.scrollTop = messages.scrollHeight;
});

joinForm.addEventListener("submit", (event) => {
  event.preventDefault();

  const name = nameInput.value.trim();

  if (name.length === 0) {
    nameError.textContent = "Escriu un nom per entrar al xat.";
    nameInput.focus();
    return;
  }

  if (name.length > 20) {
    nameError.textContent = "El nom no pot tenir més de 20 caràcters.";
    nameInput.focus();
    return;
  }

  nameError.textContent = "";
  participantColor = nameColors[Math.floor(Math.random() * nameColors.length)];
  participantName.textContent = name;
  participantName.style.color = participantColor;
  joinForm.hidden = true;
  chatRoom.hidden = false;
  messageInput.focus();
});

nameInput.addEventListener("input", () => {
  nameError.textContent = "";
});

messageForm.addEventListener("submit", (event) => {
  event.preventDefault();

  const message = messageInput.value.trim();
  if (message.length === 0) {
    messageInput.focus();
    return;
  }

  if (message.length > 500) {
    messageError.textContent = "El missatge no pot tenir més de 500 caràcters.";
    messageInput.focus();
    return;
  }

  if (!socket.connected) {
    updateConnectionStatus();
    return;
  }

  const submittedValue = messageInput.value;
  messageError.textContent = "";
  socket.emit("chat:send", {
    name: participantName.textContent,
    color: participantColor,
    text: message,
  }, (response) => {
    if (!response || !response.ok) {
      messageError.textContent = response?.error || "No s'ha pogut enviar el missatge.";
      return;
    }

    if (messageInput.value === submittedValue) {
      messageInput.value = "";
      updateCharacterCount();
    }
  });
  messageInput.focus();
});

messageInput.addEventListener("input", () => {
  messageError.textContent = "";
  updateCharacterCount();
});
