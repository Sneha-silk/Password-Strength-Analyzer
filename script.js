// ---- Matrix background ----
const canvas = document.getElementById("matrix");
const ctx = canvas.getContext("2d");
let w, h, cols, yPos;

function resize() {
  w = canvas.width = window.innerWidth;
  h = canvas.height = window.innerHeight;
  cols = Math.floor(w / 16);
  yPos = Array(cols).fill(0);
}
window.addEventListener("resize", resize);
resize();

function drawMatrix() {
  ctx.fillStyle = "rgba(0,0,0,0.10)";
  ctx.fillRect(0, 0, w, h);

  ctx.fillStyle = "rgba(0,255,176,0.55)";
  ctx.font = "16px ui-monospace, monospace";

  for (let i = 0; i < yPos.length; i++) {
    const text = String.fromCharCode(0x30A0 + Math.random() * 96);
    const x = i * 16;
    const y = yPos[i] * 16;

    ctx.fillText(text, x, y);

    if (y > h && Math.random() > 0.985) yPos[i] = 0;
    else yPos[i]++;
  }

  requestAnimationFrame(drawMatrix);
}
drawMatrix();

// ---- App logic ----
const pwEl = document.getElementById("pw");
const showBtn = document.getElementById("showBtn");
const clearBtn = document.getElementById("clearBtn");
const genBtn = document.getElementById("genBtn");
const copyBtn = document.getElementById("copyBtn");
const modeBtn = document.getElementById("modeBtn");

const statusEl = document.getElementById("status");
const meterFill = document.getElementById("meterFill");
const scoreEl = document.getElementById("score");
const rankEl = document.getElementById("rank");
const crackEl = document.getElementById("crack");
const entropyEl = document.getElementById("entropy");
const flagsEl = document.getElementById("flags");
const tipsEl = document.getElementById("tips");

// LEDs
const c_len = document.getElementById("c_len");
const c_low = document.getElementById("c_low");
const c_up = document.getElementById("c_up");
const c_num = document.getElementById("c_num");
const c_sym = document.getElementById("c_sym");
const c_common = document.getElementById("c_common");
const c_pat = document.getElementById("c_pat");

const COMMON = new Set([
  "password","123456","123456789","qwerty","abc123","111111","iloveyou","admin",
  "password1","123123","letmein","welcome","monkey","dragon","football","india"
]);

const hasLower = s => /[a-z]/.test(s);
const hasUpper = s => /[A-Z]/.test(s);
const hasNumber = s => /[0-9]/.test(s);
const hasSymbol = s => /[^A-Za-z0-9]/.test(s);

function isRepeated(s){ return /(.)\1\1/.test(s); }     // aaaa
function isSequential(s){
  const seq = "abcdefghijklmnopqrstuvwxyz";
  const num = "0123456789";
  const low = s.toLowerCase();
  for (let i=0; i<low.length-3; i++){
    const p = low.slice(i,i+4);
    if (seq.includes(p) || num.includes(p)) return true;
  }
  return false;
}

function charsetSize(pw){
  let size = 0;
  if (hasLower(pw)) size += 26;
  if (hasUpper(pw)) size += 26;
  if (hasNumber(pw)) size += 10;
  if (hasSymbol(pw)) size += 32;
  return Math.max(size, 1);
}

function entropyBits(pw){
  const L = pw.length;
  const C = charsetSize(pw);
  return L * Math.log2(C);
}

function crackTime(bits){
  // Rough estimate: 1e9 guesses/sec
  const capped = Math.min(bits, 60);
  const guesses = Math.pow(2, capped);
  const rate = 1e9;
  const seconds = guesses / rate;
  if (!isFinite(seconds) || seconds <= 0) return "—";

  const units = [
    ["year", 60*60*24*365],
    ["day", 60*60*24],
    ["hour", 60*60],
    ["min", 60],
    ["sec", 1],
  ];
  for (const [name, val] of units){
    if (seconds >= val){
      const n = seconds / val;
      const shown = n >= 100 ? Math.round(n) : n.toFixed(1);
      return `${shown} ${name}${shown == 1 ? "" : "s"}`;
    }
  }
  return `${seconds.toFixed(2)} sec`;
}

function setLed(el, ok){
  el.classList.remove("on","good","bad","off");
  if (ok === null) {
    el.classList.add("off");
    return;
  }
  el.classList.add("on", ok ? "good" : "bad");
}

function genPassword(){
  const lowers="abcdefghijklmnopqrstuvwxyz";
  const uppers="ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const nums="0123456789";
  const syms="!@#$%^&*()-_=+[]{};:,.?/";
  const all = lowers + uppers + nums + syms;
  const pick = s => s[Math.floor(Math.random()*s.length)];

  let pw = pick(lowers) + pick(uppers) + pick(nums) + pick(syms);
  for (let i=0;i<12;i++) pw += pick(all); // 16 chars
  return pw.split("").sort(()=>Math.random()-0.5).join("");
}

function analyze(pw){
  const tips = [];
  const flags = [];

  if (!pw) {
    statusEl.textContent = "Waiting…";
    meterFill.style.width = "0%";
    scoreEl.textContent = "0";
    rankEl.textContent = "UNSAFE";
    rankEl.className = "rank r0";
    crackEl.textContent = "Crack time: —";
    entropyEl.textContent = "0 bits";
    flagsEl.textContent = "—";
    tipsEl.innerHTML = `<li>Type a password to start analysis.</li>`;
    setLed(c_len, null); setLed(c_low, null); setLed(c_up, null);
    setLed(c_num, null); setLed(c_sym, null); setLed(c_common, null); setLed(c_pat, null);
    return;
  }

  statusEl.textContent = "Analyzing…";

  const okLen = pw.length >= 8;
  const okLow = hasLower(pw);
  const okUp  = hasUpper(pw);
  const okNum = hasNumber(pw);
  const okSym = hasSymbol(pw);

  const common = COMMON.has(pw.toLowerCase());
  const patternBad = isRepeated(pw) || isSequential(pw);

  setLed(c_len, okLen);
  setLed(c_low, okLow);
  setLed(c_up, okUp);
  setLed(c_num, okNum);
  setLed(c_sym, okSym);
  setLed(c_common, !common);
  setLed(c_pat, !patternBad);

  // Scoring
  let score = 0;

  // length
  if (pw.length >= 8) score += 25;
  else score += Math.min(25, pw.length * 3);
  if (pw.length >= 12) score += 10;
  if (pw.length >= 16) score += 8;

  // diversity
  if (okLow) score += 12; else tips.push("Add lowercase letters (a–z).");
  if (okUp)  score += 12; else tips.push("Add uppercase letters (A–Z).");
  if (okNum) score += 12; else tips.push("Add numbers (0–9).");
  if (okSym) score += 18; else tips.push("Add symbols (!@#...).");

  // penalties
  if (common){ score -= 25; flags.push("COMMON"); tips.push("Avoid common passwords (easy to guess)."); }
  if (patternBad){ score -= 15; flags.push("PATTERN"); tips.push("Avoid patterns like 1234 or aaaa."); }

  // quick flags
  if (pw.length < 8) flags.push("SHORT");
  if (!okSym) flags.push("NO-SYMBOL");
  if (!okUp) flags.push("NO-UPPER");
  if (!okNum) flags.push("NO-NUM");

  score = Math.max(0, Math.min(100, score));

  // UI
  meterFill.style.width = `${score}%`;
  scoreEl.textContent = String(score);

  // rank
  if (score < 40){
    rankEl.textContent = "UNSAFE";
    rankEl.className = "rank r0";
    tips.unshift("Increase length to 12+ characters for a big boost.");
  } else if (score < 70){
    rankEl.textContent = "OKAY";
    rankEl.className = "rank r1";
    tips.unshift("Good start. Add more length + symbols to level up.");
  } else {
    rankEl.textContent = "HARD";
    rankEl.className = "rank r2";
    tips.unshift("Nice! This is strong. Consider using a password manager.");
  }

  const bits = entropyBits(pw);
  entropyEl.textContent = `${Math.round(bits)} bits`;
  crackEl.textContent = `Crack time: ${crackTime(bits)}`;
  flagsEl.textContent = flags.length ? flags.join(" • ") : "CLEAN";

  // tips list
  tipsEl.innerHTML = "";
  tips.slice(0, 7).forEach(t=>{
    const li = document.createElement("li");
    li.textContent = t;
    tipsEl.appendChild(li);
  });

  statusEl.textContent = score >= 70 ? "Status: Secure ✅" : score >= 40 ? "Status: Improving ⚠️" : "Status: Weak ❌";
}

// Events
pwEl.addEventListener("input", () => analyze(pwEl.value));

showBtn.addEventListener("click", () => {
  const isHidden = pwEl.type === "password";
  pwEl.type = isHidden ? "text" : "password";
  showBtn.textContent = isHidden ? "Hide" : "Show";
});

clearBtn.addEventListener("click", () => {
  pwEl.value = "";
  pwEl.type = "password";
  showBtn.textContent = "Show";
  analyze("");
});

genBtn.addEventListener("click", () => {
  pwEl.value = genPassword();
  analyze(pwEl.value);
});

copyBtn.addEventListener("click", async () => {
  const val = pwEl.value;
  if (!val) return alert("Nothing to copy.");
  try{
    await navigator.clipboard.writeText(val);
    const old = copyBtn.textContent;
    copyBtn.textContent = "Copied!";
    setTimeout(()=> copyBtn.textContent = old, 800);
  }catch{
    alert("Copy failed. Please copy manually.");
  }
});

// Simple theme toggle (Neon <-> Ice)
let ice = false;
modeBtn.addEventListener("click", () => {
  ice = !ice;
  document.documentElement.style.setProperty("--accent", ice ? "#7cf7ff" : "#00ffb0");
  document.documentElement.style.setProperty("--accent2", ice ? "#a78bfa" : "#00b7ff");
  document.documentElement.style.setProperty("--stroke", ice ? "rgba(124,247,255,0.18)" : "rgba(0,255,170,0.18)");
  modeBtn.textContent = ice ? "Theme: Ice" : "Theme: Neon";
});

// Init
analyze("");
