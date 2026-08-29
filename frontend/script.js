const chat = document.getElementById('chat');
const input = document.getElementById('msg');
const sendButton = document.getElementById('send');

function add(text, who) {
const d = document.createElement('div');

d.className = 'msg ' + who;
d.innerText = text;

chat.appendChild(d);

chat.scrollTop = chat.scrollHeight;

return d;

}

function getJarvisResponse(message) {

const text = message.toLowerCase();

if (text.includes('hello') || text.includes('hi')) {
    return 'Hello, Boss. J.A.R.V.I.S is online and ready to assist you.';
}

if (text.includes('your name') || text.includes('who are you')) {
    return 'I am J.A.R.V.I.S, your personal mobile assistant.';
}

if (text.includes('status')) {
    return 'All primary systems are online, Boss.';
}

if (text.includes('time')) {
    return 'The current time is ' +
        new Date().toLocaleTimeString();
}

if (text.includes('date')) {
    return 'Today is ' +
        new Date().toLocaleDateString();
}

if (text.includes('thank')) {
    return 'Always happy to assist you, Boss.';
}

return 'I am currently running in local mode. AI connection will be added soon, Boss.';

}

function sendMessage() {

const t = input.value.trim();

if (!t) return;


// USER MESSAGE

add('YOU: ' + t, 'user');

input.value = '';


// JARVIS PROCESSING MESSAGE

const processing = add(
    'J.A.R.V.I.S: Processing...',
    'ai'
);


// RESPONSE

setTimeout(() => {

    processing.innerText =
        'J.A.R.V.I.S: ' +
        getJarvisResponse(t);

    chat.scrollTop = chat.scrollHeight;

}, 700);

}

// SEND BUTTON

sendButton.onclick = sendMessage;

// ENTER KEY

input.addEventListener('keydown', (event) => {

if (event.key === 'Enter') {
    sendMessage();
}

});

// START MESSAGE

window.onload = () => {

setTimeout(() => {

    add(
        'J.A.R.V.I.S: Systems online. How may I assist you, Boss?',
        'ai'
    );

}, 500);

};
