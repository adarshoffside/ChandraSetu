from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
import base64
import math
import time

import cv2
import numpy as np

app = FastAPI(title="ChandraSetu Backend", version="1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

MAX_FILE_BYTES = 20 * 1024 * 1024
MAX_DIMENSION = 1800


@app.get("/")
def home():
    return {
        "status": "online",
        "message": "ChandraSetu backend is working"
    }


def decode_image(raw: bytes) -> np.ndarray:
    array = np.frombuffer(raw, dtype=np.uint8)
    image = cv2.imdecode(array, cv2.IMREAD_COLOR)
    if image is None:
        raise HTTPException(status_code=422, detail="One of the uploaded files is not a readable image.")
    return image


def resize_for_processing(image: np.ndarray) -> np.ndarray:
    height, width = image.shape[:2]
    longest = max(height, width)
    if longest <= MAX_DIMENSION:
        return image
    scale = MAX_DIMENSION / float(longest)
    return cv2.resize(
        image,
        (int(width * scale), int(height * scale)),
        interpolation=cv2.INTER_AREA,
    )


def normalize_illumination(gray: np.ndarray, method: str) -> tuple[np.ndarray, str]:
    if method == "disabled":
        return gray, "Illumination normalisation disabled"

    if method == "equalize":
        return cv2.equalizeHist(gray), "Global histogram equalisation"

    # Default: CLAHE. This is a real, practical illumination-normalisation baseline.
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    normalized = clahe.apply(gray)
    return normalized, "CLAHE illumination normalisation"


def make_detector(engine: str):
    if engine == "orb":
        return cv2.ORB_create(nfeatures=5000, scaleFactor=1.2, nlevels=8, fastThreshold=10), cv2.NORM_HAMMING

    # Default to SIFT because it is scale and rotation robust and works well as a classical baseline.
    return cv2.SIFT_create(nfeatures=5000, contrastThreshold=0.02, edgeThreshold=12), cv2.NORM_L2


def encode_image(image: np.ndarray, quality: int = 88) -> str:
    ok, buffer = cv2.imencode(".jpg", image, [int(cv2.IMWRITE_JPEG_QUALITY), quality])
    if not ok:
        return ""
    encoded = base64.b64encode(buffer).decode("ascii")
    return f"data:image/jpeg;base64,{encoded}"


def spatial_coverage(points: np.ndarray, width: int, height: int, grid: int = 4) -> float:
    if points.size == 0:
        return 0.0
    occupied = set()
    cell_w = max(width / grid, 1)
    cell_h = max(height / grid, 1)
    for x, y in points.reshape(-1, 2):
        gx = min(grid - 1, max(0, int(x / cell_w)))
        gy = min(grid - 1, max(0, int(y / cell_h)))
        occupied.add((gx, gy))
    return 100.0 * len(occupied) / float(grid * grid)


def calculate_confidence(inliers: int, inlier_ratio: float, rmse: float, coverage: float) -> float:
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


@app.post("/api/analyse")
async def analyse(
    image_a: UploadFile = File(...),
    image_b: UploadFile = File(...),
    sensor: str = Form("OHRC"),
    illumination_model: str = Form("clahe"),
    feature_engine: str = Form("sift"),
    ratio_threshold: float = Form(0.75),
):
    started = time.perf_counter()

    raw_a = await image_a.read()
    raw_b = await image_b.read()

    if len(raw_a) > MAX_FILE_BYTES or len(raw_b) > MAX_FILE_BYTES:
        raise HTTPException(status_code=413, detail="Each image must be 20 MB or smaller.")

    if feature_engine not in {"sift", "orb"}:
        raise HTTPException(status_code=400, detail="Current working backend supports SIFT and ORB only.")

    if illumination_model not in {"clahe", "equalize", "disabled"}:
        illumination_model = "clahe"

    ratio_threshold = float(np.clip(ratio_threshold, 0.55, 0.90))

    image_a_color = resize_for_processing(decode_image(raw_a))
    image_b_color = resize_for_processing(decode_image(raw_b))

    gray_a = cv2.cvtColor(image_a_color, cv2.COLOR_BGR2GRAY)
    gray_b = cv2.cvtColor(image_b_color, cv2.COLOR_BGR2GRAY)

    normalized_a, normalization_label = normalize_illumination(gray_a, illumination_model)
    normalized_b, _ = normalize_illumination(gray_b, illumination_model)

    detector, norm_type = make_detector(feature_engine)
    keypoints_a, descriptors_a = detector.detectAndCompute(normalized_a, None)
    keypoints_b, descriptors_b = detector.detectAndCompute(normalized_b, None)

    if descriptors_a is None or descriptors_b is None or len(keypoints_a) < 4 or len(keypoints_b) < 4:
        raise HTTPException(
            status_code=422,
            detail="Not enough stable features were found. Try images with more visible lunar terrain detail."
        )

    matcher = cv2.BFMatcher(norm_type)
    raw_matches = matcher.knnMatch(descriptors_a, descriptors_b, k=2)

    good_matches = []
    for pair in raw_matches:
        if len(pair) != 2:
            continue
        first, second = pair
        if first.distance < ratio_threshold * second.distance:
            good_matches.append(first)

    if len(good_matches) < 4:
        raise HTTPException(
            status_code=422,
            detail=f"Only {len(good_matches)} reliable matches were found. Try a closer pair of images or raise the match ratio threshold slightly."
        )

    points_a = np.float32([keypoints_a[m.queryIdx].pt for m in good_matches]).reshape(-1, 1, 2)
    points_b = np.float32([keypoints_b[m.trainIdx].pt for m in good_matches]).reshape(-1, 1, 2)

    # B is the moving/source image. The homography maps B into A (the reference image).
    homography, mask = cv2.findHomography(
        points_b,
        points_a,
        cv2.RANSAC,
        4.0,
        maxIters=5000,
        confidence=0.995,
    )

    if homography is None or mask is None:
        raise HTTPException(
            status_code=422,
            detail="RANSAC could not find a stable geometric transformation for this image pair."
        )

    inlier_mask = mask.ravel().astype(bool)
    inlier_matches = [m for m, keep in zip(good_matches, inlier_mask) if keep]
    inliers = len(inlier_matches)

    if inliers < 4:
        raise HTTPException(status_code=422, detail="Too few geometrically verified inliers for registration.")

    inlier_points_a = points_a[inlier_mask].reshape(-1, 1, 2)
    inlier_points_b = points_b[inlier_mask].reshape(-1, 1, 2)

    projected_b = cv2.perspectiveTransform(inlier_points_b, homography)
    errors = np.linalg.norm(projected_b - inlier_points_a, axis=2).reshape(-1)
    rmse = float(np.sqrt(np.mean(errors ** 2)))

    inlier_ratio = 100.0 * inliers / max(len(good_matches), 1)
    h_a, w_a = normalized_a.shape[:2]
    coverage = spatial_coverage(inlier_points_a, w_a, h_a, grid=4)
    confidence_score = calculate_confidence(inliers, inlier_ratio, rmse, coverage)

    registered_b = cv2.warpPerspective(image_b_color, homography, (w_a, h_a))

    if image_a_color.shape[:2] != registered_b.shape[:2]:
        reference_for_overlay = cv2.resize(image_a_color, (w_a, h_a), interpolation=cv2.INTER_AREA)
    else:
        reference_for_overlay = image_a_color

    overlay = cv2.addWeighted(reference_for_overlay, 0.5, registered_b, 0.5, 0)

    # Draw at most 100 verified inliers so the result remains readable.
    display_matches = inlier_matches[:100]
    match_image = cv2.drawMatches(
        cv2.cvtColor(normalized_a, cv2.COLOR_GRAY2BGR),
        keypoints_a,
        cv2.cvtColor(normalized_b, cv2.COLOR_GRAY2BGR),
        keypoints_b,
        display_matches,
        None,
        flags=cv2.DrawMatchesFlags_NOT_DRAW_SINGLE_POINTS,
    )

    if confidence_score >= 80 and rmse < 3.0:
        title = "Strong geometric correspondence detected."
        text = "The verified feature matches support a stable registration between the two lunar observations."
    elif confidence_score >= 55:
        title = "Moderate geometric correspondence detected."
        text = "A usable transformation was found, but the pair contains fewer or less uniformly distributed verified matches."
    else:
        title = "Low-confidence correspondence detected."
        text = "The backend found a transformation, but this image pair should be treated carefully and may need different parameters or a stronger multimodal method."

    processing_time = time.perf_counter() - started

    return {
        "status": "success",
        "message": "Real OpenCV analysis complete",
        "sensor": sensor,
        "feature_engine": feature_engine.upper(),
        "normalization_label": normalization_label,
        "feature_count": len(keypoints_a) + len(keypoints_b),
        "features_a": len(keypoints_a),
        "features_b": len(keypoints_b),
        "candidate_matches": len(good_matches),
        "inliers": inliers,
        "inlier_ratio": round(inlier_ratio, 3),
        "coverage": round(coverage, 3),
        "rmse": round(rmse, 4),
        "confidence": round(confidence_score, 3),
        "processing_time": round(processing_time, 4),
        "interpretation_title": title,
        "interpretation_text": text,
        "images": {
            "normalized_a": encode_image(normalized_a),
            "normalized_b": encode_image(normalized_b),
            "matches": encode_image(match_image),
            "registered": encode_image(registered_b),
            "overlay": encode_image(overlay),
        },
    }
