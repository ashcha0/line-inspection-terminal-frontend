<template>
  <div>
    <el-page-header @back="goBack" :content="`正在执行任务: ${id}`" />
    <el-row :gutter="20" style="margin-top: 20px">
      <el-col :span="18">
        <!-- EasyPlayer 播放器容器 -->
        <div
          id="taskPlayerContainer"
          ref="playerContainer"
          style="width: 100%; height: 400px; background-color: #000; position: relative;"
        >
          <div v-if="!playerInstance" class="player-placeholder">
            <el-icon size="48" color="#909399"><VideoCamera /></el-icon>
            <p>摄像头播放器</p>
          </div>
        </div>
        <div class="control-panel">
          <el-select v-model="currentStreamId" placeholder="选择摄像头" @change="switchCamera" style="width: 200px">
            <el-option
              v-for="device in cameraDevices"
              :key="device.id"
              :label="device.name || `摄像头 ${device.id}`"
              :value="device.id"
            />
          </el-select>
          
          <!-- 任务控制按钮 -->
          <el-button 
            v-if="taskInfo.taskStatus === '待巡视'" 
            type="success" 
            @click="handleStartTask"
            size="default"
          >
            ▶️ 启动任务
          </el-button>
          
          <!-- AGV控制按钮 -->
          <el-button type="primary" @click="handleMove('forward')">前进</el-button>
          <el-button type="warning" @click="handleMove('stop')">停止移动</el-button>
          <el-button type="info" @click="handleMove('backward')">后退</el-button>
          <span style="font-size: 12px; color: #999; margin-left: 5px;">
            (仅控制AGV移动，不影响巡检任务)
          </span>
          
          <!-- 其他功能按钮 -->
          <el-button
            :type="audioEnabled ? 'success' : 'default'"
            @click="toggleAudio"
            :icon="audioEnabled ? 'Microphone' : 'MicrophoneSlash'"
          >
            {{ audioEnabled ? '音频开' : '音频关' }}
          </el-button>
          <el-button type="warning" @click="testLiveInfo" style="border-style: dashed;">
            🔍 测试缺陷轮询
          </el-button>
          
          <!-- 任务结束按钮 -->
          <el-button type="danger" @click="handleEndTask(true)">终止巡检</el-button>
          <el-button type="success" @click="handleEndTask(false)">完成巡检</el-button>
        </div>
      </el-col>
      <el-col :span="6">
        <el-card>
          <template #header>
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span>任务状态</span>
              <el-tag 
                :type="taskInfo.taskStatus === '巡视中' ? 'success' : 
                      taskInfo.taskStatus === '待巡视' ? 'info' : 
                      taskInfo.taskStatus === '已完成' ? 'primary' : 'warning'"
                size="small"
              >
                {{ taskInfo.taskStatus || '未知' }}
              </el-tag>
            </div>
          </template>
          <div style="font-size: 12px;">
            <p><strong>任务信息:</strong></p>
            <p>任务ID: {{ id }}</p>
            <p>任务名称: {{ taskInfo.taskName || '加载中...' }}</p>
            <p>任务状态: {{ taskInfo.taskStatus || '加载中...' }}</p>
            <p>创建人: {{ taskInfo.creator || '-' }}</p>
            <p>执行人: {{ taskInfo.executor || '-' }}</p>
          </div>
        </el-card>
        <el-card style="margin-top: 10px">
          <template #header>车辆状态</template>
          <p>系统时间: {{ agvStatus?.sysTime }}</p>
          <p>行驶状态: {{ agvStatus?.isRunning ? '行驶中' : '停止' }}</p>
          <p>当前距离: {{ agvStatus?.currentPosition?.toFixed(2) }} m</p>
        </el-card>
        <el-card style="margin-top: 20px">
          <template #header>
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span>实时缺陷</span>
              <el-tag size="small" type="info">{{ liveFlaws.length }} 个</el-tag>
            </div>
          </template>
          <div style="height: 300px; overflow-y: auto">
            <!-- 调试信息 -->
            <div style="background: #f5f7fa; padding: 10px; margin-bottom: 10px; border-radius: 4px; font-size: 12px;">
              <p><strong>调试信息:</strong></p>
              <p>任务ID: {{ id }}</p>
              <p>任务状态: <span :style="{ color: taskInfo.taskStatus === '巡视中' ? '#67c23a' : '#e6a23c', fontWeight: 'bold' }">{{ taskInfo.taskStatus || '加载中...' }}</span></p>
              <p>轮询状态: {{ liveInfoTimer ? '✅ 运行中' : '❌ 已停止' }}</p>
              <p>缺陷总数: {{ liveFlaws.length }}</p>
              <p>最后更新: {{ new Date().toLocaleTimeString() }}</p>
              
              <!-- 状态指导 -->
              <div style="margin-top: 8px; padding: 6px; border-radius: 3px;" 
                   :style="{ 
                     backgroundColor: taskInfo.taskStatus === '巡视中' ? '#f0f9ff' : '#fff7ed',
                     borderLeft: `3px solid ${taskInfo.taskStatus === '巡视中' ? '#67c23a' : '#e6a23c'}`
                   }">
                <p style="margin: 0; font-weight: bold;">
                  {{ taskInfo.taskStatus === '巡视中' ? '✅ 状态正常' : '⚠️ 需要注意' }}
                </p>
                <p style="margin: 2px 0 0 0; font-size: 11px;">
                  {{ taskInfo.taskStatus === '巡视中' 
                      ? '任务正在运行，可以接收实时缺陷数据' 
                      : taskInfo.taskStatus === '待巡视' 
                        ? '任务未启动，点击上方"启动任务"按钮开始巡检' 
                        : '任务已结束或异常，无法接收实时缺陷数据' 
                  }}
                </p>
              </div>
            </div>
            
            <!-- 缺陷列表 -->
            <div v-for="(flaw, index) in liveFlaws" :key="flaw.id" style="margin-bottom: 8px;">
              <el-tag size="small" type="warning" style="margin-right: 8px;">{{ index + 1 }}</el-tag>
              在 {{ flaw.flawDistance }}m 处发现: {{ flaw.flawName }}
              <div style="font-size: 12px; color: #999; margin-top: 2px;">
                ID: {{ flaw.id }} | 类型: {{ flaw.flawType }} | 等级: {{ flaw.level }}
              </div>
            </div>
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
import { ref, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getHeartbeat, agvForward, agvStop, agvBackward } from '@/api/movement'
import { getLiveInfo } from '@/api/flaw'
import { getTask, endTask, startTask } from '@/api/task'
import { getDeviceList, type CameraDevice } from '@/api/camera'
import { ElMessage } from 'element-plus'
import { VideoCamera } from '@element-plus/icons-vue'
import type { Task, Flaw, AgvStatusVO } from '@/types/models'

const route = useRoute()
const router = useRouter()
const id = route.params.id as string

const playerContainer = ref<HTMLElement | null>(null)
const currentStreamId = ref('')
const audioEnabled = ref(false)
const cameraDevices = ref<CameraDevice[]>([])

// EasyPlayer实例和音频客户端
const playerInstance = ref<any>(null)
const audioClient = ref<any>(null)

const taskInfo = ref<Partial<Task>>({})
const agvStatus = ref<AgvStatusVO | null>(null)
const liveFlaws = ref<Flaw[]>([])
const flawDialogVisible = ref(false)
const currentFlaw = ref<Partial<Flaw>>({})
let heartbeatTimer: number | null = null
let liveInfoTimer: number | null = null

// AGV状态轮询
let statusPollingTimer: NodeJS.Timeout | null = null

// 加载任务信息
const loadTaskInfo = async () => {
  try {
    const response = await getTask(Number(id))
    taskInfo.value = response.data.data
    console.log('任务执行页面','加载的任务信息:', taskInfo.value)
    console.log('任务执行页面','任务状态:', taskInfo.value.taskStatus)
    
    // 检查任务状态，给出相应提醒但不自动启动
    if (taskInfo.value.taskStatus === '待巡视') {
      console.log('任务执行页面','任务状态为"待巡视"，需要手动启动')
      ElMessage.warning({
        message: '当前任务未启动，需要先启动任务才能进行巡检和获取实时缺陷数据',
        duration: 5000
      })
    } else if (taskInfo.value.taskStatus === '巡视中') {
      console.log('任务执行页面','任务已在巡视中')
      ElMessage.success('任务正在进行中，可以查看实时缺陷数据')
    } else if (taskInfo.value.taskStatus === '已完成') {
      console.log('任务执行页面','任务已完成')
      ElMessage.info('任务已完成，可以查看历史数据')
    } else {
      console.log('任务执行页面','任务状态为:', taskInfo.value.taskStatus)
      ElMessage.warning(`任务状态: ${taskInfo.value.taskStatus}`)
    }
  } catch (error) {
    ElMessage.error('加载任务信息失败')
    console.error('加载任务信息失败:', error)
  }
}

// 获取摄像头设备列表
const loadCameraDevices = async () => {
  try {
    console.log('任务执行页面','=== 摄像头设备列表获取 ===')
    const response = await getDeviceList()
    console.log('任务执行页面','API响应:', response)
    // 根据API文档，数据在items字段中
    cameraDevices.value = response.items || []
    console.log('任务执行页面','解析后的摄像头列表:', cameraDevices.value)
    console.log('任务执行页面','摄像头设备数量:', cameraDevices.value.length)

    // 如果有设备，默认选择第一个
    if (cameraDevices.value.length > 0) {
      currentStreamId.value = cameraDevices.value[0].id
      console.log('任务执行页面','默认选择摄像头ID:', currentStreamId.value)
    }
  } catch (error) {
    console.error('获取摄像头设备列表失败:', error)
    ElMessage.warning('获取摄像头设备列表失败，使用默认配置')
    // 使用默认设备列表
    cameraDevices.value = [
      { id: '1', name: '摄像头 1', status: 'online' },
      { id: '2', name: '摄像头 2', status: 'online' },
      { id: '3', name: '摄像头 3', status: 'online' },
      { id: '4', name: '摄像头 4', status: 'online' }
    ]
    currentStreamId.value = '1'
  }
}

// 创建EasyPlayer实例
const createEasyPlayer = async () => {
  try {
    console.log('任务执行页面','=== EasyPlayer 实例创建 ===')

    // 检查EasyPlayerPro是否可用
    if (typeof window.EasyPlayerPro === 'undefined') {
      console.error('EasyPlayerPro 库未加载！')
      throw new Error('EasyPlayerPro 库未加载')
    }

    console.log('任务执行页面','EasyPlayerPro 构造函数可用:', window.EasyPlayerPro)

    // 销毁现有实例
    if (playerInstance.value) {
      console.log('任务执行页面','销毁现有播放器实例')
      try {
        playerInstance.value.pause()
        playerInstance.value.destroy()
        playerInstance.value = null
        // 等待销毁完成
        await new Promise(resolve => setTimeout(resolve, 50))
      } catch (error) {
        console.error('销毁现有播放器实例失败:', error)
        playerInstance.value = null
      }
    }

    // 获取容器元素
    const container = document.getElementById('taskPlayerContainer')
    if (!container) {
      throw new Error('找不到播放器容器元素')
    }

    // 播放器配置
    const playerConfig = {
      autoplay: true,
      live: true,
      hasAudio: false,
      decoder: {
        forceNoOffscreen: true,
        useMSE: false,
        useWCS: false
      },
      debug: true
    }

    console.log('任务执行页面','播放器配置:', playerConfig)
    console.log('任务执行页面','容器元素:', container)

    // 创建新的播放器实例
    playerInstance.value = new window.EasyPlayerPro(container, playerConfig)
    console.log('任务执行页面','播放器实例创建成功:', playerInstance.value)

    // 绑定事件监听器
    playerInstance.value.on('loadstart', () => {
      console.log('任务执行页面','EasyPlayer事件: loadstart')
    })

    playerInstance.value.on('loadeddata', () => {
      console.log('任务执行页面','EasyPlayer事件: loadeddata - 流媒体加载成功')
    })

    playerInstance.value.on('error', (error: any) => {
      console.error('EasyPlayer事件: error', error)
      ElMessage.error('视频播放失败')
    })

    playerInstance.value.on('ended', () => {
      console.log('任务执行页面','EasyPlayer事件: ended')
    })

    console.log('任务执行页面','EasyPlayer 实例创建完成')
    return true
  } catch (error: unknown) {
    console.error('创建 EasyPlayer 实例失败:', error)
    const errorMessage = error instanceof Error ? error.message : String(error)
    ElMessage.error(`创建播放器失败: ${errorMessage}`)
    return false
  }
}

// 播放指定摄像头的流媒体
const playStream = async () => {
  if (!currentStreamId.value) {
    ElMessage.warning('请先选择摄像头')
    return
  }

  try {
    console.log('任务执行页面','=== 开始播放流程 ===')
    console.log('任务执行页面','选择的摄像头ID:', currentStreamId.value)

    // 确保没有遗留的播放器实例
    if (playerInstance.value) {
      console.log('任务执行页面','检测到遗留播放器实例，先清理')
      try {
        playerInstance.value.pause()
        playerInstance.value.destroy()
        playerInstance.value = null
      } catch (error) {
        console.error('清理遗留播放器实例失败:', error)
      }
      // 等待清理完成
      await new Promise(resolve => setTimeout(resolve, 50))
    }

    // 创建播放器实例
    if (!(await createEasyPlayer())) {
      console.error('播放器实例创建失败')
      return
    }

    // 构建流媒体URL - 使用完整的HTTP地址
    const streamUrl = `http://192.168.2.57/webrtc-api/live/${currentStreamId.value}_01.flv`
    console.log('任务执行页面','流媒体URL:', streamUrl)

    // 开始播放
    console.log('任务执行页面','调用播放器play方法...')
    await playerInstance.value.play(streamUrl)
    console.log('任务执行页面','播放命令发送成功')

  } catch (error: unknown) {
    console.error('播放失败:', error)
    const errorMessage = error instanceof Error ? error.message : String(error)
    ElMessage.error(`播放失败: ${errorMessage}`)
    
    // 播放失败时也要清理实例
    if (playerInstance.value) {
      try {
        playerInstance.value.destroy()
        playerInstance.value = null
      } catch (cleanupError) {
        console.error('播放失败后清理实例失败:', cleanupError)
      }
    }
  }
}

// 切换摄像头
const switchCamera = async () => {
  console.log('任务执行页面','切换摄像头到:', currentStreamId.value)
  
  // 先停止并清理当前播放器实例
  if (playerInstance.value) {
    console.log('任务执行页面','清理当前播放器实例')
    try {
      playerInstance.value.pause()
      playerInstance.value.destroy()
      playerInstance.value = null
    } catch (error) {
      console.error('清理播放器实例失败:', error)
    }
  }
  
  // 等待一小段时间确保清理完成
  await new Promise(resolve => setTimeout(resolve, 100))
  
  // 重新播放新的摄像头流
  await playStream()
}

const toggleAudio = () => {
  audioEnabled.value = !audioEnabled.value

  if (audioEnabled.value) {
    // 启动音频流
    console.log('任务执行页面','启动音频流')
    ElMessage.success('音频已开启')
  } else {
    // 关闭音频流
    if (audioClient.value) {
      audioClient.value.close()
      audioClient.value = null
    }
    console.log('任务执行页面','关闭音频流')
    ElMessage.info('音频已关闭')
  }
}

const handleMove = async (action: 'forward' | 'stop' | 'backward') => {
  try {
    const actions = { forward: agvForward, stop: agvStop, backward: agvBackward }
    await actions[action]()
    ElMessage.success(`指令[${action}]已发送`)
  } catch (e) {
    console.error(`指令[${action}]发送失败:`, e)
    ElMessage.error(`指令[${action}]发送失败`)
  }
}

const handleStartTask = async () => {
  try {
    console.log('任务执行页面','用户手动启动任务，任务ID:', id)
    ElMessage.info('正在启动任务...')
    
    await startTask(Number(id))
    console.log('任务执行页面','任务启动成功')
    ElMessage.success('任务已启动')
    
    // 重新获取任务信息以确认状态
    const updatedResponse = await getTask(Number(id))
    taskInfo.value = updatedResponse.data.data
    console.log('任务执行页面','启动后任务状态:', taskInfo.value.taskStatus)
    
    if (taskInfo.value.taskStatus === '巡视中') {
      ElMessage.success('任务现在正在运行，可以查看实时缺陷数据')
    }
  } catch (error) {
    console.error('任务执行页面','启动任务失败:', error)
    ElMessage.error('启动任务失败，请检查任务状态或联系管理员')
  }
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
  // 直接跳转到任务列表，避免复杂的路由操作可能导致的问题
  router.push('/tasks');
};

// 加载AGV状态
const loadAgvStatus = async () => {
  try {
    const response = await getHeartbeat()
    agvStatus.value = response.data.data
  } catch (error) {
    console.error('获取AGV状态失败:', error)
    // 如果获取失败，显示默认状态
    agvStatus.value = null
  }
}

// 开始状态轮询
const startStatusPolling = () => {
  if (statusPollingTimer) {
    clearInterval(statusPollingTimer)
  }
  
  // 立即加载一次
  loadAgvStatus()
  
  // 每3秒轮询一次
  statusPollingTimer = setInterval(loadAgvStatus, 3000)
}

// 停止状态轮询
const stopStatusPolling = () => {
  if (statusPollingTimer) {
    clearInterval(statusPollingTimer)
    statusPollingTimer = null
  }
}

const testLiveInfo = async () => {
  try {
    console.log('任务执行页面','=== 手动测试缺陷轮询 ===')
    console.log('任务执行页面','当前任务状态:', taskInfo.value.taskStatus)
    
    if (taskInfo.value.taskStatus !== '巡视中') {
      ElMessage.warning('任务状态不是"巡视中"，可能无法获取实时缺陷数据')
    }
    
    const response = await getLiveInfo(id)
    const res = response.data // 从response中获取实际数据
    console.log('任务执行页面','API响应完整对象:', response)
    console.log('任务执行页面','API响应原始数据:', res)
    console.log('任务执行页面','API响应状态:', res.code)
    console.log('任务执行页面','API响应消息:', res.msg)
    console.log('任务执行页面','API响应数据:', res.data)
    console.log('任务执行页面','API响应数据类型:', typeof res.data)
    console.log('任务执行页面','API响应数据是否为数组:', Array.isArray(res.data))
    
    if (res.data) {
      console.log('任务执行页面','服务器返回的缺陷数量:', res.data.length)
      
      if (res.data.length > 0) {
        console.log('任务执行页面','服务器返回的缺陷列表:', res.data)
        
        // 检查是否有新的缺陷
        const newFlaws = res.data.filter((flaw: Flaw) => {
          const exists = liveFlaws.value.find(existing => existing.id === flaw.id)
          console.log('任务执行页面',`检查缺陷ID ${flaw.id} 是否已存在:`, !!exists)
          return !exists
        })

        console.log('任务执行页面','过滤后的新缺陷数量:', newFlaws.length)
        console.log('任务执行页面','新缺陷列表:', newFlaws)

        if (newFlaws.length > 0) {
          console.log('任务执行页面','发现新缺陷，准备添加到列表')
          // 添加新缺陷到列表
          liveFlaws.value.push(...newFlaws)
          console.log('任务执行页面','添加后的缺陷总数:', liveFlaws.value.length)
          console.log('任务执行页面','当前完整缺陷列表:', liveFlaws.value)
          
          // 显示第一个新缺陷的弹窗
          currentFlaw.value = newFlaws[0]
          console.log('任务执行页面','设置当前缺陷:', currentFlaw.value)
          flawDialogVisible.value = true
          console.log('任务执行页面','弹窗显示状态:', flawDialogVisible.value)
          ElMessage.warning(`发现 ${newFlaws.length} 个新的实时缺陷!`)
        } else {
          console.log('任务执行页面','没有新缺陷，跳过更新')
          ElMessage.info('测试完成：服务器有数据但都是已知缺陷')
        }
      } else {
        console.log('任务执行页面','服务器返回空的缺陷列表')
        ElMessage.info('测试完成：服务器返回空的缺陷列表')
      }
    } else {
      console.log('任务执行页面','服务器返回的data为空或null')
      ElMessage.warning('测试完成：服务器返回的data为空')
    }
  } catch (error) {
    console.error('任务执行页面','获取实时缺陷信息失败:', error)
    console.error('任务执行页面','错误详情:', error.response || error)
    ElMessage.error('获取实时缺陷信息失败，请检查网络连接')
  }
}

onMounted(async () => {
  console.log('任务执行页面','=== 页面初始化 ===')
  
  // 检查EasyPlayer库加载状态
  console.log('任务执行页面','=== EasyPlayer 库加载检查 ===')
  console.log('任务执行页面','window.EasyPlayerPro:', window.EasyPlayerPro)
  console.log('任务执行页面','typeof window.EasyPlayerPro:', typeof window.EasyPlayerPro)

  if (typeof window.EasyPlayerPro === 'undefined') {
    console.error('EasyPlayerPro 库未加载！')
    ElMessage.error('EasyPlayerPro 库未加载')
  } else {
    console.log('任务执行页面','EasyPlayerPro 库加载成功！')
  }

  // 加载任务信息
  await loadTaskInfo()

  // 先加载摄像头设备列表
  await loadCameraDevices()

  // 然后播放视频流
  if (currentStreamId.value) {
    await playStream()
  }

  heartbeatTimer = window.setInterval(async () => {
    try {
      const response = await getHeartbeat()
      agvStatus.value = response.data.data
    } catch (error) {
      console.error('获取AGV心跳失败:', error)
    }
  }, 2000)

  // 添加详细日志的实时缺陷轮询
  console.log('任务执行页面','=== 开始设置实时缺陷轮询 ===')
  console.log('任务执行页面','任务ID:', id)
  
  liveInfoTimer = window.setInterval(async () => {
    console.log('任务执行页面','=== 开始轮询实时缺陷信息 ===')
    console.log('任务执行页面','轮询时间:', new Date().toLocaleTimeString())
    console.log('任务执行页面','任务ID:', id)
    console.log('任务执行页面','当前任务状态:', taskInfo.value.taskStatus)
    console.log('任务执行页面','当前已有缺陷数量:', liveFlaws.value.length)
    
    // 检查任务状态
    if (taskInfo.value.taskStatus !== '巡视中') {
      console.log('任务执行页面','任务状态不是"巡视中"，但继续轮询以监控状态变化')
    }
    
    try {
      const response = await getLiveInfo(id)
      const res = response.data // 从response中获取实际数据
      console.log('任务执行页面','API响应完整对象:', response)
      console.log('任务执行页面','API响应原始数据:', res)
      console.log('任务执行页面','API响应状态:', res.code)
      console.log('任务执行页面','API响应消息:', res.msg)
      console.log('任务执行页面','API响应数据:', res.data)
      console.log('任务执行页面','API响应数据类型:', typeof res.data)
      console.log('任务执行页面','API响应数据是否为数组:', Array.isArray(res.data))
      
      if (res.data) {
        console.log('任务执行页面','服务器返回的缺陷数量:', res.data.length)
        
        if (res.data.length > 0) {
          console.log('任务执行页面','服务器返回的缺陷列表:', res.data)
          
          // 检查是否有新的缺陷
          const newFlaws = res.data.filter((flaw: Flaw) => {
            const exists = liveFlaws.value.find(existing => existing.id === flaw.id)
            console.log('任务执行页面',`检查缺陷ID ${flaw.id} 是否已存在:`, !!exists)
            return !exists
          })

          console.log('任务执行页面','过滤后的新缺陷数量:', newFlaws.length)
          console.log('任务执行页面','新缺陷列表:', newFlaws)

          if (newFlaws.length > 0) {
            console.log('任务执行页面','发现新缺陷，准备添加到列表')
            // 添加新缺陷到列表
            liveFlaws.value.push(...newFlaws)
            console.log('任务执行页面','添加后的缺陷总数:', liveFlaws.value.length)
            console.log('任务执行页面','当前完整缺陷列表:', liveFlaws.value)
            
            // 显示第一个新缺陷的弹窗
            currentFlaw.value = newFlaws[0]
            console.log('任务执行页面','设置当前缺陷:', currentFlaw.value)
            flawDialogVisible.value = true
            console.log('任务执行页面','弹窗显示状态:', flawDialogVisible.value)
            ElMessage.warning(`发现 ${newFlaws.length} 个新的实时缺陷!`)
          } else {
            console.log('任务执行页面','没有新缺陷，跳过更新')
          }
        } else {
          console.log('任务执行页面','服务器返回空的缺陷列表')
        }
      } else {
        console.log('任务执行页面','服务器返回的data为空或null')
      }
    } catch (error) {
      console.error('任务执行页面','获取实时缺陷信息失败:', error)
      console.error('任务执行页面','错误详情:', error.response || error)
      ElMessage.error('获取实时缺陷信息失败，请检查网络连接')
    }
    
    console.log('任务执行页面','=== 完成本次轮询 ===')
  }, 5000)

  console.log('任务执行页面','实时缺陷轮询定时器已设置，间隔5秒')

  // 开始状态轮询
  startStatusPolling()
})

onUnmounted(() => {
  // 清理播放器实例
  if (playerInstance.value) {
    playerInstance.value.destroy()
    playerInstance.value = null
  }
  if (audioClient.value) {
    audioClient.value.close()
    audioClient.value = null
  }
  if (heartbeatTimer) clearInterval(heartbeatTimer)
  if (liveInfoTimer) clearInterval(liveInfoTimer)
  if (statusPollingTimer) clearInterval(statusPollingTimer)
  console.log('任务执行页面','页面卸载，清理资源')
})
</script>

<style scoped>
.player-placeholder {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  height: 100%;
  color: #909399;
}

.control-panel {
  margin-top: 10px;
  display: flex;
  gap: 10px;
  align-items: center;
  flex-wrap: wrap;
}

.control-panel .el-button {
  margin: 2px;
}

/* 按钮分组样式 */
.control-panel .el-button[type="success"]:first-of-type {
  margin-left: 15px;
}

.control-panel .el-button[type="primary"],
.control-panel .el-button[type="warning"],
.control-panel .el-button[type="info"] {
  margin-left: 15px;
}

.control-panel .el-button[type="danger"],
.control-panel .el-button[type="success"]:last-of-type {
  margin-left: 15px;
}
</style>
