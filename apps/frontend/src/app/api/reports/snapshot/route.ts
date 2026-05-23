import { finalReportSnapshotRequest, ok } from '../../_final-api-runtime'

export async function GET() {
  return ok(finalReportSnapshotRequest)
}
