/* =========================================================
   CHANDRASETU
   THREE.JS MOON + SATELLITE
========================================================= */

const moonContainer = document.getElementById("moon3d");

if (moonContainer && typeof THREE !== "undefined") {

    /* =====================================================
       SCENE
    ====================================================== */

    const scene = new THREE.Scene();


    /* =====================================================
       CAMERA
    ====================================================== */

    const camera = new THREE.PerspectiveCamera(
        42,
        moonContainer.clientWidth / moonContainer.clientHeight,
        0.1,
        100
    );

    camera.position.set(0, 0, 6.2);


    /* =====================================================
       RENDERER
    ====================================================== */

    const renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true
    });

    renderer.setPixelRatio(
        Math.min(window.devicePixelRatio, 2)
    );

    renderer.setSize(
        moonContainer.clientWidth,
        moonContainer.clientHeight
    );

    renderer.setClearColor(
        0x000000,
        0
    );

    if ("outputColorSpace" in renderer) {
        renderer.outputColorSpace =
            THREE.SRGBColorSpace;
    }

    moonContainer.innerHTML = "";

    moonContainer.appendChild(
        renderer.domElement
    );


    /* =====================================================
       LIGHTING
    ====================================================== */

    const ambientLight =
        new THREE.AmbientLight(
            0xffffff,
            0.35
        );

    scene.add(
        ambientLight
    );


    const sunLight =
        new THREE.DirectionalLight(
            0xfff1d2,
            2.5
        );

    sunLight.position.set(
        -4,
        3,
        5
    );

    scene.add(
        sunLight
    );


    /* =====================================================
       MOON TEXTURE
    ====================================================== */

    const textureCanvas =
        document.createElement("canvas");

    textureCanvas.width = 1024;
    textureCanvas.height = 512;

    const ctx =
        textureCanvas.getContext("2d");


    /* Moon base colour */

    const gradient =
        ctx.createLinearGradient(
            0,
            0,
            1024,
            512
        );

    gradient.addColorStop(
        0,
        "#999891"
    );

    gradient.addColorStop(
        0.5,
        "#777771"
    );

    gradient.addColorStop(
        1,
        "#555750"
    );

    ctx.fillStyle =
        gradient;

    ctx.fillRect(
        0,
        0,
        1024,
        512
    );


    /* Small surface details */

    for (
        let i = 0;
        i < 700;
        i++
    ) {

        const x =
            Math.random() * 1024;

        const y =
            Math.random() * 512;

        const radius =
            1 + Math.random() * 12;

        const brightness =
            70 +
            Math.floor(
                Math.random() * 60
            );

        ctx.fillStyle =
            `rgba(
                ${brightness},
                ${brightness},
                ${brightness},
                ${0.05 + Math.random() * 0.12}
            )`;

        ctx.beginPath();

        ctx.arc(
            x,
            y,
            radius,
            0,
            Math.PI * 2
        );

        ctx.fill();
    }


    /* Craters */

    for (
        let i = 0;
        i < 90;
        i++
    ) {

        const x =
            Math.random() * 1024;

        const y =
            Math.random() * 512;

        const radius =
            6 +
            Math.random() * 25;


        ctx.strokeStyle =
            "rgba(35,35,32,0.30)";

        ctx.lineWidth =
            1 +
            Math.random() * 2;

        ctx.beginPath();

        ctx.arc(
            x,
            y,
            radius,
            0,
            Math.PI * 2
        );

        ctx.stroke();


        /* Crater highlight */

        ctx.strokeStyle =
            "rgba(210,210,195,0.10)";

        ctx.beginPath();

        ctx.arc(
            x - 2,
            y - 2,
            Math.max(
                2,
                radius - 2
            ),
            Math.PI,
            Math.PI * 1.8
        );

        ctx.stroke();
    }


    const moonTexture =
        new THREE.CanvasTexture(
            textureCanvas
        );

    if ("colorSpace" in moonTexture) {

        moonTexture.colorSpace =
            THREE.SRGBColorSpace;

    }


    /* =====================================================
       MOON
    ====================================================== */

    const moonGeometry =
        new THREE.SphereGeometry(
            1.55,
            96,
            96
        );


    const moonMaterial =
        new THREE.MeshStandardMaterial({

            map:
                moonTexture,

            roughness:
                1,

            metalness:
                0

        });


    const moon =
        new THREE.Mesh(
            moonGeometry,
            moonMaterial
        );


    scene.add(
        moon
    );


    /* =====================================================
       MOON EDGE GLOW
    ====================================================== */

    const atmosphereGeometry =
        new THREE.SphereGeometry(
            1.59,
            64,
            64
        );


    const atmosphereMaterial =
        new THREE.MeshBasicMaterial({

            color:
                0x87959c,

            transparent:
                true,

            opacity:
                0.055,

            side:
                THREE.BackSide

        });


    const atmosphere =
        new THREE.Mesh(
            atmosphereGeometry,
            atmosphereMaterial
        );


    scene.add(
        atmosphere
    );


    /* =====================================================
       ORBIT SETTINGS

       Moon radius = 1.55

       Orbit is kept safely OUTSIDE Moon.
    ====================================================== */

    const ORBIT_X =
        2.65;

    const ORBIT_Y =
        2.00;

    const ORBIT_ROTATION =
        THREE.MathUtils.degToRad(
            -12
        );


    /* =====================================================
       ORBIT LINE
    ====================================================== */

    const orbitCurve =
        new THREE.EllipseCurve(

            0,
            0,

            ORBIT_X,
            ORBIT_Y,

            0,
            Math.PI * 2,

            false,
            0
        );


    const orbitPoints =
        orbitCurve.getPoints(
            180
        );


    const orbitGeometry =
        new THREE.BufferGeometry()
            .setFromPoints(

                orbitPoints.map(
                    point =>
                        new THREE.Vector3(

                            point.x,
                            point.y,
                            -0.1
                        )
                )

            );


    const orbitMaterial =
        new THREE.LineBasicMaterial({

            color:
                0x607078,

            transparent:
                true,

            opacity:
                0.30

        });


    const orbit =
        new THREE.LineLoop(

            orbitGeometry,
            orbitMaterial

        );


    orbit.rotation.z =
        ORBIT_ROTATION;


    scene.add(
        orbit
    );


    /* =====================================================
       SECOND DECORATIVE ORBIT
    ====================================================== */

    const orbit2Curve =
        new THREE.EllipseCurve(

            0,
            0,

            2.9,
            1.72,

            0,
            Math.PI * 2,

            false,
            0
        );


    const orbit2Points =
        orbit2Curve.getPoints(
            180
        );


    const orbit2Geometry =
        new THREE.BufferGeometry()
            .setFromPoints(

                orbit2Points.map(
                    point =>
                        new THREE.Vector3(

                            point.x,
                            point.y,
                            -0.2
                        )
                )

            );


    const orbit2Material =
        new THREE.LineBasicMaterial({

            color:
                0x455159,

            transparent:
                true,

            opacity:
                0.12

        });


    const orbit2 =
        new THREE.LineLoop(

            orbit2Geometry,
            orbit2Material

        );


    orbit2.rotation.z =
        THREE.MathUtils.degToRad(
            25
        );


    scene.add(
        orbit2
    );


    /* =====================================================
       SATELLITE
    ====================================================== */

    const satellite =
        new THREE.Group();


    /* Satellite body */

    const bodyGeometry =
        new THREE.BoxGeometry(
            0.22,
            0.14,
            0.30
        );


    const bodyMaterial =
        new THREE.MeshStandardMaterial({

            color:
                0x999fa2,

            roughness:
                0.55,

            metalness:
                0.6

        });


    const satelliteBody =
        new THREE.Mesh(

            bodyGeometry,
            bodyMaterial

        );


    satellite.add(
        satelliteBody
    );


    /* =====================================================
       GOLD INSTRUMENT
    ====================================================== */

    const instrumentGeometry =
        new THREE.BoxGeometry(
            0.12,
            0.09,
            0.13
        );


    const instrumentMaterial =
        new THREE.MeshStandardMaterial({

            color:
                0xc79a43,

            roughness:
                0.45,

            metalness:
                0.6

        });


    const instrument =
        new THREE.Mesh(

            instrumentGeometry,
            instrumentMaterial

        );


    instrument.position.z =
        -0.20;


    satellite.add(
        instrument
    );


    /* =====================================================
       SOLAR PANELS
    ====================================================== */

    const panelGeometry =
        new THREE.BoxGeometry(
            0.55,
            0.025,
            0.18
        );


    const panelMaterial =
        new THREE.MeshStandardMaterial({

            color:
                0x1c2930,

            roughness:
                0.5,

            metalness:
                0.65

        });


    const leftPanel =
        new THREE.Mesh(

            panelGeometry,
            panelMaterial

        );


    leftPanel.position.x =
        -0.38;


    satellite.add(
        leftPanel
    );


    const rightPanel =
        new THREE.Mesh(

            panelGeometry,
            panelMaterial

        );


    rightPanel.position.x =
        0.38;


    satellite.add(
        rightPanel
    );


    /* =====================================================
       ANTENNA
    ====================================================== */

    const antennaGeometry =
        new THREE.CylinderGeometry(

            0.012,
            0.012,
            0.27,
            10
        );


    const antennaMaterial =
        new THREE.MeshBasicMaterial({

            color:
                0xd0d3d4

        });


    const antenna =
        new THREE.Mesh(

            antennaGeometry,
            antennaMaterial

        );


    antenna.position.y =
        0.18;


    antenna.rotation.z =
        THREE.MathUtils.degToRad(
            45
        );


    satellite.add(
        antenna
    );


    /* Small golden tracking dot */

    const markerGeometry =
        new THREE.SphereGeometry(
            0.035,
            12,
            12
        );


    const markerMaterial =
        new THREE.MeshBasicMaterial({

            color:
                0xd6a454

        });


    const marker =
        new THREE.Mesh(

            markerGeometry,
            markerMaterial

        );


    satellite.add(
        marker
    );


    satellite.scale.set(
        0.85,
        0.85,
        0.85
    );


    scene.add(
        satellite
    );


    /* =====================================================
       STARS
    ====================================================== */

    const starGeometry =
        new THREE.BufferGeometry();


    const starPositions =
        [];


    for (
        let i = 0;
        i < 350;
        i++
    ) {

        const x =
            THREE.MathUtils.randFloatSpread(
                12
            );

        const y =
            THREE.MathUtils.randFloatSpread(
                8
            );

        const z =
            THREE.MathUtils.randFloat(
                -4,
                -1
            );


        starPositions.push(
            x,
            y,
            z
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

            color:
                0xc2c7ca,

            size:
                0.018,

            transparent:
                true,

            opacity:
                0.6

        });


    const stars =
        new THREE.Points(

            starGeometry,
            starMaterial

        );


    scene.add(
        stars
    );


    /* =====================================================
       MOUSE MOVEMENT
    ====================================================== */

    let mouseX = 0;
    let mouseY = 0;

    let targetX = 0;
    let targetY = 0;


    moonContainer.addEventListener(

        "mousemove",

        function (event) {

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
                ) * 2 - 1;


            mouseY =
                (
                    (
                        event.clientY -
                        rect.top
                    ) /
                    rect.height
                ) * 2 - 1;

        }

    );


    moonContainer.addEventListener(

        "mouseleave",

        function () {

            mouseX = 0;
            mouseY = 0;

        }

    );


    /* =====================================================
       ANIMATION
    ====================================================== */

    const clock =
        new THREE.Clock();


    function animate() {

        requestAnimationFrame(
            animate
        );


        const elapsed =
            clock.getElapsedTime();


        /* Rotate Moon */

        moon.rotation.y +=
            0.0007;


        targetX +=
            (
                mouseX * 0.10 -
                targetX
            ) * 0.04;


        targetY +=
            (
                mouseY * 0.07 -
                targetY
            ) * 0.04;


        moon.rotation.x =
            targetY;


        moon.rotation.z =
            targetX * 0.25;


        atmosphere.rotation.copy(
            moon.rotation
        );


        /* =================================================
           SATELLITE ORBIT

           IMPORTANT FIX:
           Satellite follows EXACT same visible ellipse.
        ================================================= */

        const angle =
            elapsed * 0.38;


        let orbitX =
            Math.cos(angle) *
            ORBIT_X;


        let orbitY =
            Math.sin(angle) *
            ORBIT_Y;


        /* Rotate position to match orbit line */

        const rotatedX =
            orbitX *
            Math.cos(
                ORBIT_ROTATION
            )
            -
            orbitY *
            Math.sin(
                ORBIT_ROTATION
            );


        const rotatedY =
            orbitX *
            Math.sin(
                ORBIT_ROTATION
            )
            +
            orbitY *
            Math.cos(
                ORBIT_ROTATION
            );


        satellite.position.set(

            rotatedX,
            rotatedY,
            0.15

        );


        /* Satellite follows direction */

        satellite.rotation.z =
            angle +
            ORBIT_ROTATION +
            Math.PI / 2;


        /* Small antenna animation */

        antenna.rotation.x =
            Math.sin(
                elapsed * 1.5
            ) * 0.08;


        /* Slowly move decorative orbit */

        orbit2.rotation.z =
            THREE.MathUtils.degToRad(
                25
            ) +
            Math.sin(
                elapsed * 0.05
            ) * 0.05;


        stars.rotation.z =
            elapsed * 0.001;


        renderer.render(
            scene,
            camera
        );

    }


    animate();


    /* =====================================================
       WINDOW RESIZE
    ====================================================== */

    window.addEventListener(

        "resize",

        function () {

            const width =
                moonContainer.clientWidth;


            const height =
                moonContainer.clientHeight;


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