
"use strict";

// ========================================
// J.A.R.V.I.S. — MOBILE EDITION
// Telugu AI + Voice + Text
// ========================================

// 1. HTML ELEMENTS
const chat = document.getElementById("chat");
const input = document.getElementById("msg");
const sendBtn = document.getElementById("send");
const micBtn = document.getElementById("mic-btn");

// 2. GEMINI CONFIGURATION
// Keep the model that worked for your account.
const MODEL = "gemini-3.5-flash-lite";

let API_KEY = localStorage.getItem("jarvis_key") || "";
let busy = false;
let recognition = null;
let listening = false;

// 3. CHAT MESSAGE DISPLAY
function add(text, type = "ai") {
  const div = document.createElement("div");
  div.className = "msg " + type;
  div.textContent = text;

  chat.appendChild(div);
  chat.scrollTop = chat.scrollHeight;

  return div;
}

// 4. GET GEMINI API KEY
function getApiKey() {
  if (API_KEY) return API_KEY;

  const key = prompt("Enter your Gemini API key:");

  if (!key || !key.trim()) {
    return "";
  }

  API_KEY = key.trim();
  localStorage.setItem("jarvis_key", API_KEY);

  return API_KEY;
}

// 5. CONNECT TO GEMINI
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
          text:
            "You are J.A.R.V.I.S., a helpful personal AI assistant. " +
            "Reply in natural, conversational Telugu (తెలుగు) by default. " +
            "Use Telugu script. Keep technical terms in English when useful. " +
            "If the user explicitly requests another language, use that language. " +
            "Be friendly, clear, honest, and concise. " +
            "Never claim to have performed a device action unless it actually happened."
        }]
      },
      contents: [{
        role: "user",
        parts: [{ text: message }]
      }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 1024
      }
    })
  });

  let data;

  try {
    data = await response.json();
  } catch {
    throw new Error("Could not read the Gemini response.");
  }

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
    throw new Error(
      data.promptFeedback?.blockReason
        ? "The request was blocked: " +
          data.promptFeedback.blockReason
        : "Gemini returned no text. Please try again."
    );
  }

  return reply;
}

// 6. ASK J.A.R.V.I.S.
async function askGemini(message) {
  const thinking = add(
    "J.A.R.V.I.S: ఆలోచిస్తున్నాను...",
    "ai"
  );

  try {
    const reply = await callGemini(message);

    thinking.textContent = "J.A.R.V.I.S: " + reply;

    // Speak the Telugu response
    speak(reply);
  } catch (error) {
    thinking.textContent =
      "J.A.R.V.I.S ERROR: " + error.message;
  }
}

// 7. SEND MESSAGE
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

// 8. MICROPHONE INPUT
const SpeechRecognition =
  window.SpeechRecognition ||
  window.webkitSpeechRecognition;

function setMicButton(text) {
  micBtn.textContent = text;
}

if (SpeechRecognition) {
  recognition = new SpeechRecognition();

  recognition.lang = "te-IN";
  recognition.continuous = false;
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;

  micBtn.addEventListener("click", () => {
    if (listening) {
      recognition.stop();
      return;
    }

    try {
      recognition.start();
    } catch {
      add(
        "మైక్రోఫోన్ ప్రారంభం కాలేదు. మళ్లీ ప్రయత్నించండి.",
        "ai"
      );
    }
  });

  recognition.onstart = () => {
    listening = true;
    setMicButton("🛑");
    add("J.A.R.V.I.S: వింటున్నాను...", "ai");
  };

  recognition.onresult = event => {
    const transcript =
      event.results[0][0].transcript.trim();

    if (transcript) {
      input.value = transcript;
      sendMessage();
    }
  };

  recognition.onerror = event => {
    if (event.error !== "no-speech" &&
        event.error !== "aborted") {
      add(
        "Microphone error: " + event.error,
        "ai"
      );
    }
  };

  recognition.onend = () => {
    listening = false;
    setMicButton("🎙️");
  };
} else {
  micBtn.addEventListener("click", () => {
    add(
      "ఈ బ్రౌజర్‌లో voice recognition అందుబాటులో లేదు. Chromeలో మళ్లీ ప్రయత్నించండి.",
      "ai"
    );
  });
}

// 9. FIND A TELUGU TEXT-TO-SPEECH VOICE
function getTeluguVoice() {
  if (!("speechSynthesis" in window)) {
    return null;
  }

  const voices = window.speechSynthesis.getVoices();

  return voices.find(voice =>
    /^te([-_]|$)/i.test(voice.lang)
  ) || null;
}

// 10. SPEAK AI RESPONSES
function speak(text) {
  if (!("speechSynthesis" in window)) {
    add(
      "Text-to-speech is not supported in this browser.",
      "ai"
    );
    return;
  }

  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  const teluguVoice = getTeluguVoice();

  if (teluguVoice) {
    utterance.voice = teluguVoice;
    utterance.lang = teluguVoice.lang;
  } else {
    // Ask the browser to use a Telugu voice if available.
    utterance.lang = "te-IN";
  }

  utterance.rate = 0.9;
  utterance.pitch = 1.0;
  utterance.volume = 1.0;

  utterance.onerror = event => {
    if (event.error !== "canceled" &&
        event.error !== "interrupted") {
      console.warn("Speech error:", event.error);
    }
  };

  window.speechSynthesis.speak(utterance);
}

// Some browsers load voices asynchronously.
if ("speechSynthesis" in window) {
  window.speechSynthesis.onvoiceschanged = () => {
    getTeluguVoice();
  };
}

// 11. START J.A.R.V.I.S.
add(
  "నమస్కారం! J.A.R.V.I.S. సిద్ధంగా ఉంది. నన్ను ఏదైనా అడగండి.",
  "ai"
);
