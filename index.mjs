/**
 * Ce code s'inspire du tutoriel sur la détection des arêtes en utilisant Three.js,
 * par Dustin John Pfister. [4]
 * Source: https://dustinpfister.github.io/2021/05/31/threejs-edges-geometry/ 
 * For this work I also utilized generative AI assistance.
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';

// Création de la scène, caméra et renderer
const scene = new THREE.Scene();
const perspectiveCamera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
perspectiveCamera.position.set(0, 0, 2);

const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.getElementById('visualization').appendChild(renderer.domElement);

// Configuration du polytope
let geometry = new THREE.BoxGeometry(1, 1, 1);
geometry = geometry.toNonIndexed(); // Convertir immédiatement en géométrie non indexée
let material = new THREE.MeshBasicMaterial({ color: 0x00ff00, wireframe: true });
let cube = new THREE.Mesh(geometry, material);
scene.add(cube);

// Orthographic Camera
const aspectRatio = window.innerWidth / window.innerHeight;
const orthographicCamera = new THREE.OrthographicCamera(-aspectRatio, aspectRatio, 1, -1, 0.1, 1000);
orthographicCamera.position.set(0, 0, 2);

// Start with Perspective Camera
let activeCamera = perspectiveCamera;

// Function to switch cameras
function switchCamera() {
  activeCamera = activeCamera === perspectiveCamera ? orthographicCamera : perspectiveCamera;
  controls.object = activeCamera; // Update controls to use the active camera
  needsUpdate = true; // Set flag to update the scene

  // Update the camera status text
  const cameraStatusText = activeCamera === perspectiveCamera ? "Perspective" : "Orthographic";
  document.getElementById('cameraStatus').textContent = `Camera: ${cameraStatusText}`;
}

// Sélection du polytope
const polytopeSelector = document.getElementById('polytopeSelector');
polytopeSelector.addEventListener('change', changePolytope);

let totalUniqueEdgeCount = 12;

function changePolytope(event) {
  let newGeometry;

  switch (event.target.value) {
    case 'cube':
      newGeometry = new THREE.BoxGeometry(1, 1, 1);
      totalUniqueEdgeCount = 12; // Cube has 12 edges
      break;
    case 'tetrahedron':
      newGeometry = new THREE.TetrahedronGeometry(1);
      totalUniqueEdgeCount = 6; // Tetrahedron has 6 edges
      break;
    case 'octahedron':
      newGeometry = new THREE.OctahedronGeometry(1);
      totalUniqueEdgeCount = 12; // Octahedron has 12 edges
      break;
    case 'dodecahedron':
      newGeometry = new THREE.DodecahedronGeometry(1);
      totalUniqueEdgeCount = 30; // Dodecahedron has 30 edges
      break;
    case 'icosahedron':
      newGeometry = new THREE.IcosahedronGeometry(1);
      totalUniqueEdgeCount = 30; // Icosahedron has 30 edges
      break;
        }

     // Check if the geometry is indexed and convert if necessary
     let nonIndexedGeometry = newGeometry.index !== null ? newGeometry.toNonIndexed() : newGeometry;

     // Dispose of the old geometry and assign new geometry
     cube.geometry.dispose();
     cube.geometry = nonIndexedGeometry;
 
     // Recalculate normals if necessary
     cube.geometry.computeVertexNormals();
 
      // Trigger silhouette and complexity recalculation
      needsUpdate = true;
      updateComplexityDisplay();  // Call without parameter
      onCameraOrPolytopeChange();
}
     


// Configuration des contrôles
const controls = new OrbitControls(activeCamera, renderer.domElement);
controls.addEventListener('change', () => needsUpdate = true);

// Gestionnaire de redimensionnement
window.addEventListener('resize', onWindowResize, false);
function onWindowResize() {
    activeCamera.aspect = window.innerWidth / window.innerHeight;
    activeCamera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}
  
function computeEdgeVisibility(bufferGeometry, camera) {
  const edgeVisibility = {};
  const positionAttribute = bufferGeometry.attributes.position;
  const isOrthographic = camera.isOrthographicCamera;
  const cameraDirection = isOrthographic
      ? new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion).normalize()
      : camera.getWorldDirection(new THREE.Vector3()).normalize();

  for (let i = 0; i < positionAttribute.count; i += 3) {
      const vertices = [
          new THREE.Vector3().fromBufferAttribute(positionAttribute, i),
          new THREE.Vector3().fromBufferAttribute(positionAttribute, i + 1),
          new THREE.Vector3().fromBufferAttribute(positionAttribute, i + 2),
      ];

      const normal = new THREE.Vector3();
      normal.crossVectors(
          vertices[1].clone().sub(vertices[0]),
          vertices[2].clone().sub(vertices[0])
      ).normalize();

      let viewVector;
      if (isOrthographic) {
          viewVector = cameraDirection;
      } else {
          const triangleCenter = new THREE.Vector3().add(vertices[0]).add(vertices[1]).add(vertices[2]).divideScalar(3);
          viewVector = new THREE.Vector3().subVectors(triangleCenter, camera.position).normalize();
      }

      const isVisible = normal.dot(viewVector) > 0;

      for (let j = 0; j < vertices.length; j++) {
          const nextIndex = (j + 1) % vertices.length;
          const edge = [vertices[j], vertices[nextIndex]];
          const edgeKey = edge.map(vertex => vertex.toArray().join(',')).sort().join('-');
          if (!edgeVisibility[edgeKey]) {
              edgeVisibility[edgeKey] = { count: 0, vertices: edge };
          }
          if (isVisible) {
              edgeVisibility[edgeKey].count++;
          }
      }
  }

  const silhouetteEdges = [];
  Object.values(edgeVisibility).forEach(edge => {
      if (edge.count === 1) {
          silhouetteEdges.push(edge.vertices);
      }
  });

  return silhouetteEdges;
}


    

let silhouetteLine; // le maillage de ligne pour la silhouette

function updateSilhouette() {
  const silhouetteEdges = computeEdgeVisibility(cube.geometry, activeCamera); // Use `cube` instead of `tetrahedron`

  // Convert silhouette edges from Vector3 to a flat array
  const verticesFlatArray = [].concat(...silhouetteEdges.map(edge => {
    return edge.flatMap(v => [v.x, v.y, v.z]);
  }));

  // Now create the Float32Array from verticesFlatArray
  const positions = new Float32Array(verticesFlatArray);

  // If the line mesh already exists, update the geometry
  if (silhouetteLine) {
    silhouetteLine.geometry.dispose(); // Dispose of the old geometry
    silhouetteLine.geometry = new THREE.BufferGeometry(); // Create new geometry
    silhouetteLine.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  } else {
    // Create a new line geometry and add it to the scene
    const lineGeometry = new THREE.BufferGeometry();
    lineGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const lineMaterial = new THREE.LineBasicMaterial({ color: 0xff0000 }); // Change to red or any other hex color value
    silhouetteLine = new THREE.LineSegments(lineGeometry, lineMaterial);
    //silhouetteLine.visible = false;

    scene.add(silhouetteLine);
    updateComplexityDisplay(cube, activeCamera);

  }
}


function calculateFaceNormal(vertexA, vertexB, vertexC) {
  // Calculate two edge vectors
  const edge1 = new THREE.Vector3().subVectors(vertexB, vertexA);
  const edge2 = new THREE.Vector3().subVectors(vertexC, vertexA);

  // Calculate the normal of the face (cross product of edge vectors)
  const normal = new THREE.Vector3().crossVectors(edge1, edge2).normalize();

  return normal;
}

// Call this function whenever the camera or polytope changes
function onCameraOrPolytopeChange() {
  updateComplexityDisplay(cube, activeCamera);
}
  
// Loop d'Animation 
let needsUpdate
controls.addEventListener('change', () => {
  // Set needsUpdate to true so the animation loop can pick up the change.
  needsUpdate = true;
});

function animate() {
  requestAnimationFrame(animate);

  if (needsUpdate) {
    updateSilhouette();
    updateComplexityDisplay(cube, activeCamera);
    updateHelpers()
    needsUpdate = false;
  }

  controls.update();
  renderer.render(scene, activeCamera);
}

animate();

// Add a listener to switch UI element
document.getElementById('cameraSwitch').addEventListener('click', switchCamera);
// Comptage des arêtes visibles à partir de la silhouette
function countVisibleEdgesFromSilhouette(silhouetteEdges) {
  return silhouetteEdges.length;
}



// Mise à jour de l'affichage de la complexité
function updateComplexityDisplay() {
  const silhouetteEdges = computeEdgeVisibility(cube.geometry, activeCamera);
  const visibleEdgeCount = countVisibleEdgesFromSilhouette(silhouetteEdges);

  const complexityElement = document.getElementById('complexityMetric');
  if (complexityElement) {
    complexityElement.textContent = `Visible Edges: ${visibleEdgeCount}, Total Unique Edges: ${totalUniqueEdgeCount}, Ratio: ${(visibleEdgeCount / totalUniqueEdgeCount * 100).toFixed(2)}%`;
  }
}




function addCustomFaceNormalsHelper(mesh) {
  // Remove existing helper if it exists
  if (mesh.faceNormalsHelper) {
      mesh.faceNormalsHelper.forEach(helper => {
          scene.remove(helper);
          if (helper.geometry) helper.geometry.dispose();
          if (helper.material) helper.material.dispose();
      });
  }

  mesh.faceNormalsHelper = [];

  const positionAttribute = mesh.geometry.attributes.position;
  const normalsAttribute = mesh.geometry.attributes.normal;

  for (let i = 0; i < positionAttribute.count; i += 3) {
      // Get vertices of the face
      const v1 = new THREE.Vector3().fromBufferAttribute(positionAttribute, i);
      const v2 = new THREE.Vector3().fromBufferAttribute(positionAttribute, i + 1);
      const v3 = new THREE.Vector3().fromBufferAttribute(positionAttribute, i + 2);

      // Compute face center
      const faceCenter = new THREE.Vector3().add(v1).add(v2).add(v3).divideScalar(3);

      // Get normal for this face
      const normal = new THREE.Vector3().fromBufferAttribute(normalsAttribute, i).normalize().multiplyScalar(0.5); // Adjust the length of the normal line

      // Create points for the normal line
      const points = [];
      points.push(faceCenter);
      points.push(new THREE.Vector3().addVectors(faceCenter, normal));

      // Create geometry and material for the normal line
      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      const material = new THREE.LineBasicMaterial({ color: 0x0000ff }); // Blue lines for face normals
      const line = new THREE.Line(geometry, material);

      scene.add(line);
      mesh.faceNormalsHelper.push(line);
  }
}


// Update these helpers whenever the camera or polytope changes
function updateHelpers() {
  addCustomFaceNormalsHelper(cube);
//  addViewVectorsHelper(cube, activeCamera);
}



// Initialisation après le chargement du DOM
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => onCameraOrPolytopeChange());
} else {
  onCameraOrPolytopeChange();
}

// Ajoute un listener à la came switch UI element
document.getElementById('cameraSwitch').addEventListener('click', switchCamera);

