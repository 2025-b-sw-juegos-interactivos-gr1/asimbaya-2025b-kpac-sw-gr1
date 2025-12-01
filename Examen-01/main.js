// `main.js` — esqueleto mínimo para inicializar BabylonJS
window.addEventListener('DOMContentLoaded', function () {
    const canvas = document.getElementById('renderCanvas');
    if (!canvas) {
        console.error('No se encontró el canvas #renderCanvas');
        return;
    }

    const engine = new BABYLON.Engine(canvas, true, { preserveDrawingBuffer: true, stencil: true });

    const createScene = function () {
        const scene = new BABYLON.Scene(engine);


        // *** CONSTANTES DEL JUEGO ***
        const MOVE_SPEED = 0.08;            // Velocidad (base) de movimiento del player
        const MOVE_SPEED_PUSHING = 0.05;    // Más lento con carretilla
        const ACTION_DISTANCE = 2.0;        // radio de acción para recoger/entregar
        const TARGET_BRICKS = 9;            // Número de ladrillos a entregar para ganar
        const BATCH_SIZE = 3;               // Número de ladrillos que se pueden llevar a la vez
        const MAX_BRICKS_ON_WHEELBARROW = 3; // Capacidad máxima de la carretilla
        const ROT_SPEED = 0.04;            // Velocidad de rotación del player

        // *** LIMITES DEL MUNDO ***
        const WORLD_BOUNDS = {
            minX: -14,
            maxX: 7.5, // Limite frontal (pared) antes de la zona de entrega X = 8
            minZ: -9,
            maxZ: 9
        };


        // Color de fondo (Cielo Claro)
        scene.clearColor = new BABYLON.Color4(0.8, 0.9, 1.0, 1.0);

        // ** CAMARAS **
        //Vista general Tipo "dron" sobre toda la obra (3ra persona)
        const camera = new BABYLON.ArcRotateCamera(
            'camera',
            Math.PI * 1.3, // Angulo alfa (Horizontal)
            Math.PI / 3,   // Angulo beta (Vertical)
            30,            // Distancia desde el objetivo
            new BABYLON.Vector3(0, 2, 0), // Objetivo de la cámara
            scene
        );
        camera.lowerRadiusLimit = 10; // Distancia mínima
        camera.upperRadiusLimit = 50; // Distancia máxima
        camera.attachControl(canvas, true);

        // *** LUCES ***
        const hemiLight = new BABYLON.HemisphericLight(
            'hemiLight',
            new BABYLON.Vector3(0, 1, 0), // Dirección hacia arriba
            scene
        );
        hemiLight.intensity = 0.9; // Intensidad de la luz hemisférica

        const dirLight = new BABYLON.DirectionalLight(
            'dirLight',
            new BABYLON.Vector3(-0.5, -1, -0.3), // Dirección de la luz
            scene
        );
        dirLight.intensity = 0.4; // Intensidad de la luz direccional

        // *** MATERIALES ***
        // Suelo tipo Concreto
        const groundMat = new BABYLON.StandardMaterial('GroundMat', scene);
        groundMat.diffuseColor = new BABYLON.Color3(0.75, 0.75, 0.75);

        // Player (Caja amarilla * Temporal) TODO: Reemplazar por modelo 3D
        const playerMat = new BABYLON.StandardMaterial('PlayerMat', scene);
        playerMat.diffuseColor = new BABYLON.Color3(1, 0.85, 0.2);

        // Zona de recogida (amarillo/naranja traslúcido)
        const pickupZoneMat = new BABYLON.StandardMaterial('PickupZoneMat', scene);
        pickupZoneMat.diffuseColor = new BABYLON.Color3(0.95, 0.7, 0.2);
        pickupZoneMat.alpha = 0.4;

        // Zona de entrega (verde traslúcido)
        const dropoffZoneMat = new BABYLON.StandardMaterial('DropoffZoneMat', scene);
        dropoffZoneMat.diffuseColor = new BABYLON.Color3(0.2, 0.8, 0.3);
        dropoffZoneMat.alpha = 0.4;

        // Ladrillos
        const brickMat = new BABYLON.StandardMaterial('BrickMat', scene);
        brickMat.diffuseColor = new BABYLON.Color3(0.8, 0.3, 0.15);

        // Muro en Construcción
        const wallMat = new BABYLON.StandardMaterial('WallMat', scene);
        wallMat.diffuseColor = new BABYLON.Color3(0.7, 0.35, 0.2);

        // Carretilla (wheelbarrow / Caja roja * Temporal) - TODO: Añadir modelo 3D
        const wheelbarrowMat = new BABYLON.StandardMaterial('WheelbarrowMat', scene);
        wheelbarrowMat.diffuseColor = new BABYLON.Color3(1, 0.1, 0.1);


        // *** GEOMETRÍA DE LA ESCENA ***
        // Suelo principal
        const ground = BABYLON.MeshBuilder.CreateGround('ground', {
            width: 30,
            height: 20,
        }, scene);
        ground.material = groundMat;

        // Player (Caja amarilla * Temporal)
        const player = BABYLON.MeshBuilder.CreateBox('player', {
            width: 1,
            height: 1.8,
            depth: 1
        }, scene);
        player.position = new BABYLON.Vector3(0, 0.9, -4); // Posición inicial del player
        player.material = playerMat;

        // Zona de recogida: pila de ladrillos 
        const pickupZone = BABYLON.MeshBuilder.CreateBox('pickupZone', {
            width: 4,
            height: 0.1,
            depth: 3
        }, scene);
        pickupZone.position = new BABYLON.Vector3(-8, 0.05, 0); // Posición de la zona de recogida
        pickupZone.material = pickupZoneMat;

        // // Ladrillo "activo" que se utilizará para la recogida y entrega
        // const activeBrick = BABYLON.MeshBuilder.CreateBox('activeBrick',{
        //     width: 0.6,
        //     height: 0.3,
        //     depth: 0.3
        // }, scene);
        // activeBrick.material = brickMat;
        // activeBrick.position = new BABYLON.Vector3(-8, 0.15, 0); // Posición inicial en la zona de recogida

        // // Ladrillos disponibles para recoger (maximo 3)
        // const bricksCount = 3;
        // for (let i = 0; i < bricksCount; i++) {
        //     const brick = BABYLON.MeshBuilder.CreateBox(`pickupBrick_${i}`, {
        //         width: 0.6,
        //         height: 0.3,
        //         depth: 0.3
        //     }, scene);
        //     brick.material = brickMat;

        //     brick.position = new BABYLON.Vector3(
        //         -8 + (i - 1) * 0.7,
        //         0.15,
        //         0
        //     );
        //     pickupBricks.push(brick);
        // }

        // Carretilla (wheelbarrow) - Caja roja * Temporal
        const wheelbarrow = BABYLON.MeshBuilder.CreateBox('wheelbarrow', {
            width: 1.8,
            height: 0.6,
            depth: 1.2
        }, scene);
        wheelbarrow.material = wheelbarrowMat;
        wheelbarrow.position = new BABYLON.Vector3(-4, 0.3, -1); // Posición inicial de la carretilla


        // Extra ladrillos en zona de recogida "decoración"
        const pileBricks = [];
        for (let z = 0; z <= 5; z++) {
            for (let y = 0; y < 2; y++) {
                for (let x = -1; x <= 1; x++) {
                    const decoBrick = BABYLON.MeshBuilder.CreateBox('pileBrick', {
                        width: 0.6,
                        height: 0.3,
                        depth: 0.3
                    }, scene);
                    decoBrick.material = brickMat;
                    decoBrick.position = new BABYLON.Vector3(-8 + x * 0.7, 0.15 + y * 0.32, 0.5 + z * 0.35);
                    pileBricks.push(decoBrick);
                }
            }
        }




        // Muro en construcción: filas de ladrillos ya colocados
        const wallBricks = [];
        const baseWallX = 8;        // x central del muro
        const baseWallZ = 1.5;      // z del muro (centro)
        const wallStep = 0.65;      // separación entre ladrillos en z
        const baseWallY = 0.15;     // altura del primer ladrillo (base)
        const wallRowHeight = 0.32; // altura entre filas de ladrillos

        // 3 filas x 5 columnas de ladrillos a lo largo del eje Z
        for (let row = 0; row < 3; row++) {
            for (let col = 0; col < 5; col++) {
                const wb = BABYLON.MeshBuilder.CreateBox('wallBrick_${row}_${col}', {
                    width: 0.6,
                    height: 0.3,
                    depth: 0.3
                }, scene);
                wb.material = wallMat;

                wb.position = new BABYLON.Vector3(
                    baseWallX,
                    baseWallY + row * wallRowHeight,
                    baseWallZ + (col - 2) * wallStep
                );
                wb.rotation.y = Math.PI / 2; // Girar 90 grados para alinear con el muro
                wallBricks.push(wb);
            }
        }

        // La pared OBJETIVO a continuación de la ya construida
        // Config de la pared OBJETIVO empezando de la última col decorativa (col = 2)
        const deliveredStartZ = baseWallZ + (2 + 1) * wallStep; // un paso más allá del último ladrillo (col = 3 en adelante)

        // Zona de entrega: punto central para dejar los ladrillos
        const CenterDeliveredZ = deliveredStartZ + wallStep; // centro de las 3 columnas (col = 0..2)

        // Zona de entrega: área delimitada frente al muro
        const dropoffZone = BABYLON.MeshBuilder.CreateBox('dropoffZone', {
            width: 4,
            height: 0.1,
            depth: 3
        }, scene);
        dropoffZone.position = new BABYLON.Vector3(
            baseWallX - 1.5, // un poco adelantado respecto al muro
            0.05,
            CenterDeliveredZ
        );
        dropoffZone.material = dropoffZoneMat;


        // *** ESTRUCTURAS DE ESTADO ***
        const pickupBricks = []; // Ladrillos disponibles para recoger
        const bricksOnWheelbarrow = []; // Ladrillos actualmente en la carretilla
        const deliveredBricks = []; // Ladrillos ya entregados en la zona de entrega

        const state = {
            isPushingWheelbarrow: false,
            isGameOver: false,
            targetBricks: TARGET_BRICKS,
            batchSize: BATCH_SIZE,
            maxBricksOnWheelbarrow: MAX_BRICKS_ON_WHEELBARROW,
            totalDelivered: 0,
            brickIdCounter: 0
        };

        // ** METADATA PARA LA LÓGICA DEL JUEGO **
        //Referencias ordenadas para la siguiente fase del desarrollo
        // (movimiento, colisiones, etc.)
        scene.metadata = scene.metadata || {};
        scene.metadata = {
            game: {
                player,
                ground,
                pickupZone,
                dropoffZone,
                //activeBrick,
                pileBricks,
                wallBricks,
                // Referencias necesarias para la lógica de juego
                pickupBricks, // pila de ladrillos disponibles
                wheelbarrow,  // referencia a la carretilla
                bricksOnWheelbarrow,
                deliveredBricks,
                state,
                deliveredWallConfig: {
                    baseX: baseWallX,          // X fijo de TODA la pared (decorativa+objetivo)
                    startZ: deliveredStartZ,   // Z donde empieza el muro construido
                    bricksPerRow: 3,           // 3 columnas en Z
                    baseY: baseWallY,
                    rowHeight: wallRowHeight,
                    colStep: wallStep
                }
                // TODO: Añadir limites del mapa, camara, extras, etc.
            },
            ui: {}
        };


        // ** HUD (GUI) *** 
        setupUI(scene);

        // ** Ladrillos iniciales ***
        spawnPickupBath(scene);



        // *** INPUT (WASD + E) ***
        const inputMap = {};
        scene.metadata.inputMap = inputMap;

        // Observador de teclado (keydown / keyup)
        scene.onKeyboardObservable.add((kbinfo) => {
            const key = kbinfo.event.key.toLowerCase();

            switch (kbinfo.type) {
                case BABYLON.KeyboardEventTypes.KEYDOWN:
                    inputMap[key] = true;

                    // Tecla de acción 'E'
                    if (key === 'e') {
                        handleBrickAction(scene); // Interacción con ladrillos
                    } else if (key === 'f') {
                        handleWheelBarrowAction(scene); // Interacción con carretilla
                    }
                    break;
                case BABYLON.KeyboardEventTypes.KEYUP:
                    inputMap[key] = false;
                    break;
            }
        });


        // *** UPDATE POR FRAME ***
        scene.onBeforeRenderObservable.add(() => {
            const game = scene.metadata.game;
            const { player, state } = game;

            let moveForward = 0
            let rotateDir = 0;

            if (inputMap['w']) moveForward += 1;
            if (inputMap['s']) moveForward -= 1;
            if (inputMap['a']) rotateDir -= 1;
            if (inputMap['d']) rotateDir += 1;

            if (!state.isGameOver) {
                // Rotación del player (horizontal)
                if (rotateDir !== 0) {
                    player.rotation.y += rotateDir * ROT_SPEED;
                }

                // Avanzar / retroceder en la dirección actual (en la que mira)
                if (moveForward !== 0) {
                    const speed = state.isPushingWheelbarrow ? MOVE_SPEED_PUSHING : MOVE_SPEED;
                    const yaw = player.rotation.y;
                    const dirX = Math.sin(yaw);
                    const dirZ = Math.cos(yaw);

                    player.position.x += dirX * moveForward * speed;
                    player.position.z += dirZ * moveForward * speed;
                }
            }
            updateHUD(scene); // Actualizar HUD cada frame
        });

        // *** FUNCIÓN DE ACCIÓN / AUXILIARES ***
        function isFacing(player, targetPos, thresholdDot = 0.7) {
            // Vector desde el jugador hacia el objetivo (solo en XZ)
            const toTarget = targetPos.subtract(player.position);
            toTarget.y = 0;
            if (toTarget.lengthSquared() === 0) return true;
            toTarget.normalize();

            // Vector “forward” del jugador según su rotación Y
            const yaw = player.rotation.y;
            const forward = new BABYLON.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
            forward.normalize();

            const dot = BABYLON.Vector3.Dot(forward, toTarget);
            // dot = 1 → exactamente de frente, 0 → perpendicular, -1 → de espaldas
            return dot >= thresholdDot; // ~cos(45°), puedes subir/bajar el 0.7
        }


        function spawnPickupBath(scene) {
            const game = scene.metadata.game;
            const { pickupZone, pickupBricks, state } = game;

            if (state.totalDelivered >= state.targetBricks) return;

            const count = state.batchSize;
            const baseX = pickupZone.position.x;
            const baseZ = pickupZone.position.z;
            const offset = 0.7;

            for (let i = 0; i < count; i++) {
                const brick = BABYLON.MeshBuilder.CreateBox(
                    `pickupBrick_${state.brickIdCounter++}`,
                    {
                        width: 0.6,
                        height: 0.3,
                        depth: 0.3
                    },
                    scene
                );
                brick.material = brickMat;
                brick.position = new BABYLON.Vector3(
                    baseX + (i - (count - 1) / 2) * offset,
                    baseWallY,
                    baseZ
                );
                pickupBricks.push(brick);
            }
        }

        function computeDistances(game) {
            const playerPos = game.player.position;
            const wheelPos = game.wheelbarrow.getAbsolutePosition();
            const pickupPos = game.pickupZone.position;
            const dropoffPos = game.dropoffZone.position;

            return {
                playerWheel: BABYLON.Vector3.Distance(playerPos, wheelPos),
                wheelPickup: BABYLON.Vector3.Distance(wheelPos, pickupPos),
                wheelDrop: BABYLON.Vector3.Distance(wheelPos, dropoffPos),
            };
        }

        function handleWheelBarrowAction(scene) {
            const game = scene.metadata.game;
            const { player, wheelbarrow, state } = game;
            if (state.isGameOver) return;

            const dists = computeDistances(game);

            // Si ya la está empujando, soltarla en cualquier lugar
            if (state.isPushingWheelbarrow) {
                const worldPos = wheelbarrow.getAbsolutePosition().clone();
                wheelbarrow.setParent(null);
                wheelbarrow.position = worldPos;
                state.isPushingWheelbarrow = false;
                return;
            }

            // Si NO la está empujando, intentar tomarla si está cerca
            if (dists.playerWheel < ACTION_DISTANCE) {
                wheelbarrow.setParent(player);
                wheelbarrow.rotation.y = 0; // Alinear con el player
                wheelbarrow.position = new BABYLON.Vector3(0, 0.3, 1.5);
                state.isPushingWheelbarrow = true;
            }
        }

        function handleBrickAction(scene) {
            const game = scene.metadata.game;
            const {
                player,
                pickupZone,
                dropoffZone,
                wheelbarrow,
                pickupBricks,
                bricksOnWheelbarrow,
                deliveredBricks,
                state
            } = game;

            if (state.isGameOver) return;
            if (!state.isPushingWheelbarrow) return; // Solo con carretilla

            const dists = computeDistances(game);

            // 1. Intentar recoger ladrillos
            if (
                dists.wheelPickup < ACTION_DISTANCE &&
                bricksOnWheelbarrow.length < state.maxBricksOnWheelbarrow &&
                pickupBricks.length > 0 &&
                isFacing(player, pickupZone.position) // NUEVO: debe estar mirando a la pila
            ) {
                const brick = pickupBricks.shift();
                brick.setParent(wheelbarrow);

                const slotIndex = bricksOnWheelbarrow.length;
                const slots = [
                    new BABYLON.Vector3(-0.4, 0.4, 0),
                    new BABYLON.Vector3(0, 0.4, 0),
                    new BABYLON.Vector3(0.4, 0.4, 0)
                ];
                brick.position = slots[slotIndex] || new BABYLON.Vector3(0, 0.4, 0);
                bricksOnWheelbarrow.push(brick);
                return;
            }

            // 2. Intentar entregar ladrillos
            if (
                dists.wheelDrop < ACTION_DISTANCE &&
                bricksOnWheelbarrow.length > 0 &&
                isFacing(player, dropoffZone.position) // NUEVO: debe estar mirando a la pared / zona de entrega
            ) {
                const brick = bricksOnWheelbarrow.pop();
                brick.setParent(null);

                const cfg = game.deliveredWallConfig; // Configuración de la pared entregada
                const index = state.totalDelivered; // Índice del ladrillo a entregar
                const row = Math.floor(index / cfg.bricksPerRow); // Fila en Y
                const col = index % cfg.bricksPerRow;          // Columna en Z

                //MISMO EJE Z QUE EL MURO DECORATIVO, CONTINUANDO HACIA +Z
                brick.position = new BABYLON.Vector3(
                    cfg.baseX,
                    cfg.baseY + row * cfg.rowHeight,
                    cfg.startZ + col * cfg.colStep
                );
                brick.rotation.y = Math.PI / 2; // Girar 90 grados para alinear con el muro

                deliveredBricks.push(brick);
                state.totalDelivered++;

                checkProgress(scene);
            }
        }

        function checkProgress(scene) {
            const game = scene.metadata.game;
            const { pickupBricks, bricksOnWheelbarrow, state } = game;

            if (state.totalDelivered >= state.targetBricks) {
                state.isGameOver = true;
                return;
            }

            const noActiveBricks = pickupBricks.length === 0 && bricksOnWheelbarrow.length === 0;

            if (
                noActiveBricks &&
                state.totalDelivered > 0 &&
                state.totalDelivered < state.targetBricks &&
                state.totalDelivered % state.batchSize === 0
            ) {
                spawnPickupBath(scene);
            }
        }

        function setupUI(scene) {
            if (!BABYLON.GUI || !BABYLON.GUI.AdvancedDynamicTexture) {
                console.warn('Babylon GUI no está disponible, el HUD no se mostrará.');
                return;
            }

            const uiTex = BABYLON.GUI.AdvancedDynamicTexture.CreateFullscreenUI(
                'UI',
                true,
                scene
            );

            const panel = new BABYLON.GUI.StackPanel();
            panel.width = "30%";
            panel.isVertical = true;
            panel.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
            panel.verticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_TOP;
            panel.paddingTop = "10px";
            panel.paddingLeft = "10px";
            uiTex.addControl(panel);

            const hudCounter = new BABYLON.GUI.TextBlock("hudCounter");
            hudCounter.text = "";
            hudCounter.color = "rgb(16, 16, 197)";
            hudCounter.fontSize = 20;
            hudCounter.height = "30px";
            hudCounter.textHorizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
            panel.addControl(hudCounter);

            const hudHint = new BABYLON.GUI.TextBlock("hudHint");
            hudHint.text = "";
            hudHint.color = "rgb(16, 16, 197)";
            hudHint.fontSize = 16;
            hudHint.height = "100px";
            hudHint.textWrapping = true;
            hudHint.textHorizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
            panel.addControl(hudHint);

            scene.metadata.ui = {
                uiTex,
                hudCounter,
                hudHint
            };
        }

        function updateHUD(scene) {
            const ui = scene.metadata.ui;
            const game = scene.metadata.game;
            if (!ui || !ui.hudCounter || !ui.hudHint) return;

            const { hudCounter, hudHint } = ui;
            const { state, bricksOnWheelbarrow, pickupBricks } = game;

            const delivered = state.totalDelivered;
            const remaining = Math.max(0, state.targetBricks - delivered);

            hudCounter.text =
                `Ladrillos entregados: ${delivered} / ${state.targetBricks}` +
                ` | En carretilla: ${bricksOnWheelbarrow.length}` +
                ` | Faltan: ${remaining}`;

            if (state.isGameOver) {
                hudHint.text =
                    "Juego finalizado 🎉 Has apilado los 9 ladrillos y completado la pared.";
                return;
            }

            const dists = computeDistances(game);
            let hint = "W/S: avanzar/retroceder \nA/D: girar \nF: tomar/soltar carretilla \nE: interactuar con ladrillos";

            if (!state.isPushingWheelbarrow && dists.playerWheel < ACTION_DISTANCE) {
                hint = "Estás cerca de la carretilla. Pulsa F para tomarla.";
            } else if (state.isPushingWheelbarrow) {
                const facingPickup = isFacing(game.player, game.pickupZone.position);
                const facingDrop = isFacing(game.player, game.dropoffZone.position);

                if (
                    dists.wheelPickup < ACTION_DISTANCE &&
                    bricksOnWheelbarrow.length < state.maxBricksOnWheelbarrow &&
                    pickupBricks.length > 0
                ) {
                    if (facingPickup) {
                        hint =
                            "Carretilla en zona de recogida y de frente. Pulsa E para cargar un ladrillo (máx. 3).";
                    } else {
                        hint =
                            "Carretilla en zona de recogida. Gira con A/D para mirar la pila y luego pulsa E.";
                    }
                } else if (
                    dists.wheelDrop < ACTION_DISTANCE &&
                    bricksOnWheelbarrow.length > 0
                ) {
                    if (facingDrop) {
                        hint =
                            "Carretilla en zona de entrega y de frente. Pulsa E para descargar un ladrillo en la pared.";
                    } else {
                        hint =
                            "Carretilla en zona de entrega. Gira con A/D para mirar la pared y luego pulsa E.";
                    }
                } else {
                    hint =
                        "Empujando carretilla. F: soltar en cualquier momento. Acércate a zonas y mira hacia ellas para usar E.";
                }
            }


            hudHint.text = hint;
        }

        return scene;
    };

    const scene = createScene();

    engine.runRenderLoop(function () {
        if (scene) { scene.render(); }
    });

    window.addEventListener('resize', function () {
        engine.resize();
    });
});
