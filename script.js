const API_URL = "https://api.dictionaryapi.dev/api/v2/entries/en/";

const form = document.getElementById("search-form");
const input = document.getElementById("word-input");
const formMsg = document.getElementById("form-msg");
const statusEl = document.getElementById("status");
const resultEl = document.getElementById("result");
const titleEl = document.getElementById("word-title");
const phoneticEl = document.getElementById("phonetic");
const audioBtn = document.getElementById("audio-btn");
const audioPlayer = document.getElementById("audio-player");
const meaningsEl = document.getElementById("meanings");
const sourceEl = document.getElementById("source");
const saveBtn = document.getElementById("save-btn");
const savedList = document.getElementById("saved-list");
const savedEmpty = document.getElementById("saved-empty");
const themeBtn = document.getElementById("theme-toggle");

let currentWord = "";

/* ---------- Storage helpers (fail safe if storage is blocked) ---------- */
function loadSaved() {
  try { return JSON.parse(localStorage.getItem("wordly-saved")) || []; }
  catch { return []; }
}
function storeSaved(list) {
  try { localStorage.setItem("wordly-saved", JSON.stringify(list)); } catch {}
}

/* ---------- Fetch ---------- */
async function fetchWord(word) {
  const res = await fetch(API_URL + encodeURIComponent(word));
  if (res.status === 404) throw new Error("NOT_FOUND");
  if (!res.ok) throw new Error("API_ERROR");
  return res.json();
}

/* ---------- Parse the API response into one clean object ---------- */
function parseEntry(data) {
  const entry = data[0];
  const phonetic = entry.phonetic ||
    (entry.phonetics.find(p => p.text) || {}).text || "";
  const audio = (entry.phonetics.find(p => p.audio) || {}).audio || "";
  return {
    word: entry.word,
    phonetic,
    audio,
    source: (entry.sourceUrls && entry.sourceUrls[0]) || "",
    meanings: data.flatMap(e => e.meanings)
  };
}

/* ---------- Render ---------- */
function render(info) {
  currentWord = info.word.toLowerCase();
  titleEl.textContent = info.word;
  phoneticEl.textContent = info.phonetic || "Pronunciation not available";

  if (info.audio) {
    audioPlayer.src = info.audio;
    audioBtn.hidden = false;
  } else {
    audioPlayer.removeAttribute("src");
    audioBtn.hidden = true;
  }

  meaningsEl.innerHTML = "";
  info.meanings.forEach(m => {
    const block = document.createElement("div");
    block.className = "meaning";

    const pos = document.createElement("h3");
    pos.textContent = m.partOfSpeech;
    block.appendChild(pos);

    const ol = document.createElement("ol");
    m.definitions.slice(0, 3).forEach(d => {
      const li = document.createElement("li");
      li.textContent = d.definition;
      if (d.example) {
        const ex = document.createElement("span");
        ex.className = "example";
        ex.textContent = `Example: "${d.example}"`;
        li.appendChild(ex);
      }
      ol.appendChild(li);
    });
    block.appendChild(ol);

    const syns = [...new Set([...(m.synonyms || []),
      ...m.definitions.flatMap(d => d.synonyms || [])])].slice(0, 8);
    const synBox = document.createElement("div");
    synBox.className = "synonyms";
    if (syns.length) {
      synBox.append("Synonyms: ");
      syns.forEach(s => {
        const b = document.createElement("button");
        b.type = "button";
        b.textContent = s;
        b.addEventListener("click", () => search(s));
        synBox.appendChild(b);
      });
    } else {
      synBox.textContent = "No synonyms available for this meaning.";
    }
    block.appendChild(synBox);
    meaningsEl.appendChild(block);
  });

  if (info.source) {
    sourceEl.textContent = "Source: ";
    const a = document.createElement("a");
    a.href = info.source; a.textContent = info.source;
    a.target = "_blank"; a.rel = "noopener";
    sourceEl.appendChild(a);
  } else {
    sourceEl.textContent = "";
  }

  updateSaveButton();
  resultEl.hidden = false;
}

function showError(message) {
  resultEl.hidden = true;
  statusEl.innerHTML = "";
  const p = document.createElement("p");
  p.className = "error";
  p.textContent = message;
  statusEl.appendChild(p);
}

/* ---------- Search flow ---------- */
async function search(raw) {
  const word = raw.trim().toLowerCase();
  formMsg.textContent = "";
  if (!word) { formMsg.textContent = "Enter a word to search."; input.focus(); return; }
  if (!/^[a-z'-]+$/.test(word)) {
    formMsg.textContent = "Use letters only. Numbers and symbols are not supported.";
    return;
  }
  input.value = word;
  statusEl.textContent = "Searching...";
  try {
    const data = await fetchWord(word);
    statusEl.textContent = "";
    render(parseEntry(data));
  } catch (err) {
    if (err.message === "NOT_FOUND") {
      showError(`No definition found for "${word}". Check the spelling and try again.`);
    } else {
      showError("Could not reach the dictionary. Check your connection and try again.");
    }
  }
}

/* ---------- Saved words ---------- */
function renderSaved() {
  const saved = loadSaved();
  savedList.innerHTML = "";
  savedEmpty.hidden = saved.length > 0;
  saved.forEach(w => {
    const li = document.createElement("li");
    const open = document.createElement("button");
    open.type = "button"; open.textContent = w;
    open.addEventListener("click", () => search(w));
    const del = document.createElement("button");
    del.type = "button"; del.textContent = "x";
    del.setAttribute("aria-label", `Remove ${w} from saved words`);
    del.addEventListener("click", () => toggleSave(w));
    li.append(open, del);
    savedList.appendChild(li);
  });
}

function updateSaveButton() {
  const isSaved = loadSaved().includes(currentWord);
  saveBtn.setAttribute("aria-pressed", String(isSaved));
  saveBtn.textContent = isSaved ? "Saved" : "Save word";
}

function toggleSave(word) {
  const saved = loadSaved();
  const i = saved.indexOf(word);
  if (i >= 0) saved.splice(i, 1); else saved.push(word);
  storeSaved(saved);
  renderSaved();
  updateSaveButton();
}

/* ---------- Events ---------- */
form.addEventListener("submit", e => { e.preventDefault(); search(input.value); });
saveBtn.addEventListener("click", () => toggleSave(currentWord));
audioBtn.addEventListener("click", () => {
  audioPlayer.play().catch(() => showError("Audio could not be played."));
});
themeBtn.addEventListener("click", () => {
  const dark = document.body.classList.toggle("dark");
  themeBtn.textContent = dark ? "Light mode" : "Dark mode";
  try { localStorage.setItem("wordly-theme", dark ? "dark" : "light"); } catch {}
});

/* ---------- Init ---------- */
try {
  if (localStorage.getItem("wordly-theme") === "dark") {
    document.body.classList.add("dark");
    themeBtn.textContent = "Light mode";
  }
} catch {}
renderSaved();