import { Application, Sprite, Texture, CanvasSource } from 'pixi.js'
import type { Input, VideoSampleSink } from 'mediabunny'

export interface CompositorClip {
  fileHandle: FileSystemFileHandle
  input: Input
  sink: VideoSampleSink
  startUs: number
  endUs: number
  durationUs: number
  sprite: Sprite
  canvas: OffscreenCanvas
  ctx: OffscreenCanvasRenderingContext2D
}

export class VideoCompositor {
  public app: Application | null = null
  public canvas: OffscreenCanvas | HTMLCanvasElement | null = null
  public clips: CompositorClip[] = []
  
  private width = 1920
  private height = 1080

  async init(width: number, height: number, bgColor = '#000', offscreen = true): Promise<void> {
    this.width = width
    this.height = height
    
    this.app = new Application()
    
    if (offscreen) {
      this.canvas = new OffscreenCanvas(width, height)
    } else {
      this.canvas = document.createElement('canvas')
      this.canvas.width = width
      this.canvas.height = height
    }
    
    await this.app.init({
      width,
      height,
      canvas: this.canvas as any,
      backgroundColor: bgColor,
      preference: 'webgl',
      clearBeforeRender: true,
    })
    
    // Stop the automatic ticker, we will render manually
    this.app.ticker.stop()
  }

  async loadTimeline(timelineClips: any[], getFileHandleByPath: (path: string) => Promise<FileSystemFileHandle | null>): Promise<number> {
    if (!this.app) throw new Error('VideoCompositor not initialized')
    this.clearClips()

    const { Input, BlobSource, VideoSampleSink, ALL_FORMATS } = await import('mediabunny')
    
    let maxDurationUs = 0
    let sequentialTimeUs = 0 // For fallback if startUs is missing

    for (const clipData of timelineClips) {
      if (clipData.kind !== 'clip') continue

      const fileHandle = await getFileHandleByPath(clipData.source.path)
      if (!fileHandle) continue

      const file = await fileHandle.getFile()
      const source = new BlobSource(file)
      const input = new Input({ source, formats: ALL_FORMATS } as any)
      const track = await input.getPrimaryVideoTrack()
      
      if (!track || !(await track.canDecode())) {
        this.disposeResource(input)
        continue
      }

      const sink = new VideoSampleSink(track)
      const durationUs = Math.floor((await track.computeDuration()) * 1_000_000)
      
      const startUs = typeof clipData.timelineRange?.startUs === 'number' ? clipData.timelineRange.startUs : sequentialTimeUs
      sequentialTimeUs = Math.max(sequentialTimeUs, startUs + durationUs)

      // create dedicated offscreencanvas per clip for drawImage scaling and passing to Pixi
      const clipCanvas = new OffscreenCanvas(this.width, this.height)
      const clipCtx = clipCanvas.getContext('2d')!
      
      const canvasSource = new CanvasSource({ resource: clipCanvas as any })
      const texture = new Texture({ source: canvasSource })
      const sprite = new Sprite(texture)
      
      sprite.width = this.width
      sprite.height = this.height
      sprite.visible = false
      
      this.app.stage.addChild(sprite)

      this.clips.push({
        fileHandle,
        input,
        sink,
        startUs,
        endUs: startUs + durationUs,
        durationUs,
        sprite,
        canvas: clipCanvas,
        ctx: clipCtx
      })
    }

    if (this.clips.length > 0) {
      maxDurationUs = Math.max(0, ...this.clips.map(c => c.endUs))
    }

    return maxDurationUs
  }

  async renderFrame(timeUs: number): Promise<OffscreenCanvas | HTMLCanvasElement | null> {
    if (!this.app || !this.canvas) return null

    for (const clip of this.clips) {
      if (timeUs >= clip.startUs && timeUs < clip.endUs) {
        const localTimeS = (timeUs - clip.startUs) / 1_000_000
        try {
          const sample = await clip.sink.getSample(localTimeS)
          
          if (sample) {
            await this.drawSampleToCanvas(sample, clip)
            clip.sprite.texture.source.update()
            clip.sprite.visible = true
            
            if ('close' in sample) (sample as any).close()
          } else {
            clip.sprite.visible = false
          }
        } catch (e) {
          console.error('[VideoCompositor] Failed to render sample', e)
        }
      } else {
        clip.sprite.visible = false
      }
    }

    this.app.render()
    return this.canvas
  }

  private async drawSampleToCanvas(sample: any, clip: CompositorClip) {
    clip.ctx.clearRect(0, 0, clip.canvas.width, clip.canvas.height)

    let imageSource: any
    try {
      imageSource = typeof sample.toCanvasImageSource === 'function' ? sample.toCanvasImageSource() : sample
      const frameW = imageSource?.displayWidth ?? imageSource?.width ?? clip.canvas.width
      const frameH = imageSource?.displayHeight ?? imageSource?.height ?? clip.canvas.height
      const scale = Math.min(clip.canvas.width / frameW, clip.canvas.height / frameH)

      const targetW = frameW * scale
      const targetH = frameH * scale
      const targetX = (clip.canvas.width - targetW) / 2
      const targetY = (clip.canvas.height - targetH) / 2

      try {
        clip.ctx.drawImage(imageSource, targetX, targetY, targetW, targetH)
        return
      } catch (err) {
        // Fallback for some browsers where drawImage fails on VideoFrame
        const bmp = await createImageBitmap(imageSource)
        clip.ctx.drawImage(bmp, targetX, targetY, targetW, targetH)
        bmp.close()
        return
      }
    } catch (err) {
      // ignore
    }

    if (typeof sample.draw === 'function') {
      sample.draw(clip.ctx, 0, 0, clip.canvas.width, clip.canvas.height)
      return
    }
  }

  clearClips() {
    for (const clip of this.clips) {
      this.disposeResource(clip.sink)
      this.disposeResource(clip.input)
      if (clip.sprite && clip.sprite.parent) {
        clip.sprite.parent.removeChild(clip.sprite)
      }
      clip.sprite.destroy(true)
    }
    this.clips = []
  }

  destroy() {
    this.clearClips()
    if (this.app) {
      this.app.destroy(true, { children: true, texture: true })
      this.app = null
    }
    this.canvas = null
  }

  private disposeResource(resource: unknown) {
    if (!resource || typeof resource !== 'object') return
    if ('dispose' in resource && typeof (resource as { dispose?: unknown }).dispose === 'function') {
      (resource as { dispose: () => void }).dispose()
      return
    }
    if ('close' in resource && typeof (resource as { close?: unknown }).close === 'function') {
      (resource as { close: () => void }).close()
    }
  }
}
