/** 更新WorkspaceSetting请求 */
export interface UpdateWorkspaceSettingRequestDto {
  /** 设置命名空间 */
  namespace?: string;

  /** 设置键 */
  settingKey?: string;

  /** 设置值 JSON */
  settingJson?: Record<string, unknown>;

  /** 设置状态 */
  status?: string;

  /** 更新人 */
  updatedBy?: string | null;
}
