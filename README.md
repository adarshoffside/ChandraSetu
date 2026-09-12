ChandraSetu

Multi-modal, Sun-angle and scale-invariant lunar image correspondence and registration

ChandraSetu is a computer-vision based system designed to find correspondences between lunar optical images captured under different viewing conditions. The project focuses on image registration, feature matching, terrain measurement, and validation for Chandrayaan-2 style lunar imagery.

Problem Statement ID: 26166

Overview

Lunar images of the same terrain can look very different because of:

Different Sun angles

Illumination and shadow changes

Rotation and viewpoint variation

Scale and resolution differences

Different optical sensors

ChandraSetu attempts to identify the same physical lunar features despite these changes.

Core idea: Appearance may change, but the lunar terrain remains the same.

Main Features

1. Lunar Image Registration

Upload Observation A and Observation B

Upload corresponding XML metadata

Illumination normalization using CLAHE

Feature extraction using SIFT / ORB

Feature matching using BFMatcher and KNN

Lowe's Ratio Test for ambiguous-match rejection

RANSAC for geometric verification

Homography-based image alignment

Registered image and overlay visualization

2. Registration Metrics

The system reports:

RMSE

Inlier count

Inlier ratio

Spatial coverage

Processing time

Confidence score

Selected scale / transformation information

3. Terrain Measurement

ChandraSetu can estimate:

Crater diameter

Crater depth

Hill / ridge height

The calculation uses image pixel measurements together with metadata such as:

Ground Sample Distance (GSD)

Sun incidence angle

Solar elevation

4. Metadata Support

The backend can read metadata values from XML/LBL style files when available, including:

Ground resolution / GSD

Sun incidence angle

Sun azimuth angle

Solar elevation

Image information

5. Validation Architecture

Terrain measurements are treated as estimates.

For stronger validation, estimated terrain values can be compared against an independent lunar elevation reference such as:

TMC-2 DEM / DTM

LRO LOLA elevation data

The system can then report:

Estimated value

Reference value

Absolute error

Percentage error

Computer Vision Pipeline

Observation A + Observation B
            ↓
     Image Preprocessing
            ↓
          CLAHE
            ↓
     Feature Extraction
        SIFT / ORB
            ↓
        BFMatcher
            ↓
       KNN Matching
            ↓
    Lowe's Ratio Test
            ↓
          RANSAC
            ↓
       Homography
            ↓
    Image Registration
            ↓
 Registration Metrics

Terrain Measurement Pipeline

Lunar Image + Metadata
          ↓
     Pixel Distance
          ↓
  Ground Sample Distance
          ↓
   Physical Distance
          ↓
      Sun Geometry
          ↓
Estimated Height / Depth
          ↓
 Independent DEM Reference
          ↓
     Error Calculation

Measurement Formulas

Pixel Distance

distance = √((x2 - x1)² + (y2 - y1)²)

Pixels to Physical Distance

ground distance = pixel distance × GSD

Solar Elevation

solar elevation = 90° - sun incidence angle

Shadow-Based Height / Depth

height = shadow length × tan(solar elevation)

Absolute Error

absolute error = |estimated value - reference value|

Percentage Error

percentage error =
absolute error / reference value × 100

Technology Stack

Frontend

HTML

CSS

JavaScript

Three.js

Backend

Python

FastAPI

Uvicorn

Computer Vision

OpenCV

NumPy

Project Structure

ChandraSetu/
│
├── backend/
│   ├── app.py
│   └── requirements.txt
│
├── frontend/
│   ├── combine.html
│   ├── combinestyle.css
│   ├── combinescript.js
│   ├── three-scene.js
│   └── assets/
│
└── README.md

Installation

1. Clone the Repository

git clone https://github.com/adarshoffside/ChandraSetu.git
cd ChandraSetu

2. Install Backend Dependencies

cd backend
py -m pip install -r requirements.txt

Or install manually:

py -m pip install fastapi uvicorn opencv-python numpy python-multipart

3. Start the Backend

py -m uvicorn app:app --reload

Backend runs at:

http://127.0.0.1:8000

4. Start the Frontend

Open the frontend folder in VS Code and run combine.html using Live Server.

API Endpoints

Health Check

GET /

Image Analysis

POST /api/analyse

Used for image matching, registration, and metric generation.

Metadata Extraction

POST /api/metadata/extract

Used to read supported metadata values from XML/LBL/TXT/JSON files.

Important Terms

Term

Meaning

CLAHE

Improves local image contrast

SIFT

Detects scale and rotation resistant image features

ORB

Fast feature detector and descriptor

BFMatcher

Matches feature descriptors

KNN

Finds nearest candidate matches

Lowe Ratio Test

Rejects ambiguous matches

RANSAC

Removes geometrically incorrect matches

Homography

Transformation used to align images

RMSE

Registration/reprojection error

GSD

Ground Sample Distance

DEM

Digital Elevation Model

DTM

Digital Terrain Model

LOLA

Lunar Orbiter Laser Altimeter

Scientific Note

ChandraSetu does not treat every calculated terrain value as exact ground truth.

A shadow-based result depends on:

Correct feature / shadow endpoint selection

Correct GSD for the exact image

Correct Sun geometry

Image scaling and georeferencing

Local terrain assumptions

For this reason, the project is designed to compare estimates against independent DEM/DTM elevation data whenever available.

Test Data

Controlled test image pairs may be used to verify the software pipeline.

These controlled images and generated metadata are intended only for software testing and should not be presented as independent official Chandrayaan-2 observations.

Future Improvements

Automatic lunar DEM lookup

Pixel-to-lunar-coordinate georeferencing

Automatic crater / shadow detection

Automatic terrain validation

Support for larger mission datasets

Improved cross-sensor matching

GPU acceleration

Exportable scientific reports

Team

Developed as a hackathon project focused on lunar image correspondence, image registration, and terrain analysis.

Disclaimer

This project is a prototype developed for research, learning, and hackathon demonstration purposes. Mission imagery, metadata, and reference elevation data should be obtained from their respective official sources and used according to their terms and scientific documentation.
