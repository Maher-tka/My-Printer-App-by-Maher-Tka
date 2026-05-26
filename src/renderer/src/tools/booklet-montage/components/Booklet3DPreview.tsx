import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import type { BookletPage } from '../types'

interface Booklet3DPreviewProps {
  pages: BookletPage[]
}

const MAX_RENDERED_PAGES = 28

export function Booklet3DPreview({ pages }: Booklet3DPreviewProps): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = containerRef.current

    if (!container || pages.length === 0) {
      return undefined
    }

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100)
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    const group = new THREE.Group()
    const renderedPages = pages.slice(0, MAX_RENDERED_PAGES)
    const geometry = new THREE.PlaneGeometry(2.2, 3.1)
    const materials: THREE.MeshBasicMaterial[] = []
    let frameId = 0

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setClearColor(0xf3f6fb, 1)
    container.appendChild(renderer.domElement)

    scene.add(group)
    camera.position.set(0.7, 1.35, 6.6)
    camera.lookAt(0.35, 0.2, 0)

    renderedPages.forEach((page, index) => {
      const texture = createPageTexture(page, index + 1)
      const material = new THREE.MeshBasicMaterial({
        map: texture,
        side: THREE.DoubleSide
      })
      const mesh = new THREE.Mesh(geometry, material)
      const progress = renderedPages.length <= 1 ? 0 : index / (renderedPages.length - 1)

      mesh.position.set((progress - 0.5) * 0.55, 0, -index * 0.018)
      mesh.rotation.y = -0.55 + progress * 1.1
      mesh.rotation.z = (progress - 0.5) * 0.08
      group.add(mesh)
      materials.push(material)
    })

    group.rotation.x = -0.26
    group.rotation.y = -0.28

    const resize = () => {
      const width = Math.max(container.clientWidth, 1)
      const height = Math.max(container.clientHeight, 1)

      camera.aspect = width / height
      camera.updateProjectionMatrix()
      renderer.setSize(width, height, false)
    }

    const animate = () => {
      group.rotation.y = -0.28 + Math.sin(Date.now() / 1900) * 0.05
      renderer.render(scene, camera)
      frameId = window.requestAnimationFrame(animate)
    }

    const resizeObserver = new ResizeObserver(resize)
    resizeObserver.observe(container)
    resize()
    animate()

    return () => {
      window.cancelAnimationFrame(frameId)
      resizeObserver.disconnect()
      container.removeChild(renderer.domElement)
      geometry.dispose()

      for (const material of materials) {
        material.map?.dispose()
        material.dispose()
      }

      renderer.dispose()
    }
  }, [pages])

  if (pages.length === 0) {
    return (
      <div className="grid min-h-[560px] place-items-center rounded-lg border border-dashed bg-muted/35 p-8 text-center">
        <div className="max-w-md">
          <h3 className="text-lg font-semibold">No booklet preview yet</h3>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Import or add pages to inspect the booklet in 3D.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="relative min-h-[560px] overflow-hidden rounded-lg border bg-slate-100">
      <div ref={containerRef} className="absolute inset-0" />
      <div className="absolute left-4 top-4 rounded-md border bg-white/90 px-3 py-2 text-sm font-semibold shadow-sm">
        {pages.length} ordered pages
      </div>
    </div>
  )
}

function createPageTexture(page: BookletPage, pageNumber: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d')

  canvas.width = 512
  canvas.height = 724

  if (context) {
    context.fillStyle = page.kind === 'blank' ? '#f8fafc' : '#ffffff'
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.strokeStyle = '#d7deea'
    context.lineWidth = 8
    context.strokeRect(10, 10, canvas.width - 20, canvas.height - 20)
    context.fillStyle = '#1d4ed8'
    context.fillRect(0, 0, canvas.width, 86)
    context.fillStyle = '#ffffff'
    context.font = 'bold 34px Arial'
    context.fillText(`Page ${pageNumber}`, 34, 55)
    context.fillStyle = '#0f172a'
    context.font = '24px Arial'
    wrapText(context, page.displayName, 34, 160, canvas.width - 68, 34)
  }

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 4

  return texture
}

function wrapText(
  context: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number
): void {
  const words = text.split(/\s+/)
  let line = ''
  let currentY = y

  for (const word of words) {
    const testLine = line.length === 0 ? word : `${line} ${word}`

    if (context.measureText(testLine).width > maxWidth && line.length > 0) {
      context.fillText(line, x, currentY)
      line = word
      currentY += lineHeight
      continue
    }

    line = testLine
  }

  if (line.length > 0) {
    context.fillText(line, x, currentY)
  }
}
