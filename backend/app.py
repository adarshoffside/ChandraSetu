from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
import base64
import json
import math
import re
import time
import xml.etree.ElementTree as ET
import cv2
import numpy as np

app = FastAPI(title="ChandraSetu Backend", version="2.2")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"]
)

MAX_FILE_BYTES = 20 * 1024 * 1024
MAX_DIMENSION = 1800


@app.get("/")
def home():
    return {
        "status": "online",
        "message": "ChandraSetu backend is working",
        "version": "2.2"
    }


def decode_image(raw):
    array = np.frombuffer(raw, dtype=np.uint8)
    image = cv2.imdecode(array, cv2.IMREAD_COLOR)
    if image is None:
        raise HTTPException(status_code=422, detail="Uploaded file could not be read as an image.")
    return image


def resize_for_processing(image):
    height, width = image.shape[:2]
    longest = max(height, width)
    if longest <= MAX_DIMENSION:
        return image
    scale = MAX_DIMENSION / float(longest)
    return cv2.resize(
        image,
        (int(width * scale), int(height * scale)),
        interpolation=cv2.INTER_AREA
    )


def get_image_metadata(upload, raw, original, processed):
    original_height, original_width = original.shape[:2]
    processed_height, processed_width = processed.shape[:2]
    return {
        "filename": upload.filename or "unknown",
        "content_type": upload.content_type or "unknown",
        "file_size_mb": round(len(raw) / (1024 * 1024), 3),
        "original_width": original_width,
        "original_height": original_height,
        "processed_width": processed_width,
        "processed_height": processed_height
    }


def normalize_illumination(gray, method):
    if method == "disabled":
        return gray, "Illumination normalisation disabled"
    if method == "equalize":
        return cv2.equalizeHist(gray), "Global histogram equalisation"
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    return clahe.apply(gray), "CLAHE illumination normalisation"


def make_detector(engine):
    if engine == "orb":
        return cv2.ORB_create(
            nfeatures=8000,
            scaleFactor=1.2,
            nlevels=8,
            fastThreshold=10
        ), cv2.NORM_HAMMING
    return cv2.SIFT_create(
        nfeatures=8000,
        contrastThreshold=0.01,
        edgeThreshold=15
    ), cv2.NORM_L2


def encode_image(image, quality=88):
    ok, buffer = cv2.imencode(
        ".jpg",
        image,
        [int(cv2.IMWRITE_JPEG_QUALITY), quality]
    )
    if not ok:
        return ""
    encoded = base64.b64encode(buffer).decode("ascii")
    return "data:image/jpeg;base64," + encoded


def find_good_matches(descriptors_a, descriptors_b, norm_type, ratio_threshold):
    matcher = cv2.BFMatcher(norm_type)
    raw_matches = matcher.knnMatch(descriptors_a, descriptors_b, k=2)
    good_matches = []
    for pair in raw_matches:
        if len(pair) != 2:
            continue
        first, second = pair
        if first.distance < ratio_threshold * second.distance:
            good_matches.append(first)
    return good_matches


def uniform_match_filter(matches, keypoints_a, width, height, grid=4, max_per_cell=25):
    buckets = {}
    selected = []
    for match in sorted(matches, key=lambda item: item.distance):
        x, y = keypoints_a[match.queryIdx].pt
        cell_x = min(grid - 1, max(0, int(x / max(width / grid, 1))))
        cell_y = min(grid - 1, max(0, int(y / max(height / grid, 1))))
        cell = (cell_x, cell_y)
        count = buckets.get(cell, 0)
        if count >= max_per_cell:
            continue
        buckets[cell] = count + 1
        selected.append(match)
    return selected


def spatial_coverage(points, width, height, grid=4):
    if points.size == 0:
        return 0.0
    occupied = set()
    cell_width = max(width / grid, 1)
    cell_height = max(height / grid, 1)
    for x, y in points.reshape(-1, 2):
        gx = min(grid - 1, max(0, int(x / cell_width)))
        gy = min(grid - 1, max(0, int(y / cell_height)))
        occupied.add((gx, gy))
    return 100.0 * len(occupied) / float(grid * grid)


def estimate_geometry(points_b, points_a):
    homography, mask = cv2.findHomography(
        points_b,
        points_a,
        cv2.RANSAC,
        5.0,
        maxIters=5000,
        confidence=0.995
    )
    if homography is not None and mask is not None and np.isfinite(homography).all():
        if int(mask.sum()) >= 4:
            return homography, mask, "HOMOGRAPHY"

    affine, affine_mask = cv2.estimateAffinePartial2D(
        points_b.reshape(-1, 2),
        points_a.reshape(-1, 2),
        method=cv2.RANSAC,
        ransacReprojThreshold=5.0,
        maxIters=5000,
        confidence=0.995
    )
    if affine is not None and affine_mask is not None and int(affine_mask.sum()) >= 4:
        matrix = np.eye(3, dtype=np.float64)
        matrix[:2, :] = affine
        return matrix, affine_mask, "AFFINE FALLBACK"

    return None, None, None


def calculate_confidence(inliers, inlier_ratio, rmse, coverage):
    ratio_score = np.clip(inlier_ratio / 100.0, 0.0, 1.0)
    count_score = np.clip(inliers / 80.0, 0.0, 1.0)
    rmse_score = math.exp(-max(rmse, 0.0) / 4.0)
    coverage_score = np.clip(coverage / 100.0, 0.0, 1.0)
    score = 100.0 * (
        0.40 * ratio_score
        + 0.25 * count_score
        + 0.20 * rmse_score
        + 0.15 * coverage_score
    )
    return float(np.clip(score, 0.0, 99.5))


def scale_image(image, scale):
    if abs(scale - 1.0) < 0.001:
        return image
    width = max(32, int(image.shape[1] * scale))
    height = max(32, int(image.shape[0] * scale))
    interpolation = cv2.INTER_CUBIC if scale > 1 else cv2.INTER_AREA
    return cv2.resize(image, (width, height), interpolation=interpolation)


def normalize_field_name(value):
    value = value.split("}")[-1]
    value = re.sub(r"[^a-zA-Z0-9]+", "_", value).strip("_").lower()
    return value


def first_number(value):
    if value is None:
        return None
    match = re.search(r"[-+]?\d+(?:\.\d+)?(?:[eE][-+]?\d+)?", str(value))
    if not match:
        return None
    try:
        return float(match.group(0))
    except ValueError:
        return None


def resolution_to_metres(value, unit, field_name):
    unit_text = normalize_field_name(unit or "")
    name = normalize_field_name(field_name)
    if value is None or value <= 0:
        return None
    if "pixel_per_degree" in unit_text or "pixels_per_degree" in unit_text:
        return None
    if "degree_per_pixel" in unit_text or "degrees_per_pixel" in unit_text:
        return None
    if "kilomet" in unit_text or unit_text.startswith("km") or "km_per_pixel" in unit_text or "km_pixel" in unit_text:
        return value * 1000.0
    if "centimet" in unit_text or unit_text.startswith("cm"):
        return value * 0.01
    if "millimet" in unit_text or unit_text.startswith("mm"):
        return value * 0.001
    if "metre" in unit_text or "meter" in unit_text or unit_text.startswith("m_per") or unit_text.startswith("m_pixel") or unit_text == "m":
        return value
    strong = any(token in name for token in [
        "ground_sample_distance",
        "ground_sampling_distance",
        "ground_resolution",
        "ground_pixel_size"
    ])
    if strong and not unit_text:
        return value
    return None


def metadata_records_from_xml(text):
    records = []
    root = ET.fromstring(text)
    for element in root.iter():
        name = normalize_field_name(element.tag)
        raw = (element.text or "").strip()
        value = first_number(raw)
        unit = ""
        for key, attr_value in element.attrib.items():
            key_name = normalize_field_name(key)
            if "unit" in key_name:
                unit = str(attr_value)
        if value is not None:
            records.append({
                "name": name,
                "value": value,
                "unit": unit,
                "raw": raw
            })
    return records


def metadata_records_from_text(text):
    records = []
    for line in text.splitlines():
        stripped = line.strip()
        if not stripped:
            continue
        if "=" in stripped:
            key, raw_value = stripped.split("=", 1)
        elif ":" in stripped:
            key, raw_value = stripped.split(":", 1)
        else:
            continue
        name = normalize_field_name(key)
        value = first_number(raw_value)
        if value is None:
            continue
        unit_match = re.search(r"(?:<|\[|\()\s*([a-zA-Z]+(?:\s*/\s*[a-zA-Z]+)?)\s*(?:>|\]|\))", raw_value)
        unit = unit_match.group(1) if unit_match else ""
        records.append({
            "name": name,
            "value": value,
            "unit": unit,
            "raw": raw_value.strip()
        })
    return records


def metadata_records_from_json(text):
    data = json.loads(text)
    records = []

    def walk(value, key_name=""):
        if isinstance(value, dict):
            for key, child in value.items():
                walk(child, key)
        elif isinstance(value, list):
            for child in value:
                walk(child, key_name)
        elif isinstance(value, (int, float)):
            records.append({
                "name": normalize_field_name(key_name),
                "value": float(value),
                "unit": "",
                "raw": str(value)
            })
        elif isinstance(value, str):
            number = first_number(value)
            if number is not None:
                records.append({
                    "name": normalize_field_name(key_name),
                    "value": number,
                    "unit": value,
                    "raw": value
                })

    walk(data)
    return records


def choose_metadata_value(records):
    resolution_candidates = []
    incidence_candidates = []
    elevation_candidates = []
    azimuth_candidates = []

    for record in records:
        name = record["name"]
        value = record["value"]
        unit = record.get("unit", "")

        resolution_score = 0
        if "ground_sample_distance" in name or "ground_sampling_distance" in name:
            resolution_score = 120
        elif "ground_resolution" in name or "ground_pixel_size" in name:
            resolution_score = 115
        elif "pixel_resolution" in name or "spatial_resolution" in name:
            resolution_score = 100
        elif "pixel_size" in name or "pixel_scale" in name:
            resolution_score = 85
        elif "resolution" in name and any(token in name for token in ["ground", "spatial", "pixel"]):
            resolution_score = 75

        metres = resolution_to_metres(value, unit, name)
        if resolution_score and metres is not None:
            resolution_candidates.append((resolution_score, metres, record))

        incidence_score = 0
        if "solar_incidence_angle" in name or "sun_incidence_angle" in name:
            incidence_score = 120
        elif "solar_incidence" in name or "sun_incidence" in name:
            incidence_score = 115
        elif "incidence_angle" in name and "emission" not in name:
            incidence_score = 95
        elif name == "incidence" or name.endswith("_incidence"):
            incidence_score = 80
        if incidence_score and 0 <= value <= 180:
            incidence_candidates.append((incidence_score, value, record))

        elevation_score = 0
        if "solar_elevation_angle" in name or "sun_elevation_angle" in name:
            elevation_score = 120
        elif "solar_elevation" in name or "sun_elevation" in name:
            elevation_score = 110
        if elevation_score and -90 <= value <= 90:
            elevation_candidates.append((elevation_score, value, record))

        azimuth_score = 0
        if "solar_azimuth_angle" in name or "sun_azimuth_angle" in name:
            azimuth_score = 120
        elif "solar_azimuth" in name or "sun_azimuth" in name:
            azimuth_score = 110
        elif "azimuth_angle" in name and "spacecraft" not in name:
            azimuth_score = 70
        if azimuth_score and 0 <= value <= 360:
            azimuth_candidates.append((azimuth_score, value, record))

    resolution = max(resolution_candidates, default=None, key=lambda item: item[0])
    incidence = max(incidence_candidates, default=None, key=lambda item: item[0])
    elevation = max(elevation_candidates, default=None, key=lambda item: item[0])
    azimuth = max(azimuth_candidates, default=None, key=lambda item: item[0])

    incidence_value = incidence[1] if incidence else None
    incidence_source = incidence[2]["name"] if incidence else None

    if incidence_value is None and elevation is not None:
        incidence_value = 90.0 - elevation[1]
        incidence_source = elevation[2]["name"] + " converted to incidence"

    return {
        "ground_resolution_m_per_pixel": round(resolution[1], 6) if resolution else None,
        "ground_resolution_source": resolution[2]["name"] if resolution else None,
        "sun_incidence_deg": round(incidence_value, 6) if incidence_value is not None else None,
        "sun_incidence_source": incidence_source,
        "sun_azimuth_deg": round(azimuth[1], 6) if azimuth else None,
        "sun_azimuth_source": azimuth[2]["name"] if azimuth else None
    }


def detect_terrain_feature_type(text):
    lowered = text.lower()

    patterns = [
        r"<(?:terrain_feature_type|feature_type|terrain_type|landform_type|feature_class)[^>]*>\s*([^<]+)",
        r'["\']?(?:terrain_feature_type|feature_type|terrain_type|landform_type|feature_class)["\']?\s*[:=]\s*["\']?([a-zA-Z0-9 _/-]+)'
    ]

    candidates = []

    for pattern in patterns:
        for match in re.finditer(pattern, text, flags=re.IGNORECASE):
            candidates.append(match.group(1).strip().lower())

    candidates.append(lowered)

    for value in candidates:
        if any(token in value for token in ["crater", "impact crater", "impact_crater"]):
            return "crater"

    for value in candidates:
        if any(token in value for token in ["mountain", "peak", "hill", "ridge", "massif"]):
            return "peak_ridge"

    return None


def normalize_terrain_feature_type(value):
    if value is None:
        return None

    text = str(value).strip().lower()

    if "crater" in text:
        return "crater"

    if any(token in text for token in ["mountain", "peak", "hill", "ridge", "massif"]):
        return "peak_ridge"

    return None


@app.post("/api/metadata/extract")
async def extract_metadata(metadata_file: UploadFile = File(...)):
    raw = await metadata_file.read()
    if not raw:
        raise HTTPException(status_code=400, detail="Metadata file is empty.")
    if len(raw) > 5 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Metadata file must be 5 MB or smaller.")

    text = raw.decode("utf-8", errors="ignore")
    filename = (metadata_file.filename or "metadata").lower()
    records = []
    parse_method = "TEXT"

    try:
        if filename.endswith(".json"):
            records = metadata_records_from_json(text)
            parse_method = "JSON"
        elif filename.endswith(".xml") or text.lstrip().startswith("<"):
            records = metadata_records_from_xml(text)
            parse_method = "XML"
        else:
            records = metadata_records_from_text(text)
            parse_method = "TEXT/LBL"
    except Exception:
        records = metadata_records_from_text(text)
        parse_method = "TEXT/LBL FALLBACK"

    detected = choose_metadata_value(records)
    detected["terrain_feature_type"] = detect_terrain_feature_type(text)

    if all(detected[key] is None for key in [
        "ground_resolution_m_per_pixel",
        "sun_incidence_deg",
        "sun_azimuth_deg"
    ]):
        raise HTTPException(
            status_code=422,
            detail="No supported ground-resolution or Sun-angle fields were found in this metadata file."
        )

    return {
        "status": "success",
        "filename": metadata_file.filename or "metadata",
        "parse_method": parse_method,
        "records_scanned": len(records),
        **detected
    }


@app.post("/api/analyse")
async def analyse(
    image_a: UploadFile = File(...),
    image_b: UploadFile = File(...),
    sensor: str = Form("OHRC"),
    illumination_model: str = Form("clahe"),
    feature_engine: str = Form("sift"),
    ratio_threshold: float = Form(0.75),
    scale_mode: str = Form("auto"),
    sun_incidence_a: float | None = Form(None),
    sun_incidence_b: float | None = Form(None)
):
    started = time.perf_counter()
    raw_a = await image_a.read()
    raw_b = await image_b.read()

    if len(raw_a) > MAX_FILE_BYTES or len(raw_b) > MAX_FILE_BYTES:
        raise HTTPException(status_code=413, detail="Each image must be 20 MB or smaller.")

    if feature_engine not in {"sift", "orb"}:
        raise HTTPException(status_code=400, detail="Feature engine must be SIFT or ORB.")

    if illumination_model not in {"clahe", "equalize", "disabled"}:
        illumination_model = "clahe"

    ratio_threshold = float(np.clip(ratio_threshold, 0.55, 0.90))
    scale_mode = scale_mode if scale_mode in {"auto", "off"} else "auto"

    for value, label in [
        (sun_incidence_a, "Image A incidence"),
        (sun_incidence_b, "Image B incidence")
    ]:
        if value is not None and not 0 <= value <= 180:
            raise HTTPException(status_code=400, detail=label + " must be between 0 and 180 degrees.")

    original_a = decode_image(raw_a)
    original_b = decode_image(raw_b)
    image_a_color = resize_for_processing(original_a)
    image_b_color = resize_for_processing(original_b)

    metadata_a = get_image_metadata(image_a, raw_a, original_a, image_a_color)
    metadata_b = get_image_metadata(image_b, raw_b, original_b, image_b_color)

    gray_a = cv2.cvtColor(image_a_color, cv2.COLOR_BGR2GRAY)
    gray_b = cv2.cvtColor(image_b_color, cv2.COLOR_BGR2GRAY)
    normalized_a, normalization_label = normalize_illumination(gray_a, illumination_model)
    normalized_b, _ = normalize_illumination(gray_b, illumination_model)

    detector, norm_type = make_detector(feature_engine)
    keypoints_a, descriptors_a = detector.detectAndCompute(normalized_a, None)

    if descriptors_a is None or len(keypoints_a) < 4:
        raise HTTPException(status_code=422, detail="Image A does not contain enough stable surface features.")

    scales = [0.75, 1.0, 1.25] if scale_mode == "auto" else [1.0]
    best_result = None
    best_attempt_matches = 0
    best_attempt_scale = 1.0
    h_a, w_a = normalized_a.shape[:2]

    for scale in scales:
        scaled_b = scale_image(normalized_b, scale)
        keypoints_b, descriptors_b = detector.detectAndCompute(scaled_b, None)
        if descriptors_b is None or len(keypoints_b) < 4:
            continue

        good_matches = find_good_matches(
            descriptors_a,
            descriptors_b,
            norm_type,
            ratio_threshold
        )

        if len(good_matches) > best_attempt_matches:
            best_attempt_matches = len(good_matches)
            best_attempt_scale = scale

        if len(good_matches) < 4:
            continue

        uniform_matches = uniform_match_filter(
            good_matches,
            keypoints_a,
            w_a,
            h_a,
            grid=4,
            max_per_cell=25
        )

        if len(uniform_matches) < 4:
            uniform_matches = good_matches

        points_a = np.float32([
            keypoints_a[match.queryIdx].pt
            for match in uniform_matches
        ]).reshape(-1, 1, 2)

        points_b = np.float32([
            keypoints_b[match.trainIdx].pt
            for match in uniform_matches
        ]).reshape(-1, 1, 2)

        transform_scaled, mask, transform_type = estimate_geometry(points_b, points_a)
        if transform_scaled is None or mask is None:
            continue

        inlier_mask = mask.ravel().astype(bool)
        inliers = int(inlier_mask.sum())
        if inliers < 4:
            continue

        inlier_points_a = points_a[inlier_mask].reshape(-1, 1, 2)
        inlier_points_b = points_b[inlier_mask].reshape(-1, 1, 2)
        projected_b = cv2.perspectiveTransform(inlier_points_b, transform_scaled)
        errors = np.linalg.norm(projected_b - inlier_points_a, axis=2).reshape(-1)
        rmse = float(np.sqrt(np.mean(errors ** 2)))
        inlier_ratio = 100.0 * inliers / max(len(uniform_matches), 1)
        quality = inliers * (inlier_ratio / 100.0) / (1.0 + rmse)

        if best_result is None or quality > best_result["quality"]:
            best_result = {
                "quality": quality,
                "scale": scale,
                "scaled_b": scaled_b,
                "keypoints_b": keypoints_b,
                "uniform_matches": uniform_matches,
                "good_match_count": len(good_matches),
                "transform_scaled": transform_scaled,
                "transform_type": transform_type,
                "inlier_mask": inlier_mask,
                "inliers": inliers,
                "inlier_points_a": inlier_points_a,
                "rmse": rmse,
                "inlier_ratio": inlier_ratio
            }

    if best_result is None:
        raise HTTPException(
            status_code=422,
            detail=(
                "No stable geometric transformation was found. "
                f"Best scale {best_attempt_scale} produced {best_attempt_matches} candidate matches. "
                "Make sure both images show the same lunar terrain. Try CLAHE, SIFT and a ratio threshold around 0.75 to 0.80."
            )
        )

    scale = best_result["scale"]
    transform_scaled = best_result["transform_scaled"]
    inlier_mask = best_result["inlier_mask"]
    uniform_matches = best_result["uniform_matches"]
    inliers = best_result["inliers"]
    rmse = best_result["rmse"]
    inlier_ratio = best_result["inlier_ratio"]

    scale_matrix = np.array(
        [[scale, 0, 0], [0, scale, 0], [0, 0, 1]],
        dtype=np.float64
    )
    final_transform = transform_scaled @ scale_matrix

    coverage = spatial_coverage(best_result["inlier_points_a"], w_a, h_a, grid=4)
    confidence_score = calculate_confidence(inliers, inlier_ratio, rmse, coverage)

    registered_b = cv2.warpPerspective(
        image_b_color,
        final_transform,
        (w_a, h_a)
    )
    overlay = cv2.addWeighted(image_a_color, 0.5, registered_b, 0.5, 0)

    inlier_matches = [
        match
        for match, keep in zip(uniform_matches, inlier_mask)
        if keep
    ]

    match_image = cv2.drawMatches(
        cv2.cvtColor(normalized_a, cv2.COLOR_GRAY2BGR),
        keypoints_a,
        cv2.cvtColor(best_result["scaled_b"], cv2.COLOR_GRAY2BGR),
        best_result["keypoints_b"],
        inlier_matches[:100],
        None,
        flags=cv2.DrawMatchesFlags_NOT_DRAW_SINGLE_POINTS
    )

    incidence_difference = None
    if sun_incidence_a is not None and sun_incidence_b is not None:
        incidence_difference = round(abs(sun_incidence_a - sun_incidence_b), 3)

    if confidence_score >= 80 and rmse < 3.0:
        title = "Strong geometric correspondence detected."
        text = "The two lunar observations contain a stable and reliable terrain correspondence."
    elif confidence_score >= 55:
        title = "Moderate geometric correspondence detected."
        text = "A usable registration was found, but some matches are less stable or less uniformly distributed."
    else:
        title = "Low-confidence correspondence detected."
        text = "A transformation was found, but the result should be treated carefully."

    processing_time = time.perf_counter() - started

    return {
        "status": "success",
        "message": "Real OpenCV analysis complete",
        "sensor": sensor,
        "feature_engine": feature_engine.upper(),
        "normalization_label": normalization_label,
        "transformation": best_result["transform_type"],
        "scale_mode": scale_mode,
        "selected_scale": round(scale, 3),
        "feature_count": len(keypoints_a) + len(best_result["keypoints_b"]),
        "features_a": len(keypoints_a),
        "features_b": len(best_result["keypoints_b"]),
        "candidate_matches": best_result["good_match_count"],
        "uniform_matches": len(uniform_matches),
        "inliers": inliers,
        "inlier_ratio": round(inlier_ratio, 3),
        "coverage": round(coverage, 3),
        "rmse": round(rmse, 4),
        "confidence": round(confidence_score, 3),
        "processing_time": round(processing_time, 4),
        "metadata": {
            "image_a": metadata_a,
            "image_b": metadata_b
        },
        "sun_angles": {
            "incidence_a": sun_incidence_a,
            "incidence_b": sun_incidence_b,
            "difference": incidence_difference
        },
        "interpretation_title": title,
        "interpretation_text": text,
        "images": {
            "normalized_a": encode_image(normalized_a),
            "normalized_b": encode_image(normalized_b),
            "matches": encode_image(match_image),
            "registered": encode_image(registered_b),
            "overlay": encode_image(overlay)
        }
    }


@app.post("/api/terrain/measure")
def terrain_measure(
    measurement_type: str = Form(...),
    pixel_distance: float = Form(...),
    ground_resolution: float = Form(...),
    sun_incidence: float | None = Form(None),
    terrain_feature_type: str | None = Form(None)
):
    allowed = {"crater_diameter", "crater_depth", "hill_height"}

    if measurement_type not in allowed:
        raise HTTPException(status_code=400, detail="Invalid terrain measurement type.")

    feature_type = normalize_terrain_feature_type(terrain_feature_type)

    if feature_type == "crater" and measurement_type == "hill_height":
        raise HTTPException(
            status_code=422,
            detail="Terrain type mismatch: this region is identified as a CRATER. Hill / ridge height cannot be used here. Select CRATER DEPTH or CRATER DIAMETER."
        )

    if feature_type == "peak_ridge" and measurement_type in {"crater_diameter", "crater_depth"}:
        raise HTTPException(
            status_code=422,
            detail="Terrain type mismatch: this region is identified as a PEAK / RIDGE. Select HILL / RIDGE HEIGHT."
        )

    if pixel_distance <= 0:
        raise HTTPException(status_code=400, detail="Pixel distance must be greater than zero.")

    if ground_resolution <= 0:
        raise HTTPException(status_code=400, detail="Ground resolution must be greater than zero.")

    ground_distance = pixel_distance * ground_resolution

    if measurement_type == "crater_diameter":
        return {
            "status": "success",
            "measurement_type": measurement_type,
            "terrain_feature_type": feature_type,
            "feature_validation": "compatible" if feature_type else "unverified",
            "pixel_distance": round(pixel_distance, 3),
            "ground_resolution": round(ground_resolution, 6),
            "ground_distance_m": round(ground_distance, 3),
            "result_m": round(ground_distance, 3),
            "result_label": "Estimated crater diameter",
            "method": "Pixel distance × ground resolution",
            "warning": "Diameter accuracy depends on the ground resolution and where the two rim points are selected."
        }

    if sun_incidence is None:
        raise HTTPException(status_code=400, detail="Sun incidence angle is required for depth or height estimation.")

    if not 0 < sun_incidence < 90:
        raise HTTPException(status_code=400, detail="Sun incidence angle must be between 0 and 90 degrees for shadow-based estimation.")

    solar_elevation = 90.0 - sun_incidence
    relief = ground_distance * math.tan(math.radians(solar_elevation))

    if measurement_type == "crater_depth":
        result_label = "Estimated crater depth"
    else:
        result_label = "Estimated hill height"

    warning = "Shadow-based estimate. It assumes locally level terrain, a correct ground resolution, a correct Sun incidence angle, and that the selected line follows the shadow direction."

    if sun_incidence < 10 or sun_incidence > 85:
        warning += " The selected Sun geometry is extreme, so the estimate may be unstable."

    return {
        "status": "success",
        "measurement_type": measurement_type,
        "terrain_feature_type": feature_type,
        "feature_validation": "compatible" if feature_type else "unverified",
        "pixel_distance": round(pixel_distance, 3),
        "ground_resolution": round(ground_resolution, 6),
        "ground_distance_m": round(ground_distance, 3),
        "sun_incidence": round(sun_incidence, 3),
        "solar_elevation": round(solar_elevation, 3),
        "result_m": round(relief, 3),
        "result_label": result_label,
        "method": "Shadow length × tan(solar elevation)",
        "warning": warning
    }

