import * as THREE from "three";

const moonContainer = document.getElementById("moon3d");

if (moonContainer) {
    const width = Math.max(moonContainer.clientWidth, 1);
    const height = Math.max(moonContainer.clientHeight, 1);

    const scene = new THREE.Scene();

    const camera = new THREE.PerspectiveCamera(
        42,
        width / height,
        0.1,
        100
    );

    camera.position.set(0, 0.15, 5.2);

    const renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true
    });

    renderer.setPixelRatio(
        Math.min(window.devicePixelRatio || 1, 2)
    );

    renderer.setSize(
        width,
        height
    );

    renderer.outputColorSpace =
        THREE.SRGBColorSpace;

    renderer.setClearColor(
        0x000000,
        0
    );

    moonContainer.innerHTML = "";

    moonContainer.appendChild(
        renderer.domElement
    );

    const ambientLight =
        new THREE.AmbientLight(
            0xffffff,
            0.65
        );

    scene.add(
        ambientLight
    );

    const sunLight =
        new THREE.DirectionalLight(
            0xfff4dc,
            3
        );

    sunLight.position.set(
        -4,
        2.5,
        5
    );

    scene.add(
        sunLight
    );

    const fillLight =
        new THREE.DirectionalLight(
            0x8fa4b0,
            0.6
        );

    fillLight.position.set(
        4,
        -2,
        4
    );

    scene.add(
        fillLight
    );

    const moonGeometry =
        new THREE.SphereGeometry(
            1.55,
            128,
            128
        );

    const moonMaterial =
        new THREE.MeshStandardMaterial({
            color: 0x9a9a9a,
            roughness: 1,
            metalness: 0
        });

    const moon =
        new THREE.Mesh(
            moonGeometry,
            moonMaterial
        );

    moon.rotation.y = -0.4;

    scene.add(
        moon
    );

    const textureLoader =
        new THREE.TextureLoader();

    textureLoader.load(
        "assets/moon-real.jpg",

        texture => {
            texture.colorSpace =
                THREE.SRGBColorSpace;

            texture.anisotropy =
                renderer.capabilities
                    .getMaxAnisotropy();

            moonMaterial.map =
                texture;

            moonMaterial.color.set(
                0xffffff
            );

            moonMaterial.needsUpdate =
                true;

            console.log(
                "MOON TEXTURE LOADED"
            );
        },

        undefined,

        error => {
            console.error(
                "MOON TEXTURE ERROR",
                error
            );
        }
    );

    const atmosphereGeometry =
        new THREE.SphereGeometry(
            1.59,
            96,
            96
        );

    const atmosphereMaterial =
        new THREE.MeshBasicMaterial({
            color: 0x8fa1aa,
            transparent: true,
            opacity: 0.05,
            side: THREE.BackSide
        });

    const atmosphere =
        new THREE.Mesh(
            atmosphereGeometry,
            atmosphereMaterial
        );

    scene.add(
        atmosphere
    );

    const orbitCurve =
        new THREE.EllipseCurve(
            0,
            0,
            2.55,
            1.65,
            0,
            Math.PI * 2,
            false,
            0
        );

    const orbitPoints =
        orbitCurve.getPoints(
            220
        );

    const orbitGeometry =
        new THREE.BufferGeometry()
            .setFromPoints(
                orbitPoints.map(
                    point =>
                        new THREE.Vector3(
                            point.x,
                            0,
                            point.y
                        )
                )
            );

    const orbitMaterial =
        new THREE.LineBasicMaterial({
            color: 0x718089,
            transparent: true,
            opacity: 0.28
        });

    const orbit =
        new THREE.LineLoop(
            orbitGeometry,
            orbitMaterial
        );

    orbit.rotation.x =
        THREE.MathUtils.degToRad(
            20
        );

    orbit.rotation.z =
        THREE.MathUtils.degToRad(
            -12
        );

    scene.add(
        orbit
    );

    const orbit2Geometry =
        new THREE.BufferGeometry()
            .setFromPoints(
                orbitPoints.map(
                    point =>
                        new THREE.Vector3(
                            point.x * 1.12,
                            0,
                            point.y * 1.12
                        )
                )
            );

    const orbit2Material =
        new THREE.LineBasicMaterial({
            color: 0x59666e,
            transparent: true,
            opacity: 0.12
        });

    const orbit2 =
        new THREE.LineLoop(
            orbit2Geometry,
            orbit2Material
        );

    orbit2.rotation.x =
        THREE.MathUtils.degToRad(
            20
        );

    orbit2.rotation.z =
        THREE.MathUtils.degToRad(
            25
        );

    scene.add(
        orbit2
    );

    const satellite =
        new THREE.Group();

    const bodyGeometry =
        new THREE.BoxGeometry(
            0.25,
            0.18,
            0.36
        );

    const bodyMaterial =
        new THREE.MeshStandardMaterial({
            color: 0x8b9295,
            roughness: 0.65,
            metalness: 0.5
        });

    const body =
        new THREE.Mesh(
            bodyGeometry,
            bodyMaterial
        );

    satellite.add(
        body
    );

    const instrumentGeometry =
        new THREE.BoxGeometry(
            0.14,
            0.10,
            0.13
        );

    const instrumentMaterial =
        new THREE.MeshStandardMaterial({
            color: 0xb18a48,
            roughness: 0.5,
            metalness: 0.5
        });

    const instrument =
        new THREE.Mesh(
            instrumentGeometry,
            instrumentMaterial
        );

    instrument.position.z =
        -0.21;

    satellite.add(
        instrument
    );

    const panelGeometry =
        new THREE.BoxGeometry(
            0.72,
            0.025,
            0.22
        );

    const panelMaterial =
        new THREE.MeshStandardMaterial({
            color: 0x253038,
            roughness: 0.5,
            metalness: 0.6
        });

    const panelLeft =
        new THREE.Mesh(
            panelGeometry,
            panelMaterial
        );

    panelLeft.position.x =
        -0.48;

    satellite.add(
        panelLeft
    );

    const panelRight =
        new THREE.Mesh(
            panelGeometry,
            panelMaterial
        );

    panelRight.position.x =
        0.48;

    satellite.add(
        panelRight
    );

    const antennaGeometry =
        new THREE.CylinderGeometry(
            0.012,
            0.012,
            0.30,
            10
        );

    const antennaMaterial =
        new THREE.MeshBasicMaterial({
            color: 0xc5c9ca
        });

    const antenna =
        new THREE.Mesh(
            antennaGeometry,
            antennaMaterial
        );

    antenna.rotation.z =
        THREE.MathUtils.degToRad(
            45
        );

    antenna.position.set(
        0,
        0.19,
        0
    );

    satellite.add(
        antenna
    );

    const dishGeometry =
        new THREE.CylinderGeometry(
            0.10,
            0.03,
            0.035,
            24
        );

    const dishMaterial =
        new THREE.MeshStandardMaterial({
            color: 0xbfc6ca,
            roughness: 0.6,
            metalness: 0.4
        });

    const dish =
        new THREE.Mesh(
            dishGeometry,
            dishMaterial
        );

    dish.position.set(
        0,
        0.36,
        0
    );

    satellite.add(
        dish
    );

    const markerGeometry =
        new THREE.SphereGeometry(
            0.035,
            12,
            12
        );

    const markerMaterial =
        new THREE.MeshBasicMaterial({
            color: 0xd6a454
        });

    const marker =
        new THREE.Mesh(
            markerGeometry,
            markerMaterial
        );

    satellite.add(
        marker
    );

    satellite.scale.setScalar(
        0.85
    );

    scene.add(
        satellite
    );

    const starGeometry =
        new THREE.BufferGeometry();

    const starPositions =
        [];

    for (
        let i = 0;
        i < 500;
        i++
    ) {
        const radius =
            THREE.MathUtils.randFloat(
                5,
                15
            );

        const theta =
            Math.random() *
            Math.PI *
            2;

        const phi =
            Math.acos(
                THREE.MathUtils
                    .randFloatSpread(
                        2
                    )
            );

        starPositions.push(
            radius *
                Math.sin(phi) *
                Math.cos(theta),

            radius *
                Math.sin(phi) *
                Math.sin(theta),

            radius *
                Math.cos(phi)
        );
    }

    starGeometry.setAttribute(
        "position",
        new THREE.Float32BufferAttribute(
            starPositions,
            3
        )
    );

    const starMaterial =
        new THREE.PointsMaterial({
            color: 0xbfc6ca,
            size: 0.018,
            transparent: true,
            opacity: 0.55
        });

    const stars =
        new THREE.Points(
            starGeometry,
            starMaterial
        );

    scene.add(
        stars
    );

    let mouseX = 0;
    let mouseY = 0;

    let targetX = 0;
    let targetY = 0;

    moonContainer.addEventListener(
        "mousemove",
        event => {
            const rect =
                moonContainer
                    .getBoundingClientRect();

            mouseX =
                (
                    (
                        event.clientX -
                        rect.left
                    ) /
                    rect.width
                ) *
                    2 -
                1;

            mouseY =
                (
                    (
                        event.clientY -
                        rect.top
                    ) /
                    rect.height
                ) *
                    2 -
                1;
        }
    );

    moonContainer.addEventListener(
        "mouseleave",
        () => {
            mouseX = 0;
            mouseY = 0;
        }
    );

    const clock =
        new THREE.Clock();

    function animate() {
        requestAnimationFrame(
            animate
        );

        const elapsed =
            clock.getElapsedTime();

        moon.rotation.y +=
            0.0018;

        atmosphere.rotation.y =
            moon.rotation.y;

        const angle =
            elapsed * 0.38;

        const orbitX =
            Math.cos(angle) *
            2.55;

        const orbitZ =
            Math.sin(angle) *
            1.65;

        satellite.position.set(
            orbitX,
            Math.sin(
                angle * 0.7
            ) * 0.38,
            orbitZ
        );

        satellite.rotation.y =
            -angle +
            Math.PI / 2;

        satellite.rotation.z =
            Math.sin(
                elapsed * 0.7
            ) * 0.08;

        antenna.rotation.x =
            Math.sin(
                elapsed * 1.5
            ) * 0.08;

        stars.rotation.y =
            elapsed * 0.003;

        targetX +=
            (
                mouseX * 0.12 -
                targetX
            ) *
            0.04;

        targetY +=
            (
                mouseY * 0.08 -
                targetY
            ) *
            0.04;

        moon.rotation.x =
            targetY;

        moon.rotation.z =
            targetX * 0.3;

        orbit.rotation.y =
            elapsed * 0.015;

        orbit2.rotation.y =
            -elapsed * 0.009;

        renderer.render(
            scene,
            camera
        );
    }

    animate();

    window.addEventListener(
        "resize",
        () => {
            const newWidth =
                Math.max(
                    moonContainer.clientWidth,
                    1
                );

            const newHeight =
                Math.max(
                    moonContainer.clientHeight,
                    1
                );

            camera.aspect =
                newWidth /
                newHeight;

            camera.updateProjectionMatrix();

            renderer.setSize(
                newWidth,
                newHeight
            );
        }
    );
}