import axios from 'axios'
import type { ApiResponse } from '@/types/api'

// 摄像头设备接口
export interface CameraDevice {
  id: string
  name: string
  status: string
  ip?: string
  port?: number
  channel?: number
}

// 摄像头设备列表响应
export interface CameraDeviceListResponse {
  data: CameraDevice[]
  total: number
  page: number
  size: number
}

/**
 * 获取摄像头设备列表
 * 根据接口文档，需要添加Authorization头部
 */
export function getDeviceList(page = 1, size = 999): Promise<CameraDeviceListResponse> {
  return axios.get('/easy-api/devices', {
    params: {
      page,
      size,
      status: '',
      id: '',
      name: ''
    },
    headers: {
      'Authorization': 'Basic YWRtaW4xMjM6QWRtaW5AMTIz'
    },
    timeout: 15000
  }).then(response => {
    // 直接返回响应数据，因为这个接口可能不遵循标准的ApiResponse格式
    return response.data
  }).catch(error => {
    console.error('获取摄像头设备列表失败:', error)
    throw error
  })
}

/**
 * 检查摄像头连接状态
 * 用于系统自检
 */
export function checkCameraConnection(): Promise<ApiResponse> {
  return getDeviceList(1, 1).then(response => {
    // 如果能成功获取设备列表，说明摄像头服务正常
    return {
      code: 0,
      msg: '摄像头连接正常',
      data: response
    }
  }).catch(error => {
    console.error('摄像头连接检查失败:', error)
    return {
      code: -1,
      msg: `摄像头连接失败: ${error.message || '未知错误'}`,
      data: null
    }
  })
}
