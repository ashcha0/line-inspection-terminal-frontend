<template>
  <div>
    <el-page-header @back="goBack" :content="`任务数据上传 - ${taskInfo.taskName}`" />
    
    <el-card style="margin-top: 20px;">
      <template #header>
        <div class="card-header">
          <span>上传进度</span>
          <el-button v-if="!isUploading" type="primary" @click="startUpload" :disabled="uploadItems.length === 0">
            开始上传
          </el-button>
        </div>
      </template>
      
      <div v-if="uploadItems.length === 0" class="empty-state">
        <el-empty description="暂无待上传数据" />
      </div>
      
      <div v-else>
        <el-table :data="uploadItems" v-loading="isUploading">
          <el-table-column prop="info" label="文件名称" />
          <el-table-column prop="type" label="数据类型" />
          <el-table-column prop="uploadStatus" label="状态">
            <template #default="scope">
              <el-tag v-if="scope.row.uploadStatus === '待上传'" type="warning">待上传</el-tag>
              <el-tag v-else-if="scope.row.uploadStatus === '上传中'" type="primary">上传中</el-tag>
              <el-tag v-else-if="scope.row.uploadStatus === '上传成功'" type="success">上传成功</el-tag>
              <el-tag v-else-if="scope.row.uploadStatus === '上传失败'" type="danger">上传失败</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="进度" width="200">
            <template #default="scope">
              <el-progress 
                v-if="scope.row.uploadStatus === '上传中'" 
                :percentage="scope.row.progress || 0" 
                :stroke-width="8"
              />
              <span v-else>{{ scope.row.uploadStatus }}</span>
            </template>
          </el-table-column>
        </el-table>
        
        <div class="upload-summary" style="margin-top: 20px; text-align: center;">
          <el-statistic 
            title="上传进度" 
            :value="uploadProgress" 
            suffix="%" 
            :precision="1"
          />
        </div>
      </div>
    </el-card>
    
    <el-card v-if="uploadCompleted" style="margin-top: 20px;">
      <template #header>上传完成</template>
      <div style="text-align: center;">
        <el-icon size="48" color="green"><CircleCheckFilled /></el-icon>
        <p style="margin-top: 10px; font-size: 16px;">所有数据上传完成！</p>
        <el-button type="primary" @click="goToTaskList">返回任务列表</el-button>
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { CircleCheckFilled } from '@element-plus/icons-vue'
import { getTask, preUploadTask, uploadTask } from '@/api/task'
import type { Task, AgvUploadInfoVO } from '@/types/models'

// 扩展AgvUploadInfoVO以支持上传进度显示
interface UploadItem extends AgvUploadInfoVO {
  uploadStatus?: '待上传' | '上传中' | '上传成功' | '上传失败'
  progress?: number
}

const route = useRoute()
const router = useRouter()
const taskId = route.params.id as string

const taskInfo = ref<Partial<Task>>({})
const uploadItems = ref<UploadItem[]>([])
const isUploading = ref(false)
const uploadCompleted = ref(false)

const uploadProgress = computed(() => {
  if (uploadItems.value.length === 0) return 0
  const completed = uploadItems.value.filter(item => item.uploadStatus === '上传成功').length
  return Math.round((completed / uploadItems.value.length) * 100)
})

const goBack = () => {
  router.back()
}

const goToTaskList = () => {
  router.push('/tasks')
}

const loadTaskInfo = async () => {
  try {
    const res = await getTask(Number(taskId))
    taskInfo.value = res.data
  } catch (error) {
    ElMessage.error('加载任务信息失败')
  }
}

const loadUploadItems = async () => {
  try {
    const res = await preUploadTask(Number(taskId))
    // 将AgvUploadInfoVO转换为UploadItem，添加上传状态字段
    uploadItems.value = (res.data || []).map(item => ({
      ...item,
      uploadStatus: '待上传' as const,
      progress: 0
    }))
  } catch (error) {
    ElMessage.error('加载上传数据失败')
    console.error('加载上传数据失败:', error)
  }
}

const startUpload = async () => {
  if (isUploading.value) return
  
  isUploading.value = true
  
  try {
    // 模拟上传过程
    for (let i = 0; i < uploadItems.value.length; i++) {
      const item = uploadItems.value[i]
      item.uploadStatus = '上传中'
      item.progress = 0
      
      // 模拟上传进度
      for (let progress = 0; progress <= 100; progress += 20) {
        item.progress = progress
        await new Promise(resolve => setTimeout(resolve, 200))
      }
      
      item.uploadStatus = '上传成功'
      item.progress = 100
    }
    
    // 调用实际上传API
    await uploadTask(Number(taskId))
    
    uploadCompleted.value = true
    ElMessage.success('数据上传完成')
  } catch (error) {
    ElMessage.error('上传失败，请重试')
    console.error('上传失败:', error)
    // 标记失败的项目
    uploadItems.value.forEach(item => {
      if (item.uploadStatus === '上传中') {
        item.uploadStatus = '上传失败'
      }
    })
  } finally {
    isUploading.value = false
  }
}

onMounted(async () => {
  await loadTaskInfo()
  await loadUploadItems()
})
</script>

<style scoped>
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.empty-state {
  padding: 40px 0;
}
</style> 