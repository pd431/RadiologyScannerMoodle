(() => {
  const MANIFEST_URL = "../data/slices/manifest.json";
  const SLICE_URL = (filename) => `../data/slices/${filename}`;
  const STORAGE_KEY = "annotator:apple:v1";
  const TYPE_LABELS = { label: "Text label", pin: "Pin + description", mcq: "MCQ" };

  const el = (id) => document.getElementById(id);
  const stage = el("stage");
  const svgHost = el("svgHost");
  const markerLayer = el("markerLayer");
  const scrub = el("scrub");
  const playBtn = el("play");
  const readout = el("readout");
  const datasetInfo = el("datasetInfo");
  const annotationListEl = el("annotationList");
  const sliceAnnCountEl = el("sliceAnnCount");
  const totalAnnCountEl = el("totalAnnCount");
  const importBtn = el("importBtn");
  const importFile = el("importFile");
  const exportBtn = el("exportBtn");
  const clearBtn = el("clearBtn");
  const modalBackdrop = el("modalBackdrop");
  const modal = el("modal");

  const state = {
    manifest: null,
    currentIndex: 1,
    annotations: [],
    playing: false,
    playTimer: null,
  };

  function uid() {
    return "a-" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
  }

  function clamp(v, min, max) {
    return Math.min(max, Math.max(min, v));
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (c) => (
      { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
    ));
  }

  function loadStoredAnnotations() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.annotations));
    } catch {
      /* storage unavailable or full: annotations still live in memory */
    }
  }

  // --- dataset / slice loading --------------------------------------------

  async function init() {
    state.annotations = loadStoredAnnotations();

    const res = await fetch(MANIFEST_URL);
    state.manifest = await res.json();
    scrub.max = state.manifest.sliceCount;
    datasetInfo.textContent = `${state.manifest.sliceCount} slices · ${state.manifest.axis || ""}`;

    await loadSlice(1);
    wireGlobalControls();
  }

  async function loadSlice(index) {
    state.currentIndex = index;
    const filename = state.manifest.files[index - 1];
    const res = await fetch(SLICE_URL(filename));
    svgHost.innerHTML = await res.text();
    scrub.value = index;
    readout.textContent = `${index} / ${state.manifest.sliceCount}`;
    renderMarkers();
    renderAnnotationList();
  }

  function stopPlaying() {
    state.playing = false;
    playBtn.textContent = "Play";
    clearInterval(state.playTimer);
  }

  // --- layer detection ------------------------------------------------------

  function layerFromEventTarget(target) {
    const layerEl = target && target.closest ? target.closest("[data-layer]") : null;
    return layerEl ? layerEl.getAttribute("data-layer") : null;
  }

  function layerAtPoint(clientX, clientY, ignoreEl) {
    const prevDisplay = ignoreEl ? ignoreEl.style.display : null;
    if (ignoreEl) ignoreEl.style.display = "none";
    const target = document.elementFromPoint(clientX, clientY);
    if (ignoreEl) ignoreEl.style.display = prevDisplay;
    return layerFromEventTarget(target);
  }

  // --- markers ---------------------------------------------------------------

  function annotationsForCurrentSlice() {
    return state.annotations.filter((a) => a.sliceIndex === state.currentIndex);
  }

  function renderMarkers() {
    markerLayer.innerHTML = "";
    annotationsForCurrentSlice().forEach((ann) => markerLayer.appendChild(buildMarkerEl(ann)));
  }

  function buildMarkerEl(ann) {
    const div = document.createElement("div");
    div.className = `marker ${ann.type}`;
    div.style.left = `${ann.x * 100}%`;
    div.style.top = `${ann.y * 100}%`;
    div.dataset.id = ann.id;

    if (ann.type === "label") {
      div.innerHTML = `<span class="dot"></span><span class="chip">${escapeHtml(ann.text || "Label")}</span>`;
    } else if (ann.type === "pin") {
      div.title = ann.title || "Pin";
      div.innerHTML = `<span class="icon-circle">i</span>`;
    } else if (ann.type === "mcq") {
      div.title = ann.question || "MCQ";
      div.innerHTML = `<span class="icon-circle">?</span>`;
    }

    wireMarkerDrag(div, ann);
    return div;
  }

  function wireMarkerDrag(div, ann) {
    div.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      div.setPointerCapture(e.pointerId);
      let dragging = false;
      let pendingX = ann.x;
      let pendingY = ann.y;
      const startX = e.clientX;
      const startY = e.clientY;

      const onMove = (moveEvt) => {
        const dx = moveEvt.clientX - startX;
        const dy = moveEvt.clientY - startY;
        if (!dragging && Math.hypot(dx, dy) > 4) dragging = true;
        if (!dragging) return;
        const rect = stage.getBoundingClientRect();
        pendingX = clamp((moveEvt.clientX - rect.left) / rect.width, 0, 1);
        pendingY = clamp((moveEvt.clientY - rect.top) / rect.height, 0, 1);
        div.style.left = `${pendingX * 100}%`;
        div.style.top = `${pendingY * 100}%`;
      };

      const onUp = (upEvt) => {
        div.removeEventListener("pointermove", onMove);
        if (dragging) {
          ann.x = pendingX;
          ann.y = pendingY;
          const newLayer = layerAtPoint(upEvt.clientX, upEvt.clientY, div);
          if (newLayer) ann.layer = newLayer;
          persist();
          renderAnnotationList();
        } else {
          openEditModal(ann.id);
        }
      };

      div.addEventListener("pointermove", onMove);
      div.addEventListener("pointerup", onUp, { once: true });
    });
  }

  // --- palette drag / drop ----------------------------------------------------

  function wirePalette() {
    document.querySelectorAll(".palette-item").forEach((item) => {
      item.addEventListener("dragstart", (e) => {
        e.dataTransfer.setData("text/plain", item.dataset.type);
        e.dataTransfer.effectAllowed = "copy";
      });
    });

    stage.addEventListener("dragover", (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
      stage.classList.add("drag-over");
    });
    stage.addEventListener("dragleave", () => stage.classList.remove("drag-over"));

    stage.addEventListener("drop", (e) => {
      e.preventDefault();
      stage.classList.remove("drag-over");
      const type = e.dataTransfer.getData("text/plain");
      if (!TYPE_LABELS[type]) return;

      const rect = stage.getBoundingClientRect();
      const x = clamp((e.clientX - rect.left) / rect.width, 0, 1);
      const y = clamp((e.clientY - rect.top) / rect.height, 0, 1);
      const layer = layerFromEventTarget(e.target);

      const ann = createDefaultAnnotation(type, x, y, layer);
      state.annotations.push(ann);
      renderMarkers();
      renderAnnotationList();
      openEditModal(ann.id, { isNew: true });
    });
  }

  function createDefaultAnnotation(type, x, y, layer) {
    const base = { id: uid(), type, sliceIndex: state.currentIndex, layer, x, y };
    if (type === "label") return { ...base, text: "" };
    if (type === "pin") return { ...base, title: "", description: "" };
    return {
      ...base,
      question: "What condition does this point to?",
      options: ["Rot", "Bite mark", "Healthy apple"],
      answer: "",
    };
  }

  // --- annotation list ------------------------------------------------------

  function summaryFor(ann) {
    if (ann.type === "label") return ann.text || "(empty label)";
    if (ann.type === "pin") return ann.title || "(untitled pin)";
    return ann.question || "(untitled question)";
  }

  function iconHtmlFor(type) {
    if (type === "label") return '<span class="icon label"></span>';
    if (type === "pin") return '<span class="icon pin">i</span>';
    return '<span class="icon mcq">?</span>';
  }

  function renderAnnotationList() {
    const items = annotationsForCurrentSlice();
    sliceAnnCountEl.textContent = items.length;
    totalAnnCountEl.textContent = state.annotations.length;
    annotationListEl.innerHTML = "";

    if (!items.length) {
      const li = document.createElement("li");
      li.className = "empty";
      li.textContent = "No annotations on this slice yet.";
      annotationListEl.appendChild(li);
      return;
    }

    items.forEach((ann) => {
      const li = document.createElement("li");
      li.innerHTML = `
        ${iconHtmlFor(ann.type)}
        <span class="label-text">${escapeHtml(summaryFor(ann))}</span>
        <span class="layer-tag">${escapeHtml(ann.layer || "—")}</span>
      `;
      li.addEventListener("click", () => openEditModal(ann.id));
      annotationListEl.appendChild(li);
    });
  }

  // --- modal editor -----------------------------------------------------------

  function buildModalForm(ann, isNew) {
    const meta = `<p class="meta">Slice ${ann.sliceIndex} · layer: ${escapeHtml(ann.layer || "unassigned")}</p>`;
    const actions = `
      <div class="modal-actions">
        ${isNew ? "" : '<button id="deleteBtn" class="danger">Delete</button>'}
        <div class="right">
          <button id="cancelBtn">Cancel</button>
          <button id="saveBtn">Save</button>
        </div>
      </div>`;

    if (ann.type === "label") {
      return `
        <h3>${TYPE_LABELS.label}</h3>
        ${meta}
        <label>Label text
          <input type="text" id="f-text" maxlength="40" value="${escapeHtml(ann.text || "")}" placeholder="e.g. Core" />
        </label>
        <div class="error" id="formError"></div>
        ${actions}`;
    }

    if (ann.type === "pin") {
      return `
        <h3>${TYPE_LABELS.pin}</h3>
        ${meta}
        <label>Title
          <input type="text" id="f-title" maxlength="60" value="${escapeHtml(ann.title || "")}" placeholder="e.g. Seed chamber" />
        </label>
        <label>Description
          <textarea id="f-desc" placeholder="Longer explanation for students">${escapeHtml(ann.description || "")}</textarea>
        </label>
        <div class="error" id="formError"></div>
        ${actions}`;
    }

    return `
      <h3>${TYPE_LABELS.mcq}</h3>
      ${meta}
      <label>Question
        <input type="text" id="f-question" value="${escapeHtml(ann.question || "")}" />
      </label>
      <label>Options (one per line)
        <textarea id="f-options">${escapeHtml((ann.options || []).join("\n"))}</textarea>
      </label>
      <label>Correct answer
        <select id="f-answer"></select>
      </label>
      <div class="error" id="formError"></div>
      ${actions}`;
  }

  function applyFormToAnnotation(ann) {
    if (ann.type === "label") {
      const text = el("f-text").value.trim();
      if (!text) return "Enter label text.";
      ann.text = text;
      return null;
    }

    if (ann.type === "pin") {
      const title = el("f-title").value.trim();
      const description = el("f-desc").value.trim();
      if (!title) return "Enter a title.";
      ann.title = title;
      ann.description = description;
      return null;
    }

    const question = el("f-question").value.trim();
    const options = el("f-options").value.split("\n").map((s) => s.trim()).filter(Boolean);
    const answer = el("f-answer").value;
    if (!question) return "Enter a question.";
    if (options.length < 2) return "Add at least two options.";
    if (!answer || !options.includes(answer)) return "Choose the correct answer.";
    ann.question = question;
    ann.options = options;
    ann.answer = answer;
    return null;
  }

  function removeAnnotation(id) {
    state.annotations = state.annotations.filter((a) => a.id !== id);
  }

  function wireModalForm(ann, isNew) {
    if (ann.type === "mcq") {
      const optionsTa = el("f-options");
      const answerSel = el("f-answer");
      const refreshOptions = () => {
        const prev = answerSel.value || ann.answer;
        const lines = optionsTa.value.split("\n").map((s) => s.trim()).filter(Boolean);
        answerSel.innerHTML = '<option value="">Select…</option>' +
          lines.map((o) => `<option value="${escapeHtml(o)}">${escapeHtml(o)}</option>`).join("");
        if (lines.includes(prev)) answerSel.value = prev;
      };
      optionsTa.addEventListener("input", refreshOptions);
      refreshOptions();
    }

    el("cancelBtn").addEventListener("click", () => {
      if (isNew) {
        removeAnnotation(ann.id);
        renderMarkers();
        renderAnnotationList();
      }
      closeModal();
    });

    const deleteBtn = el("deleteBtn");
    if (deleteBtn) {
      deleteBtn.addEventListener("click", () => {
        removeAnnotation(ann.id);
        persist();
        renderMarkers();
        renderAnnotationList();
        closeModal();
      });
    }

    el("saveBtn").addEventListener("click", () => {
      const err = applyFormToAnnotation(ann);
      if (err) {
        el("formError").textContent = err;
        return;
      }
      persist();
      renderMarkers();
      renderAnnotationList();
      closeModal();
    });
  }

  function openEditModal(id, opts = {}) {
    const ann = state.annotations.find((a) => a.id === id);
    if (!ann) return;
    stopPlaying();
    modal.innerHTML = buildModalForm(ann, !!opts.isNew);
    modalBackdrop.classList.add("open");
    wireModalForm(ann, !!opts.isNew);
  }

  function closeModal() {
    modalBackdrop.classList.remove("open");
    modal.innerHTML = "";
  }

  // --- import / export / clear -------------------------------------------------

  function stripInternal(ann) {
    const { _pendingX, _pendingY, ...rest } = ann;
    return rest;
  }

  function wireGlobalControls() {
    wirePalette();

    scrub.addEventListener("input", () => {
      stopPlaying();
      loadSlice(Number(scrub.value));
    });

    playBtn.addEventListener("click", () => {
      if (state.playing) {
        stopPlaying();
        return;
      }
      state.playing = true;
      playBtn.textContent = "Pause";
      state.playTimer = setInterval(() => {
        let next = state.currentIndex + 1;
        if (next > state.manifest.sliceCount) next = 1;
        loadSlice(next);
      }, 300);
    });

    exportBtn.addEventListener("click", () => {
      const payload = {
        version: 1,
        dataset: {
          size: state.manifest.size,
          sliceCount: state.manifest.sliceCount,
          axis: state.manifest.axis,
        },
        annotations: state.annotations.map(stripInternal),
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "annotations.json";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    });

    importBtn.addEventListener("click", () => importFile.click());

    importFile.addEventListener("change", async () => {
      const file = importFile.files[0];
      if (!file) return;
      try {
        const parsed = JSON.parse(await file.text());
        if (!parsed || !Array.isArray(parsed.annotations)) throw new Error("Missing annotations array");
        if (state.annotations.length && !confirm("Replace current annotations with the imported file?")) return;
        state.annotations = parsed.annotations.map((a) => ({ ...a, id: a.id || uid() }));
        persist();
        renderMarkers();
        renderAnnotationList();
      } catch (err) {
        alert("Could not import file: " + err.message);
      } finally {
        importFile.value = "";
      }
    });

    clearBtn.addEventListener("click", () => {
      if (!state.annotations.length) return;
      if (!confirm("Delete all annotations across every slice? This cannot be undone.")) return;
      state.annotations = [];
      persist();
      renderMarkers();
      renderAnnotationList();
    });

    modalBackdrop.addEventListener("click", (e) => {
      if (e.target === modalBackdrop) el("cancelBtn")?.click();
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && modalBackdrop.classList.contains("open")) el("cancelBtn")?.click();
    });
  }

  init();
})();
