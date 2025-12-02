// main.js
// Escena base con modelos (player, wheelbarrow, brick) y cámara 3ª persona

// Constantes Globales
const ACTION_DISTANCE = 2.5; // distancia para interactuar con objetos
const MAX_BRICKS_ON_WHEELBARROW = 3 // número máximo de ladrillos en la carretilla
const TARGET_BRICKS = 9; // número de ladrillos a transportar para ganar
const PICKUP_BATCH_SIZE = 3; // número de ladrillos que se recogen de una vez

window.addEventListener("DOMContentLoaded", function () {
  const canvas = document.getElementById("renderCanvas");
  if (!canvas) {
    console.error("No se encontró el canvas #renderCanvas");
    return;
  }

  const engine = new BABYLON.Engine(canvas, true, {
    preserveDrawingBuffer: true,
    stencil: true,
  });

  // ───────────────────── HELPERS DE ESCALADO ─────────────────────

  // Escala un root (Mesh) para que toda su jerarquía tenga una altura targetHeight (en Y),
  // y recoloca para que la base quede apoyada sobre Y=0.
  function autoScaleToHeight(root, targetHeight) {
    const bounds = root.getHierarchyBoundingVectors();
    if (!bounds) return;
    const { min, max } = bounds;
    const size = max.subtract(min);
    const currentHeight = size.y || 1;

    const scale = targetHeight / currentHeight;
    root.scaling = new BABYLON.Vector3(scale, scale, scale);

    const bounds2 = root.getHierarchyBoundingVectors();
    const min2 = bounds2.min;
    const max2 = bounds2.max;
    const centerX = (min2.x + max2.x) * 0.5;
    const centerZ = (min2.z + max2.z) * 0.5;

    // Recentrar en XZ y alinear base a Y=0
    const offset = new BABYLON.Vector3(centerX, min2.y, centerZ);
    root.position = root.position.subtract(offset);
  }

  // Escala un root de forma uniforme para que su lado más largo mida targetSize
  // y deja su base apoyada en Y=0.
  function autoScaleToLongest(root, targetSize) {
    const bounds = root.getHierarchyBoundingVectors();
    if (!bounds) return;
    const { min, max } = bounds;
    const size = max.subtract(min);
    const longest = Math.max(size.x, size.y, size.z) || 1;

    const scale = targetSize / longest;
    root.scaling = new BABYLON.Vector3(scale, scale, scale);

    const bounds2 = root.getHierarchyBoundingVectors();
    const min2 = bounds2.min;
    const max2 = bounds2.max;
    const centerX = (min2.x + max2.x) * 0.5;
    const centerZ = (min2.z + max2.z) * 0.5;

    const offset = new BABYLON.Vector3(centerX, min2.y, centerZ);
    root.position = root.position.subtract(offset);
  }

  // ───────────────────── CARGA DE MODELOS GLB ─────────────────────

  function loadModels(scene) {
    const game = scene.metadata.game;
    const models = scene.metadata.models;

    // 🧍 PLAYER (glb)
    BABYLON.SceneLoader.ImportMesh(
      "",
      "assets/models/",          // 🔁 ajusta si usas otra carpeta
      "Worker.glb",       // 🔁 ajusta al nombre real del archivo
      scene,
      (meshes, particleSystems, skeletons, animationGroups) => {
        const root = new BABYLON.Mesh("playerModelRoot", scene);
        root.isPickable = false;

        meshes.forEach((m) => {
          m.parent = root;
          // m.showBoundingBox = true; // DEBUG: mostrar bounding box
        });

        // Orientar el modelo (suele venir acostado); prueba con X=+90°
        root.rotation = new BABYLON.Vector3(-Math.PI / 2, 0, 0);
        // Si lo ves de pie pero mirando hacia atrás, prueba:
        // root.rotation = new BABYLON.Vector3(Math.PI / 2, Math.PI, 0);

        // Escala para altura "humana" ≈ 1.8
        autoScaleToHeight(root, 1.8);

        // Colgar el modelo del nodo lógico playerNode
        root.parent = game.playerNode;

        // Guardar referencias en metadata
        const animGroups = animationGroups || [];
        models.playerRoot = root;
        models.playerAnimGroups = animGroups;

        // Mapeo de animaciones:
        // Queremos: Idle "neutro" para quieto, Walk para movimiento
        const byName = (name) =>
          animGroups.find((ag) => ag.name.toLowerCase().includes(name));

        // Idle: prioridad Idle_Neutral > Idle > cualquier otro con "idle"
        models.animIdle =
          byName("idle_neutral") ||
          byName("idle|") ||                 // "CharacterArmature|Idle"
          animGroups.find((ag) =>
            ag.name.toLowerCase().includes("idle")
          ) ||
          null;

        // Run: preferimos literalmente "run" antes que Walk
        models.animWalk =
          byName("run") ||
          byName("walk") || // fallback si no hubiera run
          null;

        models.currentAnim = null;

        // Parar todas las animaciones inicialmente
        animGroups.forEach((ag) => ag.stop());

        // Sombras
        const lights = scene.metadata.lights;
        const shadowGenerator = lights && lights.shadowGenerator;
        if (shadowGenerator) {
          meshes.forEach((m) => {
            shadowGenerator.addShadowCaster(m);
          });
        }

        console.log(
          "Player animations:",
          models.playerAnimGroups.map((ag) => ag.name)
        );
      }
    );

    // 🛒 WHEELBARROW (glb)
    BABYLON.SceneLoader.ImportMesh(
      "",
      "assets/models/",
      "Wheelbarrow.glb",  // 🔁 ajusta al nombre real
      scene,
      (meshes) => {
        const root = new BABYLON.Mesh("wheelbarrowModelRoot", scene);
        root.isPickable = false;

        meshes.forEach((m) => {
          m.parent = root;
          // m.showBoundingBox = true; // DEBUG: mostrar bounding box
        });

        // Orientar la carretilla para que su "frente" coincida con +Z
        root.rotation = new BABYLON.Vector3(0, -Math.PI / 2, 0);
        // Si la ves al revés, prueba:
        // root.rotation = new BABYLON.Vector3(0, Math.PI / 2, 0);

        // Escala a altura aprox 0.6
        autoScaleToHeight(root, 0.6);

        // Colgar del nodo lógico wheelbarrowNode
        root.parent = game.wheelbarrowNode;

        models.wheelbarrowRoot = root;

        // Sombras
        const lights = scene.metadata.lights;
        const shadowGenerator = lights && lights.shadowGenerator;
        if (shadowGenerator) {
          meshes.forEach((m) => {
            shadowGenerator.addShadowCaster(m);
          });
        }
      }
    );

    // 🧱 BRICK (plantilla glb)
    BABYLON.SceneLoader.ImportMesh(
      "",
      "assets/models/",
      "Brick.glb",        // 🔁 ajusta al nombre real
      scene,
      (meshes) => {
        const root = new BABYLON.Mesh("brickTemplateRoot", scene);
        root.isPickable = false;

        meshes.forEach((m) => {
          m.parent = root;
          // m.showBoundingBox = true; // DEBUG: mostrar bounding box
        });

        // Escalamos según su lado más largo para que "mida" ~0.6
        autoScaleToLongest(root, 0.6);

        // Opcional: orientar el ladrillo para que su largo quede alineado a Z
        root.rotation = new BABYLON.Vector3(0, Math.PI / 2, 0);

        // Dejarlo como plantilla invisible (se usará para clonar más adelante)
        root.setEnabled(false);
        root.isVisible = false;

        models.brickTemplate = root;

        // Pared decorativa en la zona de entrega
        buildDecorWall(scene);

        // Pila decorativa en recogida (lo veremos en el siguiente punto)
        buildPickupDecorStack(scene);

        // Generar ladrillos de recogida
        spawnPickupBricks(scene);

        // "test": clonar un ladrillo a la derecha del player para visualizarlo
        // const testBrick = root.clone("testBrick");
        // testBrick.setEnabled(true);
        // testBrick.isVisible = true;
        // testBrick.position = new BABYLON.Vector3(0, 0, 0);
        // registerBrickShadow(testBrick, scene);

        // Sombras
        const lights = scene.metadata.lights;
        const shadowGenerator = lights && lights.shadowGenerator;
        if (shadowGenerator) {
          meshes.forEach((m) => {
            shadowGenerator.addShadowCaster(m);
          });
        }
      }
    );

    // 🧱 PARED COMPLETA (wall.glb)
    BABYLON.SceneLoader.ImportMesh(
      "",
      "assets/models/",
      "Brick wall.glb",  // ajusta al nombre real
      scene,
      (meshes) => {
        const models = scene.metadata.models;
        const game = scene.metadata.game;

        const root = new BABYLON.Mesh("wallTemplateRoot", scene);
        root.isPickable = false;

        meshes.forEach((m) => {
          m.parent = root;
        });

        // Si viene acostada como los otros modelos:
        // root.rotation = new BABYLON.Vector3(Math.PI / 2, 0, 0);

        // Escala a una altura razonable (por ejemplo 2.4 unidades)
        autoScaleToHeight(root, 2.4);

        // Aseguramos base en Y=0
        const hb = root.getHierarchyBoundingVectors();
        const min = hb.min;
        root.position.y -= min.y;

        // Hacemos el template invisible
        root.setEnabled(false);
        root.isVisible = false;

        models.wallTemplate = root;

        // Sombras
        const lights = scene.metadata.lights;
        const shadowGenerator = lights && lights.shadowGenerator;
        if (shadowGenerator) {
          meshes.forEach((m) => {
            shadowGenerator.addShadowCaster(m);
          });
        }

        // Crear algunas paredes decorativas en el mapa
        buildFullDecorWalls(scene);
      }
    );

  }

  // ───────────────────── SPAWN DE LADRILLOS ─────────────────────

  function spawnPickupBricks(scene) {
    const game = scene.metadata.game;
    const models = scene.metadata.models;
    if (!game || !models || !models.brickTemplate) return;

    const pickupZone = game.pickupZone;
    const pickupBricks = game.pickupBricks;

    // Si ya hay ladrillos, no spwanear otra tanda (3)
    if (pickupBricks.length > 0) return;

    const base = pickupZone.position;

    // 3 posiciones fijas centradas en la zona
    const offsetX = [-1, 0, 1]; // separación en X siempre dentro de un ancho de 4

    for (let i = 0; i < PICKUP_BATCH_SIZE; i++) {
      const brick = models.brickTemplate.clone(`pickupBrick_${Date.now()}_${i}`);
      brick.setEnabled(true);
      brick.isVisible = true;

      resetBrickTransform(brick, scene);

      // Posicionar en fila
      brick.position = new BABYLON.Vector3(
        base.x + offsetX[i], // centrado en la zona
        0, // sobre el suelo
        base.z
      );

      game.pickupBricks.push(brick);

      // Registrar sombra
      registerBrickShadow(brick, scene);
    }
  }

  // ──────── HELPER RESETEAR ROTACION/ESCALA DE LADRILLOS ────────

  function resetBrickTransform(brick, scene) {
    const models = scene.metadata && scene.metadata.models;
    if (!models || !models.brickTemplate) return;

    const tpl = models.brickTemplate;

    // Nos aseguramos de no usar quaternions
    brick.rotationQuaternion = null;

    // Misma escala y orientación que la plantilla
    brick.scaling.copyFrom(tpl.scaling);
    brick.rotation.copyFrom(tpl.rotation);
  }

  // ──────── HELPER FIJAR LADRILLOS SOBRE CARRETILLA ────────

  function layoutBricksOnWheelbarrow(scene) {
    const game = scene.metadata.game;
    const models = scene.metadata.models;

    const wheelbarrowNode = game.wheelbarrowNode;
    const bricksOnWheelbarrow = game.bricksOnWheelbarrow;

    if (!wheelbarrowNode || !bricksOnWheelbarrow) return;

    // Slots fijos en espacio LOCAL de la carretilla
    const slots = [
      new BABYLON.Vector3(1.35, 0.4, 0.75),  // abajo
      new BABYLON.Vector3(1.35, 0.55, 0.8),  // centro
      new BABYLON.Vector3(1.35, 0.70, 0.85),  // arriba
    ];

    bricksOnWheelbarrow.forEach((brick, i) => {
      if (!brick) return;

      // Aseguramos parent, orientación y escala consistentes
      brick.setParent(wheelbarrowNode);
      resetBrickTransform(brick, scene);

      const idx = Math.min(i, slots.length - 1);
      brick.position.copyFrom(slots[idx]);  // posición local al wheelbarrow
    });
  }

  // ──────── HELPER PARED Y PILA DECORATIVAS ────────

  // Pared decorativa en zona de entrega
  function buildDecorWall(scene) {
    const game = scene.metadata.game;
    const models = scene.metadata.models;
    if (!models.brickTemplate) return;

    const dropZone = game.dropZone;
    const baseX = dropZone.position.x + 3; // pared un poco "detrás"
    const baseZ = dropZone.position.z - 2.75;

    const bricksPerRow = 5; // número de ladrillos por fila
    const rows = 9; // número de filas
    const rowHeight = 0.175; // altura entre filas de ladrillos
    const colStep = 0.62; // separación horizontal


    game.decorWallBricks = [];

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < bricksPerRow; c++) {
        const brick = models.brickTemplate.clone(
          `decorWallBrick_${r}_${c}_${Date.now()}`
        );
        brick.setEnabled(true);
        brick.isVisible = true;
        brick.setParent(null);
        resetBrickTransform(brick, scene);

        const colIndex = c - Math.floor((bricksPerRow - 1) / 2); // centrados

        brick.position = new BABYLON.Vector3(
          baseX,
          r * rowHeight,
          baseZ + colIndex * colStep
        );

        game.decorWallBricks.push(brick);

        registerBrickShadow(brick, scene);
      }
    }
  }

  // Pila decorativa en zona de recogida
  function buildPickupDecorStack(scene) {
    const game = scene.metadata.game;
    const models = scene.metadata.models;
    if (!models.brickTemplate) return;

    const pickupZone = game.pickupZone;
    const base = pickupZone.position;

    game.pickupDecorBricks = [];

    const width = 8;   // ladrillos en X
    const depth = 5;   // ladrillos en Z (fondo)
    const height = 3;  // filas en Y

    const colStep = 0.65; // separación en X
    const depthStep = 0.65;
    const rowHeight = 0.175;

    for (let y = 0; y < height; y++) {
      for (let z = 0; z < depth; z++) {
        for (let x = 0; x < width; x++) {
          const brick = models.brickTemplate.clone(
            `pickupDecor_${x}_${y}_${z}_${Date.now()}`
          );
          brick.setEnabled(true);
          brick.isVisible = true;
          brick.setParent(null);
          resetBrickTransform(brick, scene);

          const offsetX = -(x - 1) * colStep; // -1, 0, +1
          const offsetZ = (z + 2) * depthStep; // hacia "adelante" en -Z

          brick.position = new BABYLON.Vector3(
            base.x + offsetX,
            y * rowHeight,
            base.z + offsetZ
          );

          game.pickupDecorBricks.push(brick);

          registerBrickShadow(brick, scene);
        }
      }
    }
  }

  // Construir varias paredes decorativas en el mapa
  function buildFullDecorWalls(scene) {
    const game = scene.metadata.game;
    const models = scene.metadata.models;
    if (!models.wallTemplate) return;

    const walls = [];

    // Configs de posiciones y rotaciones
    const configs = [
      {
        // Una pared al fondo detrás de la zona de entrega
        position: new BABYLON.Vector3(
          game.dropZone.position.x + 2,
          0,
          game.dropZone.position.z - 2
        ),
        rotationY: Math.PI / 2,
      },
      {
        // Otra pared lateral izquierda del mapa
        position: new BABYLON.Vector3(-8, 0, -4),
        rotationY: 0,
      },
      {
        // Otra pared lateral derecha del mapa
        position: new BABYLON.Vector3(8, 0, 6),
        rotationY: Math.PI,
      },
    ];

    configs.forEach((cfg, i) => {
      const wall = models.wallTemplate.clone(`decorFullWall_${i}`);
      wall.setEnabled(true);
      wall.isVisible = true;
      wall.setParent(null);

      wall.position.copyFrom(cfg.position);
      wall.rotation.y = cfg.rotationY;

      walls.push(wall);

      // Que también proyecten sombra
      const lights = scene.metadata.lights;
      const shadowGenerator = lights && lights.shadowGenerator;
      if (shadowGenerator) {
        wall.getChildMeshes().forEach((m) => {
          shadowGenerator.addShadowCaster(m);
        });
      }
    });

    game.decorFullWalls = walls;
  }

  // ──────── HELPER LIMITES ────────
  const WORLD_LIMIT = 18; // límite en X/Z (suelo de 40 → margen de 2)
  const PLAYER_RADIUS = 0.7;
  const WHEELBARROW_RADIUS = 0.5;
  // const BRICK_RADIUS = 0.1;

  function canMovePlayerTo(newPos, scene) {
    const game = scene.metadata.game;
    const state = game.state;

    // 1) Limite del mundo (no salir del suelo)
    if (
      Math.abs(newPos.x) > WORLD_LIMIT ||
      Math.abs(newPos.z) > WORLD_LIMIT
    ) {
      return false;
    }

    // 2) Colisión con carretilla (solo si NO la estamos empujando)
    if (!state.isPushingWheelbarrow) {
      const wbPos = game.wheelbarrowNode.position;

      // Distancia actual del player a la carretilla
      const curPos = game.playerNode.position;
      const curDx = curPos.x - wbPos.x;
      const curDz = curPos.z - wbPos.z;
      const curDist2 = curDx * curDx + curDz * curDz;

      // Distancia con el nuevo movimiento propuesto
      const newDx = newPos.x - wbPos.x;
      const newDz = newPos.z - wbPos.z;
      const newDist2 = newDx * newDx + newDz * newDz;

      const minDist = PLAYER_RADIUS + WHEELBARROW_RADIUS;
      const minDist2 = minDist * minDist;

      // Solo bloqueamos si:
      // - el nuevo punto está dentro del radio
      // - y además nos estamos ACERCANDO (distancia nueva < actual)
      if (newDist2 < minDist2 && newDist2 < curDist2) {
        return false;
      }
    }

    // 3) Colisión con objetos "sólidos": ladrillos + paredes completas
    const solidObjects = [
      ...(game.decorWallBricks || []),
      ...(game.pickupDecorBricks || []),
      ...(game.deliveredBricks || []),
      ...(game.decorFullWalls || []),   // ⬅️ nuevas paredes completas
    ];

    for (const obj of solidObjects) {
      if (!obj || !obj.isEnabled()) continue;

      obj.computeWorldMatrix(true);
      const bbox = obj.getBoundingInfo().boundingBox;
      const min = bbox.minimumWorld;
      const max = bbox.maximumWorld;

      const minX = min.x - PLAYER_RADIUS;
      const maxX = max.x + PLAYER_RADIUS;
      const minZ = min.z - PLAYER_RADIUS;
      const maxZ = max.z + PLAYER_RADIUS;

      if (
        newPos.x >= minX && newPos.x <= maxX &&
        newPos.z >= minZ && newPos.z <= maxZ
      ) {
        return false;
      }
    }


    return true;
  }

  // ──────── HELPER RESTART ────────
  function resetGame(scene) {
    const game = scene.metadata.game;
    const state = game.state;

    // 1) Limpiar ladrillos interactivos actuales
    const allInteractive = [
      ...(game.pickupBricks || []),
      ...(game.bricksOnWheelbarrow || []),
      ...(game.deliveredBricks || []),
    ];

    allInteractive.forEach((brick) => {
      if (brick && !brick.isDisposed()) {
        brick.dispose();
      }
    });

    game.pickupBricks = [];
    game.bricksOnWheelbarrow = [];
    game.deliveredBricks = [];

    // 2) Resetear estado
    state.isPushingWheelbarrow = false;
    state.totalDelivered = 0;
    state.isGameOver = false;

    // 3) Resetear posición y rotación del jugador y la carretilla
    const player = game.playerNode;
    const wheelbarrow = game.wheelbarrowNode;

    player.position.set(0, 0, 0);
    player.rotation.y = 0;

    wheelbarrow.position.set(-4, 0, -2);
    wheelbarrow.rotation.y = 0;

    // 4) Generar nueva tanda de ladrillos en la zona de recogida
    spawnPickupBricks(scene);
  }

  // ──────── HELPER SOBRAS LADRILLOS ────────

  function registerBrickShadow(brick, scene) {
    const lights = scene.metadata.lights;
    if (!lights || !lights.shadowGenerator) return;

    const sg = lights.shadowGenerator;
    // includeDescendants = true por si el modelo tiene hijos
    sg.addShadowCaster(brick, true);
  }


  // ───────────────────── CREACIÓN DE ESCENA ─────────────────────

  const createScene = function () {
    const scene = new BABYLON.Scene(engine);
    // scene.clearColor = new BABYLON.Color4(0.9, 0.9, 0.95, 1.0);
    scene.clearColor = new BABYLON.Color4(0.8, 0.9, 1.0, 1.0);

    // SUELO
    const ground = BABYLON.MeshBuilder.CreateGround(
      "ground",
      { width: 40, height: 40, subdivisions: 4 }, // subdivisions para mejor calidad de luz
      scene
    );
    const groundMat = new BABYLON.StandardMaterial("groundMat", scene);
    groundMat.diffuseColor = new BABYLON.Color3(0.6, 0.55, 0.5);
    groundMat.specularColor = new BABYLON.Color3(0, 0, 0);
    groundMat.emissiveColor = new BABYLON.Color3(0.02, 0.02, 0.02);
    ground.material = groundMat;

    // Resivir sombras
    ground.receiveShadows = true;

    // Paredes de Borde (Primitivas)
    const borderWalls = [];
    const wallHeight = 2.5;
    const wallThickness = 0.3;
    const halfSize = 20; // tu ground es 40x40 → va de -20 a +20

    const borderMat = new BABYLON.StandardMaterial("borderWallMat", scene);
    borderMat.diffuseColor = new BABYLON.Color3(0.9, 0.9, 0.9);
    borderMat.specularColor = new BABYLON.Color3(0.5, 0.5, 0.5);

    // Norte (parte "atrás")
    const northWall = BABYLON.MeshBuilder.CreateBox("borderNorth", {
      width: 2 * halfSize,
      height: wallHeight,
      depth: wallThickness,
    }, scene);
    northWall.position = new BABYLON.Vector3(0, wallHeight / 2, -halfSize);
    northWall.material = borderMat;
    northWall.isPickable = false;
    borderWalls.push(northWall);

    // Sur (parte "delante")
    const southWall = northWall.clone("borderSouth");
    southWall.position.z = halfSize;
    borderWalls.push(southWall);

    // Oeste (izquierda)
    const westWall = BABYLON.MeshBuilder.CreateBox("borderWest", {
      width: wallThickness,
      height: wallHeight,
      depth: 2 * halfSize,
    }, scene);
    westWall.position = new BABYLON.Vector3(-halfSize, wallHeight / 2, 0);
    westWall.material = borderMat;
    westWall.isPickable = false;
    borderWalls.push(westWall);

    // Este (derecha)
    const eastWall = westWall.clone("borderEast");
    eastWall.position.x = halfSize;
    borderWalls.push(eastWall);

    // DEBUG: EJES TEMPORALES
    // Muestra ejes X (rojo), Y (verde), Z (azul) en el origen (0,0,0)
    // const axes = new BABYLON.AxesViewer(scene, 3);

    // NODOS LÓGICOS (no son figuras, solo "pivotes")
    const playerNode = new BABYLON.TransformNode("playerNode", scene);
    playerNode.position = new BABYLON.Vector3(0, 0, 0);

    const wheelbarrowNode = new BABYLON.TransformNode("wheelbarrowNode", scene);
    wheelbarrowNode.position = new BABYLON.Vector3(-4, 0, -2);

    // ZONA DE RECOGIDA Y ENTREGA DE LADRILLOS
    const pickupZone = BABYLON.MeshBuilder.CreateBox(
      "pickupZone",
      { width: 4, height: 0.1, depth: 4 },
      scene
    );
    pickupZone.position = new BABYLON.Vector3(-8, 0.05, 5);
    const pickupMat = new BABYLON.StandardMaterial("pickupMat", scene);
    pickupMat.diffuseColor = new BABYLON.Color3(0.3, 0.8, 0.3);
    pickupMat.alpha = 0.1;
    pickupZone.material = pickupMat;

    const dropZone = BABYLON.MeshBuilder.CreateBox(
      "dropZone",
      { width: 4, height: 0.1, depth: 4 },
      scene
    );
    dropZone.position = new BABYLON.Vector3(8, 0.05, -5);
    const dropMat = new BABYLON.StandardMaterial("dropMat", scene);
    dropMat.diffuseColor = new BABYLON.Color3(0.9, 0.8, 0.3);
    dropMat.alpha = 0.1;
    dropZone.material = dropMat;

    // ILUMINACIÓN
    // Luz hemisférica (cielo y suelo)
    const hemiLight = new BABYLON.HemisphericLight(
      "hemiLight",
      new BABYLON.Vector3(0, 1, 0),
      scene
    );
    hemiLight.intensity = 0.5;
    hemiLight.groundColor = new BABYLON.Color3(0.1, 0.1, 0.12);

    // Luz direccional (sol)
    const sunLight = new BABYLON.DirectionalLight(
      "sunLight",
      new BABYLON.Vector3(-0.5, -1, -0.4),
      scene
    );
    sunLight.position = new BABYLON.Vector3(20, 30, 20);
    sunLight.intensity = 0.9;

    // Sombras
    const shadowGenerator = new BABYLON.ShadowGenerator(2048, sunLight);
    shadowGenerator.useExponentialShadowMap = true;

    // CÁMARA 3ª PERSONA (orbitando el playerNode)
    const cam3p = new BABYLON.ArcRotateCamera(
      "cam3p",
      Math.PI * 1.25,          // ángulo horizontal
      Math.PI / 3,             // ángulo vertical
      30,                      // radio
      playerNode.position,     // target (mismo vector de posición)
      scene
    );
    cam3p.attachControl(canvas, true);
    // Ajustes básicos
    cam3p.lowerRadiusLimit = 6;
    cam3p.upperRadiusLimit = 40;
    // Limites verticales (ángulo polar)
    cam3p.lowerBetaLimit = 0.2;                  // no dejarla totalmente zenital
    cam3p.upperBetaLimit = Math.PI / 2.1;        // ≈ un poco más que 90°



    // CÁMARA 1ª PERSONA (pegada al "head" del playerNode)
    const fpCam = new BABYLON.FreeCamera(
      "fpCam",
      new BABYLON.Vector3(5, 1.75, 0.15), // posición inicial (se recalcula por el parent)
      scene
    );
    // La cámara se mueve con el playerNode
    fpCam.parent = playerNode;
    fpCam.position = new BABYLON.Vector3(0, 1.75, 0.15); // altura aprox. de los ojos
    // Ajustes básicos
    fpCam.minZ = 0.1;                         // plano cercano
    fpCam.speed = 0.6;                        // velocidad de movimiento
    fpCam.inertia = 0.7;                      // suavizado al mover
    fpCam.fov = BABYLON.Tools.ToRadians(75);  // campo de visión

    fpCam.checkCollisions = false;
    fpCam.applyGravity = false;

    // Metadatos básicos (para usar luego con lógica del juego)
    scene.metadata = {
      game: {
        ground,
        playerNode,
        wheelbarrowNode,
        pickupZone,
        dropZone,
        pickupBricks: [], // ladrillos disponibles para recoger
        bricksOnWheelbarrow: [], // ladrillos actualmente en la carretilla
        deliveredBricks: [], // ladrillos ya entregados
        decorWallBricks: [], // ladrillos usados para el muro decorativo
        pickupDecorBricks: [], // ladrillos para el muro decorativo (zona de recogida)
        decorFullWalls: [], // paredes completas
        borderWalls,
        state: {
          isPushingWheelbarrow: false,
          totalDelivered: 0,
          targetBricks: TARGET_BRICKS,
          isGameOver: false,
        },
      },
      camera: {
        mode: "third", // "first" | "third"
        cam3p,
        fpCam,
      },
      models: {
        playerRoot: null,
        playerAnimGroups: [],
        wheelbarrowRoot: null,
        brickTemplate: null,
        wallTemplate: null,
        animIdle: null,
        animWalk: null,
        currentAnim: null,
      },
      input: {
        forward: false,
        back: false,
        left: false,
        right: false,
      },
      lights: {
        hemiLight,
        sunLight,
        shadowGenerator,
      },
    };

    // ──────────────────── HUD (Babylon GUI) ────────────────────
    let ui = null;

    if (BABYLON.GUI) {
      const advancedTexture = BABYLON.GUI.AdvancedDynamicTexture.CreateFullscreenUI(
        "UI",
        true,
        scene
      );

      // Contenedor semi-transparente (arriba a la izquierda)
      const infoContainer = new BABYLON.GUI.Rectangle("infoContainer");
      infoContainer.width = "280px";
      infoContainer.height = "130px";
      infoContainer.cornerRadius = 10;
      infoContainer.thickness = 0;          // sin borde
      infoContainer.background = "rgba(237, 237, 243, 1)";   // color de fondo
      infoContainer.alpha = 0.6;            // semitransparente
      infoContainer.horizontalAlignment =
        BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
      infoContainer.verticalAlignment =
        BABYLON.GUI.Control.VERTICAL_ALIGNMENT_TOP;
      infoContainer.paddingLeft = "10px";
      infoContainer.paddingTop = "10px";
      advancedTexture.addControl(infoContainer);

      // Texto principal (arriba a la izquierda)
      const infoText = new BABYLON.GUI.TextBlock();
      infoText.text = "";
      infoText.color = "rgba(39, 35, 224, 1)";
      infoText.fontSize = 18;
      infoText.textHorizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
      infoText.textVerticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_TOP;
      infoText.paddingLeft = "20px";
      infoText.paddingTop = "20px";
      advancedTexture.addControl(infoText);

      // Contenedor de acciones (abajo en el centro)
      const actionContainer = new BABYLON.GUI.Rectangle("actionContainer");
      actionContainer.width = "480px";
      actionContainer.height = "50px";
      actionContainer.cornerRadius = 10;
      actionContainer.thickness = 0;
      actionContainer.background = "rgba(202, 228, 110, 1)";
      actionContainer.alpha = 0.6;
      actionContainer.horizontalAlignment =
        BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_CENTER;
      actionContainer.verticalAlignment =
        BABYLON.GUI.Control.VERTICAL_ALIGNMENT_BOTTOM;
      actionContainer.paddingBottom = "20px";
      advancedTexture.addControl(actionContainer);

      // Texto de acciones (abajo en el centro)
      const actionText = new BABYLON.GUI.TextBlock();
      actionText.text = "";
      actionText.color = "rgba(0, 0, 0, 1)";
      actionText.fontSize = 20;
      actionText.textHorizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_CENTER;
      actionText.textVerticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_BOTTOM;
      actionText.paddingBottom = "25px";
      advancedTexture.addControl(actionText);

      ui = {
        advancedTexture,
        infoText,
        actionText,
      };
    } else {
      console.warn("Babylon GUI no está disponible, el HUD no se mostrará.");
    }

    scene.metadata.ui = ui;


    // Cargar modelos .glb
    loadModels(scene);

    // ───────────────────── FUNCIONES HELPER ─────────────────────
    // Cambia a cámara en 3ª persona
    function switchToThirdPerson() {
      const camState = scene.metadata.camera;

      if (scene.activeCamera === camState.cam3p) return;

      if (scene.activeCamera) {
        scene.activeCamera.detachControl(canvas);
      }

      camState.mode = "third";
      scene.activeCamera = camState.cam3p;
      scene.activeCamera.attachControl(canvas, true);
      // Por si salimos de pointer lock
      if (document.exitPointerLock && document.pointerLockElement === canvas) {
        document.exitPointerLock();
      }
    }

    // Cambia a cámara en 1ª persona
    function switchToFirstPerson() {
      const camState = scene.metadata.camera;

      if (scene.activeCamera === camState.fpCam) return;

      if (scene.activeCamera) {
        scene.activeCamera.detachControl(canvas);
      }

      camState.mode = "first";
      scene.activeCamera = camState.fpCam;
      scene.activeCamera.attachControl(canvas, true);
    }

    // Sincronizar orientación del player con la cámara 1ª persona
    function updatePlayerAnimation(isMoving) {
      const models = scene.metadata.models;
      const groups = models.playerAnimGroups;
      if (!groups || groups.length === 0) return;

      const desired = isMoving ? "walk" : "idle";
      if (models.currentAnim === desired) return;

      // Para Todo
      groups.forEach((ag) => ag.stop());

      let target = null;
      if (desired === "walk") {
        target = models.animWalk || models.animIdle || groups[0];
      } else {
        target = models.animIdle || models.animWalk || groups[0];
      }

      if (target) {
        target.reset(); // desde el inicio
        target.start(true); // loop
      }

      models.currentAnim = desired;
    }

    const INTERACT_DISTANCE = 2.5; // distancia para interactuar con la carretilla

    // Función para tomar/soltar carretilla (tecla "f")
    function handleWheelbarrowTogle() {
      const game = scene.metadata.game;
      const { playerNode, wheelbarrowNode, state } = game;

      if (state.isGameOver) return;

      const dist = BABYLON.Vector3.Distance(
        playerNode.position,
        wheelbarrowNode.position
      );

      if (!state.isPushingWheelbarrow) {
        // Intentar tomar la carretilla
        if (dist <= INTERACT_DISTANCE) {
          state.isPushingWheelbarrow = true;
          // Opcional: pequeño "snap" inicial delante del player
          const yaw = playerNode.rotation.y;
          const forward = new BABYLON.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
          const offset = 2.0; // distancia delante del player
          wheelbarrowNode.position = playerNode.position.add(
            forward.scale(offset)
          );
          wheelbarrowNode.position.y = 0; // asegurar en suelo
          wheelbarrowNode.rotation.y = playerNode.rotation.y;
        }
      } else {
        // Soltar la carretilla
        game.state.isPushingWheelbarrow = false;
      }
    }

    // Función para la interacción de ladrillos (tecla "e")
    function handleBrickAction() {
      const game = scene.metadata.game;
      const models = scene.metadata.models;

      const { playerNode, wheelbarrowNode, pickupZone, dropZone } = game;
      const { pickupBricks, bricksOnWheelbarrow, deliveredBricks, state } = game;

      if (state.isGameOver) return;

      if (!state.isPushingWheelbarrow) {
        // Sólo interactuamos con ladrillos si estamos empujando la carretilla
        return;
      }
      if (!models.brickTemplate) return;

      const distPickup = BABYLON.Vector3.Distance(
        wheelbarrowNode.position,
        pickupZone.position
      );
      const distDrop = BABYLON.Vector3.Distance(
        wheelbarrowNode.position,
        dropZone.position
      );

      // 1) CARGAR ladrillos en la carretilla (zona de recogida)
      if (
        distPickup < ACTION_DISTANCE &&
        bricksOnWheelbarrow.length < MAX_BRICKS_ON_WHEELBARROW &&
        pickupBricks.length > 0
      ) {
        const brick = pickupBricks.shift();  // sacamos uno de la zona

        // Lo añadimos a la lista "lógica" de la carretilla
        game.bricksOnWheelbarrow.push(brick);

        // Dejamos que una sola función decida posiciones/orientaciones
        layoutBricksOnWheelbarrow(scene);

        return;
      }

      // 2) DESCARGAR ladrillos en la zona de entrega
      if (distDrop < ACTION_DISTANCE && bricksOnWheelbarrow.length > 0) {
        const brick = bricksOnWheelbarrow.pop();
        brick.setParent(null); // ya no sigue a la carretilla

        resetBrickTransform(brick, scene);

        const index = state.totalDelivered; // 0..N-1
        const bricksPerRow = 3;
        const row = Math.floor(index / bricksPerRow);
        const col = index % bricksPerRow;

        const baseX = dropZone.position.x;
        const baseZ = dropZone.position.z;
        const rowHeight = 0.175;  // altura entre filas de ladrillos
        const colStep = 0.62;    // separación horizontal

        brick.position = new BABYLON.Vector3(
          baseX + 3,
          row * rowHeight,                      // altura por fila
          baseZ + (col - 1) * colStep           // centrado en la zona
        );

        deliveredBricks.push(brick);
        state.totalDelivered++;

        // Registrar sombra
        registerBrickShadow(brick, scene);

        // Comprobar si se ha alcanzado el objetivo
        if (state.totalDelivered >= state.targetBricks) {
          state.isGameOver = true;
        }

        layoutBricksOnWheelbarrow(scene);

        // Opcional: cuando se haya entregado un múltiplo de 3 y aún hay objetivo → respawn
        if (
          state.totalDelivered < state.targetBricks &&
          pickupBricks.length === 0 &&
          bricksOnWheelbarrow.length === 0 &&
          state.totalDelivered % PICKUP_BATCH_SIZE === 0
        ) {
          spawnPickupBricks(scene);
        }
      }
    }

    // Función para actualizar el HUD
    function updateHud() {
      const ui = scene.metadata.ui;
      if (!ui) return;

      const game = scene.metadata.game;
      const { state, pickupBricks, bricksOnWheelbarrow } = game;

      const remaining = Math.max(
        0,
        state.targetBricks - state.totalDelivered
      );

      // Texto de estado (arriba izquierda)
      ui.infoText.text =
        `Ladrillos en carretilla: ${bricksOnWheelbarrow.length}/${MAX_BRICKS_ON_WHEELBARROW}\n` +
        `Ladrillos entregados: ${state.totalDelivered}/${state.targetBricks}\n` +
        `Ladrillos en zona de recogida: ${pickupBricks.length}\n` +
        (state.isGameOver ? "¡Muro terminado! 🎉" : "") +
        `\n` +
        `R: Reiniciar juego\n`;

      // Texto de acciones (abajo)
      let actions = [];

      // F siempre es relevante si la carretilla está cerca
      const player = game.playerNode;
      const wheelbarrow = game.wheelbarrowNode;
      const distPlayerWheel = BABYLON.Vector3.Distance(
        player.position,
        wheelbarrow.position
      );
      if (distPlayerWheel < ACTION_DISTANCE) {
        actions.push("F: Tomar / soltar carretilla");
      }

      // E depende de si estamos empujando y de la zona
      if (!state.isGameOver && state.isPushingWheelbarrow) {
        const distPickup = BABYLON.Vector3.Distance(
          wheelbarrow.position,
          game.pickupZone.position
        );
        const distDrop = BABYLON.Vector3.Distance(
          wheelbarrow.position,
          game.dropZone.position
        );

        if (
          distPickup < ACTION_DISTANCE &&
          pickupBricks.length > 0 &&
          bricksOnWheelbarrow.length < MAX_BRICKS_ON_WHEELBARROW
        ) {
          actions.push("E: Cargar ladrillo");
        }

        if (
          distDrop < ACTION_DISTANCE &&
          bricksOnWheelbarrow.length > 0
        ) {
          actions.push("E: Descargar ladrillo");
        }
      }

      ui.actionText.text = actions.join("   ·   ");
    }

    // Empezar en cámara 3ª persona
    switchToThirdPerson();

    // ───────────────────── KEYBOARD INPUTS ─────────────────────
    const input = scene.metadata.input;
    const camState = scene.metadata.camera;

    // Toggle entre cámara 1ª y 3ª persona (tecla 'v') y movimiento WASD
    scene.onKeyboardObservable.add((kbInfo) => {
      const key = kbInfo.event.key.toLowerCase();
      const isDown = kbInfo.type === BABYLON.KeyboardEventTypes.KEYDOWN;

      switch (key) {
        case "w":
          input.forward = isDown;
          break;
        case "s":
          input.back = isDown;
          break;
        case "a":
          input.left = isDown;
          break;
        case "d":
          input.right = isDown;
          break;
        case "v":
          if (isDown) {
            if (camState.mode === "third") {
              switchToFirstPerson();
            } else {
              switchToThirdPerson();
            }
          }
          break;
        case "f":
          if (isDown) {
            handleWheelbarrowTogle();
          }
          break;
        case "e":
          if (isDown) {
            handleBrickAction();
          }
          break;
        case "r":
          if (isDown) resetGame(scene);   // ⬅️ RESET
          break;
      }
    });

    // Pointer lock en cámara 1ª persona al hacer click
    scene.onPointerDown = function () {
      const camState = scene.metadata.camera;
      if (camState.mode === "first") {
        if (canvas.requestPointerLock) {
          canvas.requestPointerLock();
        }
      }
    };

    // Update loop
    scene.onBeforeRenderObservable.add(() => {
      const dt = scene.getEngine().getDeltaTime() / 1000; // segundos
      const game = scene.metadata.game;
      const camState = scene.metadata.camera;
      const input = scene.metadata.input;

      const player = game.playerNode;
      const wheelbarrow = game.wheelbarrowNode;
      const state = game.state;

      // Si el juego terminó, no actualizamos movimiento ni carretilla
      if (state.isGameOver) {
        updateHud();
        return;
      }

      // 1. Si esta en 1ª persona, sincronizar yaw del player con la cámara
      if (camState.mode === "first" && camState.fpCam) {
        const cam = camState.fpCam;

        // Solo yaw (eje Y)
        const yawDelta = cam.rotation.y;

        if (Math.abs(yawDelta) > 1e-4) {
          player.rotation.y += yawDelta;
          // Reset rotación cámara para evitar acumulación
          cam.rotation.y = 0;
        }
        // Pitch (eje X) se mantiene en la cámara, el cuerpo no se inclina
      }

      // 2. Movimiento básico del player con WASD tipo TANK (sobre playerNode)
      const moveSpeed = 4;    // unidades por segundo
      const turnSpeed = 2.5;  // radianes por segundo

      let turn = 0;
      if (input.left) turn -= 1;
      if (input.right) turn += 1;
      player.rotation.y += turn * turnSpeed * dt;

      let move = 0;
      if (input.forward) move += 1;
      if (input.back) move -= 1;

      let isMoving = false;

      if (move !== 0) {
        const yaw = player.rotation.y;
        const forward = new BABYLON.Vector3(
          Math.sin(yaw),
          0,
          Math.cos(yaw)
        );
        const displacement = forward.scale(move * moveSpeed * dt);
        const newPos = player.position.add(displacement);

        if (canMovePlayerTo(newPos, scene)) {
          player.position.copyFrom(newPos);
          isMoving = true;
        } else {
          isMoving = false;
        }
      }

      // 3. Si está empujando la carretilla, moverla junto al player
      if (state.isPushingWheelbarrow) {
        const yaw = player.rotation.y;
        const forward = new BABYLON.Vector3(Math.sin(yaw), 0, Math.cos(yaw));

        const offsetDist = 1.5; // distancia delante del player
        const targetPos = player.position.add(forward.scale(offsetDist));

        wheelbarrow.position.copyFrom(targetPos);
        wheelbarrow.position.y = 0; // asegurar en suelo
        wheelbarrow.rotation.y = player.rotation.y;
      }

      // 4. Asegurar que la cámara 3ª persona sigue al player
      if (camState.cam3p && camState.cam3p.lockedTarget !== player) {
        camState.cam3p.lockedTarget = player;
      }

      // 5. Actualizar animaciones del player según estado
      updatePlayerAnimation(isMoving);

      // 6. Actualizar HUD
      updateHud();
    });

    return scene;
  };

  const scene = createScene();

  engine.runRenderLoop(function () {
    if (scene) {
      scene.render();
    }
  });

  window.addEventListener("resize", function () {
    engine.resize();
  });
});