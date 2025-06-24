// 文件名: /src/api/flaw.ts
import request from './request'
import type { TableDataInfo, ApiResponse } from '@/types/api'
import type { Flaw } from '@/types/models.ts'

export function listFlaws(taskId: string): Promise<TableDataInfo<Flaw>> { 
  return request({ url: '/agv/flaw/list', method: 'get', params: { taskId } }) 
}

export function getFlaw(id: number): Promise<ApiResponse<Flaw>> {
  return request({ url: `/agv/flaw/${id}`, method: 'get' })
}

export function addFlaw(data: Partial<Flaw>): Promise<ApiResponse<Flaw>> {
  return request({ url: '/agv/flaw', method: 'post', data })
}

export function updateFlaw(data: Flaw): Promise<ApiResponse<Flaw>> { 
  return request({ url: '/agv/flaw', method: 'put', data }) 
}

export function deleteFlaw(id: number): Promise<ApiResponse> {
  return request({ url: `/agv/flaw/${id}`, method: 'delete' })
}

export function getLiveInfo(taskId: string): Promise<ApiResponse<Flaw[]>> { 
  return request({ url: `/agv/flaw/live/${taskId}`, method: 'get' }) 
}

export function checkAllConfirmed(taskId: number): Promise<ApiResponse<boolean>> {
  return request({ url: `/agv/flaw/check/${taskId}`, method: 'get' })
}
