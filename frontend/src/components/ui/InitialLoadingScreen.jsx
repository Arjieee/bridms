import React from 'react'

export default function InitialLoadingScreen({ message = 'Loading Barangay Puerto Relief System...' }) {
  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-slate-900 text-white font-sans overflow-hidden select-none">
      {/* Background Ambient Glow */}
      <div className="absolute w-96 h-96 bg-blue-600/20 rounded-full blur-3xl pointer-events-none animate-pulse" />

      {/* Main Container */}
      <div className="relative flex flex-col items-center text-center px-4 max-w-sm">
        {/* Logo with pulsing ring */}
        <div className="relative mb-6">
          <div className="absolute -inset-2 rounded-full bg-gradient-to-tr from-blue-500 to-emerald-400 opacity-75 blur animate-spin" style={{ animationDuration: '4s' }} />
          <div className="relative w-20 h-20 bg-white rounded-full p-1 shadow-2xl flex items-center justify-center overflow-hidden">
            <img src="/logo.png" alt="Barangay Puerto Logo" className="w-full h-full object-cover rounded-full" />
          </div>
        </div>

        {/* System Title */}
        <h1 className="text-lg font-bold font-display text-white tracking-wide mb-1">
          Barangay Puerto
        </h1>
        <p className="text-xs text-slate-400 font-medium mb-6">
          Relief Management & Distribution System
        </p>

        {/* Modern Shimmer Progress Bar */}
        <div className="w-48 h-1.5 bg-slate-800 rounded-full overflow-hidden mb-4 relative">
          <div className="absolute inset-y-0 bg-gradient-to-r from-blue-500 via-indigo-400 to-emerald-400 rounded-full animate-pulse w-full" />
        </div>

        {/* Loading Message */}
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
          <i className="fas fa-circle-notch animate-spin text-blue-400" />
          <span>{message}</span>
        </div>
      </div>
    </div>
  )
}
