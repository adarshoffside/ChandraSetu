import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

const container = document.getElementById("moon3d");

if (container) {
    const scene = new THREE.Scene();

    const camera = new THREE.PerspectiveCamera(
        42,
        container.clientWidth / container.clientHeight,
        0.1,
        100
    );
    camera.position.set(0, 0, 6.2);

    const renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.innerHTML = "";
    container.appendChild(renderer.domElement);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.75);
    scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0xffffff, 3.4);
    sunLight.position.set(-4, 4, 6);
    scene.add(sunLight);

    const fillLight = new THREE.DirectionalLight(0x8fa4b0, 0.55);
    fillLight.position.set(4, -2, 4);
    scene.add(fillLight);

    const textureLoader = new THREE.TextureLoader();
    const moonTexture = textureLoader.load(
        "assets/moon-real.jpg",
        () => console.log("MOON TEXTURE LOADED"),
        undefined,
        error => console.error("MOON TEXTURE ERROR", error)
    );
    moonTexture.colorSpace = THREE.SRGBColorSpace;
    moonTexture.anisotropy = renderer.capabilities.getMaxAnisotropy();

    const moon = new THREE.Mesh(
        new THREE.SphereGeometry(1.55, 128, 128),
        new THREE.MeshStandardMaterial({
            map: moonTexture,
            roughness: 1,
            metalness: 0
        })
    );
    moon.rotation.y = -0.3;
    scene.add(moon);

    const glow = new THREE.Mesh(
        new THREE.SphereGeometry(1.59, 96, 96),
        new THREE.MeshBasicMaterial({
            color: 0x8b979d,
            transparent: true,
            opacity: 0.045,
            side: THREE.BackSide
        })
    );
    scene.add(glow);

    const ORBIT_WIDTH = 2.7;
    const ORBIT_HEIGHT = 2.05;
    const ORBIT_TILT = THREE.MathUtils.degToRad(-12);

    function createOrbit(width, height, opacity, tilt, z) {
        const curve = new THREE.EllipseCurve(
            0,
            0,
            width,
            height,
            0,
            Math.PI * 2,
            false,
            0
        );

        const points = curve.getPoints(260).map(
            point => new THREE.Vector3(point.x, point.y, z)
        );

        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const material = new THREE.LineBasicMaterial({
            color: 0x68777f,
            transparent: true,
            opacity
        });

        const orbit = new THREE.LineLoop(geometry, material);
        orbit.rotation.z = tilt;
        scene.add(orbit);
        return orbit;
    }

    createOrbit(ORBIT_WIDTH, ORBIT_HEIGHT, 0.3, ORBIT_TILT, 0);
    const secondOrbit = createOrbit(
        3.0,
        1.72,
        0.12,
        THREE.MathUtils.degToRad(28),
        -0.2
    );

    const satellitePivot = new THREE.Group();
    const satelliteHolder = new THREE.Group();
    satellitePivot.add(satelliteHolder);
    scene.add(satellitePivot);

    let satelliteModel = null;
    const gltfLoader = new GLTFLoader();

    gltfLoader.load(
        "assets/lro.glb",
        gltf => {
            const model = gltf.scene;
            model.updateMatrixWorld(true);

            const box = new THREE.Box3().setFromObject(model);
            const center = box.getCenter(new THREE.Vector3());
            const size = box.getSize(new THREE.Vector3());

            model.position.set(-center.x, -center.y, -center.z);

            const biggestSide = Math.max(size.x, size.y, size.z);
            const scale = biggestSide > 0 ? 0.75 / biggestSide : 1;
            satelliteHolder.scale.setScalar(scale);

            model.traverse(child => {
                if (child.isMesh) {
                    child.frustumCulled = false;
                    if (child.material) {
                        child.material.side = THREE.DoubleSide;
                        child.material.needsUpdate = true;
                    }
                }
            });

            satelliteHolder.add(model);
            satelliteHolder.rotation.x = THREE.MathUtils.degToRad(18);
            satelliteHolder.rotation.y = THREE.MathUtils.degToRad(-20);
            satelliteModel = model;
            console.log("SATELLITE LOADED");
        },
        undefined,
        error => console.error("SATELLITE ERROR", error)
    );

    const starGeometry = new THREE.BufferGeometry();
    const starPositions = [];

    for (let i = 0; i < 500; i++) {
        starPositions.push(
            THREE.MathUtils.randFloatSpread(12),
            THREE.MathUtils.randFloatSpread(8),
            THREE.MathUtils.randFloat(-5, -1)
        );
    }

    starGeometry.setAttribute(
        "position",
        new THREE.Float32BufferAttribute(starPositions, 3)
    );

    const stars = new THREE.Points(
        starGeometry,
        new THREE.PointsMaterial({
            color: 0xbfc7cb,
            size: 0.018,
            transparent: true,
            opacity: 0.65
        })
    );
    scene.add(stars);

    let mouseX = 0;
    let mouseY = 0;
    let smoothX = 0;
    let smoothY = 0;

    container.addEventListener("mousemove", event => {
        const rect = container.getBoundingClientRect();
        mouseX = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        mouseY = ((event.clientY - rect.top) / rect.height) * 2 - 1;
    });

    container.addEventListener("mouseleave", () => {
        mouseX = 0;
        mouseY = 0;
    });

    const clock = new THREE.Clock();

    function animate() {
        requestAnimationFrame(animate);

        const elapsed = clock.getElapsedTime();
        moon.rotation.y += 0.00035;

        smoothX += (mouseX * 0.04 - smoothX) * 0.04;
        smoothY += (mouseY * 0.03 - smoothY) * 0.04;
        moon.rotation.x = smoothY;
        moon.rotation.z = smoothX * 0.5;
        glow.rotation.copy(moon.rotation);

        const angle = elapsed * 0.3;
        const x = Math.cos(angle) * ORBIT_WIDTH;
        const y = Math.sin(angle) * ORBIT_HEIGHT;

        const finalX =
            x * Math.cos(ORBIT_TILT) -
            y * Math.sin(ORBIT_TILT);

        const finalY =
            x * Math.sin(ORBIT_TILT) +
            y * Math.cos(ORBIT_TILT);

        satellitePivot.position.set(finalX, finalY, 0.8);
        satellitePivot.rotation.z = angle + ORBIT_TILT + Math.PI / 2;

        if (satelliteModel) {
            satelliteHolder.rotation.y = elapsed * 0.22;
            satelliteHolder.rotation.z = Math.sin(elapsed * 0.7) * 0.06;
        }

        secondOrbit.rotation.z =
            THREE.MathUtils.degToRad(28) +
            Math.sin(elapsed * 0.08) * 0.04;

        stars.rotation.z = elapsed * 0.001;
        renderer.render(scene, camera);
    }

    animate();

    window.addEventListener("resize", () => {
        const width = container.clientWidth;
        const height = container.clientHeight;
        if (!width || !height) return;
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        renderer.setSize(width, height);
    });
}
