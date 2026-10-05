'use client';

import { useState, useEffect, useMemo } from "react";
import { useFirebase } from "@/lib/FirebaseProvider";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer, 
  LineChart, 
  Line,
  AreaChart,
  Area
} from "recharts";
import { 
  GraduationCap, 
  ArrowLeft, 
  Award, 
  CheckCircle, 
  TrendingUp, 
  BookOpen, 
  Calendar, 
  Clock, 
  HelpCircle,
  Trophy,
  ChevronRight,
  User,
  LayoutDashboard,
  Search,
  X,
  History,
  AlertCircle
} from "lucide-react";
import Link from "next/link";
import { motion } from "motion/react";
import SafeImage from "@/components/SafeImage";
import { QuizPerformanceChart } from "@/components/QuizPerformanceChart";

export default function Dashboard() {
  const { ministries, user, userProgress, authLoading, loading } = useFirebase();
  const [isMounted, setIsMounted] = useState(false);
  const [activeChart, setActiveChart] = useState<'COMBINED' | 'COMPLETION' | 'SCORES'>('COMBINED');
  const [searchTerm, setSearchTerm] = useState("");
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    try {
      const saved = localStorage.getItem('cambodia_dashboard_recent_searches');
      if (saved) {
        setRecentSearches(JSON.parse(saved));
      }
    } catch {
      // ignore
    }
  }, []);

  const addRecentSearch = (term: string) => {
    if (!term.trim()) return;
    const cleaned = term.trim();
    const updated = [cleaned, ...recentSearches.filter(s => s !== cleaned)].slice(0, 6);
    setRecentSearches(updated);
    try {
      localStorage.setItem('cambodia_dashboard_recent_searches', JSON.stringify(updated));
    } catch {
      // ignore
    }
  };

  const removeRecentSearch = (e: React.MouseEvent, term: string) => {
    e.stopPropagation();
    const updated = recentSearches.filter(s => s !== term);
    setRecentSearches(updated);
    try {
      localStorage.setItem('cambodia_dashboard_recent_searches', JSON.stringify(updated));
    } catch {
      // ignore
    }
  };

  const clearRecentSearches = () => {
    setRecentSearches([]);
    try {
      localStorage.removeItem('cambodia_dashboard_recent_searches');
    } catch {
      // ignore
    }
  };

  // Compute stats for each ministry
  const dashboardData = useMemo(() => {
    if (!ministries || ministries.length === 0) return [];

    return ministries.map(m => {
      let completedCount = 0;
      let totalCount = 0;
      let totalScore = 0;
      let gradedCategoryCount = 0;

      // MCQ Categories
      const mcqCats = m.mcqs?.map(cat => cat.category) || [];
      mcqCats.forEach(cat => {
        totalCount++;
        const key = `${m.id}_MCQ_${cat.replace(/\s+/g, '_')}`;
        const progressEntry = userProgress[key];
        if (progressEntry) {
          completedCount++;
          if (typeof progressEntry.score === 'number') {
            totalScore += progressEntry.score;
            gradedCategoryCount++;
          }
        }
      });

      // QA Categories
      const qaCats = m.shortAnswers?.map(cat => cat.category) || [];
      qaCats.forEach(cat => {
        totalCount++;
        const key = `${m.id}_QA_${cat.replace(/\s+/g, '_')}`;
        const progressEntry = userProgress[key];
        if (progressEntry) {
          completedCount++;
          if (typeof progressEntry.score === 'number') {
            totalScore += progressEntry.score;
            gradedCategoryCount++;
          }
        }
      });

      // Fallback if no mcqs/shortAnswers categories exist
      if (totalCount === 0) {
        totalCount = m.quizzes?.length || 0;
        const generalProgress = userProgress[m.id];
        if (generalProgress && typeof generalProgress.completedCount === 'number') {
          completedCount = generalProgress.completedCount;
          if (typeof generalProgress.score === 'number') {
            totalScore = generalProgress.score;
            gradedCategoryCount = 1;
          }
        }
      }

      const completionRate = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
      const avgScore = gradedCategoryCount > 0 ? Math.round(totalScore / gradedCategoryCount) : 0;

      return {
        id: m.id,
        name: m.khmerName || m.name,
        shortName: (m.khmerName || m.name).replace("ក្រសួង", "ក្រ.").substring(0, 15),
        logo: m.logo,
        totalQuizzes: totalCount,
        completedQuizzes: completedCount,
        completionRate,
        avgScore,
        color: m.color || '#094C72'
      };
    });
  }, [ministries, userProgress]);

  // Overall Statistics
  const overallStats = useMemo(() => {
    if (dashboardData.length === 0) return { totalCompleted: 0, overallAvgScore: 0, overallCompletion: 0, activeMinistriesCount: 0 };

    let totalQuizzesSum = 0;
    let totalCompletedSum = 0;
    let totalScoreSum = 0;
    let ministriesWithScores = 0;
    let activeCount = 0;

    dashboardData.forEach(m => {
      totalQuizzesSum += m.totalQuizzes;
      totalCompletedSum += m.completedQuizzes;
      if (m.completedQuizzes > 0) {
        activeCount++;
      }
      if (m.avgScore > 0) {
        totalScoreSum += m.avgScore;
        ministriesWithScores++;
      }
    });

    const overallAvgScore = ministriesWithScores > 0 ? Math.round(totalScoreSum / ministriesWithScores) : 0;
    const overallCompletion = totalQuizzesSum > 0 ? Math.round((totalCompletedSum / totalQuizzesSum) * 100) : 0;

    return {
      totalCompleted: totalCompletedSum,
      overallAvgScore,
      overallCompletion,
      activeMinistriesCount: activeCount
    };
  }, [dashboardData]);

  // Filtered Dashboard Data for table view
  const filteredDashboardData = useMemo(() => {
    if (!searchTerm.trim()) return dashboardData;
    const term = searchTerm.toLowerCase().trim();
    return dashboardData.filter(m => 
      m.name.toLowerCase().includes(term) || 
      m.shortName.toLowerCase().includes(term) ||
      m.id.toLowerCase().includes(term)
    );
  }, [dashboardData, searchTerm]);

  // Extract recent activities from userProgress
  const recentActivities = useMemo(() => {
    const list: Array<{
      key: string;
      ministryId: string;
      ministryName: string;
      category: string;
      type: string;
      score: number;
      completedAt: string;
    }> = [];

    Object.entries(userProgress).forEach(([key, val]) => {
      if (key.includes('_MCQ_') || key.includes('_QA_')) {
        const minId = val.ministryId || key.split('_')[0];
        const ministry = ministries.find(m => m.id === minId);
        
        list.push({
          key,
          ministryId: minId,
          ministryName: ministry?.khmerName || ministry?.name || minId,
          category: val.category || "វិញ្ញាសា",
          type: val.type === 'MCQ' ? 'ពហុជ្រើសរើស' : 'សំណួរ-ចម្លើយ',
          score: val.score,
          completedAt: val.completedAt || new Date().toISOString()
        });
      }
    });

    return list
      .sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime())
      .slice(0, 5);
  }, [userProgress, ministries]);

  // Loading Screens
  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC]">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-500"></div>
          <p className="text-sm font-khmer text-slate-500 font-bold">កំពុងផ្ទុកផ្ទាំងគ្រប់គ្រងវឌ្ឍនភាព...</p>
        </div>
      </div>
    );
  }

  // Not logged in state
  if (!user) {
    return (
      <main className="min-h-screen bg-slate-50 py-16 px-4">
        <div className="max-w-md mx-auto bg-white rounded-3xl p-8 border border-slate-200 shadow-xl text-center">
          <div className="w-16 h-16 bg-blue-50 text-[#094C72] rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm">
            <LayoutDashboard className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-bold font-khmer text-slate-800 mb-3">សូមចូលគណនីរបស់អ្នក</h2>
          <p className="text-slate-500 font-khmer text-sm mb-8 leading-relaxed">
            ដើម្បីមើលវឌ្ឍនភាពសិក្សា ការបំពេញកម្រងសំណួរ និងពិន្ទុមធ្យមភាគរបស់គណនីអ្នក សូមចូលប្រើប្រាស់ជាមុនសិន។
          </p>
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 w-full py-3 bg-[#094C72] hover:bg-[#073652] text-white rounded-2xl font-bold font-khmer text-sm shadow-md transition-all cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>ត្រឡប់ទៅទំព័រដើម</span>
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#F8FAFC] pt-6 sm:pt-8 md:pt-12 pb-12 sm:pb-16 px-3.5 sm:px-6 md:px-8 lg:px-12">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Navigation & Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-200 pb-6">
          <div className="flex items-center gap-4">
            <Link 
              href="/"
              className="p-3 bg-white hover:bg-slate-50 border border-slate-200 text-slate-600 rounded-2xl transition-all shadow-sm hover:shadow-md cursor-pointer"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <div className="flex items-center gap-2 text-[#094C72]">
                <LayoutDashboard className="w-5 h-5" />
                <span className="text-xs uppercase font-extrabold tracking-wider font-sans">User Learning Dashboard</span>
              </div>
              <h1 className="text-2xl md:text-3xl font-black text-slate-900 font-khmer mt-1">ផ្ទាំងគ្រប់គ្រងវឌ្ឍនភាពសិក្សា</h1>
            </div>
          </div>
          <div className="flex items-center gap-3 bg-white px-4 py-2 border border-slate-200 rounded-2xl shadow-xs">
            <div className="w-8 h-8 bg-[#094C72]/10 rounded-full flex items-center justify-center text-[#094C72]">
              <User className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-800 leading-none">{user.displayName || user.email}</p>
              <p className="text-[9px] font-semibold text-slate-400 mt-1 uppercase">សិក្ខាកាមត្រៀមប្រឡង</p>
            </div>
          </div>
        </div>

        {/* Overall Progress Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
          
          {/* Card 1: Overall Completion Rate */}
          <motion.div 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white p-6 rounded-3xl border border-slate-100 shadow-xs flex items-center gap-5 relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 -mt-4 -mr-4 w-20 h-20 bg-blue-50 rounded-full blur-xl pointer-events-none" />
            <div className="p-4 bg-blue-50 text-blue-600 rounded-2xl shadow-inner">
              <TrendingUp className="w-6 h-6" />
            </div>
            <div>
              <span className="text-[10px] font-extrabold text-slate-400 tracking-wider font-khmer block">អត្រាបញ្ចប់ការសិក្សារួម</span>
              <span className="text-3xl font-black text-slate-800 font-sans block mt-1">{overallStats.overallCompletion}%</span>
              <div className="h-1.5 w-24 bg-slate-100 rounded-full overflow-hidden mt-2">
                <div style={{ width: `${overallStats.overallCompletion}%` }} className="h-full bg-blue-600 rounded-full" />
              </div>
            </div>
          </motion.div>

          {/* Card 2: Average Score */}
          <motion.div 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="bg-white p-6 rounded-3xl border border-slate-100 shadow-xs flex items-center gap-5 relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 -mt-4 -mr-4 w-20 h-20 bg-amber-50 rounded-full blur-xl pointer-events-none" />
            <div className="p-4 bg-amber-50 text-amber-600 rounded-2xl shadow-inner">
              <Trophy className="w-6 h-6" />
            </div>
            <div>
              <span className="text-[10px] font-extrabold text-slate-400 tracking-wider font-khmer block">ពិន្ទុមធ្យមភាគរួម</span>
              <span className="text-3xl font-black text-slate-800 font-sans block mt-1">{overallStats.overallAvgScore}%</span>
              <div className="h-1.5 w-24 bg-slate-100 rounded-full overflow-hidden mt-2">
                <div style={{ width: `${overallStats.overallAvgScore}%` }} className="h-full bg-amber-500 rounded-full" />
              </div>
            </div>
          </motion.div>

          {/* Card 3: Total Completed Quizzes */}
          <motion.div 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white p-6 rounded-3xl border border-slate-100 shadow-xs flex items-center gap-5 relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 -mt-4 -mr-4 w-20 h-20 bg-emerald-50 rounded-full blur-xl pointer-events-none" />
            <div className="p-4 bg-emerald-50 text-emerald-600 rounded-2xl shadow-inner">
              <CheckCircle className="w-6 h-6" />
            </div>
            <div>
              <span className="text-[10px] font-extrabold text-slate-400 tracking-wider font-khmer block">វិញ្ញាសាដែលបានបញ្ចប់</span>
              <span className="text-3xl font-black text-slate-800 font-sans block mt-1">{overallStats.totalCompleted} <span className="text-xs text-slate-400 font-khmer font-bold">វិញ្ញាសា</span></span>
              <p className="text-[10px] text-slate-400 font-khmer mt-1">ពីគ្រប់ស្ថាប័នរដ្ឋទាំងអស់</p>
            </div>
          </motion.div>

          {/* Card 4: Active Ministries */}
          <motion.div 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="bg-white p-6 rounded-3xl border border-slate-100 shadow-xs flex items-center gap-5 relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 -mt-4 -mr-4 w-20 h-20 bg-teal-50 rounded-full blur-xl pointer-events-none" />
            <div className="p-4 bg-teal-50 text-teal-600 rounded-2xl shadow-inner">
              <BookOpen className="w-6 h-6" />
            </div>
            <div>
              <span className="text-[10px] font-extrabold text-slate-400 tracking-wider font-khmer block">ស្ថាប័នកំពុងសិក្សា</span>
              <span className="text-3xl font-black text-slate-800 font-sans block mt-1">{overallStats.activeMinistriesCount} / {dashboardData.length}</span>
              <p className="text-[10px] text-slate-400 font-khmer mt-1">ក្រសួងនិងវិញ្ញាសាឯកទេស</p>
            </div>
          </motion.div>

        </div>

        {/* User Quiz Performance Trends Over Time (Recharts Line Chart) */}
        <QuizPerformanceChart userProgress={userProgress} ministries={ministries} />

        {/* Visual Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Recharts Chart Card */}
          <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-200 p-4 md:p-6 shadow-sm flex flex-col justify-between">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
              <div>
                <h3 className="text-lg font-bold text-slate-900 font-khmer">ក្រាហ្វិកស្ថិតិ និងវឌ្ឍនភាពសិក្សា</h3>
                <p className="text-xs text-slate-400 font-khmer">ការប្រៀបធៀបអត្រាបញ្ចប់ការសិក្សា និងពិន្ទុមធ្យមភាគតាមក្រសួង-ស្ថាប័ន</p>
              </div>
              
              {/* Tab selector */}
              <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200/50">
                <button
                  onClick={() => setActiveChart('COMBINED')}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all font-khmer cursor-pointer ${
                    activeChart === 'COMBINED'
                      ? 'bg-white text-[#094C72] shadow-xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  សរុបរួម
                </button>
                <button
                  onClick={() => setActiveChart('COMPLETION')}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all font-khmer cursor-pointer ${
                    activeChart === 'COMPLETION'
                      ? 'bg-white text-blue-600 shadow-xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  អត្រាបញ្ចប់
                </button>
                <button
                  onClick={() => setActiveChart('SCORES')}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all font-khmer cursor-pointer ${
                    activeChart === 'SCORES'
                      ? 'bg-white text-amber-600 shadow-xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  ពិន្ទុភាគរយ
                </button>
              </div>
            </div>

            {/* Chart Wrapper with Mounting guard */}
            <div className="h-80 w-full min-h-[300px]">
              {!isMounted ? (
                <div className="h-full bg-slate-50 animate-pulse rounded-2xl flex items-center justify-center text-xs font-khmer text-slate-400">
                  កំពុងរៀបចំក្រាហ្វិក...
                </div>
              ) : dashboardData.filter(d => d.totalQuizzes > 0).length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-6 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
                  <HelpCircle className="w-10 h-10 text-slate-300 mb-2" />
                  <p className="text-sm font-khmer text-slate-500">មិនទាន់មានទិន្នន័យដើម្បីបង្ហាញក្រាហ្វិកទេ</p>
                  <p className="text-xs font-khmer text-slate-400 mt-1">សូមសាកល្បងចូលធ្វើតេស្តវិញ្ញាសាមួយចំនួនសិន!</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  {activeChart === 'COMBINED' ? (
                    <BarChart
                      data={dashboardData.filter(d => d.totalQuizzes > 0)}
                      margin={{ top: 10, right: 10, left: -15, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                      <XAxis dataKey="shortName" tick={{ fontSize: 10, fill: '#64748B' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 10, fill: '#64748B' }} axisLine={false} tickLine={false} domain={[0, 100]} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#ffffff', borderRadius: '16px', border: '1px solid #E2E8F0', boxShadow: '0 4px 12px rgba(0,0,0,0.05)', fontSize: '11px', fontFamily: 'sans-serif' }}
                        formatter={(value, name) => [
                          `${value}%`,
                          name === 'completionRate' ? 'អត្រាបញ្ចប់' : 'ពិន្ទុមធ្យម'
                        ]}
                      />
                      <Legend verticalAlign="top" height={36} iconSize={10} wrapperStyle={{ fontSize: '11px', fontFamily: 'sans-serif' }} />
                      <Bar dataKey="completionRate" fill="#3B82F6" name="completionRate" radius={[4, 4, 0, 0]} barSize={20} />
                      <Bar dataKey="avgScore" fill="#F59E0B" name="avgScore" radius={[4, 4, 0, 0]} barSize={20} />
                    </BarChart>
                  ) : activeChart === 'COMPLETION' ? (
                    <AreaChart
                      data={dashboardData.filter(d => d.totalQuizzes > 0)}
                      margin={{ top: 10, right: 10, left: -15, bottom: 0 }}
                    >
                      <defs>
                        <linearGradient id="colorCompletion" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#3B82F6" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                      <XAxis dataKey="shortName" tick={{ fontSize: 10, fill: '#64748B' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 10, fill: '#64748B' }} axisLine={false} tickLine={false} domain={[0, 100]} />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#ffffff', borderRadius: '16px', border: '1px solid #E2E8F0', fontSize: '11px' }}
                        formatter={(value) => [`${value}%`, 'អត្រាបញ្ចប់ការសិក្សា']}
                      />
                      <Area type="monotone" dataKey="completionRate" stroke="#3B82F6" strokeWidth={3} fillOpacity={1} fill="url(#colorCompletion)" />
                    </AreaChart>
                  ) : (
                    <LineChart
                      data={dashboardData.filter(d => d.totalQuizzes > 0)}
                      margin={{ top: 10, right: 10, left: -15, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                      <XAxis dataKey="shortName" tick={{ fontSize: 10, fill: '#64748B' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 10, fill: '#64748B' }} axisLine={false} tickLine={false} domain={[0, 100]} />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#ffffff', borderRadius: '16px', border: '1px solid #E2E8F0', fontSize: '11px' }}
                        formatter={(value) => [`${value}%`, 'ពិន្ទុមធ្យមភាគ']}
                      />
                      <Line type="monotone" dataKey="avgScore" stroke="#F59E0B" strokeWidth={4} activeDot={{ r: 8 }} dot={{ r: 4, strokeWidth: 2 }} />
                    </LineChart>
                  )}
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Recent Activity Card */}
          <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="p-2 bg-purple-50 text-purple-600 rounded-xl">
                  <Calendar className="w-4 h-4" />
                </div>
                <h3 className="text-base font-bold text-slate-900 font-khmer">សកម្មភាពថ្មីៗ</h3>
              </div>
              
              <div className="space-y-4">
                {recentActivities.length === 0 ? (
                  <div className="py-12 text-center text-slate-400">
                    <Clock className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                    <p className="text-xs font-khmer">មិនទាន់មានសកម្មភាពថ្មីៗនៅឡើយទេ</p>
                  </div>
                ) : (
                  recentActivities.map((act) => (
                    <div key={act.key} className="flex gap-3 items-start pb-4 border-b border-slate-100 last:border-0 last:pb-0">
                      <div className="w-8 h-8 bg-[#094C72]/5 text-[#094C72] rounded-full flex items-center justify-center font-bold text-xs shrink-0 font-sans mt-0.5">
                        {act.score}%
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-slate-800 font-khmer truncate">{act.category}</p>
                        <p className="text-[10px] text-slate-400 font-khmer mt-0.5 truncate">{act.ministryName} • {act.type}</p>
                        <p className="text-[9px] text-slate-300 mt-1">
                          {new Date(act.completedAt).toLocaleDateString('kh-KH', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {recentActivities.length > 0 && (
              <div className="mt-4 pt-4 border-t border-slate-150">
                <div className="flex items-center justify-between text-xs text-[#094C72] font-semibold hover:underline cursor-pointer">
                  <span className="font-khmer">ពិនិត្យមើលលទ្ធផលលម្អិតទាំងអស់</span>
                  <ChevronRight className="w-4 h-4" />
                </div>
              </div>
            )}
          </div>

        </div>

        {/* Detailed Ministry Progress List */}
        <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                <Award className="w-4 h-4" />
              </div>
              <h3 className="text-base font-bold text-slate-900 font-khmer">វឌ្ឍនភាពសិក្សាលម្អិតតាមក្រសួងស្ថាប័ន</h3>
            </div>
            
            {/* Search Box */}
            <div className="w-full md:w-80 shrink-0">
              <div className="relative flex items-center">
                <Search className="absolute left-3.5 text-slate-400 w-4 h-4 pointer-events-none" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && searchTerm.trim()) {
                      addRecentSearch(searchTerm);
                    }
                  }}
                  placeholder="ស្វែងរកក្រសួង ស្ថាប័ន..."
                  className="w-full pl-9 pr-9 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 shadow-3xs focus:outline-none focus:ring-2 focus:ring-[#094C72] focus:border-transparent transition-all font-khmer placeholder:text-slate-400"
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm("")}
                    className="absolute right-3 p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Recent Search Chips */}
          {recentSearches.length > 0 && (
            <div className="mb-6 flex flex-wrap items-center gap-2 bg-slate-50 border border-slate-100 p-3 rounded-2xl">
              <div className="flex items-center gap-1.5 text-xs text-slate-500 font-khmer mr-1">
                <History className="w-3.5 h-3.5 text-[#094C72]" />
                <span>ស្វែងរកថ្មីៗ៖</span>
              </div>
              {recentSearches.map((term, i) => (
                <button
                  key={i}
                  onClick={() => setSearchTerm(term)}
                  className="group inline-flex items-center gap-1.5 px-3 py-1 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg text-xs text-slate-700 shadow-3xs transition-all font-khmer cursor-pointer"
                >
                  <span>{term}</span>
                  <span
                    onClick={(e) => removeRecentSearch(e, term)}
                    className="text-slate-400 hover:text-red-500 rounded-full p-0.5 transition-colors"
                  >
                    <X className="w-3 h-3" />
                  </span>
                </button>
              ))}
              <button
                onClick={() => setShowClearConfirm(true)}
                className="text-[10px] text-slate-400 hover:text-red-500 font-khmer ml-auto underline transition-colors cursor-pointer"
              >
                លុបប្រវត្តិទាំងអស់
              </button>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 text-[10px] uppercase font-extrabold text-slate-400 tracking-wider">
                  <th className="py-3 px-4 font-khmer">ក្រសួង / ស្ថាប័ន</th>
                  <th className="py-3 px-4 text-center font-khmer">វិញ្ញាសាដែលបានបញ្ចប់</th>
                  <th className="py-3 px-4 text-center font-khmer">អត្រាបញ្ចប់</th>
                  <th className="py-3 px-4 text-center font-khmer">ពិន្ទុមធ្យមភាគ</th>
                  <th className="py-3 px-4 text-right font-khmer">សកម្មភាព</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredDashboardData.map((m) => (
                  <tr key={m.id} className="hover:bg-slate-50/50 transition-colors">
                    {/* Logo & Name */}
                    <td className="py-4 px-4 flex items-center gap-3">
                      <div className="relative w-10 h-10 bg-slate-50 border border-slate-100 rounded-xl overflow-hidden flex-shrink-0 flex items-center justify-center p-1.5">
                        {m.logo ? (
                          <SafeImage src={m.logo} alt={m.name} fill className="object-contain" />
                        ) : (
                          <GraduationCap className="w-5 h-5 text-slate-300" />
                        )}
                      </div>
                      <div>
                        <span className="text-xs font-bold text-slate-800 font-khmer block">{m.name}</span>
                        <span className="text-[10px] text-slate-400 font-mono block uppercase">{m.id}</span>
                      </div>
                    </td>

                    {/* Quizzes Count */}
                    <td className="py-4 px-4 text-center">
                      <span className="text-xs font-bold text-slate-700 font-sans">
                        {m.completedQuizzes} / {m.totalQuizzes}
                      </span>
                    </td>

                    {/* Completion Progress bar */}
                    <td className="py-4 px-4">
                      <div className="flex flex-col items-center gap-1">
                        <span className="text-xs font-bold text-slate-800 font-sans">{m.completionRate}%</span>
                        <div className="h-1.5 w-24 bg-slate-100 rounded-full overflow-hidden">
                          <div 
                            style={{ width: `${m.completionRate}%` }} 
                            className={`h-full rounded-full ${m.completionRate === 100 ? 'bg-emerald-500' : 'bg-blue-600'}`} 
                          />
                        </div>
                      </div>
                    </td>

                    {/* Average Score */}
                    <td className="py-4 px-4 text-center">
                      <span className={`text-xs font-bold font-sans px-2.5 py-1 rounded-lg ${
                        m.avgScore >= 80 
                          ? 'bg-emerald-50 text-emerald-700' 
                          : m.avgScore >= 50 
                            ? 'bg-amber-50 text-amber-700' 
                            : m.avgScore > 0 
                              ? 'bg-red-50 text-red-700' 
                              : 'bg-slate-50 text-slate-400'
                      }`}>
                        {m.avgScore > 0 ? `${m.avgScore}%` : 'N/A'}
                      </span>
                    </td>

                    {/* Action button */}
                    <td className="py-4 px-4 text-right">
                      <Link 
                        href={`/ministry/${m.id}`}
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-100 hover:bg-[#094C72] hover:text-white text-[#094C72] rounded-xl text-[10px] font-bold transition-all font-khmer cursor-pointer shadow-2xs"
                      >
                        <span>ចូលសិក្សា</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {/* Clear Search History Confirmation Modal */}
      {showClearConfirm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="bg-white border-2 border-amber-500/30 rounded-3xl p-6 max-w-sm w-full shadow-2xl relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 -mr-8 -mt-8 w-24 h-24 bg-amber-500/5 rounded-full blur-xl pointer-events-none" />
            
            <div className="text-center">
              <div className="w-12 h-12 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-800 font-khmer mb-2">បញ្ជាក់ការលុបប្រវត្តិ</h3>
              <p className="text-slate-500 text-xs font-khmer leading-relaxed mb-6">
                តើអ្នកពិតជាចង់លុបប្រវត្តិស្វែងរកទាំងអស់មែនទេ? ការលុបនេះមិនអាចសង្គ្រោះមកវិញបានឡើយ។
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowClearConfirm(false)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold font-khmer text-xs transition-all cursor-pointer"
                >
                  បោះបង់
                </button>
                <button
                  onClick={() => {
                    clearRecentSearches();
                    setShowClearConfirm(false);
                  }}
                  className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold font-khmer text-xs transition-all cursor-pointer shadow-md shadow-red-600/10"
                >
                  យល់ព្រមលុប
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </main>
  );
}
