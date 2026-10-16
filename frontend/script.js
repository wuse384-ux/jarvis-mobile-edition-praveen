
'use strict';

// ========================================
// J.A.R.V.I.S. — EPISODE 05
// Chat + Voice + Memory + Image Vision
// ========================================

// Keep your Episode 04 model names unchanged.
const MODELS = [
  'gemini-3.6-flash',
  'gemini-flash-latest'
];

const MEMORY_KEY = 'jarvis_memory';
const API_KEY_STORAGE = 'jarvis_key';

// Page elements
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

// Load saved conversation safely.
function loadMemory() {
  try {
    const saved = JSON.parse(
      localStorage.getItem(MEMORY_KEY) || '[]'
    );

    if (!Array.isArray(saved)) return [];

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
  let key = localStorage.getItem(API_KEY_STORAGE);

  if (key && key.trim()) {
    return key.trim();
  }

  key = prompt('Enter your Gemini API key:');

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
}

// ========================================
// CHAT DISPLAY
// ========================================

function addMessage(text, type = 'ai') {
  const message = document.createElement('div');

  message.className = 'msg ' + type;
  message.textContent = text;

  chat.appendChild(message);
  chat.scrollTop = chat.scrollHeight;

  return message;
}

function renderMemory() {
  chat.innerHTML = '';

  MEMORY.forEach(message => {
    const type = message.role === 'user' ? 'user' : 'ai';
    addMessage(message.text, type);
  });

  if (MEMORY.length === 0) {
    addMessage(
      'J.A.R.V.I.S. online. How can I assist you?',
      'ai'
    );
  }
}

function saveMemory() {
  try {
    localStorage.setItem(
      MEMORY_KEY,
      JSON.stringify(MEMORY)
    );

    if (memoryStatus) {
      memoryStatus.textContent = '● ACTIVE';
    }

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
// GEMINI API
// ========================================

const USER_PROFILE = {
  name: "Praveen",
  preferredName: "Praveen"
};

const JARVIS_INSTRUCTIONS = `
You are J.A.R.V.I.S., a personal AI assistant.
The user's name is ${USER_PROFILE.name}.
Address the user as ${USER_PROFILE.preferredName} when natural.
If asked for the user's name, answer with their name from this profile.
Use the conversation history to understand follow-up questions.
Never claim you know personal information that is not provided.
`;
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
    parts: [{ text: JARVIS_INSTRUCTIONS }]
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

      lastError =
        data?.promptFeedback?.blockReason
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
  // Gemini conversation history must alternate user/model roles.
  return MEMORY.slice(-12).map(message => ({
    role: message.role,
    parts: [{ text: message.text }]
  }));
}

// ========================================
// TEXT CHAT
// ========================================

async function sendMessage() {
  if (busy) return;

  const promptText = input.value.trim();

  if (!promptText) return;

  input.value = '';

  await askJarvis(promptText);
}

async function askJarvis(promptText) {
  if (busy) return;

  busy = true;
  sendBtn.disabled = true;
  engineStatus.textContent = '● PROCESSING';
  systemStatus.textContent = 'PROCESSING COMMAND';

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

    // Keep recent history within a reasonable size.
    MEMORY = MEMORY.slice(-40);
    saveMemory();

    addMessage(reply, 'ai');
    speak(reply);

    engineStatus.textContent = '● OPERATIONAL';
    systemStatus.textContent = 'SYSTEM READY';

  } catch (error) {
    console.error(error);

    addMessage(
      'J.A.R.V.I.S. error: ' + error.message,
      'error'
    );

    engineStatus.textContent = '● ERROR';
    systemStatus.textContent = 'CHECK CONNECTION OR API KEY';

  } finally {
    busy = false;
    sendBtn.disabled = false;
    input.focus();
  }
}

// Submit using the EXECUTE button or Enter.
form.addEventListener('submit', event => {
  event.preventDefault();
  sendMessage();
});

// ========================================
// TEXT-TO-SPEECH
// ========================================

function speak(text) {
  if (!('speechSynthesis' in window)) return;

  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'en-US';
  utterance.rate = 1;
  utterance.pitch = 1;

  window.speechSynthesis.speak(utterance);
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
    micBtn.textContent = '🔴';
    voiceStatus.textContent = '● LISTENING';
    systemStatus.textContent = 'LISTENING';
  };

  recognition.onresult = event => {
    const transcript =
      event.results[0][0].transcript.trim();

    input.value = transcript;

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
    micBtn.textContent = '🎙️';
    voiceStatus.textContent = '● READY';
    systemStatus.textContent = 'SYSTEM READY';
  };

  voiceStatus.textContent = '● READY';

} else {
  voiceStatus.textContent = '● NOT SUPPORTED';
}

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
    addMessage(
      'Could not start voice input. Please try again.',
      'error'
    );
  }
});

// ========================================
// CAMERA / IMAGE VISION
// ========================================

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

imgInput.addEventListener('change', async () => {
  const file = imgInput.files?.[0];

  // Allow selecting the same photo again later.
  imgInput.value = '';

  if (!file) return;

  if (!file.type.startsWith('image/')) {
    addMessage('Please select a valid image.', 'error');
    return;
  }

  // Avoid sending excessively large images.
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
    input.value.trim() ||
    'What do you see in this image? Describe it briefly.';

  input.value = '';

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
  sendBtn.disabled = true;
  camBtn.disabled = true;
  engineStatus.textContent = '● ANALYZING IMAGE';
  systemStatus.textContent = 'ANALYZING IMAGE';

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

    engineStatus.textContent = '● OPERATIONAL';
    systemStatus.textContent = 'SYSTEM READY';

  } catch (error) {
    console.error('Vision API error:', error);

    addMessage(
      'Image analysis failed: ' + error.message,
      'error'
    );

    engineStatus.textContent = '● ERROR';
    systemStatus.textContent = 'CHECK IMAGE OR API';

  } finally {
    busy = false;
    sendBtn.disabled = false;
    camBtn.disabled = false;
  }
}

// ========================================
// CLEAR MEMORY
// ========================================

clearBtn.addEventListener('click', () => {
  const confirmed = window.confirm(
    'Are you sure you want to clear all saved J.A.R.V.I.S. conversation memory?'
  );

  if (!confirmed) return;

  try {
    localStorage.removeItem(MEMORY_KEY);
    MEMORY = [];

    chat.innerHTML = '';

    addMessage(
      'Saved conversation memory cleared successfully.',
      'ai'
    );

    memoryStatus.textContent = '● ACTIVE';

  } catch (error) {
    console.error('Clear memory failed:', error);

    addMessage(
      'Could not clear memory: ' + error.message,
      'error'
    );
  }
});

// ========================================
// INITIALIZE
// ========================================

connectionStatus.textContent = navigator.onLine
  ? '● ONLINE'
  : '● OFFLINE';

window.addEventListener('online', () => {
  connectionStatus.textContent = '● ONLINE';
});

window.addEventListener('offline', () => {
  connectionStatus.textContent = '● OFFLINE';
});

engineStatus.textContent = '● OPERATIONAL';
memoryStatus.textContent = '● ACTIVE';

renderMemory();
