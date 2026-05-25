import { redirect } from 'next/navigation'

export default async function DashboardRoute() {
  redirect('/overview')
}
