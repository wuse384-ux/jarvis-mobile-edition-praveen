"use strict";

// ===== JARVIS ELEMENTS =====
const chat = document.getElementById("chat");
const input = document.getElementById("msg");
const sendBtn = document.getElementById("send");
const micBtn = document.getElementById("mic-btn");

// ===== GEMINI CONFIGURATION =====
// Use a model available in your Google AI Studio account.
const MODEL = "gemini-2.5-flash";

let API_KEY = localStorage.getItem("jarvis_key") || "";

function add(text, type = "ai") {
  const div = document.createElement("div");
  div.className = "msg " + type;
  div.textContent = text;
  chat.appendChild(div);
  chat.scrollTop = chat.scrollHeight;
  return div;
}

function getApiKey() {
  if (API_KEY) return API_KEY;

  const key = prompt("Enter your Gemini API key:");
  if (!key || !key.trim()) return "";

  API_KEY = key.trim();
  localStorage.setItem("jarvis_key", API_KEY);
  return API_KEY;
}

// ===== GEMINI AI =====
async function callGemini(message) {
  const key = getApiKey();

  if (!key) {
    throw new Error("API key not entered.");
  }

  const url =
    "https://generativelanguage.googleapis.com/v1beta/models/" +
    MODEL +
    ":generateContent";

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": key
    },
    body: JSON.stringify({
      system_instruction: {
        parts: [{
          text: "You are J.A.R.V.I.S., a helpful AI assistant. Answer clearly and honestly."
        }]
      },
      contents: [{
        role: "user",
        parts: [{ text: message }]
      }]
    })
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.error?.message || "Gemini request failed."
    );
  }

  const reply = data.candidates?.[0]?.content?.parts
    ?.map(part => part.text || "")
    .join("")
    .trim();

  if (!reply) {
    throw new Error("Gemini returned no text.");
  }

  return reply;
}

async function askGemini(message) {
  const thinking = add("J.A.R.V.I.S: Thinking...", "ai");

  try {
    const reply = await callGemini(message);
    thinking.textContent = "J.A.R.V.I.S: " + reply;
    speak(reply);
  } catch (error) {
    thinking.textContent =
      "J.A.R.V.I.S ERROR: " + error.message;
  }
}

// ===== SEND BUTTON =====
let busy = false;

async function sendMessage() {
  const message = input.value.trim();

  if (!message || busy) return;

  add("YOU: " + message, "user");
  input.value = "";
  busy = true;
  sendBtn.disabled = true;

  try {
    await askGemini(message);
  } finally {
    busy = false;
    sendBtn.disabled = false;
  }
}

sendBtn.addEventListener("click", sendMessage);

input.addEventListener("keydown", event => {
  if (event.key === "Enter") {
    event.preventDefault();
    sendMessage();
  }
});

// ===== MICROPHONE =====
const SpeechRecognition =
  window.SpeechRecognition ||
  window.webkitSpeechRecognition;

if (SpeechRecognition) {
  const rec = new SpeechRecognition();

  rec.lang = "en-IN";
  rec.continuous = false;
  rec.interimResults = false;

  micBtn.addEventListener("click", () => {
    try {
      rec.start();
      micBtn.textContent = "LISTENING...";
    } catch (error) {
      add("Microphone is starting. Try again.", "ai");
    }
  });

  rec.onresult = event => {
    const transcript =
      event.results[0][0].transcript;

    input.value = transcript;
    sendMessage();
  };

  rec.onerror = event => {
    add("Microphone error: " + event.error, "ai");
    micBtn.textContent = "🎙️";
  };

  rec.onend = () => {
    micBtn.textContent = "🎙️";
  };
} else {
  micBtn.addEventListener("click", () => {
    add(
      "Speech recognition is unavailable in this browser. Try a supported browser or native Android speech recognition.",
      "ai"
    );
  });
}

// ===== TEXT-TO-SPEECH =====
function speak(text) {
  if (!("speechSynthesis" in window)) return;

  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "en-IN";
  utterance.rate = 1.0;
  utterance.pitch = 0.9;

  window.speechSynthesis.speak(utterance);
}

add("J.A.R.V.I.S systems initialized. Enter a message to begin.", "ai");
