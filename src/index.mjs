/**
 * Ce code s'inspire du tutoriel sur la détection des arêtes en utilisant Three.js,
 * par Dustin John Pfister.
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

function changePolytope(event) {
  let newGeometry;
  switch (event.target.value) {
      case 'cube':
          newGeometry = new THREE.BoxGeometry(1, 1, 1);
          break;
      case 'tetrahedron':
          newGeometry = new THREE.TetrahedronGeometry(1);
          break;
        case 'octahedron':
          newGeometry = new THREE.OctahedronGeometry(1);
            break;
        case 'dodecahedron':
          newGeometry = new THREE.DodecahedronGeometry(1);
            break;
        case 'icosahedron':
          newGeometry = new THREE.IcosahedronGeometry(1);
            break;
        // Add more cases for other polytopes as needed
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
    
        const triangleCenter = new THREE.Vector3().add(vertices[0]).add(vertices[1]).add(vertices[2]).divideScalar(3);
        const viewVector = new THREE.Vector3().subVectors(triangleCenter, camera.position);
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
    needsUpdate = false;
  }

  controls.update();
  renderer.render(scene, activeCamera);
}

animate();

// Add a listener to your camera switch UI element
document.getElementById('cameraSwitch').addEventListener('click', switchCamera);
// Comptage des arêtes visibles à partir de la silhouette
function countVisibleEdgesFromSilhouette(silhouetteEdges) {
  return silhouetteEdges.length;
}

// Mise à jour de l'affichage de la complexité
function updateComplexityDisplay() {
  const silhouetteEdges = computeEdgeVisibility(cube.geometry, activeCamera);
  let visibleEdgeCount = countVisibleEdgesFromSilhouette(silhouetteEdges);

  const complexityElement = document.getElementById('complexityMetric');
  if (complexityElement) {
    complexityElement.textContent = `Visible Edges: ${visibleEdgeCount}`;
  }
}

// Initialisation après le chargement du DOM
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => onCameraOrPolytopeChange());
} else {
  onCameraOrPolytopeChange();
}

// Ajoute un listener à la came switch UI element
document.getElementById('cameraSwitch').addEventListener('click', switchCamera);

