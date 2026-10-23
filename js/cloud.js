// Konten & Cloud-Speicher (Firebase Authentication + Firestore)
//
// Prinzip: Die App speichert wie bisher alles im localStorage (Schlüssel „wortwerk.*“).
// Dieses Modul spiegelt diese Schlüssel in das Konto des angemeldeten Nutzers:
//   users/{uid}/data/{schlüssel}  →  { z: gzip+base64 oder s: Text, t: Zeitstempel }
// Beim Start werden neuere Daten aus der Cloud geholt, jede Änderung wird kurz
// danach hochgeladen. So hat jede Person ihren eigenen Fortschritt – auf jedem Gerät.

import { firebaseConfig } from "./firebase-config.js";

const SDK = "https://www.gstatic.com/firebasejs/10.12.2";
const PREFIX = "wortwerk.";
const UID_KEY = "wortwerk.uid"; // wem gehören die Daten auf diesem Gerät?
const SYNC_KEY = "wortwerk.sync"; // lokale Änderungszeiten je Schlüssel
const LOCAL_ONLY = new Set([UID_KEY, SYNC_KEY]);

let fb = null; // geladene SDK-Funktionen
let auth = null;
let db = null;
let user = null;
let rawSet = null; // ursprüngliches localStorage.setItem
const dirty = new Set();
let timer = null;
let syncing = false;

export const enabled = () => !!firebaseConfig;
export const sdkLoaded = () => !!fb;
export const currentUser = () => user;
export const userName = () => (user ? user.displayName || (user.email || "").split("@")[0] : "");

// ---------- localStorage-Hilfen ----------
const ls = {
  get: (k) => {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  set: (k, v) => {
    try {
      (rawSet || localStorage.setItem).call(localStorage, k, v);
    } catch {
      /* voll oder gesperrt */
    }
  },
  del: (k) => {
    try {
      localStorage.removeItem(k);
    } catch {
      /* egal */
    }
  },
  keys: () => {
    const out = [];
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(PREFIX) && !LOCAL_ONLY.has(k)) out.push(k);
      }
    } catch {
      /* egal */
    }
    return out;
  },
};
const syncTimes = () => {
  try {
    return JSON.parse(ls.get(SYNC_KEY) || "{}");
  } catch {
    return {};
  }
};
const setSyncTime = (k, t) => {
  const m = syncTimes();
  m[k] = t;
  ls.set(SYNC_KEY, JSON.stringify(m));
};
function clearLocal() {
  for (const k of ls.keys()) ls.del(k);
  ls.del(SYNC_KEY);
}

// ---------- Komprimieren (Fortschritt kann groß werden) ----------
async function pack(text) {
  if (typeof CompressionStream === "undefined" || text.length < 20000) return { s: text };
  const stream = new Blob([text]).stream().pipeThrough(new CompressionStream("gzip"));
  const buf = new Uint8Array(await new Response(stream).arrayBuffer());
  let bin = "";
  for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return { z: btoa(bin) };
}
async function unpack(d) {
  if (typeof d.s === "string") return d.s;
  if (typeof d.z !== "string") return null;
  const bin = atob(d.z);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  const stream = new Blob([buf]).stream().pipeThrough(new DecompressionStream("gzip"));
  return await new Response(stream).text();
}

// ---------- SDK laden ----------
async function loadSdk() {
  if (fb) return fb;
  const [app, a, f] = await Promise.all([
    import(`${SDK}/firebase-app.js`),
    import(`${SDK}/firebase-auth.js`),
    import(`${SDK}/firebase-firestore.js`),
  ]);
  const inst = app.initializeApp(firebaseConfig);
  auth = a.getAuth(inst);
  auth.languageCode = "de";
  db = f.getFirestore(inst);
  fb = { ...a, ...f };
  return fb;
}

// ---------- Hochladen ----------
function watchWrites() {
  if (rawSet) return;
  rawSet = Storage.prototype.setItem;
  const rawDel = Storage.prototype.removeItem;
  Storage.prototype.setItem = function (k, v) {
    rawSet.call(this, k, v);
    if (this === localStorage && user && typeof k === "string" && k.startsWith(PREFIX) && !LOCAL_ONLY.has(k)) mark(k);
  };
  Storage.prototype.removeItem = function (k) {
    rawDel.call(this, k);
    if (this === localStorage && user && typeof k === "string" && k.startsWith(PREFIX) && !LOCAL_ONLY.has(k)) mark(k);
  };
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flush();
  });
  window.addEventListener("online", () => flush());
}
function mark(k) {
  setSyncTime(k, Date.now());
  dirty.add(k);
  clearTimeout(timer);
  timer = setTimeout(flush, 1500);
}
export async function flush() {
  if (!user || !db || syncing || !dirty.size) return;
  syncing = true;
  const keys = [...dirty];
  dirty.clear();
  try {
    for (const k of keys) {
      const ref = fb.doc(db, "users", user.uid, "data", k);
      const v = ls.get(k);
      if (v == null) await fb.deleteDoc(ref);
      else await fb.setDoc(ref, { ...(await pack(v)), t: syncTimes()[k] || Date.now() });
    }
  } catch (e) {
    keys.forEach((k) => dirty.add(k)); // später erneut versuchen
    console.warn("Cloud-Speichern fehlgeschlagen", e);
  } finally {
    syncing = false;
  }
}

// ---------- Holen ----------
async function pull() {
  const snap = await fb.getDocs(fb.collection(db, "users", user.uid, "data"));
  const times = syncTimes();
  let got = 0;
  for (const d of snap.docs) {
    const data = d.data();
    got++;
    if ((data.t || 0) <= (times[d.id] || 0)) continue; // lokal ist aktueller
    const text = await unpack(data);
    if (text != null) {
      ls.set(d.id, text);
      setSyncTime(d.id, data.t || Date.now());
    }
  }
  return got;
}

// ---------- Start ----------
// Liefert true, wenn die App starten darf; false, wenn erst angemeldet werden muss.
export async function start() {
  if (!enabled()) return true;
  const knownUid = ls.get(UID_KEY);
  try {
    await loadSdk();
  } catch {
    // offline und SDK nicht im Cache: mit den Daten auf dem Gerät weiterlernen
    return !!knownUid;
  }
  user = await new Promise((res) => {
    const off = fb.onAuthStateChanged(auth, (u) => {
      off();
      res(u);
    });
  });
  if (!user) return false;
  if (knownUid !== user.uid) {
    // Gerät gehörte bisher niemandem (Gast) oder jemand anderem
    if (knownUid) clearLocal();
    ls.set(UID_KEY, user.uid);
  }
  watchWrites();
  try {
    const remote = await pull();
    if (!remote) {
      // neues Konto: bisherigen Fortschritt auf diesem Gerät übernehmen
      for (const k of ls.keys()) mark(k);
      await flush();
    } else {
      // lokale Änderungen, die noch nicht oben sind (z. B. offline gelernt)
      const times = syncTimes();
      for (const k of ls.keys()) if (!times[k]) mark(k);
    }
  } catch (e) {
    console.warn("Cloud-Laden fehlgeschlagen – lerne mit den Daten auf diesem Gerät", e);
  }
  return true;
}

export async function logout() {
  await flush();
  await fb.signOut(auth);
  user = null;
  clearLocal();
  ls.del(UID_KEY);
  location.hash = "#/";
  location.reload();
}

// ---------- Anmeldebildschirm ----------
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

const ERR = {
  "auth/invalid-email": "Diese E-Mail-Adresse sieht nicht richtig aus.",
  "auth/missing-email": "Bitte gib deine E-Mail-Adresse ein.",
  "auth/missing-password": "Bitte gib dein Passwort ein.",
  "auth/invalid-credential": "E-Mail oder Passwort stimmt nicht. Bitte noch einmal versuchen.",
  "auth/wrong-password": "Das Passwort stimmt nicht.",
  "auth/user-not-found": "Zu dieser E-Mail gibt es noch kein Konto. Tippe oben auf „Neues Konto“.",
  "auth/email-already-in-use": "Mit dieser E-Mail gibt es schon ein Konto. Tippe oben auf „Anmelden“.",
  "auth/weak-password": "Das Passwort ist zu kurz. Bitte mindestens 6 Zeichen.",
  "auth/too-many-requests": "Zu viele Versuche. Bitte warte kurz und versuche es dann noch einmal.",
  "auth/network-request-failed": "Keine Internetverbindung. Bitte prüfe dein WLAN oder deine mobilen Daten.",
  "auth/unauthorized-domain": "Diese Website ist in Firebase noch nicht freigegeben (Autorisierte Domains).",
  "auth/operation-not-allowed": "Anmelden mit E-Mail ist in Firebase noch nicht eingeschaltet.",
};

export function showLogin(root, { offline = false } = {}) {
  let mode = "login";
  document.documentElement.classList.add("is-login");
  const draw = (msg = "", ok = false) => {
    const neu = mode === "new";
    root.innerHTML = `
    <main class="login">
      <div class="login-head">
        <div class="login-logo" aria-hidden="true">W</div>
        <h1>Wortwerk</h1>
        <p>Vokabeln lernen – Schritt für Schritt</p>
      </div>
      ${
        offline
          ? `<p class="login-msg">Für die erste Anmeldung brauchst du Internet. Bitte verbinde dich und lade die Seite neu.</p>`
          : `<div class="login-tabs" role="tablist">
        <button role="tab" aria-selected="${!neu}" class="${neu ? "" : "on"}" data-mode="login">Anmelden</button>
        <button role="tab" aria-selected="${neu}" class="${neu ? "on" : ""}" data-mode="new">Neues Konto</button>
      </div>
      <p class="login-intro">${neu ? "Lege ein eigenes Konto an. Dann wird dein Fortschritt gespeichert – auf jedem Handy und Computer." : "Melde dich an, damit dein Fortschritt gespeichert wird."}</p>
      <form class="login-form" novalidate>
        ${neu ? `<label>Dein Vorname<input name="name" autocomplete="given-name" placeholder="z. B. Anna"></label>` : ""}
        <label>E-Mail-Adresse<input name="email" type="email" autocomplete="email" inputmode="email" autocapitalize="off" placeholder="name@beispiel.de"></label>
        <label>Passwort${neu ? " <small>(mindestens 6 Zeichen)</small>" : ""}
          <span class="login-pw"><input name="pw" type="password" autocomplete="${neu ? "new-password" : "current-password"}"><button type="button" class="login-eye" aria-label="Passwort zeigen">👁</button></span></label>
        ${msg ? `<p class="login-msg ${ok ? "ok" : ""}" role="alert">${esc(msg)}</p>` : ""}
        <button class="login-go" type="submit">${neu ? "Konto erstellen" : "Anmelden"}</button>
        ${neu ? "" : `<button type="button" class="login-link" id="forgot">Passwort vergessen?</button>`}
      </form>`
      }
    </main>`;
    if (offline) return;
    root.querySelectorAll("[data-mode]").forEach((b) => (b.onclick = () => ((mode = b.dataset.mode), draw())));
    const form = root.querySelector("form");
    const eye = root.querySelector(".login-eye");
    eye.onclick = () => {
      const i = form.pw;
      i.type = i.type === "password" ? "text" : "password";
      eye.setAttribute("aria-label", i.type === "password" ? "Passwort zeigen" : "Passwort verbergen");
    };
    const forgot = root.querySelector("#forgot");
    if (forgot)
      forgot.onclick = async () => {
        const email = form.email.value.trim();
        if (!email) return draw("Bitte gib zuerst oben deine E-Mail-Adresse ein.");
        try {
          await fb.sendPasswordResetEmail(auth, email);
          draw("Wir haben dir eine E-Mail geschickt. Darin kannst du ein neues Passwort festlegen.", true);
        } catch (e) {
          draw(ERR[e.code] || "Das hat nicht geklappt. Bitte versuche es noch einmal.");
        }
      };
    form.onsubmit = async (e) => {
      e.preventDefault();
      const email = form.email.value.trim();
      const pw = form.pw.value;
      const btn = form.querySelector(".login-go");
      btn.disabled = true;
      btn.textContent = "Einen Moment …";
      try {
        if (neu) {
          const cred = await fb.createUserWithEmailAndPassword(auth, email, pw);
          const name = form.name.value.trim();
          if (name) await fb.updateProfile(cred.user, { displayName: name });
        } else {
          await fb.signInWithEmailAndPassword(auth, email, pw);
        }
        location.hash = "#/";
        location.reload();
      } catch (err) {
        draw(ERR[err.code] || "Das hat nicht geklappt. Bitte versuche es noch einmal.");
        const f = root.querySelector("form");
        if (f) f.email.value = email;
      }
    };
  };
  draw();
}
