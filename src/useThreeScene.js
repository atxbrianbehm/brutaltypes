import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { palette } from './palette'

const hashNoise = (x, y, z, seed) => {
  const p = (x * 12.9898 + y * 78.233 + z * 43.123 + seed * 91.432)
  const q = (z * 13.1313 + x * 93.939 + y * 17.171)
  return (Math.sin(p + q) * 43758.5453) % 1
}

export function useThreeScene({
  text,
  mode,
  seed,
  speed,
  phase,
  depth,
  rotSpeed,
  posterize,
  accentColor,
  backgroundColor,
  isColorEnabled,
  isSpeedEnabled,
  isRotationEnabled,
  isWanderEnabled,
  fontFamily
}) {
  const mountRef = useRef(null)

  const sceneRef = useRef({
    scene: null,
    camera: null,
    renderer: null,
    blocks: [],
    group: null,
    wanderLight: null,
    clock: new THREE.Clock(),
    texCache: new Map(),
    envMap: null
  })

  const cameraStateRef = useRef({
    isDragging: false,
    dragMode: 'none',
    lastX: 0,
    lastY: 0,
    yaw: 0,
    pitch: 0,
    radius: 10,
    target: new THREE.Vector3(0, 0, 0)
  })

  const stateRef = useRef({})
  useEffect(() => {
    stateRef.current = {
      text,
      mode,
      seed,
      speed,
      phase,
      depth,
      rotSpeed,
      posterize,
      accentColor,
      backgroundColor,
      isColorEnabled,
      isSpeedEnabled,
      isRotationEnabled,
      isWanderEnabled,
      fontFamily
    }
  }, [
    text,
    mode,
    seed,
    speed,
    phase,
    depth,
    rotSpeed,
    posterize,
    accentColor,
    backgroundColor,
    isColorEnabled,
    isSpeedEnabled,
    isRotationEnabled,
    isWanderEnabled,
    fontFamily
  ])

  const applyCameraTransform = (camera) => {
    const c = cameraStateRef.current
    const cosPitch = Math.cos(c.pitch)
    camera.position.set(
      c.target.x + c.radius * Math.sin(c.yaw) * cosPitch,
      c.target.y + c.radius * Math.sin(c.pitch),
      c.target.z + c.radius * Math.cos(c.yaw) * cosPitch
    )
    camera.lookAt(c.target)
  }

  const createEnvMap = () => {
    const size = 128
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = backgroundColor
    ctx.fillRect(0, 0, size, size)
    for (let i = 0; i < 8; i++) {
      for (let j = 0; j < 8; j++) {
        const brightness = 35 + Math.random() * 25
        ctx.fillStyle = `rgba(${brightness}, ${brightness + 2}, ${brightness + 4}, 0.15)`
        ctx.fillRect(i * 16 + 1, j * 16 + 1, 14, 14)
      }
    }
    const tex = new THREE.CanvasTexture(canvas)
    tex.mapping = THREE.EquirectangularReflectionMapping
    return tex
  }

  const getRingTex = (content) => {
    const { texCache } = sceneRef.current
    const textColorKey = isColorEnabled ? accentColor : palette.ink
    const key = `ring-final-${content}-${fontFamily}-${textColorKey}`
    if (texCache.has(key)) return texCache.get(key)

    const canvas = document.createElement('canvas')
    const h = 512
    const ctx = canvas.getContext('2d')
    const padX = 48
    const fontStr = `900 500px ${fontFamily}`
    ctx.font = fontStr
    const displayStr = (content || ' ').toUpperCase()
    const metrics = ctx.measureText(displayStr)
    const w = Math.ceil(metrics.width) + padX * 2

    canvas.width = w
    canvas.height = h

    ctx.fillStyle = palette.bg
    ctx.fillRect(0, 0, w, h)
    ctx.fillStyle = textColorKey
    ctx.font = fontStr
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.letterSpacing = '-12px'
    ctx.fillText(displayStr, w / 2, h / 2 + 45)

    const tex = new THREE.CanvasTexture(canvas)
    tex.wrapS = THREE.RepeatWrapping
    tex.wrapT = THREE.RepeatWrapping
    tex.colorSpace = THREE.SRGBColorSpace
    tex.anisotropy = 8
    tex.userData = { aspect: w / h }
    texCache.set(key, tex)
    return tex
  }

  const getCharTex = (char) => {
    const { texCache } = sceneRef.current
    const textColorKey = isColorEnabled ? accentColor : palette.ink
    const charKey = `char-final-${char.toUpperCase()}-${fontFamily}-${textColorKey}`
    if (texCache.has(charKey)) return texCache.get(charKey)

    const canvas = document.createElement('canvas')
    canvas.width = 256
    canvas.height = 256

    const ctx = canvas.getContext('2d')
    ctx.fillStyle = palette.bg
    ctx.fillRect(0, 0, 256, 256)
    ctx.fillStyle = textColorKey
    ctx.font = `900 148px ${fontFamily}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(char.toUpperCase(), 128, 132)

    const tex = new THREE.CanvasTexture(canvas)
    tex.colorSpace = THREE.SRGBColorSpace
    texCache.set(charKey, tex)
    return tex
  }

  const initGrid = () => {
    const { group, blocks } = sceneRef.current
    if (!group) return

    const s = stateRef.current

    while (group.children.length > 0) {
      const obj = group.children[0]
      obj.geometry.dispose()
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material]
      mats.forEach((m) => {
        if (m.map) m.map.dispose()
        m.dispose()
      })
      group.remove(obj)
    }
    blocks.length = 0

    const aspect = window.innerWidth / window.innerHeight
    const ringTex = getRingTex(s.text)
    const isRingMode =
      s.mode === 'dials' ||
      s.mode === 'pulsing' ||
      s.mode === 'z-ripple' ||
      s.mode === 'spiral-wrap'

    const currentEmissiveColor = s.isColorEnabled
      ? new THREE.Color(s.accentColor)
      : new THREE.Color(0x000000)

    if (s.mode === 'spiral-wrap') {
      const turns = 10
      const height = 0.5
      const hairlineGap = 0.01
      const pitch = height + hairlineGap
      const k = pitch / (Math.PI * 2)
      const segments = turns * 128
      const geometry = new THREE.PlaneGeometry(turns * Math.PI * 2, height, segments, 1)
      const pos = geometry.attributes.position
      const uvs = geometry.attributes.uv

      let totalArcLength = 0
      for (let i = 0; i <= segments; i++) {
        const theta = (i / segments) * (turns * Math.PI * 2)
        const r = k * theta + 0.6
        const deltaTheta = (turns * Math.PI * 2) / segments
        totalArcLength += Math.sqrt(r * r + k * k) * deltaTheta
      }
      const uRepeat = totalArcLength / (height * ringTex.userData.aspect)

      for (let i = 0; i < pos.count; i++) {
        const x_flat = pos.getX(i) + turns * Math.PI
        const y_flat = pos.getY(i)
        const theta = x_flat
        const r = k * theta + 0.6 + y_flat
        pos.setXY(i, r * Math.cos(theta), r * Math.sin(theta))
        const u = (1 - x_flat / (turns * Math.PI * 2)) * uRepeat
        const v = (y_flat + height / 2) / height
        uvs.setXY(i, u, v)
      }
      geometry.computeVertexNormals()
      const mat = new THREE.MeshStandardMaterial({
        map: ringTex,
        roughness: 0.82,
        metalness: 0.08,
        envMapIntensity: 0.12,
        side: THREE.DoubleSide,
        transparent: true,
        emissive: currentEmissiveColor,
        emissiveIntensity: 0
      })
      const mesh = new THREE.Mesh(geometry, mat)
      group.add(mesh)
      blocks.push({ mesh, type: 'spiral' })
      return
    }

    if (isRingMode) {
      const ringCount = aspect < 1 ? 10 : 16
      const ringHeight = 0.5
      const ringGap = 0.51

      for (let r = 1; r <= ringCount; r++) {
        const radius = r * ringGap
        const useExtrudedBand = s.mode === 'z-ripple'
        const zThickness = 0.36
        const circum = 2 * Math.PI * radius
        const uRepeat = circum / (ringHeight * ringTex.userData.aspect)
        const geom = useExtrudedBand
          ? new THREE.BoxGeometry(Math.PI * 2, ringHeight, zThickness, 128, 1, 1)
          : new THREE.PlaneGeometry(Math.PI * 2, ringHeight, 128, 1)

        const pos = geom.attributes.position
        const uvs = geom.attributes.uv
        for (let i = 0; i < pos.count; i++) {
          const x_flat = pos.getX(i)
          const y_flat = pos.getY(i)
          const z_flat = pos.getZ(i)
          const theta = x_flat
          const rad = radius + y_flat
          pos.setXYZ(i, rad * Math.cos(theta), rad * Math.sin(theta), z_flat)
          const u = (1 - (x_flat + Math.PI) / (Math.PI * 2)) * uRepeat
          const v = (y_flat + ringHeight / 2) / ringHeight
          uvs.setXY(i, u, v)
        }
        geom.computeVertexNormals()

        const ringMap = useExtrudedBand ? ringTex.clone() : ringTex
        if (useExtrudedBand) {
          ringMap.wrapS = THREE.RepeatWrapping
          ringMap.wrapT = THREE.RepeatWrapping
          ringMap.repeat.set(uRepeat, 1)
          ringMap.needsUpdate = true
        }

        const mat = new THREE.MeshStandardMaterial({
          map: ringMap,
          roughness: 0.82,
          metalness: 0.08,
          envMapIntensity: 0.12,
          side: THREE.DoubleSide,
          transparent: true,
          emissive: currentEmissiveColor,
          emissiveIntensity: 0
        })
        const mesh = new THREE.Mesh(geom, mat)
        mesh.position.z = r * -0.01
        group.add(mesh)
        blocks.push({ mesh, ringIndex: r, type: 'tube' })
      }

      return
    }

    const spacing = s.mode === 'radial' ? 0.68 : 0.55
    const cols = aspect < 1 ? 6 : 14
    const rows = aspect < 1 ? 10 : 8

    const geom =
      s.mode === 'radial'
        ? new THREE.CylinderGeometry(0.25, 0.25, 0.22, 64, 1, false)
        : new THREE.BoxGeometry(0.5, 0.5, 0.5)

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const char = (s.text.length > 0 ? s.text : ' ')[(r * cols + c) % s.text.length]
        const tex = getCharTex(char)
        const displayTex = s.mode === 'radial' ? tex.clone() : tex
        if (s.mode === 'radial') {
          displayTex.center.set(0.5, 0.5)
          displayTex.rotation = Math.PI / 2
        }
        const mat =
          s.mode === 'radial'
            ? [
                new THREE.MeshStandardMaterial({
                  color: palette.bg,
                  roughness: 0.82,
                  metalness: 0.02,
                  envMapIntensity: 0.04,
                  emissive: currentEmissiveColor,
                  emissiveIntensity: 0
                }),
                new THREE.MeshStandardMaterial({
                  map: displayTex,
                  roughness: 0.74,
                  metalness: 0.06,
                  envMapIntensity: 0.08,
                  emissive: currentEmissiveColor,
                  emissiveIntensity: 0
                }),
                new THREE.MeshStandardMaterial({
                  map: displayTex,
                  roughness: 0.74,
                  metalness: 0.06,
                  envMapIntensity: 0.08,
                  emissive: currentEmissiveColor,
                  emissiveIntensity: 0
                })
              ]
            : new THREE.MeshStandardMaterial({
                map: displayTex,
                roughness: 0.74,
                metalness: 0.06,
                envMapIntensity: 0.08,
                emissive: currentEmissiveColor,
                emissiveIntensity: 0
              })
        const mesh = new THREE.Mesh(geom, mat)
        const x = (c - cols / 2 + 0.5) * spacing
        const y = (rows / 2 - r - 0.5) * spacing
        mesh.position.set(x, y, 0)
        if (s.mode === 'radial') mesh.rotation.set(Math.PI / 2, 0, 0)
        group.add(mesh)
        blocks.push({
          mesh,
          r,
          c,
          index: r * cols + c,
          baseX: x,
          baseY: y,
          dist: Math.sqrt(x * x + y * y),
          type: 'block'
        })
      }
    }
  }

  useEffect(() => {
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(backgroundColor)

    const camera = new THREE.PerspectiveCamera(
      40,
      window.innerWidth / window.innerHeight,
      0.1,
      100
    )
    applyCameraTransform(camera)

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setSize(window.innerWidth, window.innerHeight)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))

    mountRef.current.appendChild(renderer.domElement)

    const envMap = createEnvMap()
    scene.environment = envMap

    scene.add(new THREE.AmbientLight(0xffffff, 1.15))
    const key = new THREE.DirectionalLight(0xffffff, 0.55)
    key.position.set(6, 10, 12)
    scene.add(key)
    const fill = new THREE.DirectionalLight(0xffffff, 0.25)
    fill.position.set(-8, -6, 8)
    scene.add(fill)

    const group = new THREE.Group()
    scene.add(group)

    const handlePointerDown = (e) => {
      if (e.button !== 0 && e.button !== 1) return
      if (e.button === 1) e.preventDefault()
      cameraStateRef.current.isDragging = true
      cameraStateRef.current.dragMode = e.button === 1 ? 'pan' : 'rotate'
      cameraStateRef.current.lastX = e.clientX
      cameraStateRef.current.lastY = e.clientY
      renderer.domElement.style.cursor = e.button === 1 ? 'move' : 'grabbing'
    }

    const handlePointerMove = (e) => {
      const c = cameraStateRef.current
      if (!c.isDragging) return
      const dx = e.clientX - c.lastX
      const dy = e.clientY - c.lastY
      c.lastX = e.clientX
      c.lastY = e.clientY

      if (c.dragMode === 'pan') {
        const panScale = c.radius * 0.0018
        const right = new THREE.Vector3().setFromMatrixColumn(camera.matrix, 0)
        const up = new THREE.Vector3().setFromMatrixColumn(camera.matrix, 1)
        c.target.addScaledVector(right, -dx * panScale)
        c.target.addScaledVector(up, dy * panScale)
      } else {
        c.yaw += dx * 0.005
        c.pitch += dy * 0.005
        c.pitch = Math.max(-1.35, Math.min(1.35, c.pitch))
      }

      applyCameraTransform(camera)
    }

    const handlePointerUp = () => {
      cameraStateRef.current.isDragging = false
      cameraStateRef.current.dragMode = 'none'
      renderer.domElement.style.cursor = 'grab'
    }

    const handleWheel = (e) => {
      e.preventDefault()
      const c = cameraStateRef.current
      c.radius += e.deltaY * 0.01
      c.radius = Math.max(4, Math.min(24, c.radius))
      applyCameraTransform(camera)
    }

    const handleDoubleClick = () => {
      const c = cameraStateRef.current
      c.yaw = 0
      c.pitch = 0
      c.radius = 10
      c.target.set(0, 0, 0)
      applyCameraTransform(camera)
    }

    renderer.domElement.style.cursor = 'grab'
    renderer.domElement.addEventListener('pointerdown', handlePointerDown)
    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)
    renderer.domElement.addEventListener('wheel', handleWheel, { passive: false })
    renderer.domElement.addEventListener('dblclick', handleDoubleClick)

    sceneRef.current = {
      ...sceneRef.current,
      scene,
      camera,
      renderer,
      group,
      envMap
    }

    initGrid()

    let frameId
    const animate = () => {
      const { renderer, scene, camera, blocks, clock } = sceneRef.current
      const t = clock.getElapsedTime()
      const s = stateRef.current
      const st = s.posterize >= 60 ? t : Math.floor(t * s.posterize) / s.posterize

      blocks.forEach((b) => {
        let glow = 0

        if (b.type === 'spiral') {
          if (s.isRotationEnabled) b.mesh.rotation.z = st * s.rotSpeed
          if (s.isSpeedEnabled) {
            b.mesh.material.map.offset.x = -(st * s.speed * 0.5)
            b.mesh.material.metalnessMap.offset.x = -(st * s.speed * 0.5)
          }
          glow = 0.5 + Math.sin(st * s.speed) * 0.5
        } else if (b.type === 'tube') {
          const direction = b.ringIndex % 2 === 0 ? 1 : -1
          if (s.mode === 'pulsing') {
            const osc = Math.sin(st * s.speed + b.ringIndex * s.phase * 4)
            if (s.isRotationEnabled) b.mesh.rotation.z = osc * s.rotSpeed * 2 * direction
            b.mesh.position.z = b.ringIndex * -0.01 + osc * 0.2
            glow = Math.max(0, osc)
          } else if (s.mode === 'z-ripple') {
            const ringSpeedFactor = 1.0 / (1 + b.ringIndex * 0.35)
            if (s.isRotationEnabled)
              b.mesh.rotation.z = st * s.rotSpeed * direction * ringSpeedFactor
            const wave = Math.sin(st * s.speed + b.ringIndex * s.phase * 6)
            b.mesh.position.z = b.ringIndex * -0.35 + wave * 0.4
            glow = wave
          } else {
            const ringSpeedFactor = 1.0 / (1 + b.ringIndex * 0.35)
            if (s.isRotationEnabled)
              b.mesh.rotation.z = st * s.rotSpeed * direction * ringSpeedFactor
            const wave = Math.sin(st * s.speed + b.ringIndex * s.phase * 5)
            b.mesh.position.z = b.ringIndex * -0.01 + wave * 0.12
            glow = wave
          }
        } else {
          if (s.mode === 'radial') b.mesh.rotation.set(Math.PI / 2, 0, 0)
          else b.mesh.rotation.set(0, 0, 0)
          b.mesh.position.set(b.baseX, b.baseY, 0)
          b.mesh.scale.set(1, 1, 1)

          switch (s.mode) {
            case 'fractal': {
              const n = hashNoise(b.r, b.c, st * s.speed, s.seed)
              b.mesh.position.z = n * s.depth * 4
              if (s.isRotationEnabled) b.mesh.rotation.x = st * s.rotSpeed + n
              glow = n
              break
            }
            case 'ticker': {
              const rowDir = b.r % 2 === 0 ? 1 : -1
              const xShift = (st * s.speed + b.c * s.phase) * rowDir
              b.mesh.position.x = b.baseX + (xShift % 0.5)
              glow = Math.sin(st * s.speed + b.c)
              break
            }
            case 'matrix': {
              const drop = (Math.floor(st * s.speed * 2 + b.c * 10) % 20) * 0.1
              b.mesh.position.y = b.baseY - drop
              glow = 1 - drop
              break
            }
            case 'horizontal': {
              b.mesh.position.z = Math.sin(st * s.speed + b.index * s.phase) * 0.15
              if (s.isRotationEnabled)
                b.mesh.rotation.y = st * s.rotSpeed + b.index * 0.1
              break
            }
            case 'snake': {
              const sn = Math.sin(st * s.speed + b.index * s.phase)
              b.mesh.position.z = sn * 0.35
              if (s.isRotationEnabled) b.mesh.rotation.x = st * s.rotSpeed + b.index * s.phase
              glow = sn
              break
            }
            case 'radial': {
              const rd = Math.sin(st * s.speed * 2 - b.dist * s.phase * 10)
              b.mesh.position.z = rd * 0.25
              glow = rd
              break
            }
          }
        }

        const emissiveIntensity =
          s.isSpeedEnabled && s.isColorEnabled ? Math.pow(Math.max(0, glow), 2) * 0.25 : 0
        const mats = Array.isArray(b.mesh.material) ? b.mesh.material : [b.mesh.material]
        mats.forEach((m) => {
          m.emissiveIntensity = emissiveIntensity
        })

        if (b.type === 'block') {
          if (s.mode === 'radial') b.mesh.scale.set(1, 1, 1)
          else if (s.mode === 'horizontal') b.mesh.scale.set(0.98, 0.98, 0.98 + s.depth * 8)
          else b.mesh.scale.set(1, 1, 1 + s.depth * 8)
        }
      })

      renderer.render(scene, camera)
      frameId = requestAnimationFrame(animate)
    }

    animate()

    const handleResize = () => {
      renderer.setSize(window.innerWidth, window.innerHeight)
      camera.aspect = window.innerWidth / window.innerHeight
      camera.updateProjectionMatrix()
      initGrid()
    }

    window.addEventListener('resize', handleResize)
    return () => {
      renderer.domElement.removeEventListener('pointerdown', handlePointerDown)
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
      renderer.domElement.removeEventListener('wheel', handleWheel)
      renderer.domElement.removeEventListener('dblclick', handleDoubleClick)
      window.removeEventListener('resize', handleResize)
      cancelAnimationFrame(frameId)

      const { texCache, envMap } = sceneRef.current
      texCache.forEach((t) => {
        try {
          t.dispose()
        } catch {}
      })
      texCache.clear()

      if (envMap) envMap.dispose()

      renderer.dispose()

      if (mountRef.current && renderer.domElement.parentNode === mountRef.current) {
        mountRef.current.removeChild(renderer.domElement)
      }
    }
  }, [])

  useEffect(() => {
    const { scene } = sceneRef.current
    if (!scene) return
    scene.background = new THREE.Color(backgroundColor)
  }, [backgroundColor])

  useEffect(() => {
    const { texCache } = sceneRef.current
    texCache.clear()
    initGrid()
  }, [text, mode, accentColor, isColorEnabled, fontFamily])

  return { mountRef }
}
