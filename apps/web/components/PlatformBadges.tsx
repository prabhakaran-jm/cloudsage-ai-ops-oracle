'use client';

/**
 * Platform badges component showing Raindrop and Vultr branding
 */
export default function PlatformBadges() {
  return (
    <div className="flex flex-wrap items-center justify-center gap-4 py-6 px-4 border-t border-white/10">
      <div className="flex items-center gap-2 text-white/60 text-sm">
        <span className="font-medium">Powered by</span>
      </div>
      
      {/* Raindrop Badge */}
      <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-purple-500/10 to-purple-600/10 border border-purple-500/30 hover:border-purple-500/50 transition-colors">
        <svg className="w-5 h-5 text-purple-400" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
        </svg>
        <span className="text-purple-300 font-semibold text-sm">Raindrop</span>
        <span className="text-purple-400/70 text-xs">SmartComponents</span>
      </div>
      
      {/* Vultr Badge */}
      <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-[#007BFC]/10 to-[#007BFC]/20 border border-[#007BFC]/30 hover:border-[#007BFC]/50 transition-colors">
        <svg className="w-5 h-5 text-[#007BFC]" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="#007BFC" strokeWidth="2" fill="none"/>
        </svg>
        <span className="text-[#007BFC] font-semibold text-sm">Vultr</span>
        <span className="text-[#007BFC]/70 text-xs">Cloud Compute</span>
      </div>
      
      <div className="text-white/40 text-xs">
        SmartBuckets • SmartSQL • SmartMemory • SmartInference
      </div>
    </div>
  );
}
