<template>
  <div class="camera-test">
    <el-page-header @back="goBack" content="摄像头测试页面" />

    <el-row :gutter="20" style="margin-top: 20px">
      <!-- 视频播放区域 -->
      <el-col :span="16">
        <el-card>
          <template #header>
            <div class="card-header">
              <span>视频播放器</span>
              <el-tag :type="playerStatus === 'playing' ? 'success' : 'info'">
                {{ playerStatus === 'playing' ? '播放中' : '未播放' }}
              </el-tag>
            </div>
          </template>

          <!-- EasyPlayer 播放器容器 -->
          <div
            id="easyPlayerContainer"
            ref="playerContainer"
            style="width: 100%; height: 400px; background-color: #000; position: relative;"
          >
            <div v-if="!playerInstance" class="player-placeholder">
              <el-icon size="48" color="#909399"><VideoCamera /></el-icon>
              <p>请选择摄像头并开始播放</p>
            </div>
          </div>

          <!-- 播放器控制面板 -->
          <div class="player-controls">
            <el-select
              v-model="selectedCameraId"
              placeholder="选择摄像头"
              style="width: 200px; margin-right: 10px"
              @change="onCameraChange"
            >
              <el-option
                v-for="camera in cameraList"
                :key="camera.id"
                :label="camera.name || `摄像头 ${camera.id}`"
                :value="camera.id"
              />
            </el-select>

            <el-button
              type="primary"
              @click="startPlay"
              :disabled="!selectedCameraId || playerStatus === 'playing'"
              :loading="isLoading"
            >
              开始播放
            </el-button>

            <el-button
              type="warning"
              @click="stopPlay"
              :disabled="playerStatus !== 'playing'"
            >
              停止播放
            </el-button>

            <el-button
              type="info"
              @click="takeSnapshot"
              :disabled="playerStatus !== 'playing'"
            >
              截图
            </el-button>

            <el-button
              type="success"
              @click="refreshCameraList"
              :loading="isRefreshing"
            >
              刷新设备
            </el-button>
          </div>
        </el-card>
      </el-col>

      <!-- 信息面板 -->
      <el-col :span="8">
        <!-- 摄像头设备信息 -->
        <el-card>
          <template #header>摄像头设备列表</template>
          <div style="max-height: 200px; overflow-y: auto">
            <el-empty v-if="cameraList.length === 0" description="暂无设备" :image-size="60" />
            <div v-else>
              <div
                v-for="camera in cameraList"
                :key="camera.id"
                class="camera-item"
                :class="{ active: camera.id === selectedCameraId }"
                @click="selectedCameraId = camera.id"
              >
                <div class="camera-info">
                  <span class="camera-name">{{ camera.name || `摄像头 ${camera.id}` }}</span>
                  <el-tag
                    :type="camera.status === 'online' ? 'success' : 'danger'"
                    size="small"
                  >
                    {{ camera.status === 'online' ? '在线' : '离线' }}
                  </el-tag>
                </div>
                <div class="camera-details">
                  <small>ID: {{ camera.id }}</small>
                  <small v-if="camera.ip">IP: {{ camera.ip }}</small>
                </div>
              </div>
            </div>
          </div>
        </el-card>

        <!-- 播放器状态信息 -->
        <el-card style="margin-top: 20px">
          <template #header>播放器状态</template>
          <el-descriptions :column="1" size="small">
            <el-descriptions-item label="播放状态">
              <el-tag :type="playerStatus === 'playing' ? 'success' : 'info'">
                {{ getPlayerStatusText() }}
              </el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="当前摄像头">
              {{ getCurrentCameraName() }}
            </el-descriptions-item>
            <el-descriptions-item label="流媒体地址">
              <el-text size="small" type="info">{{ currentStreamUrl || '未设置' }}</el-text>
            </el-descriptions-item>
            <el-descriptions-item label="播放器实例">
              <el-tag :type="playerInstance ? 'success' : 'info'" size="small">
                {{ playerInstance ? '已创建' : '未创建' }}
              </el-tag>
            </el-descriptions-item>
          </el-descriptions>
        </el-card>

        <!-- 测试日志 -->
        <el-card style="margin-top: 20px">
          <template #header>
            <div style="display: flex; justify-content: space-between; align-items: center">
              <span>测试日志</span>
              <el-button size="small" @click="clearLogs">清空</el-button>
            </div>
          </template>
          <div class="log-container">
            <div v-for="(log, index) in testLogs" :key="index" class="log-item">
              <span class="log-time">{{ log.time }}</span>
              <span :class="`log-level log-${log.level}`">{{ log.level.toUpperCase() }}</span>
              <span class="log-message">{{ log.message }}</span>
            </div>
            <el-empty v-if="testLogs.length === 0" description="暂无日志" :image-size="40" />
          </div>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { getDeviceList, type CameraDevice } from '@/api/camera'
import { ElMessage } from 'element-plus'
import { VideoCamera } from '@element-plus/icons-vue'

// 定义日志接口
interface TestLog {
  time: string
  level: 'info' | 'success' | 'warning' | 'error'
  message: string
}

const router = useRouter()

// 响应式数据
const cameraList = ref<CameraDevice[]>([])
const selectedCameraId = ref('')
const playerContainer = ref<HTMLElement | null>(null)
const playerInstance = ref<any>(null)
const playerStatus = ref<'idle' | 'loading' | 'playing' | 'error'>('idle')
const currentStreamUrl = ref('')
const isLoading = ref(false)
const isRefreshing = ref(false)
const testLogs = ref<TestLog[]>([])

// 添加日志
const addLog = (level: TestLog['level'], message: string) => {
  const now = new Date()
  const time = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`
  testLogs.value.unshift({ time, level, message })

  // 限制日志数量
  if (testLogs.value.length > 50) {
    testLogs.value = testLogs.value.slice(0, 50)
  }
}

// 清空日志
const clearLogs = () => {
  testLogs.value = []
  addLog('info', '日志已清空')
}

// 获取摄像头设备列表
const loadCameraList = async () => {
  try {
    isRefreshing.value = true
    addLog('info', '正在获取摄像头设备列表...')
    console.log('播放器调试','=== 摄像头设备列表获取 ===')

    const response = await getDeviceList()
    console.log('播放器调试','API响应:', response)
    // 根据API文档，数据在items字段中
    cameraList.value = response.items || []
    console.log('播放器调试','解析后的摄像头列表:', cameraList.value)
    console.log('播放器调试','摄像头设备数量:', cameraList.value.length)

    addLog('success', `成功获取 ${cameraList.value.length} 个摄像头设备`)

    // 如果有设备且未选择，默认选择第一个
    if (cameraList.value.length > 0 && !selectedCameraId.value) {
      selectedCameraId.value = cameraList.value[0].id
      addLog('info', `默认选择摄像头: ${getCurrentCameraName()}`)
      console.log('播放器调试','默认选择摄像头ID:', selectedCameraId.value)
    }
  } catch (error: unknown) {
    console.error('获取摄像头设备列表失败:', error)
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.log('播放器调试','错误详情:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      response: (error as any)?.response
    })
    addLog('error', `获取摄像头设备列表失败: ${errorMessage}`)
    ElMessage.error('获取摄像头设备列表失败')

    // 使用默认设备列表进行测试
    cameraList.value = [
      { id: '1', name: '摄像头 1', status: 'online' },
      { id: '2', name: '摄像头 2', status: 'online' },
      { id: '3', name: '摄像头 3', status: 'online' },
      { id: '4', name: '摄像头 4', status: 'online' }
    ]
    selectedCameraId.value = '1'
    addLog('warning', '使用默认摄像头配置进行测试')
    console.log('播放器调试','使用默认摄像头配置:', cameraList.value)
  } finally {
    isRefreshing.value = false
  }
}

// 刷新摄像头列表
const refreshCameraList = () => {
  loadCameraList()
}

// 摄像头选择变化
const onCameraChange = () => {
  addLog('info', `选择摄像头: ${getCurrentCameraName()}`)
  // 如果正在播放，停止当前播放
  if (playerStatus.value === 'playing') {
    stopPlay()
  }
}

// 创建EasyPlayer实例
const createEasyPlayer = () => {
  try {
    addLog('info', '正在创建 EasyPlayer 实例...')
    console.log('播放器调试','=== EasyPlayer 实例创建 ===')

    // 检查EasyPlayerPro是否可用
    if (typeof window.EasyPlayerPro === 'undefined') {
      console.error('EasyPlayerPro 库未加载！')
      throw new Error('EasyPlayerPro 库未加载')
    }

    console.log('播放器调试','EasyPlayerPro 构造函数可用:', window.EasyPlayerPro)

    // 销毁现有实例
    if (playerInstance.value) {
      console.log('播放器调试','销毁现有播放器实例')
      playerInstance.value.destroy()
      playerInstance.value = null
    }

    // 获取容器元素
    const container = document.getElementById('easyPlayerContainer')
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

    console.log('播放器调试','播放器配置:', playerConfig)
    console.log('播放器调试','容器元素:', container)

    // 创建新的播放器实例 - 传入容器元素和配置
    playerInstance.value = new window.EasyPlayerPro(container, playerConfig)
    console.log('播放器调试','播放器实例创建成功:', playerInstance.value)

    // 绑定事件监听器
    playerInstance.value.on('loadstart', () => {
      console.log('播放器调试','EasyPlayer事件: loadstart')
      addLog('info', 'EasyPlayer: 开始加载流媒体')
      playerStatus.value = 'loading'
    })

    playerInstance.value.on('loadeddata', () => {
      console.log('播放器调试','EasyPlayer事件: loadeddata')
      addLog('success', 'EasyPlayer: 流媒体加载成功')
      playerStatus.value = 'playing'
    })

    playerInstance.value.on('error', (error: any) => {
      console.error('EasyPlayer事件: error', error)
      addLog('error', `EasyPlayer: 播放错误 - ${error.message || error}`)
      playerStatus.value = 'error'
      ElMessage.error('视频播放失败')
    })

    playerInstance.value.on('ended', () => {
      console.log('播放器调试','EasyPlayer事件: ended')
      addLog('warning', 'EasyPlayer: 播放结束')
      playerStatus.value = 'idle'
    })

    addLog('success', 'EasyPlayer 实例创建成功')
    console.log('播放器调试','EasyPlayer 实例创建完成')
    return true
  } catch (error: unknown) {
    console.error('创建 EasyPlayer 实例失败:', error)
    const errorMessage = error instanceof Error ? error.message : String(error)
    addLog('error', `创建 EasyPlayer 实例失败: ${errorMessage}`)
    ElMessage.error('创建播放器失败')
    return false
  }
}

// 开始播放
const startPlay = async () => {
  if (!selectedCameraId.value) {
    ElMessage.warning('请先选择摄像头')
    return
  }

  try {
    isLoading.value = true
    addLog('info', `开始播放摄像头 ${getCurrentCameraName()}`)
    console.log('播放器调试','=== 开始播放流程 ===')
    console.log('播放器调试','选择的摄像头ID:', selectedCameraId.value)

    // 创建播放器实例
    if (!createEasyPlayer()) {
      console.error('播放器实例创建失败')
      return
    }

    // 构建流媒体URL - 使用完整的HTTP地址
    currentStreamUrl.value = `http://192.168.2.57/webrtc-api/live/${selectedCameraId.value}_01.flv`
    addLog('info', `流媒体地址: ${currentStreamUrl.value}`)
    console.log('播放器调试','流媒体URL:', currentStreamUrl.value)

    // 开始播放
    console.log('播放器调试','调用播放器play方法...')
    await playerInstance.value.play(currentStreamUrl.value)
    addLog('success', '播放命令已发送')
    console.log('播放器调试','播放命令发送成功')

  } catch (error: unknown) {
    console.error('播放失败:', error)
    console.log('播放器调试','播放错误详情:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      playerInstance: playerInstance.value
    })
    const errorMessage = error instanceof Error ? error.message : String(error)
    addLog('error', `播放失败: ${errorMessage}`)
    ElMessage.error('播放失败')
    playerStatus.value = 'error'
  } finally {
    isLoading.value = false
  }
}

// 停止播放
const stopPlay = () => {
  try {
    addLog('info', '正在停止播放...')

    if (playerInstance.value) {
      playerInstance.value.pause()
      playerInstance.value.destroy()
      playerInstance.value = null
    }

    playerStatus.value = 'idle'
    currentStreamUrl.value = ''
    addLog('success', '播放已停止')
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    addLog('error', `停止播放失败: ${errorMessage}`)
    ElMessage.error('停止播放失败')
  }
}

// 截图
const takeSnapshot = () => {
  try {
    if (!playerInstance.value) {
      ElMessage.warning('播放器未初始化')
      return
    }

    addLog('info', '正在截图...')

    // 调用EasyPlayer的截图功能
    const canvas = playerInstance.value.getImage()
    if (canvas) {
      // 创建下载链接
      const link = document.createElement('a')
      link.download = `camera_${selectedCameraId.value}_${Date.now()}.png`
      link.href = canvas.toDataURL()
      link.click()

      addLog('success', '截图成功')
      ElMessage.success('截图已保存')
    } else {
      addLog('error', '截图失败: 无法获取画面')
      ElMessage.error('截图失败')
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    addLog('error', `截图失败: ${errorMessage}`)
    ElMessage.error('截图失败')
  }
}

// 获取当前摄像头名称
const getCurrentCameraName = () => {
  const camera = cameraList.value.find(c => c.id === selectedCameraId.value)
  return camera ? (camera.name || `摄像头 ${camera.id}`) : '未选择'
}

// 获取播放器状态文本
const getPlayerStatusText = () => {
  const statusMap = {
    idle: '空闲',
    loading: '加载中',
    playing: '播放中',
    error: '错误'
  }
  return statusMap[playerStatus.value] || '未知'
}

// 返回上一页
const goBack = () => {
  router.back()
}

// 组件挂载
onMounted(async () => {
  addLog('info', '摄像头测试页面已加载')

  // 详细检查EasyPlayer库加载状态
  console.log('播放器调试','=== EasyPlayer 库加载检查 ===')
  console.log('播放器调试','window.EasyPlayerPro:', window.EasyPlayerPro)
  console.log('播放器调试','typeof window.EasyPlayerPro:', typeof window.EasyPlayerPro)
  console.log('播放器调试','window对象上的EasyPlayer相关属性:', Object.keys(window).filter(key => key.toLowerCase().includes('easy')))

  if (typeof window.EasyPlayerPro === 'undefined') {
    addLog('error', 'EasyPlayerPro 库未加载，请检查库文件引入')
    console.error('EasyPlayerPro 库未加载！')
    console.log('播放器调试','请检查以下文件是否正确加载:')
    console.log('播放器调试','- /EasyPlayer-decode.js')
    console.log('播放器调试','- /EasyPlayer-lib.js')
    console.log('播放器调试','- /EasyPlayer-pro.js')
    ElMessage.error('EasyPlayerPro 库未加载')
  } else {
    addLog('success', 'EasyPlayerPro 库已加载')
    console.log('播放器调试','EasyPlayerPro 库加载成功！')
    console.log('播放器调试','EasyPlayerPro 构造函数:', window.EasyPlayerPro)
  }

  // 加载摄像头设备列表
  await loadCameraList()
})

// 组件卸载
onUnmounted(() => {
  // 清理播放器实例
  if (playerInstance.value) {
    playerInstance.value.destroy()
    playerInstance.value = null
  }
  addLog('info', '摄像头测试页面已卸载')
})
</script>

<style scoped>
.camera-test {
  padding: 20px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.player-placeholder {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  height: 100%;
  color: #909399;
}

.player-controls {
  margin-top: 15px;
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.camera-item {
  padding: 10px;
  border: 1px solid #e4e7ed;
  border-radius: 4px;
  margin-bottom: 8px;
  cursor: pointer;
  transition: all 0.3s;
}

.camera-item:hover {
  border-color: #409eff;
  background-color: #f0f9ff;
}

.camera-item.active {
  border-color: #409eff;
  background-color: #ecf5ff;
}

.camera-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 5px;
}

.camera-name {
  font-weight: 500;
}

.camera-details {
  display: flex;
  gap: 10px;
  color: #909399;
  font-size: 12px;
}

.log-container {
  max-height: 200px;
  overflow-y: auto;
  font-family: 'Courier New', monospace;
  font-size: 12px;
}

.log-item {
  display: flex;
  gap: 8px;
  padding: 2px 0;
  border-bottom: 1px solid #f0f0f0;
}

.log-time {
  color: #909399;
  min-width: 60px;
}

.log-level {
  min-width: 50px;
  font-weight: bold;
}

.log-info { color: #409eff; }
.log-success { color: #67c23a; }
.log-warning { color: #e6a23c; }
.log-error { color: #f56c6c; }

.log-message {
  flex: 1;
  word-break: break-all;
}
</style>
