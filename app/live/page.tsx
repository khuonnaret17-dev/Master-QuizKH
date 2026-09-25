'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowLeft, Radio, Tv, Shield, Zap, Sparkles } from 'lucide-react';
import { LiveStudio } from '@/components/LiveStudio';
import { UserNav } from '@/components/UserNav';
import { useFirebase } from '@/lib/FirebaseProvider';

export default function LivePage() {
  const { userRole, loading, authLoading } = useFirebase();

  if (loading || authLoading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center font-sans">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-500 animate-[spin_1s_linear_infinite]"></div>
          <p className="text-sm font-khmer font-bold text-slate-300">កំពុងផ្ទៀងផ្ទាត់សិទ្ធិចូលប្រើប្រាស់...</p>
        </div>
      </div>
    );
  }

  if (userRole !== 'ADMIN') {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-4 font-sans">
        <div className="max-w-md w-full bg-slate-900 border-2 border-red-500/30 rounded-3xl p-8 text-center shadow-2xl relative overflow-hidden">
          {/* Animated red glow background */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />
          
          <div className="w-16 h-16 bg-red-500/10 border border-red-500/20 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
            <Shield className="w-8 h-8" />
          </div>

          <h2 className="text-xl md:text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-red-400 to-amber-400 mb-3 font-khmer">
            ការចូលប្រើប្រាស់ត្រូវបានបដិសេធ
          </h2>
          <p className="text-xs md:text-sm text-slate-400 font-khmer leading-relaxed mb-6 text-center">
            ទំព័រផ្សាយផ្ទាល់ (Live Studio) នេះត្រូវបានរក្សាទុកសម្រាប់តែអ្នកគ្រប់គ្រង (Administrator) តែប៉ុណ្ណោះ។ ប្រសិនបើអ្នកជាអ្នកគ្រប់គ្រង សូមប្រាកដថាអ្នកបានចូលគណនីជា Admin។
          </p>

          <div className="flex flex-col gap-2.5">
            <Link
              href="/"
              className="w-full py-2.5 px-6 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold text-xs transition-all cursor-pointer font-khmer border border-slate-700 text-center"
            >
              ត្រឡប់ទៅទំព័រដើម
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-sky-500 selection:text-white">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-40 bg-slate-950/80 backdrop-blur-xl border-b border-slate-900 px-4 md:px-8 py-3.5">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="flex items-center gap-2 p-2 rounded-2xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 transition-all font-khmer text-xs font-bold"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">ត្រឡប់ទៅទំព័រដើម</span>
            </Link>

            <div className="h-6 w-px bg-slate-800 hidden sm:block" />

            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-sky-500 to-blue-600 flex items-center justify-center text-white shadow-md shadow-sky-500/20">
                <Radio className="w-4 h-4 animate-pulse text-white" />
              </div>
              <div>
                <span className="text-sm font-black font-khmer text-white tracking-wide">
                  Vignasa Live Studio
                </span>
                <span className="text-[10px] text-sky-400 block font-mono -mt-0.5">
                  TELEGRAM BROADCAST
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/quiz"
              className="hidden md:flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 font-khmer text-xs font-bold transition-all"
            >
              <Tv className="w-3.5 h-3.5 text-[#D4AF37]" />
              <span>សាកល្បងវិញ្ញាសា</span>
            </Link>
            <UserNav />
          </div>
        </div>
      </header>

      {/* Main Broadcast Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-8 space-y-8">
        <LiveStudio />

        {/* Feature Highlights Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 pt-4">
          <div className="bg-slate-900/60 border border-slate-850 p-5 rounded-3xl flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-2xl bg-sky-500/10 border border-sky-500/20 text-sky-400 flex items-center justify-center shrink-0">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-white font-khmer mb-1">
                Zero-Latency RTMP Ingest
              </h4>
              <p className="text-xs text-slate-400 font-khmer leading-relaxed">
                បញ្ជូនទិន្នន័យវីដេអូកម្រិតច្បាស់ខ្ពស់ 1080p/720p ទៅកាន់ម៉ាស៊ីនបម្រើ Telegram ដោយផ្ទាល់គ្មានការរង់ចាំ។
              </p>
            </div>
          </div>

          <div className="bg-slate-900/60 border border-slate-850 p-5 rounded-3xl flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-2xl bg-[#D4AF37]/10 border border-[#D4AF37]/20 text-[#D4AF37] flex items-center justify-center shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-white font-khmer mb-1">
                ការបង្ហាញវិញ្ញាសាអន្តរកម្ម (Quiz Overlay)
              </h4>
              <p className="text-xs text-slate-400 font-khmer leading-relaxed">
                អាចជ្រើសរើសសំណួរពហុជ្រើសរើស (MCQ) ឬវិញ្ញាសាក្រសួងមកបង្ហាញលើកញ្ចក់វីដេអូផ្សាយផ្ទាល់ភ្លាមៗ។
              </p>
            </div>
          </div>

          <div className="bg-slate-900/60 border border-slate-850 p-5 rounded-3xl flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-white font-khmer mb-1">
                សុវត្ថិភាពខ្ពស់ & ឯកជនភាព
              </h4>
              <p className="text-xs text-slate-400 font-khmer leading-relaxed">
                Stream Key ត្រូវបានរក្សាទុកតែលើ Browser របស់អ្នក និងផ្ញើតាមបណ្តាញសុវត្ថិភាព RTMPS ទៅ Telegram។
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 py-6 text-center text-xs text-slate-500 font-khmer">
        <p>© 2026 Vignasa Hub • បន្ទប់ផ្សាយបន្តផ្ទាល់ត្រៀមប្រឡងក្របខណ្ឌរដ្ឋកម្ពុជា</p>
      </footer>
    </div>
  );
}
