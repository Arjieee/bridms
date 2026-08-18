import React from 'react'

export function Skeleton({ className = '', style = {} }) {
  return (
    <div
      className={`skeleton-box ${className}`}
      style={style}
    />
  )
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      {/* Header Skeleton */}
      <div className="flex justify-between items-center mb-5">
        <div className="space-y-2">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-9 w-32 rounded-xl" />
      </div>

      {/* 4 Stat Cards Grid Skeleton */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="card p-4 flex items-center gap-3">
            <Skeleton className="w-12 h-12 rounded-xl flex-shrink-0" />
            <div className="space-y-2 flex-1 min-w-0">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-6 w-16" />
            </div>
          </div>
        ))}
      </div>

      {/* Chart & Right Column Grid Skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="card p-5 lg:col-span-2 space-y-4">
          <div className="flex justify-between items-center">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-8 w-28 rounded-lg" />
          </div>
          <Skeleton className="h-[220px] w-full rounded-2xl" />
        </div>
        <div className="card p-5 space-y-4">
          <Skeleton className="h-5 w-36" />
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="w-9 h-9 rounded-full flex-shrink-0" />
                <div className="space-y-1.5 flex-1 min-w-0">
                  <Skeleton className="h-3.5 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export function TableSkeleton({ rows = 5 }) {
  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      {/* Top Header Skeleton */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
        <div className="space-y-2">
          <Skeleton className="h-6 w-44" />
          <Skeleton className="h-4 w-56" />
        </div>
        <Skeleton className="h-10 w-full sm:w-64 rounded-xl" />
      </div>

      {/* Filter Tabs Skeleton */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {[1, 2, 3, 4, 5].map(i => (
          <Skeleton key={i} className="h-9 w-20 rounded-xl flex-shrink-0" />
        ))}
      </div>

      {/* Main Table Card Skeleton */}
      <div className="card overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex justify-between items-center">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-8 w-24 rounded-lg" />
        </div>
        <div className="divide-y divide-slate-100">
          {Array.from({ length: rows }).map((_, i) => (
            <div key={i} className="p-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <Skeleton className="w-9 h-9 rounded-full flex-shrink-0" />
                <div className="space-y-1.5 flex-1 min-w-0">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </div>
              <Skeleton className="h-6 w-20 rounded-full" />
              <Skeleton className="h-8 w-16 rounded-lg flex-shrink-0" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export function GridSkeleton() {
  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      {/* Header Skeleton */}
      <div className="flex justify-between items-center mb-4">
        <div className="space-y-2">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-56" />
        </div>
        <Skeleton className="h-9 w-28 rounded-xl" />
      </div>

      {/* Grid Cards Skeleton */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[1, 2, 3, 4, 5, 6].map(i => (
          <div key={i} className="card p-4 flex flex-col items-center justify-center gap-3 min-h-[100px]">
            <Skeleton className="w-8 h-8 rounded-full" />
            <Skeleton className="h-3.5 w-16" />
          </div>
        ))}
      </div>

      <div className="card p-5 space-y-3">
        <Skeleton className="h-5 w-48" />
        <Skeleton className="h-16 w-full rounded-xl" />
      </div>
    </div>
  )
}

export function PageSkeleton({ route = '' }) {
  if (route.includes('/inventory') || route.includes('/beneficiaries') || route.includes('/suppliers') || route.includes('/reports')) {
    return <TableSkeleton rows={6} />
  }
  if (route.includes('/distribution') || route.includes('/qr')) {
    return <GridSkeleton />
  }
  return <DashboardSkeleton />
}
