<template>
  <div class="api-test-container">
    <el-card class="test-card">
      <template #header>
        <div class="card-header">
          <span>接口测试页面</span>
          <el-button type="primary" @click="clearLogs">清空日志</el-button>
        </div>
      </template>

      <!-- 系统配置测试 -->
      <el-collapse v-model="activeNames">
        <el-collapse-item title="系统配置相关接口" name="config">
          <div class="test-section">
            <el-button @click="testGetConfig" type="primary">获取系统配置</el-button>
            <el-button @click="testUpdateConfig" type="warning">更新系统配置</el-button>
          </div>
        </el-collapse-item>

        <!-- 系统检查测试 -->
        <el-collapse-item title="系统检查相关接口" name="check">
          <div class="test-section">
            <el-button @click="testCheckFs" type="primary">检查文件系统</el-button>
            <el-button @click="testCheckDb" type="primary">检查数据库</el-button>
            <el-button @click="testCheckAgv" type="primary">检查AGV连接</el-button>
            <el-button @click="testCheckCam" type="primary">检查摄像头连接</el-button>
          </div>
        </el-collapse-item>

        <!-- AGV控制测试 -->
        <el-collapse-item title="AGV移动控制相关接口" name="agv">
          <div class="test-section">
            <el-button @click="testHeartbeat" type="primary">查询AGV心跳</el-button>
            <el-button @click="testAgvForward" type="success">AGV向前移动</el-button>
            <el-button @click="testAgvStop" type="danger">停止AGV</el-button>
            <el-button @click="testAgvBackward" type="warning">AGV向后移动</el-button>
          </div>
        </el-collapse-item>

        <!-- 任务管理测试 -->
        <el-collapse-item title="巡视任务管理相关接口" name="task">
          <div class="test-section">
            <el-button @click="testListTask" type="primary">获取任务列表</el-button>
            <el-button @click="testAddTask" type="success">新建任务</el-button>
            <el-button @click="testGetTask" type="info">获取任务详情</el-button>
          </div>
        </el-collapse-item>

        <!-- 故障缺陷测试 -->
        <el-collapse-item title="故障缺陷管理相关接口" name="flaw">
          <div class="test-section">
            <el-button @click="testListFlaw" type="primary">获取缺陷列表</el-button>
            <el-button @click="testAddFlaw" type="success">新增缺陷</el-button>
          </div>
        </el-collapse-item>

        <!-- 摄像头设备测试 -->
        <el-collapse-item title="摄像头信息相关接口" name="camera">
          <div class="test-section">
            <el-button @click="testDeviceList" type="primary">获取摄像头设备列表</el-button>
          </div>
        </el-collapse-item>
      </el-collapse>

      <!-- 测试日志 -->
      <div class="log-section">
        <h3>测试日志</h3>
        <el-scrollbar height="400px">
          <div class="log-content">
            <div 
              v-for="(log, index) in logs" 
              :key="index" 
              :class="['log-item', log.type]"
            >
              <span class="log-time">{{ log.time }}</span>
              <span class="log-message">{{ log.message }}</span>
              <pre v-if="log.data" class="log-data">{{ log.data }}</pre>
            </div>
          </div>
        </el-scrollbar>
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import request from '@/api/request'
import axios from 'axios'

interface LogItem {
  time: string
  type: 'success' | 'error' | 'info'
  message: string
  data?: string
}

const activeNames = ref(['config', 'check'])
const logs = ref<LogItem[]>([])

// 添加日志
const addLog = (type: LogItem['type'], message: string, data?: any) => {
  const time = new Date().toLocaleTimeString()
  logs.value.unshift({
    time,
    type,
    message,
    data: data ? JSON.stringify(data, null, 2) : undefined
  })
}

// 清空日志
const clearLogs = () => {
  logs.value = []
}

// 通用请求处理
const handleRequest = async (requestFn: () => Promise<any>, description: string) => {
  try {
    addLog('info', `开始测试: ${description}`)
    const response = await requestFn()
    addLog('success', `${description} - 成功`, response.data)
    ElMessage.success(`${description} 测试成功`)
  } catch (error: any) {
    addLog('error', `${description} - 失败`, error.response?.data || error.message)
    ElMessage.error(`${description} 测试失败: ${error.message}`)
  }
}

// 系统配置相关测试
const testGetConfig = () => {
  handleRequest(() => request.get('/agv/config'), '获取系统配置')
}

const testUpdateConfig = () => {
  const config = {
    host: '192.168.2.57',
    drivePort: 8080,
    analysisPort: 8081,
    cloudUrl: 'http://cloud.example.com'
  }
  handleRequest(() => request.put('/agv/config', config), '更新系统配置')
}

// 系统检查相关测试
const testCheckFs = () => {
  handleRequest(() => request.get('/system/check/fs'), '检查文件系统')
}

const testCheckDb = () => {
  handleRequest(() => request.get('/system/check/db'), '检查数据库')
}

const testCheckAgv = () => {
  handleRequest(() => request.get('/system/check/agv'), '检查AGV连接')
}

const testCheckCam = () => {
  handleRequest(() => request.get('/system/check/cam'), '检查摄像头连接')
}

// AGV控制相关测试
const testHeartbeat = () => {
  handleRequest(() => request.get('/agv/movement/heartbeat'), '查询AGV心跳状态')
}

const testAgvForward = () => {
  handleRequest(() => request.post('/agv/movement/forward'), 'AGV向前移动')
}

const testAgvStop = () => {
  handleRequest(() => request.post('/agv/movement/stop'), '停止AGV')
}

const testAgvBackward = () => {
  handleRequest(() => request.post('/agv/movement/backward'), 'AGV向后移动')
}

// 任务管理相关测试
const testListTask = () => {
  handleRequest(() => request.get('/agv/task/list?pageNum=1&pageSize=10'), '获取任务列表')
}

const testAddTask = () => {
  const task = {
    taskName: '测试任务',
    startPos: '起始位置A',
    taskTrip: '1000m',
    creator: '测试用户',
    executor: '执行用户',
    remark: '这是一个测试任务'
  }
  handleRequest(() => request.post('/agv/task', task), '新建任务')
}

const testGetTask = () => {
  handleRequest(() => request.get('/agv/task/1'), '获取任务详情')
}

// 故障缺陷相关测试
const testListFlaw = () => {
  handleRequest(() => request.get('/agv/flaw/list?pageNum=1&pageSize=10'), '获取缺陷列表')
}

const testAddFlaw = () => {
  const flaw = {
    taskId: 1,
    flawType: '裂缝',
    flawName: '测试缺陷',
    flawDesc: '这是一个测试缺陷',
    flawDistance: 100.5,
    level: '轻微'
  }
  handleRequest(() => request.post('/agv/flaw', flaw), '新增缺陷')
}

// 摄像头设备相关测试
const testDeviceList = () => {
  const requestFn = async () => {
    const headers = {
      'Authorization': 'Basic YWRtaW4xMjM6QWRtaW5AMTIz'
    }
    return axios.get('/easy-api/devices?page=1&size=999&status=&id&name', { headers })
  }
  handleRequest(requestFn, '获取摄像头设备列表')
}
</script>

<style scoped>
.api-test-container {
  padding: 20px;
  max-width: 1200px;
  margin: 0 auto;
}

.test-card {
  margin-bottom: 20px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.test-section {
  margin-bottom: 20px;
}

.test-section .el-button {
  margin-right: 10px;
  margin-bottom: 10px;
}

.log-section {
  margin-top: 30px;
}

.log-content {
  padding: 10px;
  background-color: #f5f5f5;
  border-radius: 4px;
}

.log-item {
  display: block;
  margin-bottom: 10px;
  padding: 8px;
  border-radius: 4px;
  font-family: 'Courier New', monospace;
  font-size: 12px;
}

.log-item.success {
  background-color: #f0f9ff;
  border-left: 4px solid #10b981;
}

.log-item.error {
  background-color: #fef2f2;
  border-left: 4px solid #ef4444;
}

.log-item.info {
  background-color: #f8fafc;
  border-left: 4px solid #6b7280;
}

.log-time {
  color: #6b7280;
  margin-right: 10px;
}

.log-message {
  font-weight: 500;
}

.log-data {
  margin-top: 5px;
  padding: 8px;
  background-color: #1f2937;
  color: #f9fafb;
  border-radius: 4px;
  font-size: 11px;
  overflow-x: auto;
}
</style>