import { lazy, Suspense } from 'react'

const HerbalApp = lazy(() => import('../HerbalApp.jsx'))

export default function LazyHerbalApp() {
  return (
    <Suspense fallback={<div className="herbal-loading">Opening the herbal almanac...</div>}>
      <HerbalApp />
    </Suspense>
  )
}
