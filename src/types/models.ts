export interface Task {
  id?: number;
  taskCode: string;
  taskName: string;
  startPos?: string;
  taskTrip?: string;
  creator?: string;
  executor?: string;
  execTime?: string | null;
  endTime?: string | null;
  createTime?: string;
  taskStatus: '待巡视' | '巡视中' | '待上传' | '已完成';
  round?: number;
  uploaded?: boolean;
  remark?: string;
  cloudTaskId?: number;
  deleteFlag?: boolean;
  // ... 其他字段
}

export interface Flaw {
  id: number;
  taskId: number;
  round?: number;
  flawType?: string;
  flawName: string;
  flawDesc?: string;
  flawDistance?: number;
  flawImage?: string;
  flawImageUrl?: string;
  flawRtsp?: string;
  shown?: boolean;
  confirmed: boolean;
  uploaded?: boolean;
  createTime?: string;
  remark?: string;
  flawLength?: number;
  flawArea?: number;
  level: string;
  countNum?: number;
  deleteFlag?: boolean;
}

export interface SystemConfig {
  id?: number;
  host: string;
  drivePort: number;
  analysisPort?: number;
  cloudUrl?: string;
  cam1?: string;
  cam2?: string;
  cam3?: string;
  cam4?: string;
  username1?: string;
  username2?: string;
  username3?: string;
  username4?: string;
  password1?: string;
  password2?: string;
  password3?: string;
  password4?: string;
  deleteFlag?: boolean;
}

export interface AgvStatusVO {
  sysTime: string;
  isRunning: boolean;
  currentPosition: number;
}

export interface AgvUploadInfoVO {
  info: string;
  type: string;
  status: string;
}

export interface PageParam {
  pageNum?: number;
  pageSize?: number;
}
