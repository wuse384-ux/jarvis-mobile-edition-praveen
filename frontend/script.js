
"use strict";

// ============================================
// J.A.R.V.I.S. MOBILE EDITION
// Telugu AI + Text Chat + Voice + Model Fallback
// ============================================

// 1. HTML ELEMENTS
const chat = document.getElementById("chat");
const input = document.getElementById("msg");
const sendBtn = document.getElementById("send");
const micBtn = document.getElementById("mic-btn");

if (!chat || !input || !sendBtn || !micBtn) {
  throw new Error(
    "J.A.R.V.I.S. could not find a required HTML element. " +
    "Check the IDs: chat, msg, send, mic-btn."
  );
}

// 2. GEMINI MODELS
// J.A.R.V.I.S. tries these in order if a model fails.
const MODELS = [
  "gemini-3.8-flash",
  "gemini-3.6-flash",
  "gemini-3.5-flash-lite",
  "gemini-3.1-flash-lite"
];

const API_BASE =
  "https://generativelanguage.googleapis.com/v1beta/models/";

let apiKey = "";
let busy = false;
let recognition = null;
let listening = false;

// 3. SHOW CHAT MESSAGES
function add(text, type = "ai") {
  const div = document.createElement("div");
  div.className = "msg " + type;
  div.textContent = text;

  chat.appendChild(div);
  chat.scrollTop = chat.scrollHeight;

  return div;
}

// 4. GET THE API KEY
function getApiKey() {
  if (apiKey) return apiKey;

  try {
    apiKey = localStorage.getItem("jarvis_key") || "";
  } catch (error) {
    console.warn("Could not read saved API key:", error);
  }

  if (apiKey) return apiKey;

  const enteredKey = prompt(
    "Enter your Gemini API key. Do not share it with anyone:"
  );

  if (!enteredKey || !enteredKey.trim()) {
    return "";
  }

  apiKey = enteredKey.trim();

  try {
    localStorage.setItem("jarvis_key", apiKey);
  } catch (error) {
    console.warn("Could not save API key in this browser:", error);
  }

  return apiKey;
}

// 5. WAIT BEFORE RETRYING
function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// 6. CALL GEMINI WITH AUTOMATIC MODEL FALLBACK
async function callGemini(message) {
  const key = getApiKey();

  if (!key) {
    throw new Error(
      "No API key entered. Refresh the page and enter your Gemini API key."
    );
  }

  const requestBody = {
    system_instruction: {
      parts: [{
        text:
          "You are J.A.R.V.I.S., a helpful personal AI assistant. " +
          "Reply in natural, conversational Telugu using Telugu script by default. " +
          "Keep technical words in English when useful. " +
          "If the user requests another language, use that language. " +
          "Give clear, practical answers suitable for a beginner. " +
          "Be honest about your abilities. " +
          "Never claim that you performed a phone action unless it actually happened."
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

  const failures = [];
  const maxAttemptsPerModel = 2;

  for (const model of MODELS) {
    let tryNextModel = false;

    for (let attempt = 1; attempt <= maxAttemptsPerModel; attempt++) {
      let response;

      try {
        response = await fetch(
          API_BASE + model + ":generateContent",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-goog-api-key": key
            },
            body: JSON.stringify(requestBody)
          }
        );
      } catch (error) {
        if (attempt < maxAttemptsPerModel) {
          await wait(1000 * attempt);
          continue;
        }

        failures.push(model + ": network connection failed");
        tryNextModel = true;
        break;
      }

      let data = {};

      try {
        data = await response.json();
      } catch (error) {
        failures.push(model + ": unreadable server response");
        tryNextModel = true;
        break;
      }

      // SUCCESS
      if (response.ok) {
        const reply = data.candidates?.[0]?.content?.parts
          ?.map(part => part.text || "")
          .join("")
          .trim();

        if (reply) {
          return {
            reply: reply,
            model: model
          };
        }

        const blockReason = data.promptFeedback?.blockReason;

        failures.push(
          model + ": " +
          (blockReason
            ? "request blocked (" + blockReason + ")"
            : "no text was returned")
        );

        tryNextModel = true;
        break;
      }

      const status = response.status;
      const apiMessage =
        data.error?.message || response.statusText || "Unknown API error";

      // The same bad API key or permission issue will not be
      // repaired by trying a different model.
      if (status === 401 || status === 403) {
        throw new Error(
          "API key or permission error. Check your key and its " +
          "project access in Google AI Studio. Details: " + apiMessage
        );
      }

      if (status === 400) {
        throw new Error("Gemini rejected the request: " + apiMessage);
      }

      // A model can be unavailable, overloaded, or rate-limited.
      // Retry temporary errors, then try the next model.
      if (status === 404) {
        failures.push(model + ": model unavailable (404)");
        tryNextModel = true;
        break;
      }

      const retryableStatuses = [429, 500, 502, 503, 504];

      if (retryableStatuses.includes(status)) {
        if (attempt < maxAttemptsPerModel) {
          const delay = 1000 * Math.pow(2, attempt - 1);
          const jitter = Math.floor(Math.random() * 500);

          await wait(delay + jitter);
          continue;
        }

        failures.push(
          model + ": HTTP " + status + " — " + apiMessage
        );

        tryNextModel = true;
        break;
      }

      throw new Error(
        "Gemini HTTP " + status + ": " + apiMessage
      );
    }

    if (tryNextModel) {
      console.warn("J.A.R.V.I.S. switching from model:", model);
    }
  }

  throw new Error(
    "All configured Gemini models failed.\n\n" +
    failures.join("\n") +
    "\n\nThis may be a temporary Gemini service problem, " +
    "an API limit, or model access issue. Wait briefly and try again. " +
    "If it continues, check your API key, project and API usage."
  );
}

// 7. ASK J.A.R.V.I.S.
async function askGemini(message) {
  const thinking = add("J.A.R.V.I.S: ఆలోచిస్తున్నాను...", "ai");

  try {
    const result = await callGemini(message);

    thinking.textContent =
      "J.A.R.V.I.S (" + result.model + "): " + result.reply;

    speak(result.reply);

    console.log("J.A.R.V.I.S used model:", result.model);
  } catch (error) {
    thinking.textContent =
      "J.A.R.V.I.S ERROR:\n" +
      (error.message || "Something went wrong.");

    console.error("J.A.R.V.I.S error:", error);
  }
}

// 8. SEND A TEXT MESSAGE
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
    input.focus();
  }
}

sendBtn.addEventListener("click", sendMessage);

input.addEventListener("keydown", event => {
  if (event.key === "Enter" && !event.shiftKey) {
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
    } catch (error) {
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
    if (
      event.error !== "no-speech" &&
      event.error !== "aborted"
    ) {
      add(
        "Microphone error: " + event.error +
        ". You can type your message instead.",
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
      "Voice recognition is not supported in this browser. " +
      "Try Chrome or type your message.",
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
  if (!("speechSynthesis" in window)) {
    return;
  }

  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  const voice = getTeluguVoice();

  utterance.lang = voice ? voice.lang : "te-IN";

  if (voice) {
    utterance.voice = voice;
  }

  utterance.rate = 0.9;
  utterance.pitch = 1.0;
  utterance.volume = 1.0;

  utterance.onerror = event => {
    if (
      event.error !== "canceled" &&
      event.error !== "interrupted"
    ) {
      console.warn("Speech error:", event.error);
    }
  };

  window.speechSynthesis.speak(utterance);
}

// 12. INITIAL GREETING
add(
  "నమస్కారం! J.A.R.V.I.S. సిద్ధంగా ఉంది. " +
  "నన్ను తెలుగులో లేదా ఇంగ్లీష్‌లో ఏదైనా అడగండి.",
  "ai"
);

console.log("J.A.R.V.I.S. ready.");
