<template>
  <div>
    <el-alert
      v-if="networkError"
      title="网络连接错误"
      type="error"
      :closable="false"
      show-icon
      style="margin-bottom: 20px;"
    >
      <template #default>
        无法连接到车载服务器，请检查网络连接和服务器状态。
        <el-button type="primary" size="small" @click="getTasks" style="margin-left: 10px;">
          重试
        </el-button>
      </template>
    </el-alert>
    
    <el-card>
      <el-form :inline="true" :model="queryParams">
        <el-form-item label="任务编号">
          <el-input v-model="queryParams.taskCode" placeholder="请输入"></el-input>
        </el-form-item>
        <el-form-item label="任务状态">
          <el-select v-model="queryParams.taskStatus" placeholder="请选择" clearable>
            <el-option label="待巡视" value="待巡视"></el-option>
            <el-option label="巡视中" value="巡视中"></el-option>
            <el-option label="待上传" value="待上传"></el-option>
            <el-option label="已完成" value="已完成"></el-option>
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="getTasks">搜索</el-button>
          <el-button @click="resetQuery">重置</el-button>
        </el-form-item>
        <el-form-item style="float: right;">
            <el-button type="info" @click="testApiConnection" :loading="testingConnection">测试连接</el-button>
            <el-button type="success" @click="handleAddTask">📹 新增任务</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-table 
      :data="taskList" 
      v-loading="loading" 
      style="width: 100%; margin-top: 20px;"
      :empty-text="loading ? '加载中...' : '暂无任务数据'"
    >
      <el-table-column prop="taskCode" label="任务编号" />
      <el-table-column prop="taskName" label="任务名称" />
      <el-table-column prop="taskStatus" label="状态">
        <template #default="scope">
            <el-tag :type="statusTagType(scope.row.taskStatus)">{{ scope.row.taskStatus }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="creator" label="创建人" />
      <el-table-column prop="executor" label="执行人" />
      <el-table-column prop="createTime" label="创建时间" />
      <el-table-column label="操作" width="250">
        <template #default="scope">
          <el-button v-if="scope.row.taskStatus === '待巡视'" size="small" type="primary" @click="handleStartTask(scope.row)">启动</el-button>
          <el-button v-if="scope.row.taskStatus === '待巡视'" size="small" @click="handleEditTask(scope.row)">修改</el-button>
          <el-button v-if="scope.row.taskStatus === '待巡视'" size="small" type="danger" @click="handleDeleteTask(scope.row)">删除</el-button>
          <el-button v-if="['待上传', '已完成', '巡视中'].includes(scope.row.taskStatus)" size="small" type="info" @click="handleViewDetail(scope.row)">详情</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-dialog v-model="dialogVisible" :title="dialogTitle" width="500px">
        <el-form :model="taskForm" label-width="100px">
            <el-form-item label="任务名称"> <el-input v-model="taskForm.taskName" /> </el-form-item>
            <el-form-item label="任务编号"> <el-input v-model="taskForm.taskCode" /> </el-form-item>
            <el-form-item label="创建人"> <el-input v-model="taskForm.creator" /> </el-form-item>
            <el-form-item label="执行人"> <el-input v-model="taskForm.executor" /> </el-form-item>
            <el-form-item label="起始地点"> <el-input v-model="taskForm.startPos" /> </el-form-item>
            <el-form-item label="任务距离"> <el-input v-model="taskForm.taskTrip" /> </el-form-item>
        </el-form>
        <template #footer>
            <el-button @click="dialogVisible = false">取消</el-button>
            <el-button type="primary" @click="submitTaskForm">确定</el-button>
        </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, reactive } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import { listTasks, addTask, updateTask, deleteTask, startTask } from '@/api/task';
import type { Task } from '@/types/models';

const router = useRouter();
const loading = ref(false);
const testingConnection = ref(false);
const networkError = ref(false);
const taskList = ref<Task[]>([]);
const dialogVisible = ref(false);
const dialogTitle = ref('');
const taskForm = ref<Partial<Task>>({});

const queryParams = reactive({
    taskCode: '',
    taskStatus: '',
});

const statusTagType = (status: Task['taskStatus']) => {
    const map = { '待巡视': 'warning', '巡视中': 'primary', '待上传': 'info', '已完成': 'success' };
    return map[status] || '';
}

const getTasks = async () => {
  loading.value = true;
  networkError.value = false;
  try {
    const params = {
      ...queryParams,
      pageNum: 1,
      pageSize: 999 // 获取所有任务
    };
    console.log('发送任务列表请求，参数:', params);
    const res = await listTasks(params);
    taskList.value = res.data.rows || [];
    console.log('获取任务列表成功:', res.data);
    console.log('任务列表数据:', taskList.value);
  } catch (error) {
    console.error('获取任务列表失败:', error);
    networkError.value = true;
    ElMessage.error('获取任务列表失败，请检查网络连接');
  } finally {
    loading.value = false;
  }
};

const resetQuery = () => {
    queryParams.taskCode = '';
    queryParams.taskStatus = '';
    getTasks();
};

const handleAddTask = () => {
    taskForm.value = {};
    dialogTitle.value = '新增任务';
    dialogVisible.value = true;
};

const handleEditTask = (row: Task) => {
    taskForm.value = { ...row };
    dialogTitle.value = '修改任务';
    dialogVisible.value = true;
};

const submitTaskForm = async () => {
    const form = taskForm.value as Task;
    if (form.id) {
        await updateTask(form);
        ElMessage.success('修改成功');
    } else {
        await addTask(form);
        ElMessage.success('新增成功');
    }
    dialogVisible.value = false;
    getTasks();
};

const handleDeleteTask = (row: Task) => {
    ElMessageBox.confirm(`确定删除任务 "${row.taskName}" 吗?`, '提示', { type: 'warning' })
    .then(async () => {
        if(row.id) {
            await deleteTask(row.id);
            ElMessage.success('删除成功');
            getTasks();
        }
    });
};

const handleStartTask = async (row: Task) => {
    if(row.id) {
        await startTask(row.id);
        ElMessage.success('任务已启动');
        router.push(`/task/execute/${row.id}`);
    }
};

const handleViewDetail = (row: Task) => {
    if (row.taskStatus === '巡视中') {
        router.push(`/task/execute/${row.id}`);
    } else {
        router.push(`/task/detail/${row.id}`);
    }
};

const testApiConnection = async () => {
    testingConnection.value = true;
    try {
        console.log('开始测试API连接...');
        const params = {
            pageNum: 1,
            pageSize: 1
        };
        const res = await listTasks(params);
        console.log('API连接测试成功:', res);
        ElMessage.success('API连接正常');
    } catch (error) {
        console.error('API连接测试失败:', error);
        ElMessage.error('API连接失败，请检查网络和服务器状态');
    } finally {
        testingConnection.value = false;
    }
};

onMounted(() => {
  console.log('TaskView 组件已挂载，开始获取任务列表');
  getTasks();
});
</script>
