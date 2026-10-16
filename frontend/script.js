// ===== 1. API KEY & SMART MODELS ===== let API_KEY = localStorage.getItem('jarvis_key'); if(!API_KEY)
{ API_KEY = prompt('Enter your Gemini API Key:'); if(API_KEY) localStorage.setItem('jarvis_key', API_KEY); } c
onst MODELS = ["gemini-3.5-flash", "gemini-3.1-flash-lite", "gemini-flash-latest"]; // ===== 2. MEMORY SYSTEM
===== let MEMORY = JSON.parse(localStorage.getItem('jarvis_memory') || '[]'); function saveMemory(){ localStor
age.setItem('jarvis_memory', JSON.stringify(MEMORY)); } const chat=document.getElementById('chat'); const inpu
t=document.getElementById('msg'); const micBtn=document.getElementById('mic-btn'); const clearBtn=document.get
ElementById('clear-btn'); const camBtn=document.getElementById('cam-btn'); const imgInput=document.getElementB
yId('img-input'); MEMORY.forEach(m=> add((m.role==='user'?'YOU: ':'J.A.R.V.I.S: ')+m.text, m.role==='user'?'us
er':'ai')); // ===== 3. GEMINI BRAIN (MEMORY INTEGRATED) ===== async function callGemini(p){ const contents =
MEMORY.slice(-12).map(m=>({role:m.role, parts:[{text:m.text}]})); contents.push({role:'user', parts:[{text:
p}]}); let lastErr; for(const m of MODELS){ try{ const res=await fetch("https://generativelanguage.googleapis.
com/v1beta/models/"+m+":generateContent?key="+API_KEY, {method:"POST",headers:{"Content-Type":"application/jso
n"},body:JSON.stringify({contents:contents})}); const data=await res.json(); if(data.error){ lastErr=new Error
(data.error.message); if(/high demand|temporar|quota|rate|unavailable|deprecated/i.test(data.error.message)) c
ontinue; throw lastErr; } return data.candidates[0].content.parts[0].text; }catch(e){ lastErr=e; } } throw las
tErr; } async function askGemini(p){ add('J.A.R.V.I.S: Thinking...','ai'); try{ const reply=await callGemini
(p); MEMORY.push({role:'user',text:p}); MEMORY.push({role:'model',text:reply}); saveMemory(); chat.lastChild.i
nnerText='J.A.R.V.I.S: '+reply; speak(reply); }catch(e){ chat.lastChild.innerText='J.A.R.V.I.S: ERROR - '+e.me
ssage; } } // ===== 4. VISION ENGINE (EYES) ===== if(camBtn && imgInput){ camBtn.onclick=()=>imgInput.click();
imgInput.onchange=()=>{ const file=imgInput.files[0]; if(!file)return; const reader=new FileReader(); reader.o
nload=()=>{ const base64=reader.result.split(',')[1]; const q=input.value.trim()||'What do you see? Describe b
riefly.'; add('YOU: [IMAGE] '+q,'user'); input.value=''; askVision(base64,file.type,q); }; reader.readAsDataUR
L(file); }; } async function askVision(base64,mime,q){ add('J.A.R.V.I.S: Analyzing image...','ai'); let lastEr
r; for(const m of MODELS){ try{ const res=await fetch("https://generativelanguage.googleapis.com/v1beta/model
s/"+m+":generateContent?key="+API_KEY, {method:"POST",headers:{"Content-Type":"application/json"}, body:JSON.s
tringify({contents:[{parts:[{text:q},{inline_data:{mime_type:mime,data:base64}}]}]})}); const data=await res.j
son(); if(data.error){ lastErr=new Error(data.error.message); if(/high demand|temporar|quota|rate|unavailable|
deprecated/i.test(data.error.message)) continue; throw lastErr; } const reply=data.candidates[0].content.parts
[0].text; chat.lastChild.innerText='J.A.R.V.I.S: '+reply; speak(reply); return; }catch(e){ lastErr=e; } } cha
t.lastChild.innerText='J.A.R.V.I.S: ERROR - '+lastErr.message; } // ===== 5. VOICE & UTILS ===== const SR=wind
ow.SpeechRecognition||window.webkitSpeechRecognition; if(SR && micBtn){ const rec=new SR(); rec.lang='en-US';
rec.onresult=(e)=>{const t=e.results[0][0].transcript;add('YOU: '+t,'user');askGemini(t);}; micBtn.onclick=()=
>{rec.start();micBtn.innerText='LISTENING...';}; rec.onend=()=>{micBtn.innerText='🎙️';}; } let voices=[]; func
tion loadVoices(){ voices=speechSynthesis.getVoices(); } loadVoices(); speechSynthesis.onvoiceschanged=loadVoi
ces; function speak(t){ const u=new SpeechSynthesisUtterance(t); u.rate=1.05; u.pitch=0.85; const v=voices.fin
d(v=>v.lang.startsWith('en')); if(v) u.voice=v; speechSynthesis.speak(u); } document.getElementById('send').on
click=()=>{ const t=input.value.trim(); if(!t)return; add('YOU: '+t,'user'); input.value=''; askGemini(t); };
if(clearBtn){ clearBtn.onclick=()=>{ MEMORY=[]; saveMemory(); chat.innerHTML=''; add('SYSTEM: Memory cleare
d.','ai'); }; } function add(t,w){const d=document.createElement('div');d.className='msg '+w;d.innerText=t;cha
t.appendChild(d);chat.scrollTop=chat.scrollHeight;}
