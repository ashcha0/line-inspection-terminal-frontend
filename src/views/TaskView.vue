<template>
  <div>
    <el-alert
      v-if="networkError"
      title="任务列表加载失败"
      type="error"
      :closable="false"
      show-icon
      style="margin-bottom: 20px;"
    >
      <template #default>
        {{ errorMessage || '无法获取任务列表，可能是服务器暂时不可用或网络连接问题。' }}
        <div style="margin-top: 10px;">
          <el-button type="primary" size="small" @click="getTasks" :loading="loading">
            重新加载
          </el-button>
          <el-button type="info" size="small" @click="clearQueryAndRetry">
            清空筛选条件重试
          </el-button>
        </div>
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
        <el-form-item label="创建人">
          <el-input v-model="queryParams.creator" placeholder="请输入"></el-input>
        </el-form-item>
        <el-form-item label="执行人">
          <el-input v-model="queryParams.executor" placeholder="请输入"></el-input>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="getTasks">搜索</el-button>
          <el-button @click="resetQuery">重置</el-button>
        </el-form-item>
        <el-form-item style="float: right;">
            <el-button type="info" @click="testApiConnection" :loading="testingConnection">测试连接</el-button>
            <el-button type="warning" @click="testQueryParams" :loading="testingQuery">测试查询</el-button>
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
import { ref, onMounted, reactive, onActivated } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import { listTasks, addTask, updateTask, deleteTask, startTask } from '@/api/task';
import type { Task } from '@/types/models';

const router = useRouter();
const loading = ref(false);
const testingConnection = ref(false);
const testingQuery = ref(false);
const networkError = ref(false);
const taskList = ref<Task[]>([]);
const dialogVisible = ref(false);
const dialogTitle = ref('');
const taskForm = ref<Partial<Task>>({});
const errorMessage = ref('');

const queryParams = reactive({
    taskCode: '',
    taskStatus: '',
    creator: '',
    executor: '',
});

const statusTagType = (status: Task['taskStatus']) => {
    const map = { '待巡视': 'warning', '巡视中': 'primary', '待上传': 'info', '已完成': 'success' };
    return map[status] || '';
}

const getTasks = async () => {
  loading.value = true;
  networkError.value = false;
  try {
    // 构建查询参数，过滤空值和无效值
    const params: any = {
      pageNum: 1,
      pageSize: 999 // 获取所有任务
    };
    
    // 只添加有效的查询条件，避免发送空值或"未设置"等无效值
    if (queryParams.taskCode && queryParams.taskCode.trim() && queryParams.taskCode.trim() !== '未设置') {
      params.taskCode = queryParams.taskCode.trim();
    }
    if (queryParams.taskStatus && queryParams.taskStatus.trim() && queryParams.taskStatus.trim() !== '未设置') {
      params.taskStatus = queryParams.taskStatus.trim();
    }
    if (queryParams.creator && queryParams.creator.trim() && queryParams.creator.trim() !== '未设置') {
      params.creator = queryParams.creator.trim();
    }
    if (queryParams.executor && queryParams.executor.trim() && queryParams.executor.trim() !== '未设置') {
      params.executor = queryParams.executor.trim();
    }
    
    console.log('=== 任务列表查询调试 ===');
    console.log('原始查询参数:', queryParams);
    console.log('发送到后端的参数:', params);
    console.log('参数数量:', Object.keys(params).length);
    
    const res = await listTasks(params);
    console.log('后端响应成功');
    console.log('响应数据结构:', {
      code: res.data?.code,
      msg: res.data?.msg,
      total: res.data?.total,
      rowsCount: res.data?.rows?.length || 0
    });
    
    let filteredTasks = res.data?.rows || [];
    
    // 如果后端不支持查询参数，在前端进行过滤
    const hasQueryConditions = params.taskCode || params.taskStatus || params.creator || params.executor;
    if (hasQueryConditions && filteredTasks.length > 0) {
      console.log('检测到查询条件，在前端进行过滤');
      
      const originalCount = filteredTasks.length;
      filteredTasks = filteredTasks.filter(task => {
        let match = true;
        
        if (params.taskCode && !task.taskCode?.includes(params.taskCode)) {
          match = false;
        }
        if (params.taskStatus && task.taskStatus !== params.taskStatus) {
          match = false;
        }
        if (params.creator && !task.creator?.includes(params.creator)) {
          match = false;
        }
        if (params.executor && !task.executor?.includes(params.executor)) {
          match = false;
        }
        
        return match;
      });
      
      console.log(`前端过滤结果: 从 ${originalCount} 条过滤到 ${filteredTasks.length} 条`);
    }
    
    taskList.value = filteredTasks;
    
    // 显示查询结果统计
    const filteredCount = taskList.value.length;
    const totalCount = res.data?.total || filteredTasks.length;
    console.log(`查询完成: 显示 ${filteredCount} 条任务，服务器总计 ${totalCount} 条`);
    
    if (hasQueryConditions) {
      if (filteredCount === 0) {
        ElMessage.warning('未找到匹配的任务');
      } else {
        ElMessage.success(`查询完成: 找到 ${filteredCount} 条匹配的任务`);
      }
    }
    
  } catch (error: any) {
    console.error('获取任务列表失败:', error);
    
    // 详细的错误分析
    if (error.response) {
      console.error('服务器响应错误:', {
        status: error.response.status,
        statusText: error.response.statusText,
        data: error.response.data
      });
      
      if (error.response.status === 500) {
        ElMessage.error('服务器内部错误，请稍后重试或联系管理员');
        // 服务器错误时，尝试用最简单的参数重新请求
        console.log('尝试使用基础参数重新请求...');
        try {
          const basicRes = await listTasks({ pageNum: 1, pageSize: 999 });
          taskList.value = basicRes.data?.rows || [];
          ElMessage.success('使用基础查询成功获取任务列表');
          return; // 成功后直接返回，不设置networkError
        } catch (retryError) {
          console.error('重试请求也失败:', retryError);
        }
      }
    } else if (error.request) {
      console.error('网络请求失败:', error.request);
      ElMessage.error('网络连接失败，请检查网络连接');
    } else {
      console.error('请求配置错误:', error.message);
      ElMessage.error('请求配置错误，请刷新页面重试');
    }
    
    networkError.value = true;
    errorMessage.value = error.message || '无法获取任务列表，可能是服务器暂时不可用或网络连接问题。';
  } finally {
    loading.value = false;
  }
};

const resetQuery = () => {
    queryParams.taskCode = '';
    queryParams.taskStatus = '';
    queryParams.creator = '';
    queryParams.executor = '';
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

const testQueryParams = async () => {
    testingQuery.value = true;
    try {
        console.log('=== 开始测试查询参数 ===');
        
        // 测试1: 基础查询（无过滤条件）
        console.log('测试1: 基础查询');
        const basicRes = await listTasks({ pageNum: 1, pageSize: 5 });
        console.log('基础查询结果:', basicRes);
        
        // 测试2: 按任务编号查询
        console.log('测试2: 按任务编号查询');
        const codeRes = await listTasks({ pageNum: 1, pageSize: 5, taskCode: 'TEST' });
        console.log('任务编号查询结果:', codeRes);
        
        // 测试3: 按状态查询
        console.log('测试3: 按状态查询');
        const statusRes = await listTasks({ pageNum: 1, pageSize: 5, taskStatus: '待巡视' });
        console.log('状态查询结果:', statusRes);
        
        // 测试4: 按创建人查询
        console.log('测试4: 按创建人查询');
        const creatorRes = await listTasks({ pageNum: 1, pageSize: 5, creator: 'admin' });
        console.log('创建人查询结果:', creatorRes);
        
        // 测试5: 按执行人查询
        console.log('测试5: 按执行人查询');
        const executorRes = await listTasks({ pageNum: 1, pageSize: 5, executor: 'operator' });
        console.log('执行人查询结果:', executorRes);
        
        // 测试6: 组合查询
        console.log('测试6: 组合查询');
        const combinedRes = await listTasks({ 
            pageNum: 1, 
            pageSize: 5, 
            taskCode: 'TEST',
            taskStatus: '待巡视',
            creator: 'admin',
            executor: 'operator'
        });
        console.log('组合查询结果:', combinedRes);
        
        ElMessage.success('查询参数测试完成，请查看控制台日志');
    } catch (error) {
        console.error('查询参数测试失败:', error);
        ElMessage.error('查询参数测试失败，请检查网络和服务器状态');
    } finally {
        testingQuery.value = false;
    }
};

const clearQueryAndRetry = () => {
    resetQuery();
    getTasks();
};

onMounted(() => {
  console.log('TaskView 组件已挂载，开始获取任务列表');
  getTasks();
});

onActivated(() => {
  console.log('TaskView 组件已激活，开始获取任务列表');
  getTasks();
});
</script>
