export function LandingFooter() {
  return (
    <footer className="w-full bg-[#07090f] text-slate-400 border-t border-slate-800/80 py-16 px-6 sm:px-12 font-sans">
      <div className="mx-auto max-w-7xl">
        {/* Bottom Credits & Legal */}
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-4">
          <p>© {new Date().getFullYear()} Portfolio Platform. Crafted for developers &amp; creators.</p>
          <div className="flex items-center gap-6">
            <span className="hover:text-slate-400 transition-colors">Privacy Policy</span>
            <span className="hover:text-slate-400 transition-colors">Terms of Service</span>
            <span className="hover:text-slate-400 transition-colors">Security</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
