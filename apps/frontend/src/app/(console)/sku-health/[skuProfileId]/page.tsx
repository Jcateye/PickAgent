import { redirect } from 'next/navigation'

export default async function SkuHealthDetailRoute({
  params,
}: {
  params: Promise<{ skuProfileId: string }>
}) {
  const { skuProfileId } = await params

  redirect(`/sku-access?skuProfileId=${encodeURIComponent(skuProfileId)}&drawerTab=evidence`)
}
