<template>
  <div>
    <el-page-header @back="goBack" :content="`任务详情`" />
    <el-row :gutter="20" style="margin-top:20px;">
      <el-col :span="16">
        <el-card>
          <template #header>当前缺陷图片</template>
          <el-image 
            :src="getCurrentFlawImageUrl()" 
            fit="contain" 
            style="width: 100%; height: 500px; background: #f5f7fa; display:flex; justify-content:center; align-items:center;"
            :preview-src-list="getCurrentFlawImageUrl() ? [getCurrentFlawImageUrl()] : []"
          >
             <template #error> 
               <div class="image-slot">
                 <el-icon size="60"><Picture /></el-icon>
                 <div>图片加载失败或暂无图片</div>
               </div> 
             </template>
          </el-image>
          <!-- 显示缺陷视频流信息 -->
          <div v-if="currentFlaw.flawRtsp" style="margin-top: 10px;">
            <el-tag type="info">缺陷视频流: {{ currentFlaw.flawRtsp }}</el-tag>
          </div>
        </el-card>
      </el-col>
      <el-col :span="8">
        <el-card>
          <template #header>缺陷列表</template>
          <el-table :data="flawList" @row-click="handleFlawSelect" highlight-current-row height="500">
            <el-table-column prop="flawName" label="缺陷名称" />
            <el-table-column prop="level" label="等级" />
            <el-table-column prop="confirmed" label="状态">
              <template #default="scope"> {{ scope.row.confirmed ? '已确认' : '未确认' }} </template>
            </el-table-column>
            <el-table-column prop="uploaded" label="上传状态">
              <template #default="scope"> 
                <el-tag :type="scope.row.uploaded ? 'success' : 'warning'">
                  {{ scope.row.uploaded ? '已上传' : '未上传' }}
                </el-tag>
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-col>
    </el-row>
    <el-card style="margin-top:20px;">
      <template #header>缺陷详情与确认</template>
      <div v-if="currentFlaw.id">
        <el-descriptions :column="2" border>
          <el-descriptions-item label="缺陷名称">{{ currentFlaw.flawName }}</el-descriptions-item>
          <el-descriptions-item label="缺陷类型">{{ currentFlaw.flawType || '未设置' }}</el-descriptions-item>
          <el-descriptions-item label="巡视轮次">{{ currentFlaw.round || '未设置' }}</el-descriptions-item>
          <el-descriptions-item label="缺陷等级">{{ currentFlaw.level }}</el-descriptions-item>
          <el-descriptions-item label="巡检距离">{{ currentFlaw.flawDistance }}m</el-descriptions-item>
          <el-descriptions-item label="缺陷长度">{{ currentFlaw.flawLength || '未测量' }}{{ currentFlaw.flawLength ? 'm' : '' }}</el-descriptions-item>
          <el-descriptions-item label="缺陷面积">{{ currentFlaw.flawArea || '未测量' }}{{ currentFlaw.flawArea ? 'm²' : '' }}</el-descriptions-item>
          <el-descriptions-item label="缺陷数量">{{ currentFlaw.countNum || '未统计' }}</el-descriptions-item>
          <el-descriptions-item label="创建时间">{{ formatTime(currentFlaw.createTime) }}</el-descriptions-item>
          <el-descriptions-item label="上传状态">
            <el-tag :type="currentFlaw.uploaded ? 'success' : 'warning'">
              {{ currentFlaw.uploaded ? '已上传' : '未上传' }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="缺陷描述" :span="2">{{ currentFlaw.flawDesc || '无描述' }}</el-descriptions-item>
        </el-descriptions>
        <div style="margin-top: 20px;">
          <el-form-item label="是否确认属实">
            <el-radio-group v-model="currentFlaw.confirmed">
              <el-radio :value="true">属实</el-radio>
              <el-radio :value="false">误报/不确认</el-radio>
            </el-radio-group>
          </el-form-item>
          <el-form-item label="补充说明">
            <el-input v-model="currentFlaw.remark" type="textarea" placeholder="请输入补充说明..." />
          </el-form-item>
          <el-button type="primary" @click="saveFlawConfirmation">保存确认</el-button>
          <el-button v-if="currentFlaw.flawRtsp" type="info" @click="viewFlawVideo">查看缺陷视频</el-button>
        </div>
      </div>
      <el-empty v-else description="请从右侧列表选择一个缺陷" />
    </el-card>
    
    <!-- 任务操作区域 -->
    <el-card style="margin-top: 20px;">
      <template #header>任务操作</template>
      <div style="display: flex; gap: 10px; align-items: center;">
        <el-button v-if="taskInfo.taskStatus === '待上传'" type="success" @click="handleUpload">
          📤 上传任务数据
        </el-button>
        <el-button @click="goBack">返回任务列表</el-button>
        <span v-if="taskInfo.taskStatus === '待上传'" style="color: #909399; font-size: 14px;">
          提示：确认所有缺陷后，点击上传按钮将数据上传到云端
        </span>
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { Picture } from '@element-plus/icons-vue';
import { listFlaws, updateFlaw } from '@/api/flaw';
import { getTask } from '@/api/task';
import type { Flaw, Task } from '@/types/models';

const route = useRoute();
const router = useRouter();
const taskId = route.params.id as string;

const flawList = ref<Flaw[]>([]);
const currentFlaw = ref<Partial<Flaw>>({});
const taskInfo = ref<Partial<Task>>({});

const goBack = () => {
  // 直接跳转到任务列表，避免router.back()可能导致的状态问题
  router.push('/tasks');
};

// 获取当前缺陷的图片URL，优先使用flawImageUrl，其次是flawImage
const getCurrentFlawImageUrl = (): string => {
  if (currentFlaw.value.flawImageUrl) {
    return currentFlaw.value.flawImageUrl;
  }
  if (currentFlaw.value.flawImage) {
    // 如果是相对路径，需要拼接完整URL
    if (currentFlaw.value.flawImage.startsWith('http')) {
      return currentFlaw.value.flawImage;
    } else {
      return `http://192.168.2.57/prod-api${currentFlaw.value.flawImage}`;
    }
  }
  return '';
};

// 格式化时间显示
const formatTime = (timeStr?: string): string => {
  if (!timeStr) return '未设置';
  return new Date(timeStr).toLocaleString('zh-CN');
};

const loadTaskInfo = async () => {
  try {
    const res = await getTask(Number(taskId));
    taskInfo.value = res.data;
  } catch (error) {
    ElMessage.error('加载任务信息失败');
  }
};

const getFlaws = async () => {
  try {
    const res = await listFlaws(taskId);
    flawList.value = res.data.rows || [];
    if (flawList.value.length > 0) {
      currentFlaw.value = { ...flawList.value[0] };
    }
  } catch (error) {
    ElMessage.error('加载缺陷列表失败');
  }
};

const handleFlawSelect = (row: Flaw) => {
    currentFlaw.value = { ...row };
};

const saveFlawConfirmation = async () => {
    if (!currentFlaw.value.id) {
        ElMessage.warning('请先选择一个缺陷');
        return;
    }
    await updateFlaw(currentFlaw.value as Flaw);
    ElMessage.success('缺陷状态保存成功');
    const index = flawList.value.findIndex(f => f.id === currentFlaw.value.id);
    if (index !== -1) {
        flawList.value[index] = { ...currentFlaw.value } as Flaw;
    }
};

const viewFlawVideo = () => {
  if (currentFlaw.value.flawRtsp) {
    ElMessage.info(`缺陷视频流地址: ${currentFlaw.value.flawRtsp}`);
    // 这里可以集成视频播放器来播放缺陷视频
  }
};

const handleUpload = () => {
  router.push(`/task/upload/${taskId}`);
};

onMounted(async () => {
  await loadTaskInfo();
  await getFlaws();
});
</script>

<style scoped>
.image-slot {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  color: #c0c4cc;
  font-size: 14px;
}
</style>
