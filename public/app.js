const elements = {
  joinForm: document.querySelector("#join-form"),
  nameInput: document.querySelector("#name"),
  nameError: document.querySelector("#name-error"),
  chatRoom: document.querySelector("#chat-room"),
  participantName: document.querySelector("#participant-name"),
  connectionStatus: document.querySelector("#connection-status"),
  messageForm: document.querySelector("#message-form"),
  messageInput: document.querySelector("#message-input"),
  characterCount: document.querySelector("#character-count"),
  sendButton: document.querySelector("#send-button"),
  messageError: document.querySelector("#message-error"),
  messages: document.querySelector("#messages"),
};
const socket = io();
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

function updateCharacterCount() {
  elements.characterCount.value = `${elements.messageInput.value.length} / 500`;
}

function updateConnectionStatus() {
  elements.connectionStatus.textContent = socket.connected ? "Connectat" : "Desconnectat";
  elements.connectionStatus.classList.toggle("connected", socket.connected);
  elements.sendButton.disabled = !socket.connected;
}

socket.on("connect", updateConnectionStatus);
socket.on("disconnect", updateConnectionStatus);
updateConnectionStatus();

socket.on("chat:error", (error) => {
  elements.messageError.textContent = error;
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
  time.textContent = dateFormatter.format(sentAt);

  const content = document.createElement("p");
  content.className = "message-content";
  content.textContent = message.text;

  metadata.append(sender, time);
  item.append(metadata, content);
  elements.messages.append(item);
  elements.messages.scrollTop = elements.messages.scrollHeight;
});

elements.joinForm.addEventListener("submit", (event) => {
  event.preventDefault();

  const name = elements.nameInput.value.trim();

  if (name.length === 0) {
    elements.nameError.textContent = "Escriu un nom per entrar al xat.";
    elements.nameInput.focus();
    return;
  }

  if (name.length > 20) {
    elements.nameError.textContent = "El nom no pot tenir més de 20 caràcters.";
    elements.nameInput.focus();
    return;
  }

  elements.nameError.textContent = "";
  participantColor = nameColors[Math.floor(Math.random() * nameColors.length)];
  elements.participantName.textContent = name;
  elements.participantName.style.color = participantColor;
  elements.joinForm.hidden = true;
  elements.chatRoom.hidden = false;
  elements.messageInput.focus();
});

elements.nameInput.addEventListener("input", () => {
  elements.nameError.textContent = "";
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

  if (!socket.connected) {
    updateConnectionStatus();
    return;
  }

  const submittedValue = elements.messageInput.value;
  elements.messageError.textContent = "";
  socket.emit("chat:send", {
    name: elements.participantName.textContent,
    color: participantColor,
    text: message,
  }, (response) => {
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
