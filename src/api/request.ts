import axios, { type AxiosInstance, type AxiosResponse, type AxiosError } from 'axios'
import { ElMessage } from 'element-plus'
import type { ApiResponse } from '@/types/api'

const service: AxiosInstance = axios.create({
  // 根据接口文档配置，使用代理转发到车载服务器
  baseURL: '/prod-api',
  timeout: 30000, // 增加超时时间，适应车载网络环境
  // 添加默认请求头
  headers: {
    'Content-Type': 'application/json'
  }
})

// 响应拦截器
service.interceptors.response.use(
  /**
   * 成功的响应处理
   * response 的类型是 AxiosResponse，其 data 属性是我们自定义的 ApiResponse
   */
  (response: AxiosResponse<ApiResponse>) => {
    const res = response.data

    // 如果自定义状态码不为0，则判断为错误
    if (res.code !== 200) {
      ElMessage({
        message: res.msg || 'Error',
        type: 'error',
        duration: 5 * 1000
      })
      return Promise.reject(new Error(res.msg || 'Error'))
    } else {
      // 成功则直接返回完整的响应对象，保持类型一致性
      return response
    }
  },
  /**
   * 失败的响应处理
   * @param error 错误对象，类型为 AxiosError
   */
  (error: AxiosError) => {
    console.error('Request Error: ' + error.message) // 用于调试

    let errorMessage = '请求失败'

    if (error.code === 'ECONNABORTED') {
      errorMessage = '请求超时，请检查网络连接'
    } else if (error.code === 'ERR_NETWORK') {
      errorMessage = '网络连接失败，请检查网络设置'
    } else if (error.response) {
      // 服务器响应了错误状态码
      const status = error.response.status
      if (status === 404) {
        errorMessage = '请求的资源不存在'
      } else if (status === 500) {
        errorMessage = '服务器内部错误'
      } else if (status === 502) {
        errorMessage = '网关错误，请检查服务器连接'
      } else if (status === 503) {
        errorMessage = '服务不可用'
      } else {
        errorMessage = `请求失败 (${status})`
      }
    } else if (error.request) {
      // 请求已发出但没有收到响应
      errorMessage = '无法连接到服务器，请检查网络连接'
    }

    ElMessage({
      message: errorMessage,
      type: 'error',
      duration: 5 * 1000
    })
    return Promise.reject(error)
  }
)

export default service
