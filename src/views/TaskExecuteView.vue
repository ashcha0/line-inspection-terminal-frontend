<template>
  <div>
    <el-page-header @back="goBack" :content="`正在执行任务: ${id}`" />
    <el-row :gutter="20" style="margin-top: 20px">
      <el-col :span="18">
        <div 
          id="video-player-container"
          ref="videoPlayer" 
          style="width: 100%; height: 450px; background-color: black;"
        ></div>
        <div class="control-panel">
          <el-select v-model="currentStreamId" placeholder="选择摄像头" @change="playStream" style="width: 200px">
            <el-option
              v-for="device in cameraDevices"
              :key="device.id"
              :label="device.name || `摄像头 ${device.id}`"
              :value="device.id"
            />
            <!-- 如果没有获取到设备列表，显示默认选项 -->
            <el-option v-if="cameraDevices.length === 0" v-for="i in 4" :key="i" :label="`摄像头 ${i}`" :value="String(i)" />
          </el-select>
          <el-button type="primary" @click="handleMove('forward')">前进</el-button>
          <el-button type="warning" @click="handleMove('stop')">停止</el-button>
          <el-button type="info" @click="handleMove('backward')">后退</el-button>
          <el-button
            :type="audioEnabled ? 'success' : 'default'"
            @click="toggleAudio"
            :icon="audioEnabled ? 'Microphone' : 'MicrophoneSlash'"
          >
            {{ audioEnabled ? '音频开' : '音频关' }}
          </el-button>
          <el-button type="danger" @click="handleEndTask(true)">终止巡检</el-button>
          <el-button type="success" @click="handleEndTask(false)">完成巡检</el-button>
        </div>
      </el-col>
      <el-col :span="6">
        <el-card>
          <template #header>车辆状态</template>
          <p>系统时间: {{ agvStatus.sysTime }}</p>
          <p>行驶状态: {{ agvStatus.isRunning ? '行驶中' : '停止' }}</p>
          <p>当前距离: {{ agvStatus.currentPosition?.toFixed(2) }} m</p>
        </el-card>
        <el-card style="margin-top: 20px">
          <template #header>实时缺陷</template>
          <div style="height: 300px; overflow-y: auto">
            <p v-for="flaw in liveFlaws" :key="flaw.id">
              在 {{ flaw.flawDistance }}m 处发现: {{ flaw.flawName }}
            </p>
            <el-empty v-if="liveFlaws.length === 0" description="暂无缺陷" :image-size="50" />
          </div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 实时缺陷弹窗 -->
    <el-dialog v-model="flawDialogVisible" title="发现新缺陷" width="600px">
      <div v-if="currentFlaw.id">
        <el-row :gutter="20">
          <el-col :span="12">
            <el-image
              :src="currentFlaw.flawImageUrl"
              fit="contain"
              style="width: 100%; height: 200px; background: #f5f7fa;"
            />
          </el-col>
          <el-col :span="12">
            <el-descriptions :column="1" border>
              <el-descriptions-item label="缺陷名称">{{ currentFlaw.flawName }}</el-descriptions-item>
              <el-descriptions-item label="缺陷类型">{{ currentFlaw.flawType }}</el-descriptions-item>
              <el-descriptions-item label="发现距离">{{ currentFlaw.flawDistance }}m</el-descriptions-item>
              <el-descriptions-item label="缺陷等级">{{ currentFlaw.level }}</el-descriptions-item>
              <el-descriptions-item label="缺陷描述">{{ currentFlaw.flawDesc }}</el-descriptions-item>
            </el-descriptions>
          </el-col>
        </el-row>
      </div>
      <template #footer>
        <el-button @click="flawDialogVisible = false">关闭</el-button>
        <el-button type="primary" @click="viewFlawDetail">查看详情</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getHeartbeat, agvForward, agvStop, agvBackward } from '@/api/movement'
import { getLiveInfo } from '@/api/flaw'
import { endTask } from '@/api/task'
import { ElMessage } from 'element-plus'
import type { Flaw } from '@/types/models'

// EasyPlayer相关类型定义
interface EasyPlayerOptions {
  container: HTMLElement
  videoUrl: string
  width?: number
  height?: number
  autoplay?: boolean
  isLive?: boolean
  hasAudio?: boolean
  debug?: boolean
}

// 摄像头设备接口
interface CameraDevice {
  id: string
  name: string
  status: string
  ip: string
  port: number
  videoUrl?: string
}

// 定义AGV状态的接口
interface AgvStatus {
  sysTime: string
  isRunning: boolean
  currentPosition: number
}

const route = useRoute()
const router = useRouter()
const id = route.params.id as string

const videoPlayer = ref<HTMLElement | null>(null)
const currentStreamId = ref('1')
const audioEnabled = ref(false)
const cameraDevices = ref<CameraDevice[]>([])

// EasyPlayer实例
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let easyPlayer: any = null
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let audioPlayer: any = null
// rtcClient 来自外部 JS 库，类型设为 any（保留作为备用）
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let rtcClient: any = null
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let audioClient: any = null

const agvStatus = ref<Partial<AgvStatus>>({})
const liveFlaws = ref<Flaw[]>([])
const flawDialogVisible = ref(false)
const currentFlaw = ref<Partial<Flaw>>({})
let heartbeatTimer: number | null = null
let liveInfoTimer: number | null = null

// 获取摄像头设备列表
const getCameraDevices = async () => {
  console.log('🔍 开始获取摄像头设备列表...')
  try {
    // 使用正确的摄像头设备API
    const response = await fetch('/easy-api/devices?page=1&size=999&status=&id&name', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Basic YWRtaW4xMjM6QWRtaW5AMTIz'
      }
    })
    
    console.log('📡 摄像头设备API响应状态:', response.status)
    console.log('📡 摄像头设备API响应头:', Object.fromEntries(response.headers.entries()))
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    
    const data = await response.json()
    console.log('📦 摄像头设备API原始响应:', data)
    
    // 根据实际API响应结构处理数据
    if (data && Array.isArray(data)) {
      // 如果直接返回数组
      cameraDevices.value = data.map((device: any) => ({
        id: device.id || device.deviceId || String(device.index || 1),
        name: device.name || device.deviceName || `摄像头 ${device.id || device.index || 1}`,
        status: device.status || 'online',
        ip: device.ip || '192.168.2.57',
        port: device.port || 8080,
        videoUrl: device.videoUrl || `/webrtc-api/live/${device.id || device.deviceId}_01.flv`
      }))
    } else if (data.code === 200 && data.data) {
      // 如果是标准响应格式
      const devices = Array.isArray(data.data) ? data.data : (data.data.rows || [])
      cameraDevices.value = devices.map((device: any) => ({
        id: device.id || device.deviceId || String(device.index || 1),
        name: device.name || device.deviceName || `摄像头 ${device.id || device.index || 1}`,
        status: device.status || 'online',
        ip: device.ip || '192.168.2.57',
        port: device.port || 8080,
        videoUrl: device.videoUrl || `/webrtc-api/live/${device.id || device.deviceId}_01.flv`
      }))
    } else {
      console.warn('⚠️ 摄像头设备列表数据格式异常，使用默认设备:', data)
      // 如果API返回异常，使用默认摄像头设备
      cameraDevices.value = [
        { id: '1', name: '摄像头 1', status: 'online', ip: '192.168.2.57', port: 8080, videoUrl: '/webrtc-api/live/1_01.flv' },
        { id: '2', name: '摄像头 2', status: 'online', ip: '192.168.2.57', port: 8080, videoUrl: '/webrtc-api/live/2_01.flv' },
        { id: '3', name: '摄像头 3', status: 'online', ip: '192.168.2.57', port: 8080, videoUrl: '/webrtc-api/live/3_01.flv' },
        { id: '4', name: '摄像头 4', status: 'online', ip: '192.168.2.57', port: 8080, videoUrl: '/webrtc-api/live/4_01.flv' }
      ]
    }
    
    console.log('✅ 摄像头设备列表获取成功:', cameraDevices.value)
    console.log('📹 可用摄像头数量:', cameraDevices.value.length)
    
    // 设置默认选择第一个摄像头
    if (cameraDevices.value.length > 0) {
      currentStreamId.value = cameraDevices.value[0].id
      console.log('🎯 设置默认摄像头ID:', currentStreamId.value)
    }
  } catch (error) {
    console.error('❌ 获取摄像头设备列表失败:', error)
    console.log('🔄 使用默认摄像头设备列表')
    // 网络错误时使用默认设备
    cameraDevices.value = [
      { id: '1', name: '摄像头 1', status: 'online', ip: '192.168.2.57', port: 8080, videoUrl: '/webrtc-api/live/1_01.flv' },
      { id: '2', name: '摄像头 2', status: 'online', ip: '192.168.2.57', port: 8080, videoUrl: '/webrtc-api/live/2_01.flv' },
      { id: '3', name: '摄像头 3', status: 'online', ip: '192.168.2.57', port: 8080, videoUrl: '/webrtc-api/live/3_01.flv' },
      { id: '4', name: '摄像头 4', status: 'online', ip: '192.168.2.57', port: 8080, videoUrl: '/webrtc-api/live/4_01.flv' }
    ]
    currentStreamId.value = cameraDevices.value[0].id
    ElMessage.warning('获取摄像头设备列表失败，使用默认设备: ' + (error as Error).message)
  }
}

const playStream = async () => {
  console.log('🎬 开始播放视频流，当前摄像头ID:', currentStreamId.value)
  
  // 开发环境下直接显示模拟界面
  if (import.meta.env.DEV) {
    console.log('🔧 开发环境检测，显示模拟视频界面')
    showMockVideoInterface()
    return
  }
  
  // 清理之前的播放器实例
  if (easyPlayer) {
    console.log('🧹 清理之前的播放器实例')
    try {
      easyPlayer.destroy()
    } catch (e) {
      console.warn('⚠️ 清理播放器实例时出错:', e)
    }
    easyPlayer = null
  }

  if (!videoPlayer.value) {
    console.error('❌ 视频容器未准备就绪')
    ElMessage.error('视频容器未准备就绪')
    return
  }

  try {
    // 根据接口文档，视频流地址格式为: {流媒体服务}/live/{摄像头ID}_01.flv
    // 获取当前选择的摄像头设备
    const currentDevice = cameraDevices.value.find(d => d.id === currentStreamId.value)
    if (!currentDevice) {
      console.error('❌ 未找到当前选择的摄像头设备:', currentStreamId.value)
      ElMessage.error('未找到选择的摄像头设备')
      return
    }
    
    // 使用摄像头设备的videoUrl
    const streamUrl = currentDevice.videoUrl
    
    console.log('🎯 当前选择的摄像头设备:', currentDevice)
    console.log('🎯 视频流URL:', streamUrl)

    // 等待DOM更新完成
    await nextTick()
    
    // 再等待一小段时间确保容器完全渲染
    await new Promise(resolve => setTimeout(resolve, 100))

    // 获取容器元素 - 使用getElementById而不是ref
    const containerElement = document.getElementById('video-player-container')
    if (!containerElement) {
      console.error('❌ 视频容器元素未找到')
      ElMessage.error('视频容器未准备就绪，请稍后重试')
      return
    }

    // 检查容器是否在DOM中且可见
    if (!containerElement.offsetParent && containerElement.offsetHeight === 0) {
      console.error('❌ 容器不可见或未正确渲染')
      ElMessage.error('视频容器未正确渲染')
      return
    }

    console.log('📦 视频容器元素:', containerElement)
    console.log('📏 容器尺寸:', {
      width: containerElement.clientWidth,
      height: containerElement.clientHeight,
      offsetWidth: containerElement.offsetWidth,
      offsetHeight: containerElement.offsetHeight,
      offsetParent: containerElement.offsetParent
    })

    // 检查EasyPlayer是否已加载
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const EasyPlayerClass = (window as any)['EasyPlayer-pro'] || (window as any).EasyPlayer

    console.log('🎮 EasyPlayer类检查:', {
      'EasyPlayer-pro': (window as any)['EasyPlayer-pro'],
      'EasyPlayer': (window as any).EasyPlayer,
      'selectedClass': EasyPlayerClass
    })

    if (!EasyPlayerClass) {
      console.error('❌ EasyPlayer未加载')
      ElMessage.error('视频播放器未加载，请刷新页面重试')
      return
    }

    // 彻底清理容器 - 移除EasyPlayer添加的所有class和属性
    containerElement.innerHTML = ''
    containerElement.className = ''
    containerElement.removeAttribute('data--easy-prov')
    containerElement.removeAttribute('data-darkreader-inline-bgcolor')
    containerElement.style.cssText = 'width: 100%; height: 450px; background-color: black; position: relative;'
    
    console.log('🧹 容器清理完成，当前状态:', {
      className: containerElement.className,
      innerHTML: containerElement.innerHTML,
      attributes: Array.from(containerElement.attributes).map(attr => `${attr.name}=${attr.value}`)
    })
    
    const playerConfig = {
      isLive: true,
      hasAudio: true,
      debug: true,
      WASM: true,
      stretch: true,
      autoplay: true,
      libUrl: '/EasyPlayer-lib.js',
      wasmUrl: '/EasyPlayer-pro.wasm'
    }

    console.log('⚙️ EasyPlayer初始化配置:', playerConfig)
    console.log('🎯 初始化参数:', {
      container: containerElement,
      config: playerConfig,
      videoUrl: streamUrl
    })

    // 创建EasyPlayer实例
    console.log('🚀 创建EasyPlayer实例...')
    console.log('🔧 最终检查 - 容器类型:', typeof containerElement)
    console.log('🔧 最终检查 - 容器标签名:', containerElement.tagName)
    console.log('🔧 最终检查 - 容器ID:', containerElement.id)
    console.log('🔧 最终检查 - 容器在文档中:', document.contains(containerElement))
    
    // 尝试创建实例前再次验证
    if (!containerElement || containerElement.nodeType !== Node.ELEMENT_NODE) {
      throw new Error('容器不是有效的DOM元素')
    }
    
    easyPlayer = new EasyPlayerClass(containerElement, playerConfig)
    console.log('✅ EasyPlayer实例创建成功:', easyPlayer)

    // 添加更多事件监听
    easyPlayer.on('loadstart', () => {
      console.log('📡 开始加载视频流')
    })
    
    easyPlayer.on('loadeddata', () => {
      console.log('📊 视频数据加载完成')
    })
    
    easyPlayer.on('canplay', () => {
      console.log('▶️ 视频可以开始播放')
    })

    easyPlayer.on('play', () => {
      console.log('✅ 视频开始播放')
      ElMessage.success(`摄像头 ${currentStreamId.value} 连接成功`)
    })

    easyPlayer.on('error', (error: any) => {
      console.error('❌ 视频播放错误:', error)
      console.error('❌ 错误详情:', {
        message: error.message,
        code: error.code,
        type: error.type,
        target: error.target
      })
      
      // 开发环境下的特殊处理
      if (import.meta.env.DEV) {
        console.log('🔧 开发环境检测到视频流错误，尝试使用测试流')
        // 尝试使用公开的测试HLS流
        const testStreamUrl = 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8'
        console.log('🎯 尝试播放测试流:', testStreamUrl)
        
        try {
          easyPlayer.play(testStreamUrl)
          ElMessage.warning(`摄像头 ${currentStreamId.value} 使用测试流 (开发模式)`)
        } catch (testError) {
          console.error('❌ 测试流也无法播放:', testError)
          showMockVideoInterface()
        }
      } else {
        ElMessage.error(`摄像头 ${currentStreamId.value} 连接失败: ${error.message || '未知错误'}`)
      }
    })

    easyPlayer.on('ended', () => {
      console.log('⏹️ 视频播放结束')
    })
    
    easyPlayer.on('waiting', () => {
      console.log('⏳ 视频缓冲中...')
    })
    
    easyPlayer.on('stalled', () => {
      console.log('⚠️ 视频流停滞')
    })

    // 播放视频流
    console.log('▶️ 开始播放视频流:', streamUrl)
    easyPlayer.play(streamUrl)
    
    // 设置超时检查
    setTimeout(() => {
      if (easyPlayer && !easyPlayer.playing) {
        console.warn('⚠️ 视频播放超时，可能存在网络问题')
        ElMessage.warning('视频加载超时，请检查网络连接')
      }
    }, 10000)

  } catch (error) {
    console.error('❌ 创建EasyPlayer实例失败:', error)
    console.error('❌ 错误堆栈:', (error as Error).stack)
    ElMessage.error(`视频播放器初始化失败: ${(error as Error).message || '未知错误'}`)
  }
}

const toggleAudio = () => {
  audioEnabled.value = !audioEnabled.value

  if (audioEnabled.value) {
    try {
      // 启动音频流 - 使用摄像头5作为音频源
      // 本地开发时使用代理
      const audioUrl = `/webrtc-api/live/5_01.flv`
      // 连接车载WiFi时使用直接地址
      // const audioUrl = `http://192.168.2.57/webrtc-api/live/5_01.flv`

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const EasyPlayerClass = (window as any).EasyPlayer || (window as any)['EasyPlayer-pro']

      if (!EasyPlayerClass) {
        ElMessage.error('音频播放器未加载')
        audioEnabled.value = false
        return
      }

      // 创建一个隐藏的音频容器
      const audioContainer = document.createElement('div')
      audioContainer.style.display = 'none'
      document.body.appendChild(audioContainer)

      audioPlayer = new EasyPlayerClass({
        container: audioContainer,
        videoUrl: audioUrl,
        autoplay: true,
        isLive: true,
        hasAudio: true,
        debug: true
      })

      audioPlayer.on('play', () => {
        console.log('音频开始播放')
        ElMessage.success('音频已开启')
      })

      audioPlayer.on('error', (error: any) => {
        console.error('音频播放错误:', error)
        ElMessage.error('音频开启失败')
        audioEnabled.value = false
      })

    } catch (error) {
      console.error('音频播放器初始化失败:', error)
      ElMessage.error('音频开启失败')
      audioEnabled.value = false
    }
  } else {
    // 关闭音频流
    if (audioPlayer) {
      audioPlayer.destroy()
      audioPlayer = null
    }
    ElMessage.info('音频已关闭')
  }
}

const handleMove = async (action: 'forward' | 'stop' | 'backward') => {
  try {
    const actions = { forward: agvForward, stop: agvStop, backward: agvBackward }
    await actions[action]()
    ElMessage.success(`指令[${action}]已发送`)
  } catch (e) {
    // 使用错误对象 e，消除 eslint 警告
    console.error(`指令[${action}]发送失败:`, e)
    ElMessage.error(`指令[${action}]发送失败`)
  }
}

const showMockVideoInterface = () => {
  console.log('🎭 显示模拟视频界面')
  
  // 获取视频容器
  const containerElement = document.getElementById('video-player-container')
  if (!containerElement) {
    console.error('❌ 视频容器未找到')
    return
  }
  
  // 清空容器并添加模拟界面
  containerElement.innerHTML = `
    <div style="
      width: 100%; 
      height: 100%; 
      background: linear-gradient(45deg, #1a1a1a 25%, #2a2a2a 25%, #2a2a2a 50%, #1a1a1a 50%, #1a1a1a 75%, #2a2a2a 75%);
      background-size: 20px 20px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      color: #ffffff;
      font-family: Arial, sans-serif;
      position: relative;
    ">
      <div style="
        background: rgba(0, 0, 0, 0.8);
        padding: 20px;
        border-radius: 10px;
        text-align: center;
        max-width: 400px;
      ">
        <div style="font-size: 48px; margin-bottom: 10px;">📹</div>
        <div style="font-size: 18px; margin-bottom: 10px; color: #00ff00;">摄像头 ${currentStreamId.value}</div>
        <div style="font-size: 14px; color: #cccccc; margin-bottom: 15px;">开发模式 - 模拟视频流</div>
        <div style="font-size: 12px; color: #888888; line-height: 1.4;">
          实际部署时将连接真实的摄像头设备<br>
          当前显示模拟界面用于开发测试
        </div>
      </div>
      <div style="
        position: absolute;
        top: 10px;
        right: 10px;
        background: rgba(255, 0, 0, 0.8);
        color: white;
        padding: 5px 10px;
        border-radius: 5px;
        font-size: 12px;
      ">DEMO</div>
    </div>
  `
  
  ElMessage.info(`摄像头 ${currentStreamId.value} 使用模拟界面 (开发模式)`)
}

const handleEndTask = async (isAbort: boolean) => {
  await endTask(Number(id), isAbort)
  ElMessage.success(isAbort ? '任务已终止' : '任务已完成，请复盘')

  if (isAbort) {
    router.push('/tasks')
  } else {
    // 任务完成，跳转到上传页面
    router.push(`/task/upload/${id}`)
  }
}

const viewFlawDetail = () => {
  flawDialogVisible.value = false
  router.push(`/task/detail/${id}`)
}

const goBack = () => {
  if (window.history.length > 1) {
    router.back();
    setTimeout(() => {
      location.reload();
    }, 100);
  } else {
    router.push('/tasks');
  }
};

onMounted(async () => {
  // 获取摄像头设备列表
  await getCameraDevices()

  // 启动视频流
  await playStream()

  // 启动心跳检测
  heartbeatTimer = window.setInterval(async () => {
    try {
      const res = await getHeartbeat()
      agvStatus.value = res.data
    } catch (error) {
      console.error('心跳检测失败:', error)
    }
  }, 2000)

  // 启动实时缺陷检测
  liveInfoTimer = window.setInterval(async () => {
    try {
      const res = await getLiveInfo(id)
      if (res.data && res.data.length > 0) {
        // 检查是否有新的缺陷
        const newFlaws = res.data.filter((flaw: Flaw) =>
          !liveFlaws.value.find(existing => existing.id === flaw.id)
        )

        if (newFlaws.length > 0) {
          liveFlaws.value.push(...newFlaws)
          // 显示第一个新缺陷的弹窗
          currentFlaw.value = newFlaws[0]
          flawDialogVisible.value = true
          ElMessage.warning(`发现新的实时缺陷!`)
        }
      }
    } catch (error) {
      console.error('获取实时缺陷信息失败:', error)
    }
  }, 5000)
})

onUnmounted(() => {
  // 清理EasyPlayer实例
  if (easyPlayer) {
    easyPlayer.destroy()
    easyPlayer = null
  }
  if (audioPlayer) {
    audioPlayer.destroy()
    audioPlayer = null
  }

  // 清理备用的RTC客户端（如果存在）
  if (rtcClient) {
    rtcClient.close()
  }
  if (audioClient) {
    audioClient.close()
  }

  // 清理定时器
  if (heartbeatTimer) clearInterval(heartbeatTimer)
  if (liveInfoTimer) clearInterval(liveInfoTimer)
})
</script>

<style scoped>
.control-panel {
  margin-top: 10px;
  display: flex;
  gap: 10px;
  align-items: center;
}
</style>
