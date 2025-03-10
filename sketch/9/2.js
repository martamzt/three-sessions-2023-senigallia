// Rotating cube + Volume

import Stats from 'three/addons/libs/stats.module.js' // XXX
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'

let geometry
let material
let animation
let onWindowResize
let gui
let controls

export function sketch() {
    console.log("Sketch launched")
    const stats = new Stats() // XXX
    canvas3D.appendChild(stats.dom)

    // CAMERA
    let camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000)
    camera.position.z = 5

    // WINDOW RESIZE
    const onWindowResize = () => {
        camera.aspect = window.innerWidth / window.innerHeight
        camera.updateProjectionMatrix()
        renderer.setSize(window.innerWidth, window.innerHeight)
    }
    window.addEventListener('resize', onWindowResize)

    // SCENE
    const scene = new THREE.Scene()
    geometry = new THREE.BoxGeometry(2, 2, 2)
    material = new THREE.MeshBasicMaterial({ color: 0xff0000 })
    const cube = new THREE.Mesh(geometry, material)
    scene.add(cube)

    // CONTROLS
    controls = new OrbitControls(camera, renderer.domElement);

    // GUI
    gui = new GUI.GUI()
    const cubeFolder = gui.addFolder('Cube')
    cubeFolder.add(cube.rotation, 'x', 0, Math.PI * 2)
    cubeFolder.add(cube.rotation, 'y', 0, Math.PI * 2)
    cubeFolder.add(cube.rotation, 'z', 0, Math.PI * 2)
    cubeFolder.open()
    const cameraFolder = gui.addFolder('Camera')
    cameraFolder.add(camera.position, 'z', 0, 10)
    cameraFolder.open()

    // ANIMATE
    const animate = () => {
        stats.begin() // XXX

        // ANIMATION
        if (typeof MIC != 'undefined') {
            // cube.scale.x = MIC.getVol() * .04
            // cube.scale.x = MIC.volume * .05
            cube.scale.x = MIC.mapSound(0, 2, .5, 1)
        }
        // ...
        renderer.render(scene, camera) // RENDER
        stats.end() // XXX

        animation = requestAnimationFrame(animate) // CIAK
    }
    animate()
}

export function dispose() {
    cancelAnimationFrame(animation)
    controls?.dispose()
    geometry?.dispose()
    material?.dispose()
    gui?.destroy()
    window?.removeEventListener('resize', onWindowResize)
}