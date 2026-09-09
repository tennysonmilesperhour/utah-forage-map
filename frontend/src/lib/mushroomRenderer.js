import { deformSpecimen, easeBetween, MUSHROOM_TIMING, specimenPose } from './mushroomMotion'

const ART = '/images/fungi/oyster-specimen.webp'
const GROUND = '/images/fungi/oyster-ground.webp'
let artworkPromise
function loadImage(src) {
  const image = new Image()
  image.decoding = 'async'
  image.src = src
  return image.decode().then(() => image)
}
export function loadSpecimenArtwork() {
  if (!artworkPromise) artworkPromise = Promise.all([loadImage(ART), loadImage(GROUND)]).catch(error => { artworkPromise = undefined; throw error })
  return artworkPromise
}

// Texture mesh, not a collection of drawn outlines. A shared grid bends the
// photographic cap and stem continuously, preserving their joined anatomy.
export function createSpecimenRenderer(canvas, [specimen, ground]) {
  const context = canvas.getContext('2d', { alpha: true })
  if (!context) return null
  let width = 0, height = 0, ratio = 1, phase = 'still', started = performance.now()
  let frame = 0, destroyed = false, visible = true, carryPose = null
  let lastPose = specimenPose('still', 0)
  const columns = 10, rows = 16
  const sourceWidth = specimen.naturalWidth, sourceHeight = specimen.naturalHeight
  const cellWidth = sourceWidth / columns, cellHeight = sourceHeight / rows
  const vertices = Array.from({ length: (columns + 1) * (rows + 1) }, () => ({ x: 0, y: 0 }))

  function triangle(points, a, b, c, d, e, f) {
    context.save()
    // Fractional overlap avoids antialiasing seams between neighboring tiles.
    const cx = (points[0].x + points[1].x + points[2].x) / 3
    const cy = (points[0].y + points[1].y + points[2].y) / 3
    context.beginPath()
    points.forEach((point, index) => {
      const length = Math.hypot(point.x - cx, point.y - cy) || 1
      const x = point.x + (point.x - cx) / length * .22
      const y = point.y + (point.y - cy) / length * .22
      if (index === 0) context.moveTo(x, y)
      else context.lineTo(x, y)
    })
    context.closePath()
    context.clip()
    context.transform(a, b, c, d, e, f)
    context.drawImage(specimen, 0, 0)
    context.restore()
  }

  function draw(now) {
    if (destroyed || !width || !height) return
    const elapsed = Math.max(0, now - started)
    let pose = specimenPose(phase, elapsed)
    if (carryPose && phase === 'wilting') {
      const blend = 1 - easeBetween(elapsed, 0, 650)
      pose = { ...pose, bend: pose.bend + carryPose.bend * blend, spread: pose.spread + (carryPose.spread - 1) * blend }
    }
    lastPose = pose
    context.setTransform(ratio, 0, 0, ratio, 0, 0)
    context.clearRect(0, 0, width, height)
    context.imageSmoothingEnabled = true
    context.imageSmoothingQuality = 'high'
    const size = Math.min(width, height), x0 = (width - size) / 2, y0 = height - size
    const soilY = y0 + size * .87
    const soilHeight = size * .25
    const soilWidth = size * .9

    if (pose.alpha > .001) {
      for (let row = 0; row <= rows; row++) for (let col = 0; col <= columns; col++) {
        const point = deformSpecimen(col / columns, row / rows, pose)
        const vertex = vertices[row * (columns + 1) + col]
        vertex.x = x0 + point.x * size
        vertex.y = y0 + point.y * size
      }
      // Apply the opacity after meshing so the overlapping edges cannot form
      // a visible grid during emergence or absorption.
      for (let row = 0; row < rows; row++) for (let col = 0; col < columns; col++) {
        const i = row * (columns + 1) + col
        const p00 = vertices[i], p10 = vertices[i + 1], p01 = vertices[i + columns + 1], p11 = vertices[i + columns + 2]
        const sx = col * cellWidth, sy = row * cellHeight
        let a = (p10.x - p00.x) / cellWidth, b = (p10.y - p00.y) / cellWidth
        let c = (p01.x - p00.x) / cellHeight, d = (p01.y - p00.y) / cellHeight
        triangle([p00, p10, p01], a, b, c, d, p00.x - a * sx - c * sy, p00.y - b * sx - d * sy)
        a = (p11.x - p01.x) / cellWidth; b = (p11.y - p01.y) / cellWidth
        c = (p11.x - p10.x) / cellHeight; d = (p11.y - p10.y) / cellHeight
        triangle([p11, p01, p10], a, b, c, d, p11.x - a * (sx + cellWidth) - c * (sy + cellHeight), p11.y - b * (sx + cellWidth) - d * (sy + cellHeight))
      }
      context.save()
      context.globalCompositeOperation = 'source-atop'
      context.fillStyle = `rgba(0, 0, 0, ${pose.curl * .16})`
      context.fillRect(0, 0, width, height)
      context.globalCompositeOperation = 'destination-in'
      const mask = context.createLinearGradient(0, soilY - size * .08, 0, soilY + size * .016)
      mask.addColorStop(0, `rgba(0,0,0,${pose.alpha})`)
      mask.addColorStop(1, 'rgba(0,0,0,0)')
      context.fillStyle = mask
      context.fillRect(0, 0, width, height)
      context.restore()
    }
    // Actual bark and grass texture masks the foot of the emerging specimen.
    context.globalAlpha = .7 + .3 * pose.alpha
    context.drawImage(ground, x0 + (size - soilWidth) / 2, soilY - soilHeight / 2, soilWidth, soilHeight)
    context.globalAlpha = 1
    canvas.dataset.renderedPhase = phase
    canvas.dataset.progress = String(Math.min(1, elapsed / (MUSHROOM_TIMING[phase] || 1)).toFixed(3))
  }

  function tick(now) {
    frame = 0
    if (!visible || document.hidden || destroyed) return
    draw(now)
    const moving = phase === 'forming' || phase === 'wilting' || phase === 'offering' || phase === 'ambient'
    const finished = MUSHROOM_TIMING[phase] && now - started >= MUSHROOM_TIMING[phase]
    if (moving && (!finished || phase === 'offering')) frame = requestAnimationFrame(tick)
  }
  function wake() {
    cancelAnimationFrame(frame)
    frame = 0
    if (visible && !document.hidden) frame = requestAnimationFrame(tick)
  }
  const visibility = () => wake()
  document.addEventListener('visibilitychange', visibility)
  const observer = new IntersectionObserver(entries => { visible = entries[0].isIntersecting; wake() })
  observer.observe(canvas)

  return {
    setPhase(next) { carryPose = lastPose; phase = next; started = performance.now(); draw(started); wake() },
    resize(w, h) {
      width = w; height = h; ratio = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = Math.max(1, Math.round(width * ratio)); canvas.height = Math.max(1, Math.round(height * ratio))
      draw(performance.now()); wake()
    },
    destroy() { destroyed = true; cancelAnimationFrame(frame); observer.disconnect(); document.removeEventListener('visibilitychange', visibility) },
  }
}
