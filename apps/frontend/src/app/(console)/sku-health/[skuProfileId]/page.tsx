import { SkuHealthPage } from '@/modules/sku/sku-health-page'

export default async function SkuHealthDetailRoute({
  params,
}: {
  params: Promise<{ skuProfileId: string }>
}) {
  const { skuProfileId } = await params

  return <SkuHealthPage skuProfileId={skuProfileId} />
}
