

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

const terrainCanvas = $("terrainCanvas");
const terrainEmpty = $("terrainEmpty");
const terrainPointStatus = $("terrainPointStatus");
const terrainInstruction = $("terrainInstruction");
const terrainSource = $("terrainSource");
const terrainMeasurementType = $("terrainMeasurementType");
const terrainGsd = $("terrainGsd");
const terrainSunIncidence = $("terrainSunIncidence");
const terrainLoadBtn = $("terrainLoadBtn");
const terrainCalculateBtn = $("terrainCalculateBtn");
const terrainClearBtn = $("terrainClearBtn");

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
    terrainState.image = null;
    terrainState.points = [];
    terrainState.canvasScale = 1;
    if (terrainCanvas) {
        const ctx = terrainCanvas.getContext("2d");
        ctx.clearRect(0, 0, terrainCanvas.width, terrainCanvas.height);
        terrainCanvas.width = 300;
        terrainCanvas.height = 180;
    }
    if (terrainEmpty) terrainEmpty.style.display = "grid";
    if (terrainPointStatus) terrainPointStatus.textContent = "SELECT AN IMAGE";
    if (terrainGsd) terrainGsd.value = "";
    if (terrainSunIncidence) terrainSunIncidence.value = "";
    if (terrainSource) terrainSource.value = "A";
    if (terrainMeasurementType) terrainMeasurementType.value = "crater_depth";
    resetTerrainResults();
    setTerrainInstruction();
    syncTerrainSunAngle();
    updatePipeline(0);
    showToast("Workspace reset.");
}

if (analyzeBtn) analyzeBtn.addEventListener("click", runAnalysis);
if (resetBtn) resetBtn.addEventListener("click", resetAnalysis);

document.addEventListener("keydown", event => {
    if (event.ctrlKey && event.key === "Enter") runAnalysis();
});


const terrainState = {
    image: null,
    source: "A",
    points: [],
    canvasScale: 1
};

function terrainPreviewForSource() {
    return terrainSource?.value === "B" ? previewB : previewA;
}

function terrainFileForSource() {
    return terrainSource?.value === "B" ? state.imageB : state.imageA;
}

function setTerrainInstruction() {
    if (!terrainMeasurementType || !terrainInstruction) return;
    if (terrainMeasurementType.value === "crater_diameter") {
        terrainInstruction.textContent = "Click two opposite points on the crater rim, then press CALCULATE.";
    } else if (terrainMeasurementType.value === "crater_depth") {
        terrainInstruction.textContent = "Click the two endpoints of the crater shadow in the shadow direction, then press CALCULATE.";
    } else {
        terrainInstruction.textContent = "Click the two endpoints of the hill or ridge shadow in the shadow direction, then press CALCULATE.";
    }
}

function syncTerrainSunAngle() {
    if (!terrainSunIncidence || !terrainMeasurementType) return;
    const diameterMode = terrainMeasurementType.value === "crater_diameter";
    terrainSunIncidence.disabled = diameterMode;
    if (diameterMode) {
        terrainSunIncidence.value = "";
        return;
    }
    const sourceValue = terrainSource?.value === "B" ? sunIncidenceB?.value : sunIncidenceA?.value;
    if (sourceValue !== undefined && sourceValue !== "") {
        terrainSunIncidence.value = sourceValue;
    }
}

function resetTerrainResults() {
    setText("terrainPixelDistance", "—");
    setText("terrainGroundDistance", "—");
    setText("terrainResultValue", "—");
    setText("terrainSolarElevation", "—");
    setText("terrainResultName", "ESTIMATED RELIEF");
    setText("terrainResultMethod", "WAITING FOR MEASUREMENT");
    setText("terrainWarning", "Depth and height are estimates. Use the real image ground resolution and Sun incidence angle from mission metadata for meaningful values.");
}

function drawTerrainCanvas() {
    if (!terrainCanvas) return;
    const ctx = terrainCanvas.getContext("2d");
    ctx.clearRect(0, 0, terrainCanvas.width, terrainCanvas.height);

    if (!terrainState.image) return;

    ctx.drawImage(
        terrainState.image,
        0,
        0,
        terrainCanvas.width,
        terrainCanvas.height
    );

    terrainState.points.forEach((point, index) => {
        const radius = Math.max(5, Math.min(12, terrainCanvas.width / 120));
        ctx.beginPath();
        ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
        ctx.fillStyle = "#c99a4a";
        ctx.fill();
        ctx.lineWidth = Math.max(2, terrainCanvas.width / 700);
        ctx.strokeStyle = "#ffffff";
        ctx.stroke();
        ctx.font = `${Math.max(16, terrainCanvas.width / 60)}px monospace`;
        ctx.fillStyle = "#ffffff";
        ctx.fillText(String(index + 1), point.x + radius + 5, point.y - radius - 3);
    });

    if (terrainState.points.length === 2) {
        const [a, b] = terrainState.points;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.lineWidth = Math.max(2, terrainCanvas.width / 600);
        ctx.strokeStyle = "#c99a4a";
        ctx.stroke();
    }
}

function terrainPixelDistance() {
    if (terrainState.points.length !== 2) return null;
    const [a, b] = terrainState.points;
    const canvasDistance = Math.hypot(b.x - a.x, b.y - a.y);
    return canvasDistance / terrainState.canvasScale;
}

function loadTerrainImage() {
    if (!terrainCanvas) return;
    const file = terrainFileForSource();
    const preview = terrainPreviewForSource();

    if (!file || !preview?.src) {
        showToast(`Load Observation ${terrainSource?.value || "A"} first.`);
        return;
    }

    const image = new Image();
    image.onload = () => {
        const maxDimension = 1400;
        const longest = Math.max(image.naturalWidth, image.naturalHeight);
        const scale = Math.min(1, maxDimension / longest);
        terrainCanvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
        terrainCanvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
        terrainState.image = image;
        terrainState.source = terrainSource?.value || "A";
        terrainState.points = [];
        terrainState.canvasScale = scale;
        if (terrainEmpty) terrainEmpty.style.display = "none";
        if (terrainPointStatus) terrainPointStatus.textContent = "CLICK POINT 1";
        resetTerrainResults();
        syncTerrainSunAngle();
        setTerrainInstruction();
        drawTerrainCanvas();
        showToast(`Observation ${terrainState.source} loaded for terrain measurement.`);
    };
    image.src = preview.src;
}

function clearTerrainPoints() {
    terrainState.points = [];
    if (terrainPointStatus) {
        terrainPointStatus.textContent = terrainState.image ? "CLICK POINT 1" : "SELECT AN IMAGE";
    }
    resetTerrainResults();
    drawTerrainCanvas();
}

async function calculateTerrainMeasurement() {
    if (terrainState.points.length !== 2) {
        showToast("Select exactly two points on the terrain image first.");
        return;
    }

    const pixelDistance = terrainPixelDistance();
    const gsd = Number(terrainGsd?.value);
    const measurementType = terrainMeasurementType?.value || "crater_depth";

    if (!Number.isFinite(gsd) || gsd <= 0) {
        showToast("Enter the real ground resolution in metres per pixel.");
        return;
    }

    const form = new FormData();
    form.append("measurement_type", measurementType);
    form.append("pixel_distance", String(pixelDistance));
    form.append("ground_resolution", String(gsd));

    if (measurementType !== "crater_diameter") {
        const incidence = Number(terrainSunIncidence?.value);
        if (!Number.isFinite(incidence) || incidence <= 0 || incidence >= 90) {
            showToast("Enter a Sun incidence angle between 0 and 90 degrees.");
            return;
        }
        form.append("sun_incidence", String(incidence));
    }

    if (terrainCalculateBtn) {
        terrainCalculateBtn.disabled = true;
        terrainCalculateBtn.style.opacity = ".55";
    }

    try {
        const response = await fetch(`${API_BASE}/api/terrain/measure`, {
            method: "POST",
            body: form
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.detail || "Terrain measurement failed.");

        setText("terrainPixelDistance", `${Number(data.pixel_distance).toFixed(1)} px`);
        setText("terrainGroundDistance", formatTerrainDistance(data.ground_distance_m));
        setText("terrainResultName", data.result_label.toUpperCase());
        setText("terrainResultValue", formatTerrainDistance(data.result_m));
        setText("terrainResultMethod", data.method.toUpperCase());
        setText(
            "terrainSolarElevation",
            data.solar_elevation == null ? "N/A" : `${Number(data.solar_elevation).toFixed(1)}°`
        );
        setText("terrainWarning", data.warning);
        showToast("Terrain measurement calculated.");
    } catch (error) {
        console.error(error);
        showToast(error.message || "Terrain measurement failed.");
    } finally {
        if (terrainCalculateBtn) {
            terrainCalculateBtn.disabled = false;
            terrainCalculateBtn.style.opacity = "1";
        }
    }
}

function formatTerrainDistance(value) {
    const metres = Number(value);
    if (!Number.isFinite(metres)) return "—";
    if (metres >= 1000) return `${(metres / 1000).toFixed(3)} km`;
    if (metres >= 10) return `${metres.toFixed(1)} m`;
    return `${metres.toFixed(3)} m`;
}

if (terrainCanvas) {
    terrainCanvas.addEventListener("click", event => {
        if (!terrainState.image) {
            showToast("Load an observation into the terrain viewer first.");
            return;
        }

        const rect = terrainCanvas.getBoundingClientRect();
        const x = (event.clientX - rect.left) * terrainCanvas.width / rect.width;
        const y = (event.clientY - rect.top) * terrainCanvas.height / rect.height;

        if (terrainState.points.length >= 2) terrainState.points = [];
        terrainState.points.push({ x, y });

        if (terrainState.points.length === 1) {
            if (terrainPointStatus) terrainPointStatus.textContent = "CLICK POINT 2";
        } else {
            const distance = terrainPixelDistance();
            if (terrainPointStatus) terrainPointStatus.textContent = `${distance.toFixed(1)} PX SELECTED`;
            setText("terrainPixelDistance", `${distance.toFixed(1)} px`);
        }

        drawTerrainCanvas();
    });
}

if (terrainLoadBtn) terrainLoadBtn.addEventListener("click", loadTerrainImage);
if (terrainClearBtn) terrainClearBtn.addEventListener("click", clearTerrainPoints);
if (terrainCalculateBtn) terrainCalculateBtn.addEventListener("click", calculateTerrainMeasurement);

if (terrainSource) {
    terrainSource.addEventListener("change", () => {
        clearTerrainPoints();
        syncTerrainSunAngle();
    });
}

if (terrainMeasurementType) {
    terrainMeasurementType.addEventListener("change", () => {
        clearTerrainPoints();
        syncTerrainSunAngle();
        setTerrainInstruction();
    });
}

setTerrainInstruction();
syncTerrainSunAngle();


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
