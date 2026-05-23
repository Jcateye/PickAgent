/** Connector响应对象 */
export interface ConnectorResponseDto {
  /** 主键 */
  id: string;

  /** 连接器编码 */
  code: string;

  /** 连接器名称 */
  name: string;

  /** 连接器类型 */
  kind: string;

  /** 电商平台标识 */
  platform: string | null;

  /** 连接器配置 JSON */
  configJson: Record<string, unknown>;

  /** 连接器状态 */
  status: string;

  /** 创建时间 */
  createdAt: string;

  /** 更新时间 */
  updatedAt: string;
}
