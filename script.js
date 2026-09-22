const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const state = {
  color: "#FF4FA3",
  shape: "square",
  radius: 18,
  quiet: 4,
  svg: "",
  lastPayload: "",
  visitorId: localStorage.getItem("qrgen_visitor_id") || crypto.randomUUID()
};

localStorage.setItem("qrgen_visitor_id", state.visitorId);

const linkInput = $("#linkInput");
const colorPicker = $("#colorPicker");
const hexInput = $("#hexInput");
const qrOutput = $("#qrOutput");
const qrEmpty = $("#qrEmpty");
const toast = $("#toast");

function toastMessage(message) {
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastMessage.timer);
  toastMessage.timer = setTimeout(() => toast.classList.remove("show"), 2200);
}

function normalizeHex(value) {
  let v = value.trim().replace(/^#/, "").toUpperCase();
  if (/^[0-9A-F]{3}$/.test(v)) v = v.split("").map(x => x + x).join("");
  return /^[0-9A-F]{6}$/.test(v) ? `#${v}` : null;
}

function setColor(color) {
  const normalized = normalizeHex(color);
  if (!normalized) return;
  state.color = normalized;
  colorPicker.value = normalized;
  hexInput.value = normalized.slice(1);
  $$(".swatch").forEach(el => el.classList.toggle("active", el.dataset.color.toUpperCase() === normalized));
  renderQR();
}

function escapeXml(value) {
  return String(value).replace(/[<>&'"]/g, c => ({
    "<":"&lt;", ">":"&gt;", "&":"&amp;", "'":"&apos;", '"':"&quot;"
  }[c]));
}

function polygonPoints(cx, cy, radius, count, rotation = -Math.PI / 2) {
  return Array.from({length: count}, (_, i) => {
    const a = rotation + i * Math.PI * 2 / count;
    return `${(cx + Math.cos(a) * radius).toFixed(2)},${(cy + Math.sin(a) * radius).toFixed(2)}`;
  }).join(" ");
}

function shapeElement(shape, x, y, s, color, radiusPercent) {
  const r = Math.max(0, Math.min(50, radiusPercent)) / 100;
  const inset = s * .10;
  const x2 = x + inset, y2 = y + inset, size = s - inset * 2;
  const cx = x + s / 2, cy = y + s / 2;

  if (shape === "circle") {
    return `<circle cx="${cx}" cy="${cy}" r="${size/2}" fill="${color}"/>`;
  }
  if (shape === "rounded") {
    return `<rect x="${x2}" y="${y2}" width="${size}" height="${size}" rx="${Math.min(size/2, size*(.18 + r*.55))}" fill="${color}"/>`;
  }
  if (shape === "diamond") {
    return `<polygon points="${cx},${y2} ${x+s-inset},${cy} ${cx},${y+s-inset} ${x2},${cy}" fill="${color}"/>`;
  }
  if (shape === "heart") {
    const scale = size / 24;
    return `<path transform="translate(${cx - 12*scale} ${cy - 11*scale}) scale(${scale})" fill="${color}" d="M12 21.4 10.4 20C4.8 15 1.2 11.8 1.2 7.9A5.7 5.7 0 0 1 6.9 2.2c1.9 0 3.7.9 5.1 2.4a6.8 6.8 0 0 1 5.1-2.4 5.7 5.7 0 0 1 5.7 5.7c0 3.9-3.6 7.1-9.2 12.1L12 21.4Z"/>`;
  }
  if (shape === "star") {
    return `<polygon points="${polygonPoints(cx, cy, size*.51, 5)}" fill="${color}"/>`;
  }
  if (shape === "hex") {
    return `<polygon points="${polygonPoints(cx, cy, size*.52, 6, Math.PI/6)}" fill="${color}"/>`;
  }
  if (shape === "plus") {
    const w = size*.34;
    return `<path fill="${color}" d="M${cx-w/2} ${y2}h${w}v${size/2-w/2}h${size/2-w/2}v${w}H${cx-w/2+size/2-w/2}v${size/2-w/2}h-${w}V${cy+w/2}H${x2}v-${w}h${size/2-w/2}V${y2}Z"/>`;
  }
  return `<rect x="${x2}" y="${y2}" width="${size}" height="${size}" rx="${Math.min(size*.06, size*r)}" fill="${color}"/>`;
}

function finderPattern(qr, row, col, module, quiet, color, shape) {
  // Keep finder patterns recognizable; use a template-specific outer shape.
  const x = (col + quiet) * module;
  const y = (row + quiet) * module;
  const size = 7 * module;
  let outer = `<rect x="${x}" y="${y}" width="${size}" height="${size}" rx="${shape === "rounded" ? module*1.1 : 0}" fill="${color}"/>`;

  if (shape === "circle") {
    outer = `<circle cx="${x+size/2}" cy="${y+size/2}" r="${size/2}" fill="${color}"/>`;
  } else if (shape === "diamond") {
    outer = `<polygon points="${x+size/2},${y} ${x+size},${y+size/2} ${x+size/2},${y+size} ${x},${y+size/2}" fill="${color}"/>`;
  }

  const white = `<rect x="${x+module}" y="${y+module}" width="${5*module}" height="${5*module}" fill="#fff"/>`;
  const inner = `<rect x="${x+2*module}" y="${y+2*module}" width="${3*module}" height="${3*module}" fill="${color}"/>`;

  if (shape === "circle") {
    return `${outer}<circle cx="${x+size/2}" cy="${y+size/2}" r="${size*2.5/7}" fill="#fff"/><circle cx="${x+size/2}" cy="${y+size/2}" r="${size*1.5/7}" fill="${color}"/>`;
  }
  return `${outer}${white}${inner}`;
}

function buildQrSvg(text) {
  const qr = qrcode(0, "M");
  qr.addData(text);
  qr.make();

  const count = qr.getModuleCount();
  const module = 10;
  const quiet = Number(state.quiet);
  const size = (count + quiet * 2) * module;
  let shapes = "";

  const finders = [
    [0,0], [0,count-7], [count-7,0]
  ];

  const isFinder = (r,c) => finders.some(([fr,fc]) => r >= fr && r < fr+7 && c >= fc && c < fc+7);

  for (let r = 0; r < count; r++) {
    for (let c = 0; c < count; c++) {
      if (!qr.isDark(r,c) || isFinder(r,c)) continue;
      shapes += shapeElement(state.shape, (c+quiet)*module, (r+quiet)*module, module, state.color, state.radius);
    }
  }

  for (const [r,c] of finders) shapes += finderPattern(qr, r, c, module, quiet, state.color, state.shape);

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" role="img" aria-label="Mã QR cho ${escapeXml(text)}">
    <rect width="${size}" height="${size}" fill="#fff"/>
    ${shapes}
  </svg>`;
}

let renderTimer;
function renderQR() {
  clearTimeout(renderTimer);
  renderTimer = setTimeout(() => {
    const value = linkInput.value.trim();
    if (!value) {
      qrOutput.innerHTML = "";
      qrEmpty.hidden = false;
      qrEmpty.textContent = "Nhập nội dung để tạo QR";
      state.svg = "";
      return;
    }

    try {
      state.svg = buildQrSvg(value);
      state.lastPayload = value;
      qrOutput.innerHTML = state.svg;
      qrEmpty.hidden = true;
      countServer("qr");
    } catch (error) {
      qrOutput.innerHTML = "";
      qrEmpty.hidden = false;
      qrEmpty.textContent = "Nội dung quá dài hoặc không thể tạo QR.";
      console.error(error);
    }
  }, 120);
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 500);
}

$("#downloadSvg").addEventListener("click", () => {
  if (!state.svg) return toastMessage("Hãy tạo QR trước.");
  downloadBlob(new Blob([state.svg], {type:"image/svg+xml;charset=utf-8"}), "vieqr-qr.svg");
  toastMessage("Đã tải SVG.");
});

$("#downloadPng").addEventListener("click", () => {
  if (!state.svg) return toastMessage("Hãy tạo QR trước.");
  const svgUrl = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(state.svg);
  const img = new Image();
  img.onload = () => {
    const canvas = document.createElement("canvas");
    const scale = 3;
    canvas.width = img.width * scale;
    canvas.height = img.height * scale;
    const ctx = canvas.getContext("2d");
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(blob => downloadBlob(blob, "vieqr-qr.png"), "image/png");
  };
  img.onerror = () => toastMessage("Không thể xuất PNG.");
  img.src = svgUrl;
});

$("#copyLink").addEventListener("click", async () => {
  const value = linkInput.value.trim();
  if (!value) return toastMessage("Chưa có link để copy.");
  try {
    await navigator.clipboard.writeText(value);
    toastMessage("Đã copy nội dung QR.");
  } catch {
    toastMessage("Trình duyệt không cho phép copy tự động.");
  }
});

$("#clearInput").addEventListener("click", () => {
  linkInput.value = "";
  renderQR();
  linkInput.focus();
});

linkInput.addEventListener("input", renderQR);

colorPicker.addEventListener("input", e => setColor(e.target.value));
hexInput.addEventListener("input", () => {
  const normalized = normalizeHex(hexInput.value);
  if (normalized) setColor(normalized);
});
hexInput.addEventListener("blur", () => {
  if (!normalizeHex(hexInput.value)) {
    hexInput.value = state.color.slice(1);
    toastMessage("Mã Hex không hợp lệ.");
  }
});

$$(".swatch").forEach(swatch => {
  swatch.addEventListener("click", () => setColor(swatch.dataset.color));
});

$$(".shape-option").forEach(option => {
  option.addEventListener("click", () => {
    $$(".shape-option").forEach(x => x.classList.remove("active"));
    option.classList.add("active");
    state.shape = option.dataset.shape;
    renderQR();
  });
});

$("#radiusRange").addEventListener("input", e => {
  state.radius = Number(e.target.value);
  renderQR();
});
$("#quietRange").addEventListener("input", e => {
  state.quiet = Number(e.target.value);
  renderQR();
});

// Light / dark mode
const savedTheme = localStorage.getItem("vieqr_theme");
if (savedTheme === "dark") document.body.classList.add("dark");

$("#modeToggle").addEventListener("click", () => {
  const isDark = document.body.classList.toggle("dark");
  localStorage.setItem("vieqr_theme", isDark ? "dark" : "light");
  countServer("mode");
  toastMessage(isDark ? "Đã chuyển Dark mode." : "Đã chuyển Light mode.");
});

// Hex help modal
const hexModal = $("#hexModal");
const openHexModal = () => { hexModal.hidden = false; document.body.style.overflow = "hidden"; };
const closeHexModal = () => { hexModal.hidden = true; document.body.style.overflow = ""; };
$("#hexHelp").addEventListener("click", openHexModal);
$("#closeHexModal").addEventListener("click", closeHexModal);
$("#closeHexModal2").addEventListener("click", closeHexModal);
hexModal.addEventListener("click", e => { if (e.target === hexModal) closeHexModal(); });
document.addEventListener("keydown", e => { if (e.key === "Escape" && !hexModal.hidden) closeHexModal(); });

// Upload → Netlify Function → Netlify Blob public route
$("#uploadButton").addEventListener("click", () => $("#fileInput").click());
$("#fileInput").addEventListener("change", async e => {
  const file = e.target.files?.[0];
  if (!file) return;

  const note = $("#uploadNote");
  note.textContent = `Đang upload: ${file.name}…`;

  try {
    const form = new FormData();
    form.append("file", file);

    const response = await fetch("/.netlify/functions/upload", {
      method: "POST",
      body: form
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Upload thất bại.");

    linkInput.value = data.url;
    renderQR();
    note.textContent = `${file.name} • ${formatBytes(file.size)}`;
    toastMessage("Upload xong — link đã được đưa vào QR.");
  } catch (error) {
    note.textContent = "Upload chưa khả dụng — hãy deploy project trên Netlify.";
    toastMessage(error.message || "Upload thất bại.");
  } finally {
    e.target.value = "";
  }
});

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024**2) return `${(bytes/1024).toFixed(1)} KB`;
  return `${(bytes/1024**2).toFixed(1)} MB`;
}

async function countServer(action) {
  try {
    const body = { action };
    if (action === "visit") body.visitorId = state.visitorId;
    const response = await fetch("/.netlify/functions/stats", {
      method: "POST",
      headers: {"Content-Type":"application/json"},
      body: JSON.stringify(body)
    });
    if (!response.ok) throw new Error();
    const stats = await response.json();
    updateStats(stats);
  } catch {
    // Keep a local fallback so the UI still works when opened directly.
    const key = "vieqr_local_stats";
    const local = JSON.parse(localStorage.getItem(key) || '{"visits":0,"qrs":0,"modeChanges":0}');
    if (action === "visit" && !sessionStorage.getItem("vieqr_counted")) {
      local.visits++;
      sessionStorage.setItem("vieqr_counted","1");
    }
    if (action === "qr") local.qrs++;
    if (action === "mode") local.modeChanges++;
    localStorage.setItem(key, JSON.stringify(local));
    updateStats(local);
  }
}

function updateStats(stats) {
  $("#visitCount").textContent = Number(stats.visits || 0).toLocaleString("vi-VN");
  $("#qrCount").textContent = Number(stats.qrs || 0).toLocaleString("vi-VN");
  $("#modeCount").textContent = Number(stats.modeChanges || 0).toLocaleString("vi-VN");
}

async function loadStats() {
  try {
    const response = await fetch("/.netlify/functions/stats");
    if (!response.ok) throw new Error();
    updateStats(await response.json());
  } catch {
    const local = JSON.parse(localStorage.getItem("vieqr_local_stats") || '{"visits":0,"qrs":0,"modeChanges":0}');
    updateStats(local);
  }
}

// Count the first visit once per browser profile.
if (!sessionStorage.getItem("vieqr_session_started")) {
  sessionStorage.setItem("vieqr_session_started", "1");
  countServer("visit");
} else {
  loadStats();
}

// Initial render
renderQR();
