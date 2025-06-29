import request from './request'
import type { ApiResponse } from '@/types/api'
import type { SystemConfig } from '@/types/models'
import { checkCameraConnection } from './camera'

export function checkFs(): Promise<ApiResponse> { return request({ url: '/system/check/fs', method: 'get' }) }
export function checkDb(): Promise<ApiResponse> { return request({ url: '/system/check/db', method: 'get' }) }
export function checkAgv(): Promise<ApiResponse> { return request({ url: '/system/check/agv', method: 'get' }) }
// 使用新的摄像头检查函数，直接调用摄像头服务API
export function checkCam(): Promise<ApiResponse> { return checkCameraConnection() }
export function getConfig(): Promise<ApiResponse<SystemConfig>> { return request({ url: '/agv/config', method: 'get' }) }
export function updateConfig(data: SystemConfig): Promise<ApiResponse<SystemConfig>> { return request({ url: '/agv/config', method: 'put', data }) }
