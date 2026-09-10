

const API_BASE = "http://127.0.0.1:8000";

const state = {
    imageA: null,
    imageB: null,
    running: false,
    threshold: 0.75,
    sweepAngle: 0
};

const $ = id => document.getElementById(id);

const imageA = $("imageA");
const imageB = $("imageB");
const imageBoxA = $("imageBoxA");
const imageBoxB = $("imageBoxB");
const previewA = $("previewA");
const previewB = $("previewB");
const fileNameA = $("fileNameA");
const fileNameB = $("fileNameB");
const analyzeBtn = $("analyzeBtn");
const resetBtn = $("resetAnalysis");
const thresholdInput = $("thresholdInput");
const thresholdValue = $("thresholdValue");
const analysisStage = $("analysisStage");
const analysisPercent = $("analysisPercent");
const progressFill = $("progressFill");
const analysisStatus = $("analysisStatus");
const sensorSelect = $("sensorSelect");
const illuminationSelect = $("illuminationSelect");
const featureSelect = $("featureSelect");
const scaleModeSelect = $("scaleModeSelect");
const sunIncidenceA = $("sunIncidenceA");
const sunIncidenceB = $("sunIncidenceB");
const opticalCanvas = $("opticalCanvas");
const systemStatus = $("systemStatus");
const systemStatusText = $("systemStatusText");

function setText(id, value) {
    const el = $(id);
    if (el) el.textContent = value;
}

function showToast(message) {
    const toast = $("toast");
    const toastMessage = $("toastMessage");
    if (!toast || !toastMessage) {
        console.log(message);
        return;
    }
    toastMessage.textContent = message;
    toast.classList.add("show");
    setTimeout(() => toast.classList.remove("show"), 2600);
}


async function checkBackend() {
    try {
        const response = await fetch(`${API_BASE}/`, { cache: "no-store" });
        if (!response.ok) throw new Error("Backend offline");
        const data = await response.json();
        if (systemStatus) {
            systemStatus.classList.remove("offline");
            systemStatus.classList.add("online");
        }
        if (systemStatusText) systemStatusText.textContent = "BACKEND ONLINE";
        return true;
    } catch (error) {
        if (systemStatus) {
            systemStatus.classList.remove("online");
            systemStatus.classList.add("offline");
        }
        if (systemStatusText) systemStatusText.textContent = "BACKEND OFFLINE";
        return false;
    }
}


const cursor = document.querySelector(".cursor-reticle");
document.addEventListener("mousemove", event => {
    if (!cursor) return;
    cursor.style.left = `${event.clientX}px`;
    cursor.style.top = `${event.clientY}px`;
});

document.querySelectorAll("a, button, select, input, .image-upload").forEach(element => {
    element.addEventListener("mouseenter", () => document.body.classList.add("cursor-active"));
    element.addEventListener("mouseleave", () => document.body.classList.remove("cursor-active"));
});


function handleImage(file, preview, filename, box, which) {
    if (!file || !file.type.startsWith("image/")) {
        showToast("Please select a valid image.");
        return;
    }
    if (file.size > 20 * 1024 * 1024) {
        showToast("Image exceeds 20 MB.");
        return;
    }

    const reader = new FileReader();
    reader.onload = event => {
        if (preview) preview.src = event.target.result;
        if (filename) filename.textContent = file.name;
        if (box) box.classList.add("has-image");
        if (which === "A") state.imageA = file;
        if (which === "B") state.imageB = file;
        showToast(`Observation ${which} loaded.`);
    };
    reader.readAsDataURL(file);
}

function setupImageUpload(input, box, preview, filename, which) {
    if (!input || !box) return;
    box.addEventListener("click", () => input.click());
    input.addEventListener("change", () => {
        if (input.files?.length) handleImage(input.files[0], preview, filename, box, which);
    });
    box.addEventListener("dragover", event => {
        event.preventDefault();
        box.classList.add("dragging");
    });
    box.addEventListener("dragleave", () => box.classList.remove("dragging"));
    box.addEventListener("drop", event => {
        event.preventDefault();
        box.classList.remove("dragging");
        const file = event.dataTransfer.files[0];
        if (file) handleImage(file, preview, filename, box, which);
    });
}

setupImageUpload(imageA, imageBoxA, previewA, fileNameA, "A");
setupImageUpload(imageB, imageBoxB, previewB, fileNameB, "B");

if (thresholdInput) {
    state.threshold = parseFloat(thresholdInput.value);
    thresholdInput.addEventListener("input", () => {
        state.threshold = parseFloat(thresholdInput.value);
        if (thresholdValue) thresholdValue.textContent = state.threshold.toFixed(2);
    });
}


if (sunIncidenceA) {
    sunIncidenceA.addEventListener("input", () => {
        if (sunIncidenceA.value !== "") setText("incidenceValue", `${Number(sunIncidenceA.value).toFixed(1)}°`);
    });
}

if (sunIncidenceB) {
    sunIncidenceB.addEventListener("input", () => {
        if (sunIncidenceA?.value !== "" && sunIncidenceB.value !== "") {
            const difference = Math.abs(Number(sunIncidenceA.value) - Number(sunIncidenceB.value));
            setText("azimuthValue", `Δ ${difference.toFixed(1)}°`);
        }
    });
}

[sensorSelect, illuminationSelect, featureSelect].forEach(select => {
    if (!select) return;
    select.addEventListener("change", () => {
        showToast(`${select.options[select.selectedIndex].text.trim()} selected.`);
    });
});


const pipelineSteps = document.querySelectorAll(".pipeline-step");

function updatePipeline(index) {
    pipelineSteps.forEach((step, i) => step.classList.toggle("active", i <= index));
}

const waitingStages = [
    ["UPLOADING OBSERVATIONS", 15, 0],
    ["NORMALIZING ILLUMINATION", 30, 1],
    ["EXTRACTING SURFACE FEATURES", 48, 2],
    ["MATCHING FEATURES", 65, 2],
    ["RANSAC GEOMETRIC VERIFICATION", 82, 3]
];

function setProgress(text, percent, pipelineIndex) {
    if (analysisStage) analysisStage.textContent = text;
    if (analysisPercent) analysisPercent.textContent = `${percent}%`;
    if (progressFill) progressFill.style.width = `${percent}%`;
    updatePipeline(pipelineIndex);
}

function startProgressAnimation() {
    let i = 0;
    setProgress(...waitingStages[0]);
    return setInterval(() => {
        i = Math.min(i + 1, waitingStages.length - 1);
        setProgress(...waitingStages[i]);
    }, 700);
}


function setResultImage(id, src) {
    const img = $(id);
    if (!img) return;
    if (src) {
        img.src = src;
        img.classList.add("has-result");
    } else {
        img.removeAttribute("src");
        img.classList.remove("has-result");
    }
}

function renderResults(data) {
    setText("featureCount", Number(data.feature_count).toLocaleString());
    setText("matchCount", Number(data.inliers).toLocaleString());
    setText("confidence", `${Number(data.confidence).toFixed(1)}%`);
    setText("registrationError", `${Number(data.rmse).toFixed(2)} px`);
    setText("targetConfidence", `${Number(data.confidence).toFixed(1)}%`);

    setText("benchmarkMethod", data.feature_engine);
    setText("benchmarkFeatures", Number(data.feature_count).toLocaleString());
    setText("benchmarkConfidence", `${Number(data.confidence).toFixed(1)}%`);
    setText("benchmarkRMSE", `${Number(data.rmse).toFixed(2)} px`);
    setText("benchmarkTime", `${Number(data.processing_time).toFixed(2)} s`);

    setText("interpretationTitle", data.interpretation_title);
    setText("interpretationText", data.interpretation_text);
    const metaA = data.metadata?.image_a;
    const metaB = data.metadata?.image_b;
    let resultInfo =
        `Inlier ratio: ${Number(data.inlier_ratio).toFixed(1)}%` +
        ` · Coverage: ${Number(data.coverage).toFixed(1)}%` +
        ` · Transform: ${data.transformation}` +
        ` · Selected scale: ${data.selected_scale}x`;

    if (metaA && metaB) {
        resultInfo +=
            ` · A: ${metaA.original_width}×${metaA.original_height}` +
            ` · B: ${metaB.original_width}×${metaB.original_height}`;
    }

    if (data.sun_angles?.difference != null) {
        resultInfo += ` · Sun-angle difference: ${data.sun_angles.difference}°`;
    }

    setText("researchNote", resultInfo);

    setResultImage("matchVisualization", data.images.matches);
    setResultImage("normalizedAResult", data.images.normalized_a);
    setResultImage("normalizedBResult", data.images.normalized_b);
    setResultImage("registeredResult", data.images.overlay);
}


async function runAnalysis() {
    if (state.running) return;

    if (!state.imageA || !state.imageB) {
        showToast("Load Observation A and B first.");
        return;
    }

    state.running = true;
    if (analyzeBtn) {
        analyzeBtn.disabled = true;
        analyzeBtn.style.opacity = ".55";
    }
    if (analysisStatus) analysisStatus.textContent = "PROCESSING OBSERVATIONS";
    setText("mapStatus", "PROCESSING");

    const progressTimer = startProgressAnimation();

    try {
        const form = new FormData();
        form.append("image_a", state.imageA);
        form.append("image_b", state.imageB);
        form.append("sensor", sensorSelect?.value || "OHRC");
        form.append("illumination_model", illuminationSelect?.value || "clahe");
        form.append("feature_engine", featureSelect?.value || "sift");
        form.append("ratio_threshold", String(state.threshold));
        form.append("scale_mode", scaleModeSelect?.value || "auto");

        if (sunIncidenceA?.value !== "") {
            form.append("sun_incidence_a", sunIncidenceA.value);
        }

        if (sunIncidenceB?.value !== "") {
            form.append("sun_incidence_b", sunIncidenceB.value);
        }

        const response = await fetch(`${API_BASE}/api/analyse`, {
            method: "POST",
            body: form
        });

        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.detail || "Analysis failed.");
        }

        clearInterval(progressTimer);
        setProgress("ANALYSIS COMPLETE", 100, pipelineSteps.length - 1);
        renderResults(data);

        if (analysisStatus) analysisStatus.textContent = "CORRESPONDENCE COMPLETE";
        setText("mapStatus", "MATCH VERIFIED");
        showToast("Real OpenCV correspondence analysis complete.");

        const resultSection = $("results");
        if (resultSection) resultSection.scrollIntoView({ behavior: "smooth", block: "start" });

    } catch (error) {
        clearInterval(progressTimer);
        console.error(error);
        if (analysisStatus) analysisStatus.textContent = "ANALYSIS FAILED";
        setText("mapStatus", "FAILED");
        showToast(error.message || "Backend analysis failed.");
        await checkBackend();
    } finally {
        state.running = false;
        if (analyzeBtn) {
            analyzeBtn.disabled = false;
            analyzeBtn.style.opacity = "1";
        }
    }
}


function resetAnalysis() {
    state.imageA = null;
    state.imageB = null;
    state.running = false;

    if (imageA) imageA.value = "";
    if (imageB) imageB.value = "";
    if (previewA) previewA.removeAttribute("src");
    if (previewB) previewB.removeAttribute("src");
    if (imageBoxA) imageBoxA.classList.remove("has-image");
    if (imageBoxB) imageBoxB.classList.remove("has-image");
    if (fileNameA) fileNameA.textContent = "NO IMAGE SELECTED";
    if (fileNameB) fileNameB.textContent = "NO IMAGE SELECTED";
    if (scaleModeSelect) scaleModeSelect.value = "auto";
    if (sunIncidenceA) sunIncidenceA.value = "";
    if (sunIncidenceB) sunIncidenceB.value = "";

    ["featureCount", "matchCount", "confidence", "registrationError", "targetConfidence",
     "benchmarkMethod", "benchmarkFeatures", "benchmarkConfidence", "benchmarkRMSE", "benchmarkTime"]
        .forEach(id => setText(id, "—"));

    ["matchVisualization", "normalizedAResult", "normalizedBResult", "registeredResult"]
        .forEach(id => setResultImage(id, ""));

    if (progressFill) progressFill.style.width = "0%";
    if (analysisPercent) analysisPercent.textContent = "0%";
    if (analysisStage) analysisStage.textContent = "STANDBY";
    if (analysisStatus) analysisStatus.textContent = "READY FOR OBSERVATIONS";
    setText("mapStatus", "WAITING FOR ANALYSIS");
    setText("interpretationTitle", "Run correspondence to analyse the observation pair.");
    setText("interpretationText", "Results will be calculated by the Python/OpenCV backend from the two uploaded images.");
    setText("researchNote", "CLAHE illumination normalisation, SIFT/ORB feature extraction, RANSAC verification and homography registration are used in the current baseline.");
    updatePipeline(0);
    showToast("Workspace reset.");
}

if (analyzeBtn) analyzeBtn.addEventListener("click", runAnalysis);
if (resetBtn) resetBtn.addEventListener("click", resetAnalysis);

document.addEventListener("keydown", event => {
    if (event.ctrlKey && event.key === "Enter") runAnalysis();
});


let detectionPoints = [];

function resizeOpticalCanvas() {
    if (!opticalCanvas) return;
    const rect = opticalCanvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    opticalCanvas.width = rect.width * dpr;
    opticalCanvas.height = rect.height * dpr;
    const ctx = opticalCanvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    detectionPoints = Array.from({ length: 18 }, () => ({
        x: rect.width * (0.12 + Math.random() * 0.76),
        y: rect.height * (0.18 + Math.random() * 0.64),
        size: 2 + Math.random() * 2,
        pulse: Math.random() * Math.PI * 2
    }));
}

function drawOpticalSystem() {
    if (!opticalCanvas) return;
    const ctx = opticalCanvas.getContext("2d");
    const width = opticalCanvas.clientWidth;
    const height = opticalCanvas.clientHeight;
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = "#080a0c";
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = "rgba(150,165,172,.08)";
    ctx.lineWidth = 1;
    for (let x = 0; x <= width; x += 62) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke();
    }
    for (let y = 0; y <= height; y += 62) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke();
    }

    const moonX = width * .52;
    const moonY = height * .53;
    const moonRadius = Math.min(width, height) * .29;
    const gradient = ctx.createRadialGradient(
        moonX - moonRadius * .3, moonY - moonRadius * .35, moonRadius * .15,
        moonX, moonY, moonRadius
    );
    gradient.addColorStop(0, "#343b3e");
    gradient.addColorStop(.65, "#171b1d");
    gradient.addColorStop(1, "#070809");
    ctx.fillStyle = gradient;
    ctx.beginPath(); ctx.arc(moonX, moonY, moonRadius, 0, Math.PI * 2); ctx.fill();

    ctx.strokeStyle = "rgba(125,145,154,.16)";
    ctx.beginPath(); ctx.ellipse(moonX, moonY, moonRadius * 1.6, moonRadius * .55, -.2, 0, Math.PI * 2); ctx.stroke();

    state.sweepAngle += .008;
    const sweepLength = Math.max(width, height);
    const sweepX = moonX + Math.cos(state.sweepAngle) * sweepLength;
    const sweepY = moonY + Math.sin(state.sweepAngle) * sweepLength;
    ctx.strokeStyle = "rgba(201,154,74,.25)";
    ctx.beginPath(); ctx.moveTo(moonX, moonY); ctx.lineTo(sweepX, sweepY); ctx.stroke();

    detectionPoints.forEach(point => {
        point.pulse += .04;
        const pulse = 1 + Math.sin(point.pulse) * .35;
        ctx.strokeStyle = "rgba(201,154,74,.75)";
        ctx.strokeRect(point.x - point.size * pulse, point.y - point.size * pulse,
                       point.size * 2 * pulse, point.size * 2 * pulse);
    });

    requestAnimationFrame(drawOpticalSystem);
}


const sections = document.querySelectorAll("section[id]");
const navLinks = document.querySelectorAll(".nav-link");

const sectionObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        navLinks.forEach(link => link.classList.remove("active"));
        const active = document.querySelector(`.nav-link[href="#${entry.target.id}"]`);
        if (active) active.classList.add("active");
    });
}, { threshold: .25 });
sections.forEach(section => sectionObserver.observe(section));

const revealElements = document.querySelectorAll(".method-card, .metric-card, .observation-card, .detection-info, .result-panel");
const revealObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.style.opacity = "1";
            entry.target.style.transform = "translateY(0)";
        }
    });
}, { threshold: .12 });

revealElements.forEach(element => {
    element.style.opacity = "0";
    element.style.transform = "translateY(18px)";
    element.style.transition = "opacity .6s ease, transform .6s ease";
    revealObserver.observe(element);
});

window.addEventListener("resize", resizeOpticalCanvas);
resizeOpticalCanvas();
drawOpticalSystem();
checkBackend();
setInterval(checkBackend, 15000);

setTimeout(() => showToast("ChandraSetu interface ready."), 900);
