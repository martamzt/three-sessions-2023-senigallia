// By @fupete (c) 2023 | MIT License
//
// Credits: the base keyboard VJ engine idea is inspired and builded upon the works: 
// RBVJ by George Gally Radarboy https://github.com/GeorgeGally/rbvj/ 
// P5-VJ by Salil Parekh https://github.com/burnedsap/p5-vj 
//
// HELP:
// [0-9] changeSet
// [A-Z] changeSketch
// [\] toggleMouse
// [F6] toggleFullscreen
// [mouse] orbit controls + depends on the sketch (testing)
// 
// SCENES:
// 0 - GRID [status: 1st draft]
// 1 - SPHERES [status: nd ]
// 2 - COLUMNS [status: nd]
// 3 - CLOUDS [status: 1st draft]
// 4 - LAVA [status: nd]
// 5 - ...
// 6 - SOCRATES [status: nd]
// 7 - IMAGES [status: nd]
// 
// COMING UP: 
// - ...
// - TouchOSC support

import "./init"
import * as THREE from 'three'
import * as GUI from 'dat.gui'
import * as CANNON from 'cannon-es'
import * as NOISE from 'simplex-noise'
global.THREE = THREE
global.GUI = GUI
global.CANNON = CANNON
global.NOISE = NOISE

let myThree
const artFolder = "sketch"
let current_sketch = 0
let current_set = 0
let isFullscreen = false
let showCursor = false
global.canvas3D = document.getElementById("canvas3D") // global canvas3D

// CHANGE SET & SKETCH
const changeSet = (set) => {
	current_set = set
	changeSketch(0)
}
const isSketchValid = (url) => {
	const http = new XMLHttpRequest()
	http.open('HEAD', url, false)
	http.send()
	return http.status == 200
}
const changeSketch = (sketch) => {
	sketch
	const loc = current_set + '/' + sketch
	const sketchName = loc + '.js'
	if (isSketchValid(`../sketch/${sketchName}`)) {
		current_sketch = sketch
		loadSketch(sketchName)
		console.log('Loading Sketch: ' + sketchName)
		document.location.hash = loc
	}
}
const loadSketch = async (sketchName) => {
	if (myThree?.dispose()) {
		myThree.dispose()
		myThree = {}
	}
	// canvas3D.replaceChildren()
	myThree = await import(`../sketch/${sketchName}`)
	myThree.sketch() // LET'S ROCK
}
const map = (value, min1, max1, min2, max2) => {
	const returnvalue = ((value - min1) / (max1 - min1) * (max2 - min2)) + min2
	return returnvalue
}

// MICROPHONE INPUT (info https://medium.com/hackernoon/creative-coding-using-the-microphone-to-make-sound-reactive-art-part1-164fd3d972f3)
class mic {
	constructor(_fft) {
		const FFT_SIZE = _fft || 1024
		this.spectrum_size = FFT_SIZE / 2
		this.spectrum = []
		this.volume = this.vol = 0
		this.peak_volume = 0
		let self = this
		const audioContext = new AudioContext()
		const SAMPLE_RATE = audioContext.sampleRate
		window.AudioContext = window.AudioContext || window.webkitAudioContext
		navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia
		function startMic(context) {
			const processSound = (stream) => {
				console.log("Starting microphone...")
				// analyser extracts frequency, waveform, and other data
				const analyser = context.createAnalyser()
				analyser.smoothingTimeConstant = 0.2
				analyser.fftSize = FFT_SIZE
				let node = context.createScriptProcessor(FFT_SIZE * 2, 1, 1)
				node.onaudioprocess = () => {
					// bitcount returns array which is half the FFT_SIZE
					self.spectrum = new Uint8Array(analyser.frequencyBinCount)
					// getByteFrequencyData returns the amplitude for each frequency
					analyser.getByteFrequencyData(self.spectrum)
					// getByteTimeDomainData gets volumes over the sample time
					//analyser.getByteTimeDomainData(dataArray)
					self.vol = self.getRMS(self.spectrum)
					// get peak
					if (self.vol > self.peak_volume)
						self.peak_volume = self.vol
					self.volume = self.vol
				}
				const input = context.createMediaStreamSource(stream)
				input.connect(analyser)
				analyser.connect(node)
				node.connect(context.destination)
			}
			const error = () => {
				console.log(arguments)
			}
			navigator.getUserMedia({ audio: true }, processSound, error)
		}
		try {
			startMic(new AudioContext())
		}
		catch (e) {
			console.error(e)
			alert('Web Audio API is not supported in this browser')
		}
		// SOUND UTILITIES
		this.mapSound = function (_me, _total, _min, _max) {
			if (self.spectrum.length > 0) {
				const min = _min || 0
				const max = _max || 100
				//actual new freq
				const new_freq = Math.round(_me / _total * self.spectrum.length)
				//console.log(Math.round(self.peak_volume) + " : " + Math.round(self.spectrum[new_freq]))
				// map the volumes to a useful number
				const s = map(self.spectrum[new_freq], 0, self.peak_volume, min, max)
				//console.log(s)
				return s
			}
			else
				return 0
		}
		this.getVol = function (_min, _max) {
			const min_max = _min || 100
			const min = _min || 0
			const max = _max || min_max
			// map total volume to 100 for convenience
			self.volume = map(self.vol, 0, self.peak_volume, min, max)
			return self.volume || 0
		}
		this.getVolume = function () { return this.getVol() }
		//A more accurate way to get overall volume
		this.getRMS = function (spectrum) {
			var rms = 0
			for (var i = 0; i < spectrum.length; i++) {
				rms += spectrum[i] * spectrum[i]
			}
			rms /= spectrum.length
			rms = Math.sqrt(rms)
			return rms
		}
		//freq = n * SAMPLE_RATE / MY_FFT_SIZE
		this.mapFreq = function (i) {
			// const freq = i * SAMPLE_RATE / FFT_SIZE;
			const freq = i * SAMPLE_RATE / self.spectrum.length
			return freq
		}
		// getMix function. Computes the current frequency with
		// computeFreqFromFFT, then returns bass, mids and his
		// sub bass : 0 > 100hz
		// mid bass : 80 > 500hz
		// mid range: 400 > 2000hz
		// upper mid: 1000 > 6000hz
		// high freq: 4000 > 12000hz
		// Very high freq: 10000 > 20000hz and above
		this.getMix = function () {
			var highs = []
			var mids = []
			var bass = []
			var bass = []
			for (var i = 0; i < self.spectrum.length; i++) {
				var band = mapFreq(i)
				var v = map(self.spectrum[i], 0, self.peak_volume, 0, 100)
				if (band < 500) {
					bass.push(v)
				}
				if (band > 400 && band < 6000) {
					mids.push(v)
				}
				if (band > 4000) {
					highs.push(v)
				}
			}
			return { bass: bass, mids: mids, highs: highs }
		}
		this.getBass = function () {
			return this.getMix().bass
		}
		this.getMids = function () {
			return this.getMix().mids
		}

		this.getHighs = function () {
			return this.getMix().highs
		}
		this.getHighsVol = function (_min, _max) {
			var min = _min || 0
			var max = _max || 100
			var v = map(this.getRMS(this.getMix().highs), 0, self.peak_volume, min, max)
			return v
		}
		this.getMidsVol = function (_min, _max) {
			var min = _min || 0
			var max = _max || 100
			var v = map(this.getRMS(this.getMix().mids), 0, self.peak_volume, min, max)
			return v
		}
		this.getBassVol = function (_min, _max) {
			var min = _min || 0
			var max = _max || 100
			var v = map(this.getRMS(this.getMix().bass), 0, self.peak_volume, min, max)
			return v
		}
		return this
	}
}
const initAudio = () => {
	global.MIC = new mic()
	console.log(global.MIC)
}

// UI
const onKeyDown = (event) => {
	var keyCode = event.keyCode
	if (keyCode >= 65 && keyCode <= 90)
		changeSketch(keyCode - 65) // a-z
	else if (keyCode >= 48 && keyCode <= 57) { // 0-9
		changeSet(keyCode - 48)
	} else if (keyCode == 220) toggleMouse() // \
	else if (keyCode == 117) toggleFullscreen() // F6
	else if (keyCode == 222) initAudio() // (shift) + ?
}
window.addEventListener('keydown', function (e) {
	if (typeof onKeyDown == 'function') onKeyDown(e);
})
const toggleMouse = () => {
	showCursor = !showCursor
	if (showCursor) window.document.body.style.cursor = 'crosshair'
	else window.document.body.style.cursor = 'none'
}
const toggleFullscreen = () => {
	isFullscreen = false
	if (document.fullscreenElement == null) {
		canvas3D.requestFullscreen()
		isFullscreen = true
	} else {
		document.exitFullscreen()
		isFullscreen = false
	}
}

// TEXTURES PRELOAD
THREE.Cache.enabled = true
global.cubeTextures = []
const loadCubeTexture = (name, path, format) => {
	const urls = [
		path + 'px' + format, path + 'nx' + format,
		path + 'py' + format, path + 'ny' + format,
		path + 'pz' + format, path + 'nz' + format
	]
	const cubeTextureLoader = new THREE.CubeTextureLoader()
	global.cubeTextures.push({
		name: name,
		texture: cubeTextureLoader.load(urls, (cube) => {
			console.log('loadedCubeTexture' + cube)
		})
	})
}
global.textures = []
const loadTexture = (name, path, format) => {
	const textureLoader = new THREE.TextureLoader()
	const url = path + format
	global.textures.push({
		name: name,
		texture: textureLoader.load(url, (texture) => {
			console.log('loadedTexture' + texture)
		})
	})
}
// Let's preload our textures
// global.cubeTextures[n]
loadCubeTexture('PureSky', '/assets/textures/cube/PureSky-256/', '.png') // 0
loadCubeTexture('MilkyWay', '/assets/textures/cube/MilkyWay/dark-s_', '.jpg') // 1
loadCubeTexture('teatro', '/assets/textures/cube/teatro/', '.png') // 2
// global.textures[n]
loadTexture('StoneDiff', '/assets/textures/stone_tiles_02_diff_1k', '.jpg') // 0
loadTexture('StoneDisp', '/assets/textures/stone_tiles_02_disp_4k', '.png') // 1

loadTexture('Lion', 'https://allyourhtml.club/carousel/lion', '.jpg') // 2

// INIT
const init = () => {
	window.document.body.style.cursor = 'none'
	changeSet(1)
	// RENDERER
	global.renderer = new THREE.WebGLRenderer({
		alpha: true,
		antialias: true
	})
	renderer.shadowMap.enabled = true // < Shadows enabled
	renderer.shadowMap.Type = THREE.PCFShadowMap // BasicShadowMap | PCFShadowMap | PCFSoftShadowMap | THREE.VSMShadowMap
	renderer.toneMapping = THREE.ACESFilmicToneMapping
	renderer.toneMappingExposure = 1.2
	renderer.setSize(window.innerWidth, window.innerHeight)
	canvas3D.appendChild(renderer.domElement)
	// setTimeout(() => {
	// 	toggleFullscreen();
	//   }, 5000);
	// ...
}
window.addEventListener('load', init)