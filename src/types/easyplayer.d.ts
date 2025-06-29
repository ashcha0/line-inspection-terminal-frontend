// EasyPlayer 类型声明文件

declare global {
  interface Window {
    EasyPlayerPro: typeof EasyPlayerPro
  }
}

// EasyPlayer 配置选项接口
interface EasyPlayerOptions {
  autoplay?: boolean
  live?: boolean
  hasAudio?: boolean
  decoder?: {
    forceNoOffscreen?: boolean
    useMSE?: boolean
    useWCS?: boolean
  }
  debug?: boolean
  timeout?: number
  heartTimeout?: number
  loadingTimeout?: number
  forceNoOffscreen?: boolean
  isResize?: boolean
  stretch?: boolean
  isFlv?: boolean
  hasVideo?: boolean
  operateBtns?: {
    fullscreen?: boolean
    screenshot?: boolean
    play?: boolean
    audio?: boolean
  }
  clarity?: Array<{
    name: string
    url: string
  }>
  poster?: string
}

// EasyPlayer 事件类型
type EasyPlayerEventType = 
  | 'loadstart'
  | 'loadeddata'
  | 'canplay'
  | 'play'
  | 'pause'
  | 'ended'
  | 'error'
  | 'waiting'
  | 'timeupdate'
  | 'resize'
  | 'fullscreenchange'
  | 'screenshot'
  | 'stats'
  | 'performance'
  | 'record'
  | 'buffer'
  | 'videoInfo'
  | 'audioInfo'
  | 'kBps'
  | 'streamEnd'
  | 'streamSuccess'
  | 'streamError'
  | 'mute'
  | 'load'
  | 'playbackRate'
  | 'clarity'
  | 'destroy'

// EasyPlayerPro 类声明
declare class EasyPlayerPro {
  constructor(container: HTMLElement, options: EasyPlayerOptions)
  
  // 播放控制方法
  play(url?: string): Promise<void>
  pause(): void
  stop(): void
  destroy(): void
  
  // 音频控制
  mute(): void
  unmute(): void
  
  // 截图功能
  getImage(): HTMLCanvasElement | null
  screenshot(): void
  
  // 全屏控制
  fullscreen(): void
  exitFullscreen(): void
  
  // 事件监听
  on(event: EasyPlayerEventType, callback: (data?: any) => void): void
  off(event: EasyPlayerEventType, callback?: (data?: any) => void): void
  
  // 获取播放器状态
  getPlayUrl(): string
  isPaused(): boolean
  isMuted(): boolean
  isFullscreen(): boolean
  
  // 设置播放器属性
  setPlayUrl(url: string): void
  setVolume(volume: number): void
  setPlaybackRate(rate: number): void
  
  // 获取播放器信息
  getVersion(): string
  getStats(): any
  getVideoInfo(): any
  getAudioInfo(): any
  
  // 录制功能（如果支持）
  startRecord?(): void
  stopRecord?(): void
  
  // 其他方法
  resize(): void
  load(): void
  reload(): void
}

export { EasyPlayerPro, EasyPlayerOptions, EasyPlayerEventType }