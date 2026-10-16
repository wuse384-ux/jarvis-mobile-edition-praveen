
'use strict';

// ========================================
// J.A.R.V.I.S. — EPISODE 05
// Chat + Voice + Memory + Image Vision
// ========================================

// Keep Episode 04 model names unchanged.
const MODELS = [
  'gemini-3.6-flash',
  'gemini-flash-latest'
];

const MEMORY_KEY = 'jarvis_memory';
const API_KEY_STORAGE = 'jarvis_key';

// ========================================
// PAGE ELEMENTS
// ========================================

const chat = document.getElementById('chat');
const input = document.getElementById('msg');
const form = document.getElementById('message-form');
const sendBtn = document.getElementById('send');
const micBtn = document.getElementById('mic-btn');
const camBtn = document.getElementById('cam-btn');
const clearBtn = document.getElementById('clear-btn');
const imgInput = document.getElementById('img-input');

const engineStatus = document.getElementById('engine-status');
const connectionStatus = document.getElementById('connection-status');
const voiceStatus = document.getElementById('voice-status');
const memoryStatus = document.getElementById('memory-status');
const systemStatus = document.getElementById('system-status');

// Report missing elements instead of silently failing.
const requiredElements = {
  chat,
  input,
  form,
  sendBtn,
  micBtn,
  camBtn,
  clearBtn,
  imgInput
};

const missingElements = Object.entries(requiredElements)
  .filter(([, element]) => !element)
  .map(([name]) => name);

if (missingElements.length > 0) {
  console.error(
    'J.A.R.V.I.S. is missing HTML elements:',
    missingElements
  );
}

// Safely update optional status elements.
function setStatus(element, text) {
  if (element) {
    element.textContent = text;
  }
}

// ========================================
// CONVERSATION MEMORY
// ========================================

function loadMemory() {
  try {
    const saved = JSON.parse(
      localStorage.getItem(MEMORY_KEY) || '[]'
    );

    if (!Array.isArray(saved)) {
      return [];
    }

    return saved.filter(message =>
      message &&
      ['user', 'model'].includes(message.role) &&
      typeof message.text === 'string'
    );
  } catch (error) {
    console.error('Could not load memory:', error);
    return [];
  }
}

let MEMORY = loadMemory();
let busy = false;

// ========================================
// API KEY
// ========================================

function getApiKey() {
  try {
    let key = localStorage.getItem(API_KEY_STORAGE);

    if (key && key.trim()) {
      return key.trim();
    }

    key = window.prompt('Enter your Gemini API key:');

    if (!key || !key.trim()) {
      addMessage(
        'Please enter your Gemini API key before using J.A.R.V.I.S.',
        'error'
      );
      return null;
    }

    key = key.trim();
    localStorage.setItem(API_KEY_STORAGE, key);

    return key;
  } catch (error) {
    console.error('API key storage error:', error);

    addMessage(
      'Could not access browser storage. Check your browser settings.',
      'error'
    );

    return null;
  }
}

// ========================================
// CHAT DISPLAY
// ========================================

function addMessage(text, type = 'ai') {
  if (!chat) {
    console.error('Cannot display message: #chat is missing.');
    return null;
  }

  const message = document.createElement('div');

  message.className = 'msg ' + type;
  message.textContent = String(text);

  chat.appendChild(message);
  chat.scrollTop = chat.scrollHeight;

  return message;
}

function renderMemory() {
  if (!chat) return;

  chat.innerHTML = '';

  if (MEMORY.length === 0) {
    addMessage(
      'J.A.R.V.I.S. online. How can I assist you?',
      'ai'
    );
    return;
  }

  MEMORY.forEach(message => {
    const type = message.role === 'user' ? 'user' : 'ai';
    addMessage(message.text, type);
  });
}

function saveMemory() {
  try {
    localStorage.setItem(
      MEMORY_KEY,
      JSON.stringify(MEMORY)
    );

    setStatus(memoryStatus, '● ACTIVE');
    return true;
  } catch (error) {
    console.error('Memory save failed:', error);

    addMessage(
      'Warning: conversation memory could not be saved. Browser storage may be full.',
      'error'
    );

    return false;
  }
}

// ========================================
// ASSISTANT PROFILE AND INSTRUCTIONS
// ========================================

const USER_PROFILE = {
  name: 'Praveen',
  preferredName: 'Praveen'
};

const JARVIS_INSTRUCTIONS = `
You are J.A.R.V.I.S., a personal AI assistant.
The user's name is ${USER_PROFILE.name}.
Address the user as ${USER_PROFILE.preferredName} when natural.
If asked for the user's name, answer with their name from this profile.
Use the conversation history to understand follow-up questions.
Never claim you know personal information that is not provided.
`;

// ========================================
// GEMINI API
// ========================================

async function callGemini(parts, history = []) {
  const apiKey = getApiKey();

  if (!apiKey) {
    throw new Error('Gemini API key is required.');
  }

  let lastError = 'No Gemini model was available.';

  for (const model of MODELS) {
    try {
      const contents = [
        ...history,
        {
          role: 'user',
          parts: parts
        }
      ];

      const response = await fetch(
        'https://generativelanguage.googleapis.com/v1beta/models/' +
        encodeURIComponent(model) +
        ':generateContent?key=' +
        encodeURIComponent(apiKey),
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            systemInstruction: {
              parts: [
                { text: JARVIS_INSTRUCTIONS }
              ]
            },
            contents: contents,
            generationConfig: {
              temperature: 0.7,
              maxOutputTokens: 800
            }
          })
        }
      );

      const data = await response.json();

      if (!response.ok) {
        const apiMessage =
          data?.error?.message || response.statusText;

        lastError = model + ': ' + apiMessage;

        console.warn('Gemini request failed:', lastError);
        continue;
      }

      const answer = data?.candidates?.[0]?.content?.parts
        ?.map(part => part.text || '')
        .join('')
        .trim();

      if (answer) {
        return answer;
      }

      lastError = data?.promptFeedback?.blockReason
        ? 'The request was blocked: ' +
          data.promptFeedback.blockReason
        : 'Gemini returned no text.';

    } catch (error) {
      lastError = error.message || 'Network request failed.';
      console.error('Gemini request error:', error);
    }
  }

  throw new Error(lastError);
}

function getRecentHistory() {
  return MEMORY.slice(-12).map(message => ({
    role: message.role,
    parts: [{ text: message.text }]
  }));
}

// ========================================
// TEXT CHAT
// ========================================

async function sendMessage() {
  if (busy || !input) return;

  const promptText = input.value.trim();

  if (!promptText) return;

  input.value = '';
  await askJarvis(promptText);
}

async function askJarvis(promptText) {
  if (busy) return;

  busy = true;

  if (sendBtn) sendBtn.disabled = true;

  setStatus(engineStatus, '● PROCESSING');
  setStatus(systemStatus, 'PROCESSING COMMAND');

  addMessage(promptText, 'user');

  try {
    const history = getRecentHistory();

    const reply = await callGemini(
      [{ text: promptText }],
      history
    );

    MEMORY.push(
      { role: 'user', text: promptText },
      { role: 'model', text: reply }
    );

    MEMORY = MEMORY.slice(-40);
    saveMemory();

    addMessage(reply, 'ai');
    speak(reply);

    setStatus(engineStatus, '● OPERATIONAL');
    setStatus(systemStatus, 'SYSTEM READY');

  } catch (error) {
    console.error('J.A.R.V.I.S. chat error:', error);

    addMessage(
      'J.A.R.V.I.S. error: ' + error.message,
      'error'
    );

    setStatus(engineStatus, '● ERROR');
    setStatus(systemStatus, 'CHECK CONNECTION OR API KEY');

  } finally {
    busy = false;

    if (sendBtn) sendBtn.disabled = false;
    if (input) input.focus();
  }
}

// Submit using the Execute button or Enter.
if (form) {
  form.addEventListener('submit', event => {
    event.preventDefault();
    sendMessage();
  });
}

// ========================================
// TEXT-TO-SPEECH
// ========================================

function speak(text) {
  if (!('speechSynthesis' in window)) return;

  try {
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);

    utterance.lang = 'en-US';
    utterance.rate = 1;
    utterance.pitch = 1;

    window.speechSynthesis.speak(utterance);
  } catch (error) {
    console.error('Speech output error:', error);
  }
}

// ========================================
// SPEECH RECOGNITION
// ========================================

const SpeechRecognitionAPI =
  window.SpeechRecognition ||
  window.webkitSpeechRecognition;

let recognition = null;

if (SpeechRecognitionAPI) {
  recognition = new SpeechRecognitionAPI();

  recognition.lang = 'en-US';
  recognition.continuous = false;
  recognition.interimResults = false;

  recognition.onstart = () => {
    if (micBtn) micBtn.textContent = '🔴';

    setStatus(voiceStatus, '● LISTENING');
    setStatus(systemStatus, 'LISTENING');
  };

  recognition.onresult = event => {
    const transcript =
      event.results?.[0]?.[0]?.transcript?.trim() || '';

    if (input) {
      input.value = transcript;
    }

    if (transcript) {
      sendMessage();
    }
  };

  recognition.onerror = event => {
    console.error('Speech recognition error:', event.error);

    addMessage(
      'Voice input error: ' + event.error +
      '. You can type your command instead.',
      'error'
    );
  };

  recognition.onend = () => {
    if (micBtn) micBtn.textContent = '🎙️';

    setStatus(voiceStatus, '● READY');
    setStatus(systemStatus, 'SYSTEM READY');
  };

  setStatus(voiceStatus, '● READY');

} else {
  setStatus(voiceStatus, '● NOT SUPPORTED');
}

if (micBtn) {
  micBtn.addEventListener('click', () => {
    if (!recognition) {
      addMessage(
        'Speech recognition is not supported by this browser. Please type your command.',
        'error'
      );
      return;
    }

    try {
      recognition.start();
    } catch (error) {
      console.error('Could not start voice input:', error);

      addMessage(
        'Could not start voice input. Please try again.',
        'error'
      );
    }
  });
}

// ========================================
// CAMERA / IMAGE VISION
// ========================================

if (camBtn) {
  camBtn.addEventListener('click', () => {
    if (!imgInput) {
      addMessage(
        'Image input is missing from index.html.',
        'error'
      );
      return;
    }

    imgInput.click();
  });
}

if (imgInput) {
  imgInput.addEventListener('change', async () => {
    const file = imgInput.files?.[0];

    // Permit selecting the same image again later.
    imgInput.value = '';

    if (!file) return;

    if (!file.type.startsWith('image/')) {
      addMessage('Please select a valid image.', 'error');
      return;
    }

    if (file.size > 8 * 1024 * 1024) {
      addMessage(
        'This image is too large. Please select an image smaller than 8 MB.',
        'error'
      );
      return;
    }

    if (busy) {
      addMessage(
        'J.A.R.V.I.S. is busy. Please wait before sending another image.',
        'error'
      );
      return;
    }

    const question =
      input?.value.trim() ||
      'What do you see in this image? Describe it briefly.';

    if (input) input.value = '';

    try {
      const base64 = await readImageAsBase64(file);

      await askVision(base64, file.type, question);

    } catch (error) {
      console.error('Image processing error:', error);

      addMessage(
        'Could not process the image: ' + error.message,
        'error'
      );
    }
  });
}

function readImageAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      const result = reader.result;

      if (typeof result !== 'string') {
        reject(new Error('Image could not be read.'));
        return;
      }

      const commaIndex = result.indexOf(',');

      if (commaIndex === -1) {
        reject(new Error('Invalid image data.'));
        return;
      }

      resolve(result.slice(commaIndex + 1));
    };

    reader.onerror = () => {
      reject(new Error('Could not read the selected image.'));
    };

    reader.readAsDataURL(file);
  });
}

async function askVision(base64, mimeType, question) {
  if (busy) return;

  busy = true;

  if (sendBtn) sendBtn.disabled = true;
  if (camBtn) camBtn.disabled = true;

  setStatus(engineStatus, '● ANALYZING IMAGE');
  setStatus(systemStatus, 'ANALYZING IMAGE');

  addMessage('Image selected. ' + question, 'user');

  try {
    const history = getRecentHistory();

    const answer = await callGemini(
      [
        { text: question },
        {
          inline_data: {
            mime_type: mimeType,
            data: base64
          }
        }
      ],
      history
    );

    MEMORY.push(
      {
        role: 'user',
        text: '[Image] ' + question
      },
      {
        role: 'model',
        text: answer
      }
    );

    MEMORY = MEMORY.slice(-40);
    saveMemory();

    addMessage(answer, 'ai');
    speak(answer);

    setStatus(engineStatus, '● OPERATIONAL');
    setStatus(systemStatus, 'SYSTEM READY');

  } catch (error) {
    console.error('Vision API error:', error);

    addMessage(
      'Image analysis failed: ' + error.message,
      'error'
    );

    setStatus(engineStatus, '● ERROR');
    setStatus(systemStatus, 'CHECK IMAGE OR API');

  } finally {
    busy = false;

    if (sendBtn) sendBtn.disabled = false;
    if (camBtn) camBtn.disabled = false;
  }
}

// ========================================
// CLEAR MEMORY
// ========================================

if (clearBtn) {
  clearBtn.addEventListener('click', () => {
    const confirmed = window.confirm(
      'Are you sure you want to clear all saved J.A.R.V.I.S. conversation memory?'
    );

    if (!confirmed) return;

    try {
      localStorage.removeItem(MEMORY_KEY);
      MEMORY = [];

      if (chat) chat.innerHTML = '';

      addMessage(
        'Saved conversation memory cleared successfully.',
        'ai'
      );

      setStatus(memoryStatus, '● ACTIVE');

    } catch (error) {
      console.error('Clear memory failed:', error);

      addMessage(
        'Could not clear memory: ' + error.message,
        'error'
      );
    }
  });
}

// ========================================
// CONNECTION STATUS
// ========================================

function updateConnectionStatus() {
  setStatus(
    connectionStatus,
    navigator.onLine ? '● ONLINE' : '● OFFLINE'
  );
}

updateConnectionStatus();

window.addEventListener('online', updateConnectionStatus);
window.addEventListener('offline', updateConnectionStatus);

// ========================================
// INITIALIZE
// ========================================

setStatus(engineStatus, '● OPERATIONAL');
setStatus(memoryStatus, '● ACTIVE');

renderMemory();

console.log('J.A.R.V.I.S. Episode 05 script loaded.');
