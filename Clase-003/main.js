// main.js - escena de ejemplo que usa texturas locales y carga de modelos
(function () {
  var canvas = document.getElementById('renderCanvas');
  var engine = new BABYLON.Engine(canvas, true);

  var createScene = function () {
    var scene = new BABYLON.Scene(engine);

    var camera = new BABYLON.FreeCamera('camera1', new BABYLON.Vector3(0, 5, -15), scene);
    camera.setTarget(BABYLON.Vector3.Zero());
    camera.attachControl(canvas, true);

    var light = new BABYLON.HemisphericLight('light', new BABYLON.Vector3(0, 1, 0), scene);
    light.intensity = 0.9;

    // Texturas locales (coloca archivos en assets/textures)
    var woodMat = new BABYLON.StandardMaterial('woodMat', scene);
    woodMat.diffuseTexture = new BABYLON.Texture('assets/textures/madera.jpg', scene);

    var box = BABYLON.MeshBuilder.CreateBox('box', { size: 2 }, scene);
    box.position = new BABYLON.Vector3(-4, 1, 0);
    box.material = woodMat;

    var marbleMat = new BABYLON.StandardMaterial('marbleMat', scene);
    marbleMat.diffuseTexture = new BABYLON.Texture('assets/textures/marmol.jpg', scene);

    var sphere = BABYLON.MeshBuilder.CreateSphere('sphere', { diameter: 2 }, scene);
    sphere.position = new BABYLON.Vector3(-1.5, 1, 0);
    sphere.material = marbleMat;

    var metalMat = new BABYLON.StandardMaterial('metalMat', scene);
    metalMat.diffuseTexture = new BABYLON.Texture('assets/textures/metal.jpg', scene);

    var cylinder = BABYLON.MeshBuilder.CreateCylinder('cylinder', { height: 2, diameter: 1.5 }, scene);
    cylinder.position = new BABYLON.Vector3(1.5, 1, 0);
    cylinder.material = metalMat;

    var brickMat = new BABYLON.StandardMaterial('brickMat', scene);
    brickMat.diffuseTexture = new BABYLON.Texture('assets/textures/ladrillo.jpg', scene);

    var torus = BABYLON.MeshBuilder.CreateTorus('torus', { diameter: 2, thickness: 0.5 }, scene);
    torus.position = new BABYLON.Vector3(4, 1, 0);
    torus.material = brickMat;

    var groundMat = new BABYLON.StandardMaterial('groundMat', scene);
    groundMat.diffuseTexture = new BABYLON.Texture('assets/textures/cesped.jpg', scene);

    var ground = BABYLON.MeshBuilder.CreateGround('ground', { width: 12, height: 12 }, scene);
    ground.material = groundMat;

    // Ejemplo: cargar un modelo glTF/GLB desde carpeta local 'assets/models/'
    // Coloca tu archivo (ej: model.glb) en: Clase-003/assets/models/model.glb
    var modelPath = 'assets/models/';
    var modelFile = 'Yeti.gltf'; // cargamos el Yeti.gltf que agregaste

    // Comprobamos si el archivo existe antes de intentar cargarlo (evita 404 en la consola)
    fetch(modelPath + modelFile, { method: 'HEAD' }).then(function (resp) {
      if (resp.ok) {
        console.log('Cargando modelo:', modelPath + modelFile);
        BABYLON.SceneLoader.ImportMesh('', modelPath, modelFile, scene, function (meshes, particleSystems, skeletons, animationGroups) {
          console.log('Modelo cargado, número de meshes:', meshes.length);

          // Crear un nodo padre para controlar posición/escala del conjunto
          var root = new BABYLON.TransformNode('yetiRoot', scene);
          meshes.forEach(function (m) {
            m.parent = root;
            try { m.receiveShadows = true; } catch (e) {}
          });

          // Calcular bounds combinados del conjunto para escalado automático
          var overallMin = new BABYLON.Vector3(Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY);
          var overallMax = new BABYLON.Vector3(Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY);
          meshes.forEach(function (m) {
            if (m.getBoundingInfo) {
              var bmin = m.getBoundingInfo().boundingBox.minimumWorld;
              var bmax = m.getBoundingInfo().boundingBox.maximumWorld;
              overallMin.x = Math.min(overallMin.x, bmin.x);
              overallMin.y = Math.min(overallMin.y, bmin.y);
              overallMin.z = Math.min(overallMin.z, bmin.z);
              overallMax.x = Math.max(overallMax.x, bmax.x);
              overallMax.y = Math.max(overallMax.y, bmax.y);
              overallMax.z = Math.max(overallMax.z, bmax.z);
            }
          });

          var size = overallMax.subtract(overallMin);
          var maxDim = Math.max(size.x, size.y, size.z);
          if (!isFinite(maxDim) || maxDim === 0) { maxDim = 1.0; }

          // Tamaño deseado máximo en la escena (ajusta según prefieras)
          var desiredMax = 2.0;
          var scaleFactor = desiredMax / maxDim;
          // No escalar a 0 o NaN
          if (!isFinite(scaleFactor) || scaleFactor <= 0) { scaleFactor = 1.0; }

          root.scaling = new BABYLON.Vector3(scaleFactor, scaleFactor, scaleFactor);

          // Posicionar para que la base del modelo quede en y=0 (suelo)
          var targetPos = new BABYLON.Vector3(0, 0, 4);
          // overallMin.y está en coordenadas mundo; al aplicar escala, ajustar la posición
          var yOffset = -overallMin.y * scaleFactor;
          root.position = targetPos.add(new BABYLON.Vector3(0, yOffset, 0));

          console.log('Bounds:', overallMin, overallMax, 'size:', size, 'scaleFactor:', scaleFactor, 'yOffset:', yOffset);

          // Si el glTF incluye animaciones, iniciarlas (si existen)
          if (animationGroups && animationGroups.length) {
            animationGroups.forEach(function (ag) { ag.start(true); });
            console.log('Animaciones iniciadas:', animationGroups.length);
          }
        }, null, function (scene, message) {
          console.warn('Error cargando modelo:', message);
        });
      } else {
        console.log('No se encontró', modelPath + modelFile, '— saltando carga.');
      }
    }).catch(function (err) {
      console.log('Error comprobando modelo:', err);
    });

    return scene;
  };

  var scene = createScene();

  engine.runRenderLoop(function () {
    scene.render();
  });

  window.addEventListener('resize', function () {
    engine.resize();
  });
})();
