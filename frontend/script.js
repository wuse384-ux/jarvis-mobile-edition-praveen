
"use strict";

// ==========================================
// J.A.R.V.I.S. MOBILE EDITION
// Telugu AI | Text | Voice | Error Recovery
// ==========================================

// 1. HTML ELEMENTS
const chat = document.getElementById("chat");
const input = document.getElementById("msg");
const sendBtn = document.getElementById("send");
const micBtn = document.getElementById("mic-btn");

// 2. GEMINI CONFIGURATION
// Keep the model you previously confirmed was working.
const MODEL = "gemini-3.5-flash-lite";

let API_KEY = localStorage.getItem("jarvis_key") || "";
let busy = false;
let recognition = null;
let listening = false;

// 3. CHAT DISPLAY
function add(text, type = "ai") {
  const div = document.createElement("div");
  div.className = "msg " + type;
  div.textContent = text;

  chat.appendChild(div);
  chat.scrollTop = chat.scrollHeight;

  return div;
}

// 4. API KEY
function getApiKey() {
  if (API_KEY) return API_KEY;

  const key = prompt("Enter your Gemini API key:");

  if (!key || !key.trim()) return "";

  API_KEY = key.trim();
  localStorage.setItem("jarvis_key", API_KEY);

  return API_KEY;
}

// 5. WAIT HELPER
function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// 6. GEMINI REQUEST WITH CONTROLLED RETRIES
async function callGemini(message) {
  const key = getApiKey();

  if (!key) {
    throw new Error("API key not entered.");
  }

  const url =
    "https://generativelanguage.googleapis.com/v1beta/models/" +
    MODEL +
    ":generateContent";

  const requestBody = {
    system_instruction: {
      parts: [{
        text:
          "You are J.A.R.V.I.S., a helpful personal AI assistant. " +
          "Reply in natural conversational Telugu using Telugu script by default. " +
          "Keep technical terms in English when useful. " +
          "If the user asks for another language, use that language. " +
          "Be friendly, clear, honest, and concise. " +
          "Never claim to perform a phone action unless it actually happened."
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
  };

  const maxAttempts = 3;
  let lastError;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    let response;

    try {
      response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": key
        },
        body: JSON.stringify(requestBody)
      });
    } catch (error) {
      lastError = new Error(
        "Network error. Check your internet connection."
      );

      if (attempt < maxAttempts) {
        await wait(1000 * Math.pow(2, attempt - 1));
        continue;
      }

      throw lastError;
    }

    let data;

    try {
      data = await response.json();
    } catch {
      throw new Error(
        "Gemini returned an unreadable response."
      );
    }

    if (response.ok) {
      const reply = data.candidates?.[0]?.content?.parts
        ?.map(part => part.text || "")
        .join("")
        .trim();

      if (!reply) {
        throw new Error(
          data.promptFeedback?.blockReason
            ? "Request blocked: " +
              data.promptFeedback.blockReason
            : "Gemini returned no text. Please try again."
        );
      }

      return reply;
    }

    const apiMessage =
      data.error?.message || "Gemini request failed.";

    const retryable =
      response.status === 429 ||
      response.status === 500 ||
      response.status === 502 ||
      response.status === 503 ||
      response.status === 504;

    lastError = new Error(apiMessage);

    // Do not retry permanent errors such as invalid
    // requests, invalid keys, or permission errors.
    if (!retryable) {
      if (response.status === 400) {
        throw new Error("Bad request: " + apiMessage);
      }

      if (response.status === 401 ||
          response.status === 403) {
        throw new Error(
          "API key or permission error. Check your Gemini API key and project."
        );
      }

      if (response.status === 404) {
        throw new Error(
          "Model not found. Check the model ID in script.js."
        );
      }

      if (response.status === 429) {
        throw new Error(
          "Gemini quota or rate limit reached. Try again later."
        );
      }

      throw new Error(apiMessage);
    }

    // Exponential backoff: about 1 second, then 2 seconds.
    if (attempt < maxAttempts) {
      const delay =
        1000 * Math.pow(2, attempt - 1) +
        Math.floor(Math.random() * 500);

      await wait(delay);
    }
  }

  throw new Error(
    "Gemini is still busy after 3 attempts. Please wait a little and try again. " +
    (lastError?.message || "")
  );
}

// 7. ASK J.A.R.V.I.S.
async function askGemini(message) {
  const thinking = add(
    "J.A.R.V.I.S: ఆలోచిస్తున్నాను...",
    "ai"
  );

  try {
    const reply = await callGemini(message);

    thinking.textContent = "J.A.R.V.I.S: " + reply;

    speak(reply);
  } catch (error) {
    thinking.textContent =
      "J.A.R.V.I.S ERROR: " +
      (error.message || "Something went wrong.");

    console.error("J.A.R.V.I.S error:", error);
  }
}

// 8. SEND MESSAGE
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

// 9. MICROPHONE INPUT
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
      "Voice recognition is unavailable in this browser. Try Chrome or type your message.",
      "ai"
    );
  });
}

// 10. FIND A TELUGU VOICE
function getTeluguVoice() {
  if (!("speechSynthesis" in window)) {
    return null;
  }

  const voices = window.speechSynthesis.getVoices();

  return voices.find(voice =>
    /^te([-_]|$)/i.test(voice.lang)
  ) || null;
}

// 11. SPEAK AI RESPONSES
function speak(text) {
  if (!("speechSynthesis" in window)) return;

  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  const voice = getTeluguVoice();

  if (voice) {
    utterance.voice = voice;
    utterance.lang = voice.lang;
  } else {
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

// Some browsers load voice lists asynchronously.
if ("speechSynthesis" in window) {
  window.speechSynthesis.onvoiceschanged = () => {
    getTeluguVoice();
  };
}

// 12. STARTUP
add(
  "నమస్కారం! J.A.R.V.I.S. సిద్ధంగా ఉంది. నన్ను ఏదైనా అడగండి.",
  "ai"
);
