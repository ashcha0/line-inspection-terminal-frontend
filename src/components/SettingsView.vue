<template>
  <el-dialog
    :model-value="modelValue"
    @update:modelValue="$emit('update:modelValue', $event)"
    title="系统设置"
    width="800px"
    @open="loadConfig"
  >
    <el-form v-if="config" :model="config" label-width="120px">
      <el-divider>AGV主机配置</el-divider>
      <el-row :gutter="20">
        <el-col :span="12">
          <el-form-item label="主机IP" required>
            <el-input v-model="config.host" placeholder="请输入AGV主机IP"></el-input>
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="驱动端口" required>
            <el-input-number v-model="config.drivePort" :min="1" :max="65535" placeholder="硬件驱动端口"></el-input-number>
          </el-form-item>
        </el-col>
      </el-row>
      <el-row :gutter="20">
        <el-col :span="12">
          <el-form-item label="分析程序端口">
            <el-input-number v-model="config.analysisPort" :min="1" :max="65535" placeholder="分析程序端口"></el-input-number>
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="云端地址">
            <el-input v-model="config.cloudUrl" placeholder="请输入云端服务器地址"></el-input>
          </el-form-item>
        </el-col>
      </el-row>

      <el-divider>摄像头配置</el-divider>
      <div v-for="i in 4" :key="i">
        <el-card style="margin-bottom: 15px;">
          <template #header>摄像头 {{ i }}</template>
          <el-row :gutter="20">
            <el-col :span="24">
              <el-form-item :label="`摄像头地址`">
                <el-input v-model="config[`cam${i}`]" :placeholder="`请输入摄像头${i}的地址`"></el-input>
              </el-form-item>
            </el-col>
          </el-row>
          <el-row :gutter="20">
            <el-col :span="12">
              <el-form-item :label="`登录用户名`">
                <el-input v-model="config[`username${i}`]" :placeholder="`摄像头${i}登录用户名`"></el-input>
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item :label="`登录密码`">
                <el-input v-model="config[`password${i}`]" type="password" show-password :placeholder="`摄像头${i}登录密码`"></el-input>
              </el-form-item>
            </el-col>
          </el-row>
        </el-card>
      </div>
    </el-form>
    <el-skeleton v-else :rows="5" animated />
    <template #footer>
      <el-button @click="$emit('update:modelValue', false)">取消</el-button>
      <el-button type="primary" @click="saveConfig" :loading="saving">保存配置</el-button>
      <el-button type="info" @click="resetToDefault">恢复默认</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { getConfig, updateConfig } from '@/api/system';
import { ElMessage, ElMessageBox } from 'element-plus';
import type { SystemConfig } from '@/types/models';

defineProps<{
  modelValue: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
  (e: 'saved'): void;
}>();

const config = ref<SystemConfig | null>(null);
const saving = ref(false);

const loadConfig = async () => {
  try {
    config.value = null; // reset for loading state
    const res = await getConfig();
    config.value = res.data;
  } catch (error) {
    ElMessage.error('加载配置失败');
    // 如果加载失败，提供默认配置
    config.value = getDefaultConfig();
  }
};

const getDefaultConfig = (): SystemConfig => {
  return {
    host: '192.168.2.57',
    drivePort: 8080,
    analysisPort: 8081,
    cloudUrl: '',
    cam1: '',
    cam2: '',
    cam3: '',
    cam4: '',
    username1: 'admin',
    username2: 'admin',
    username3: 'admin',
    username4: 'admin',
    password1: '',
    password2: '',
    password3: '',
    password4: '',
    deleteFlag: false
  };
};

const saveConfig = async () => {
  if (!config.value) return;
  
  // 验证必填字段
  if (!config.value.host.trim()) {
    ElMessage.warning('请输入AGV主机IP');
    return;
  }
  
  if (!config.value.drivePort || config.value.drivePort < 1) {
    ElMessage.warning('请输入有效的驱动端口');
    return;
  }
  
  try {
    saving.value = true;
    await updateConfig(config.value);
    ElMessage.success('配置已保存');
    emit('saved');
    emit('update:modelValue', false);
  } catch (error) {
    ElMessage.error('保存配置失败');
  } finally {
    saving.value = false;
  }
};

const resetToDefault = async () => {
  try {
    await ElMessageBox.confirm('确定要恢复为默认配置吗？这将清除所有自定义设置。', '确认操作', {
      type: 'warning'
    });
    
    config.value = getDefaultConfig();
    ElMessage.success('已恢复为默认配置');
  } catch {
    // 用户取消
  }
};
</script>

<style scoped>
:deep(.el-card__header) {
  padding: 10px 20px;
  background-color: #f5f7fa;
  font-weight: bold;
}

:deep(.el-input-number) {
  width: 100%;
}
</style>
