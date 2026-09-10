import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";

const container = document.getElementById("moon3d");

if (container) {

    const scene = new THREE.Scene();


    // CAMERA

    const camera = new THREE.PerspectiveCamera(
        42,
        container.clientWidth / container.clientHeight,
        0.1,
        100
    );

    camera.position.set(0, 0, 6.3);


    let renderer;
    let rendererError;

    try {

        renderer = new THREE.WebGLRenderer({
            antialias: true,
            alpha: true
        });

    } catch (error) {

        rendererError = error;
        console.error("Unable to initialize the orbital renderer", error);
        container.textContent = "ORBITAL VIEW UNAVAILABLE";

    }

    if (!renderer) {
        throw rendererError || new Error("Unable to initialize the orbital renderer");
    }

    renderer.setPixelRatio(
        Math.min(window.devicePixelRatio, 2)
    );

    renderer.setSize(
        container.clientWidth,
        container.clientHeight
    );

    renderer.setClearColor(
        0x000000,
        0
    );

    renderer.outputColorSpace =
        THREE.SRGBColorSpace;

    container.innerHTML = "";

    container.appendChild(
        renderer.domElement
    );




    const ambientLight =
        new THREE.AmbientLight(
            0xffffff,
            0.8
        );

    scene.add(
        ambientLight
    );


    const sunLight =
        new THREE.DirectionalLight(
            0xffffff,
            3.5
        );

    sunLight.position.set(
        -4,
        4,
        6
    );

    scene.add(
        sunLight
    );


    const satelliteLight =
        new THREE.DirectionalLight(
            0xffffff,
            2
        );

    satelliteLight.position.set(
        4,
        3,
        6
    );

    scene.add(
        satelliteLight
    );




    const textureLoader =
        new THREE.TextureLoader();

    const moonTexture =
        textureLoader.load(
            "assets/moon-real.jpg",
            undefined,
            undefined,
            error => {
                console.error("Unable to load the Moon texture", error);
            }
        );

    moonTexture.colorSpace =
        THREE.SRGBColorSpace;




    const moonGeometry =
        new THREE.SphereGeometry(
            1.55,
            128,
            128
        );

    const moonMaterial =
        new THREE.MeshStandardMaterial({
            map: moonTexture,
            roughness: 1,
            metalness: 0
        });

    const moon =
        new THREE.Mesh(
            moonGeometry,
            moonMaterial
        );

    moon.rotation.y = -0.3;

    scene.add(
        moon
    );


    // MOON EDGE

    const glowGeometry =
        new THREE.SphereGeometry(
            1.58,
            96,
            96
        );

    const glowMaterial =
        new THREE.MeshBasicMaterial({
            color: 0x8b979d,
            transparent: true,
            opacity: 0.04,
            side: THREE.BackSide
        });

    const glow =
        new THREE.Mesh(
            glowGeometry,
            glowMaterial
        );

    scene.add(
        glow
    );




    const ORBIT_WIDTH = 2.65;

    const ORBIT_HEIGHT = 2.05;

    const ORBIT_TILT =
        THREE.MathUtils.degToRad(-12);




    const orbitCurve =
        new THREE.EllipseCurve(
            0,
            0,
            ORBIT_WIDTH,
            ORBIT_HEIGHT,
            0,
            Math.PI * 2,
            false,
            0
        );

    const orbitPoints =
        orbitCurve
            .getPoints(250)
            .map(point =>

                new THREE.Vector3(
                    point.x,
                    point.y,
                    0
                )

            );

    const orbitGeometry =
        new THREE.BufferGeometry()
            .setFromPoints(
                orbitPoints
            );

    const orbitMaterial =
        new THREE.LineBasicMaterial({
            color: 0x68777f,
            transparent: true,
            opacity: 0.3
        });

    const orbit =
        new THREE.LineLoop(
            orbitGeometry,
            orbitMaterial
        );

    orbit.rotation.z =
        ORBIT_TILT;

    scene.add(
        orbit
    );




    const secondOrbitCurve =
        new THREE.EllipseCurve(
            0,
            0,
            2.95,
            1.7,
            0,
            Math.PI * 2
        );

    const secondOrbitPoints =
        secondOrbitCurve
            .getPoints(220)
            .map(point =>

                new THREE.Vector3(
                    point.x,
                    point.y,
                    -0.2
                )

            );

    const secondOrbitGeometry =
        new THREE.BufferGeometry()
            .setFromPoints(
                secondOrbitPoints
            );

    const secondOrbitMaterial =
        new THREE.LineBasicMaterial({
            color: 0x445159,
            transparent: true,
            opacity: 0.13
        });

    const secondOrbit =
        new THREE.LineLoop(
            secondOrbitGeometry,
            secondOrbitMaterial
        );

    secondOrbit.rotation.z =
        THREE.MathUtils.degToRad(28);

    scene.add(
        secondOrbit
    );


    // SATELLITE ORBIT GROUP

    const satelliteOrbit =
        new THREE.Group();

    scene.add(
        satelliteOrbit
    );


    // SATELLITE MODEL HOLDER

    const satelliteHolder =
        new THREE.Group();

    satelliteOrbit.add(
        satelliteHolder
    );


    let satelliteModel = null;


    // LOAD REAL SATELLITE

    const gltfLoader =
        new GLTFLoader();

    const dracoLoader =
        new DRACOLoader();

    dracoLoader.setDecoderPath(
        "https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/libs/draco/"
    );

    gltfLoader.setDRACOLoader(
        dracoLoader
    );

    gltfLoader.load(

        "assets/lro.glb",

        gltf => {

            console.log(
                "SATELLITE LOADED"
            );

            const model =
                gltf.scene;


            const box =
                new THREE.Box3()
                    .setFromObject(
                        model
                    );


            const center =
                box.getCenter(
                    new THREE.Vector3()
                );


            const size =
                box.getSize(
                    new THREE.Vector3()
                );


            model.position.set(
                -center.x,
                -center.y,
                -center.z
            );


            const biggestSide =
                Math.max(
                    size.x,
                    size.y,
                    size.z
                );


            const scale =
                0.9 / biggestSide;


            model.scale.setScalar(
                scale
            );


            model.traverse(child => {

                if (child.isMesh) {

                    child.frustumCulled =
                        false;

                    if (child.material) {

                        child.material.side =
                            THREE.DoubleSide;

                        child.material.needsUpdate =
                            true;

                    }

                }

            });


            satelliteHolder.add(
                model
            );


            satelliteModel =
                model;

        },


        progress => {

            if (progress.total) {

                const percent =
                    progress.loaded /
                    progress.total *
                    100;

                console.log(
                    "Satellite loading " +
                    percent.toFixed(0) +
                    "%"
                );

            }

        },


        error => {

            console.error(
                "SATELLITE ERROR",
                error
            );

        }

    );


    // STARS

    const starGeometry =
        new THREE.BufferGeometry();

    const starPositions =
        [];


    for (
        let i = 0;
        i < 500;
        i++
    ) {

        starPositions.push(

            THREE.MathUtils
                .randFloatSpread(12),

            THREE.MathUtils
                .randFloatSpread(8),

            THREE.MathUtils
                .randFloat(-5, -1)

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
            color: 0xbfc7cb,
            size: 0.018,
            transparent: true,
            opacity: 0.65
        });


    const stars =
        new THREE.Points(
            starGeometry,
            starMaterial
        );


    scene.add(
        stars
    );


    // MOUSE

    let mouseX = 0;

    let mouseY = 0;

    let smoothX = 0;

    let smoothY = 0;


    container.addEventListener(
        "mousemove",
        event => {

            const rect =
                container
                    .getBoundingClientRect();


            mouseX =
                (
                    event.clientX -
                    rect.left
                )
                /
                rect.width
                *
                2
                -
                1;


            mouseY =
                (
                    event.clientY -
                    rect.top
                )
                /
                rect.height
                *
                2
                -
                1;

        }
    );


    container.addEventListener(
        "mouseleave",
        () => {

            mouseX = 0;

            mouseY = 0;

        }
    );


    // CLOCK

    const clock =
        new THREE.Clock();


    // ANIMATION

    function animate() {

        requestAnimationFrame(
            animate
        );


        const elapsed =
            clock.getElapsedTime();


        // ROTATE MOON

        moon.rotation.y +=
            0.00035;


        smoothX +=
            (
                mouseX * 0.04 -
                smoothX
            )
            *
            0.04;


        smoothY +=
            (
                mouseY * 0.03 -
                smoothY
            )
            *
            0.04;


        moon.rotation.x =
            smoothY;


        glow.rotation.copy(
            moon.rotation
        );


        // SATELLITE REVOLUTION

        const angle =
            elapsed * 0.35;


        const x =
            Math.cos(angle)
            *
            ORBIT_WIDTH;


        const y =
            Math.sin(angle)
            *
            ORBIT_HEIGHT;


        const finalX =
            x *
            Math.cos(ORBIT_TILT)
            -
            y *
            Math.sin(ORBIT_TILT);


        const finalY =
            x *
            Math.sin(ORBIT_TILT)
            +
            y *
            Math.cos(ORBIT_TILT);


        satelliteOrbit.position.set(
            finalX,
            finalY,
            1
        );


        satelliteOrbit.rotation.z =
            angle
            +
            ORBIT_TILT
            +
            Math.PI / 2;


        // MAKE SATELLITE EASY TO SEE

        satelliteHolder.rotation.x =
            THREE.MathUtils.degToRad(20);


        satelliteHolder.rotation.y =
            elapsed * 0.25;


        satelliteHolder.rotation.z =
            Math.sin(
                elapsed * 0.7
            )
            *
            0.08;


        // DECORATIVE ORBIT

        secondOrbit.rotation.z =
            THREE.MathUtils.degToRad(28)
            +
            Math.sin(
                elapsed * 0.08
            )
            *
            0.04;


        // STARS

        stars.rotation.z =
            elapsed * 0.001;


        // DRAW

        renderer.render(
            scene,
            camera
        );

    }


    animate();


    // RESIZE

    window.addEventListener(
        "resize",
        () => {

            const width =
                container.clientWidth;

            const height =
                container.clientHeight;


            camera.aspect =
                width / height;


            camera.updateProjectionMatrix();


            renderer.setSize(
                width,
                height
            );

        }
    );

}