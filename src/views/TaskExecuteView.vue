<template>
  <div>
    <el-page-header @back="goBack" :content="`正在执行任务: ${id}`" />
    <el-row :gutter="20" style="margin-top: 20px">
      <el-col :span="18">
        <video
          ref="videoPlayer"
          autoplay
          controls
          muted
          style="width: 100%; height: auto; background-color: black"
        ></video>
        <div class="control-panel">
          <el-select v-model="currentStreamId" placeholder="选择摄像头" @change="playStream" style="width: 120px">
            <el-option v-for="i in 4" :key="i" :label="`摄像头 ${i}`" :value="i" />
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
import { ref, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getHeartbeat, agvForward, agvStop, agvBackward } from '@/api/movement'
import { getLiveInfo } from '@/api/flaw'
import { endTask } from '@/api/task'
import { ElMessage } from 'element-plus'
import type { Flaw } from '@/types/models'

// 定义AGV状态的接口
interface AgvStatus {
  sysTime: string
  isRunning: boolean
  currentPosition: number
}

const route = useRoute()
const router = useRouter()
const id = route.params.id as string

const videoPlayer = ref<HTMLVideoElement | null>(null)
const currentStreamId = ref(1)
const audioEnabled = ref(false)

// rtcClient 来自外部 JS 库，类型设为 any
// 使用 @ts-ignore 来忽略下一行的类型检查，这是处理无类型定义的第三方库的常用方法
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

const playStream = () => {
  if (rtcClient) {
    rtcClient.close()
  }
  // 本地开发时使用相对路径，通过vite代理转发
  const webrtcUrl = `/webrtc-api/index/api/webrtc?app=live&stream=${currentStreamId.value}&type=play`
  // 连接车载WiFi时直接使用车载服务器地址（取消注释并注释上面的webrtcUrl）
  // const webrtcUrl = `http://192.168.2.2/webrtc-api/index/api/webrtc?app=live&stream=${currentStreamId.value}&type=play`

  // ZLMRTCClient 是从外部脚本加载的，所以我们使用 window.ZLMRTCClient
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rtcClient = new (window as any).ZLMRTCClient.Endpoint({
    element: videoPlayer.value,
    zlmsdpUrl: webrtcUrl,
    debug: true
  })

  // 为事件处理器的参数显式指定 any 类型，并使用忽略注释
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rtcClient.on((window as any).ZLMRTCClient.Events.WEBRTC_ON_REMOTE_STREAMS, (e: any) => {
    console.log('播放成功', e.streams)
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rtcClient.on((window as any).ZLMRTCClient.Events.WEBRTC_OFFER_ANWSER_EXCHANGE_FAILED, (e: any) => {
    console.error('信令交换失败', e)
    ElMessage.error('视频流连接失败，请检查流媒体服务')
  })
}

const toggleAudio = () => {
  audioEnabled.value = !audioEnabled.value
  
  if (audioEnabled.value) {
    // 启动音频流
    // 本地开发时使用相对路径，通过vite代理转发
    const audioUrl = `/webrtc-api/index/api/webrtc?app=live&stream=5&type=play`
    // 连接车载WiFi时直接使用车载服务器地址（取消注释并注释上面的audioUrl）
    // const audioUrl = `http://192.168.2.2/webrtc-api/index/api/webrtc?app=live&stream=5&type=play`
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    audioClient = new (window as any).ZLMRTCClient.Endpoint({
      zlmsdpUrl: audioUrl,
      debug: true
    })
    ElMessage.success('音频已开启')
  } else {
    // 关闭音频流
    if (audioClient) {
      audioClient.close()
      audioClient = null
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

onMounted(() => {
  playStream()

  heartbeatTimer = window.setInterval(async () => {
    const res = await getHeartbeat()
    agvStatus.value = res.data
  }, 2000)

  liveInfoTimer = window.setInterval(async () => {
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
  }, 5000)
})

onUnmounted(() => {
  if (rtcClient) {
    rtcClient.close()
  }
  if (audioClient) {
    audioClient.close()
  }
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
