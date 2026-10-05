'use client';

import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine
} from 'recharts';
import { 
  TrendingUp, 
  TrendingDown,
  Award, 
  Filter, 
  Activity, 
  Sparkles,
  ArrowUpRight,
  Layers
} from 'lucide-react';
import { Ministry, Progress } from '@/lib/types';
import Link from 'next/link';

interface QuizPerformanceChartProps {
  userProgress: Progress;
  ministries: Ministry[];
}

interface AttemptPoint {
  id: string;
  attemptNumber: number;
  timestamp: number;
  displayDate: string;
  fullDate: string;
  score: number;
  ministryId: string;
  ministryName: string;
  shortMinistryName: string;
  category: string;
  type: string;
  color: string;
  [key: string]: string | number; // Dynamic ministry score keys for multi-line view
}

const COLOR_PALETTE = [
  '#094C72', // Classic Navy
  '#D4AF37', // Gold / Amber
  '#10B981', // Emerald
  '#6366F1', // Indigo
  '#EC4899', // Pink
  '#F59E0B', // Amber
  '#06B6D4', // Cyan
  '#8B5CF6', // Purple
  '#EF4444', // Red
  '#14B8A6'  // Teal
];

export function QuizPerformanceChart({ userProgress, ministries }: QuizPerformanceChartProps) {
  const [selectedMinistry, setSelectedMinistry] = useState<string>('ALL');
  const [selectedType, setSelectedType] = useState<'ALL' | 'MCQ' | 'QA'>('ALL');
  const [viewMode, setViewMode] = useState<'OVERALL' | 'BY_MINISTRY'>('OVERALL');

  // Process all completed quizzes chronologically
  const rawAttempts = useMemo(() => {
    const list: AttemptPoint[] = [];

    // Map ministry ID to color
    const ministryColorMap: Record<string, string> = {};
    ministries.forEach((m, idx) => {
      ministryColorMap[m.id] = m.color || COLOR_PALETTE[idx % COLOR_PALETTE.length];
    });

    Object.entries(userProgress).forEach(([key, val]) => {
      if (typeof val.score === 'number') {
        const minId = val.ministryId || key.split('_')[0];
        const ministry = ministries.find(m => m.id === minId);
        const minName = ministry?.khmerName || ministry?.name || minId;
        const shortName = (ministry?.khmerName || ministry?.name || minId).replace('ក្រសួង', 'ក្រ.').substring(0, 12);
        
        const dateObj = val.completedAt ? new Date(val.completedAt) : new Date();
        const validTime = !isNaN(dateObj.getTime()) ? dateObj.getTime() : Date.now();

        const catName = val.category || (key.includes('_MCQ_') ? 'ពហុជ្រើសរើស' : key.includes('_QA_') ? 'សំណួរ-ចម្លើយ' : 'វិញ្ញាសា');
        const qType = val.type || (key.includes('_MCQ_') ? 'MCQ' : key.includes('_QA_') ? 'QA' : 'GENERAL');

        list.push({
          id: key,
          attemptNumber: 0,
          timestamp: validTime,
          displayDate: new Date(validTime).toLocaleDateString('kh-KH', { month: 'numeric', day: 'numeric' }),
          fullDate: new Date(validTime).toLocaleString('kh-KH', { 
            day: 'numeric', 
            month: 'short', 
            year: 'numeric', 
            hour: '2-digit', 
            minute: '2-digit' 
          }),
          score: Math.min(100, Math.max(0, Math.round(val.score))),
          ministryId: minId,
          ministryName: minName,
          shortMinistryName: shortName,
          category: catName,
          type: qType,
          color: ministryColorMap[minId] || '#094C72',
          [minId]: Math.round(val.score)
        });
      }
    });

    // Sort chronologically
    list.sort((a, b) => a.timestamp - b.timestamp);

    // Assign sequential attempt index
    return list.map((item, index) => ({
      ...item,
      attemptNumber: index + 1,
      attemptLabel: `លើកទី ${index + 1}`
    }));
  }, [userProgress, ministries]);

  // Filtered attempts based on active ministry and type selections
  const filteredAttempts = useMemo(() => {
    return rawAttempts.filter(att => {
      const matchMinistry = selectedMinistry === 'ALL' || att.ministryId === selectedMinistry;
      const matchType = selectedType === 'ALL' || att.type === selectedType;
      return matchMinistry && matchType;
    });
  }, [rawAttempts, selectedMinistry, selectedType]);

  // List of distinct ministries present in the attempts
  const availableMinistries = useMemo(() => {
    const ids = Array.from(new Set(rawAttempts.map(a => a.ministryId)));
    return ids.map(id => {
      const min = ministries.find(m => m.id === id);
      return {
        id,
        name: min?.khmerName || min?.name || id
      };
    });
  }, [rawAttempts, ministries]);

  // Performance metrics calculation
  const stats = useMemo(() => {
    if (filteredAttempts.length === 0) {
      return {
        latestScore: 0,
        averageScore: 0,
        highestScore: 0,
        trend: 0,
        passingCount: 0
      };
    }

    const scores = filteredAttempts.map(a => a.score);
    const sum = scores.reduce((acc, curr) => acc + curr, 0);
    const avg = Math.round(sum / scores.length);
    const high = Math.max(...scores);
    const latest = scores[scores.length - 1];

    // Compute trend between first half and second half if multiple attempts
    let trend = 0;
    if (scores.length >= 2) {
      const firstScore = scores[0];
      trend = latest - firstScore;
    }

    const passing = scores.filter(s => s >= 50).length;

    return {
      latestScore: latest,
      averageScore: avg,
      highestScore: high,
      trend,
      passingCount: passing
    };
  }, [filteredAttempts]);

  return (
    <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200 p-3.5 sm:p-6 shadow-sm space-y-4 sm:space-y-6 overflow-hidden">
      {/* Component Header */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 border-b border-slate-100 pb-5">
        <div>
          <div className="flex items-center gap-2 text-[#094C72] mb-1">
            <Activity className="w-5 h-5 text-amber-500" />
            <span className="text-xs uppercase font-extrabold tracking-wider font-sans">Performance Over Time</span>
          </div>
          <h2 className="text-lg sm:text-xl font-black text-slate-900 font-khmer">
            និន្នាការនៃការវិវត្តន៍ពិន្ទុតាមពេលវេលា (Score Trends)
          </h2>
          <p className="text-xs text-slate-400 font-khmer mt-0.5">
            តាមដានការរីកចម្រើន និងកម្រិតយល់ដឹងវិញ្ញាសារបស់អ្នកតាមលំដាប់លំដោយនៃការប្រឡង
          </p>
        </div>

        {/* Filter controls */}
        <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
          {/* Ministry Category Filter */}
          <div className="relative w-full sm:w-auto">
            <select
              value={selectedMinistry}
              onChange={(e) => setSelectedMinistry(e.target.value)}
              className="appearance-none pl-8 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 font-khmer focus:outline-none focus:ring-2 focus:ring-[#094C72] cursor-pointer w-full sm:w-auto max-w-full"
            >
              <option value="ALL">គ្រប់ក្រសួង/ស្ថាប័នទាំងអស់</option>
              {availableMinistries.map(m => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
            <Filter className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          {/* Quiz Type Filter */}
          <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200/50 w-full sm:w-auto justify-between sm:justify-start">
            <button
              onClick={() => setSelectedType('ALL')}
              className={`flex-1 sm:flex-initial px-3 py-1 text-xs font-bold rounded-lg transition-all font-khmer cursor-pointer text-center ${
                selectedType === 'ALL'
                  ? 'bg-white text-[#094C72] shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              ទាំងអស់
            </button>
            <button
              onClick={() => setSelectedType('MCQ')}
              className={`flex-1 sm:flex-initial px-3 py-1 text-xs font-bold rounded-lg transition-all font-khmer cursor-pointer text-center ${
                selectedType === 'MCQ'
                  ? 'bg-white text-blue-600 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              ពហុជ្រើសរើស
            </button>
            <button
              onClick={() => setSelectedType('QA')}
              className={`flex-1 sm:flex-initial px-3 py-1 text-xs font-bold rounded-lg transition-all font-khmer cursor-pointer text-center ${
                selectedType === 'QA'
                  ? 'bg-white text-amber-600 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              សំណួរ-ចម្លើយ
            </button>
          </div>

          {/* View Mode Toggle */}
          {availableMinistries.length > 1 && (
            <button
              onClick={() => setViewMode(viewMode === 'OVERALL' ? 'BY_MINISTRY' : 'OVERALL')}
              className={`flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold font-khmer transition-all cursor-pointer w-full sm:w-auto ${
                viewMode === 'BY_MINISTRY'
                  ? 'bg-[#094C72] text-white border-[#094C72] shadow-sm'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>{viewMode === 'BY_MINISTRY' ? 'បំបែកតាមក្រសួង' : 'បន្ទាត់រួម'}</span>
            </button>
          )}
        </div>
      </div>

      {/* KPI Metrics Summary Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="p-3.5 sm:p-4 bg-slate-50 rounded-2xl border border-slate-100">
          <span className="text-[10px] font-bold text-slate-400 font-khmer block uppercase">ពិន្ទុចុងក្រោយ</span>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-2xl font-black text-slate-800 font-sans">{stats.latestScore}%</span>
            {stats.trend !== 0 && (
              <span className={`text-[10px] font-bold flex items-center font-sans ${
                stats.trend > 0 ? 'text-emerald-600' : 'text-rose-600'
              }`}>
                {stats.trend > 0 ? <TrendingUp className="w-3 h-3 mr-0.5" /> : <TrendingDown className="w-3 h-3 mr-0.5" />}
                {stats.trend > 0 ? `+${stats.trend}%` : `${stats.trend}%`}
              </span>
            )}
          </div>
        </div>

        <div className="p-3.5 sm:p-4 bg-slate-50 rounded-2xl border border-slate-100">
          <span className="text-[10px] font-bold text-slate-400 font-khmer block uppercase">ពិន្ទុមធ្យមភាគសរុប</span>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-2xl font-black text-slate-800 font-sans">{stats.averageScore}%</span>
            <span className="text-[10px] text-slate-400 font-khmer">មធ្យម</span>
          </div>
        </div>

        <div className="p-3.5 sm:p-4 bg-slate-50 rounded-2xl border border-slate-100">
          <span className="text-[10px] font-bold text-slate-400 font-khmer block uppercase">ពិន្ទុខ្ពស់បំផុត</span>
          <div className="flex items-baseline gap-1.5 mt-1">
            <span className="text-2xl font-black text-amber-500 font-sans">{stats.highestScore}%</span>
            <Award className="w-4 h-4 text-amber-500 shrink-0" />
          </div>
        </div>

        <div className="p-3.5 sm:p-4 bg-slate-50 rounded-2xl border border-slate-100">
          <span className="text-[10px] font-bold text-slate-400 font-khmer block uppercase">ចំនួនលើកដែលបានប្រឡង</span>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-2xl font-black text-[#094C72] font-sans">{filteredAttempts.length}</span>
            <span className="text-[10px] text-slate-400 font-khmer">លើក (ជាប់ {stats.passingCount})</span>
          </div>
        </div>
      </div>

      {/* Main Recharts Line Chart */}
      <div className="h-80 w-full min-h-[320px] relative">
        {filteredAttempts.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-8 bg-slate-50/60 rounded-2xl border border-dashed border-slate-200">
            <div className="w-12 h-12 bg-amber-50 text-amber-500 rounded-full flex items-center justify-center mb-3">
              <TrendingUp className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-700 font-khmer mb-1">
              មិនទាន់មានកំណត់ត្រាប្រឡងវិញ្ញាសានៅឡើយទេ
            </h3>
            <p className="text-xs text-slate-400 font-khmer max-w-sm mb-4 leading-relaxed">
              នៅពេលអ្នកចូលរួមធ្វើតេស្តពហុជ្រើសរើស ឬឆ្លើយសំណួរ-ចម្លើយ ប្រព័ន្ធនឹងគូសវាសក្រាហ្វិកវិវត្តន៍ពិន្ទុនៅទីនេះដោយស្វ័យប្រវត្តិ។
            </p>
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#094C72] text-white hover:bg-[#073652] rounded-xl text-xs font-bold font-khmer transition-all shadow-xs"
            >
              <span>ចូលជ្រើសរើសវិញ្ញាសាដើម្បីចាប់ផ្តើម</span>
              <ArrowUpRight className="w-4 h-4" />
            </Link>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={filteredAttempts}
              margin={{ top: 15, right: 20, left: -10, bottom: 5 }}
            >
              <defs>
                <linearGradient id="lineGradient" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#094C72" />
                  <stop offset="50%" stopColor="#D4AF37" />
                  <stop offset="100%" stopColor="#10B981" />
                </linearGradient>
              </defs>

              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
              
              <XAxis 
                dataKey="displayDate" 
                tick={{ fontSize: 11, fill: '#64748B', fontFamily: 'sans-serif' }}
                axisLine={{ stroke: '#E2E8F0' }}
                tickLine={false}
              />
              
              <YAxis 
                domain={[0, 100]} 
                ticks={[0, 25, 50, 75, 100]}
                tick={{ fontSize: 11, fill: '#64748B', fontFamily: 'sans-serif' }}
                axisLine={false}
                tickLine={false}
                unit="%"
              />

              {/* Reference line for 50% pass mark */}
              <ReferenceLine 
                y={50} 
                stroke="#94A3B8" 
                strokeDasharray="4 4" 
                label={{ 
                  value: 'កម្រិតមធ្យម 50%', 
                  position: 'insideBottomRight', 
                  fill: '#94A3B8', 
                  fontSize: 10,
                  fontFamily: 'sans-serif' 
                }} 
              />

              {/* Reference line for 80% honor mark */}
              <ReferenceLine 
                y={80} 
                stroke="#10B981" 
                strokeDasharray="2 2" 
                label={{ 
                  value: 'កម្រិតល្អប្រសើរ 80%', 
                  position: 'insideTopRight', 
                  fill: '#10B981', 
                  fontSize: 10,
                  fontFamily: 'sans-serif' 
                }} 
              />

              <Tooltip 
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload as AttemptPoint;
                    return (
                      <div className="bg-white/95 backdrop-blur-md p-4 rounded-2xl shadow-xl border border-slate-100 font-khmer min-w-[200px]">
                        <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2 mb-2">
                          <span className="text-[10px] font-bold text-slate-400">{data.fullDate}</span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-sans">
                            {data.type}
                          </span>
                        </div>
                        <p className="text-xs font-black text-slate-800 truncate mb-1">
                          {data.category}
                        </p>
                        <p className="text-[11px] text-slate-500 truncate mb-2">
                          {data.ministryName}
                        </p>
                        <div className="flex items-center justify-between pt-1 border-t border-slate-50">
                          <span className="text-xs font-bold text-slate-500">លទ្ធផលទទួលបាន៖</span>
                          <span className={`text-base font-black font-sans ${
                            data.score >= 80 ? 'text-emerald-600' : data.score >= 50 ? 'text-amber-500' : 'text-rose-600'
                          }`}>
                            {data.score}%
                          </span>
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
              />

              {viewMode === 'OVERALL' ? (
                <Line 
                  type="monotone" 
                  dataKey="score" 
                  stroke="url(#lineGradient)" 
                  strokeWidth={3.5}
                  name="ពិន្ទុវិញ្ញាសា"
                  activeDot={{ 
                    r: 7, 
                    fill: '#094C72', 
                    stroke: '#FFFFFF', 
                    strokeWidth: 3 
                  }}
                  dot={{ 
                    r: 4, 
                    fill: '#D4AF37', 
                    stroke: '#FFFFFF', 
                    strokeWidth: 2 
                  }}
                />
              ) : (
                // Multi-line by Ministry
                availableMinistries.map((min, idx) => (
                  <Line
                    key={min.id}
                    type="monotone"
                    dataKey={min.id}
                    name={min.name}
                    stroke={COLOR_PALETTE[idx % COLOR_PALETTE.length]}
                    strokeWidth={2.5}
                    connectNulls={true}
                    activeDot={{ r: 6 }}
                    dot={{ r: 3.5 }}
                  />
                ))
              )}

              {viewMode === 'BY_MINISTRY' && (
                <Legend 
                  verticalAlign="bottom" 
                  height={36} 
                  iconSize={10} 
                  wrapperStyle={{ fontSize: '11px', fontFamily: 'sans-serif', paddingTop: '10px' }} 
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Footer Insight Note */}
      {filteredAttempts.length > 0 && (
        <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-[11px] text-slate-500 font-khmer">
          <div className="flex items-center gap-1.5 text-slate-600 font-medium">
            <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0" />
            <span>
              {stats.trend > 0 
                ? `អបអរសាទរ! ពិន្ទុរបស់អ្នកបានកើនឡើង ${stats.trend}% ធៀបនឹងលើកដំបូង។`
                : stats.trend === 0
                ? 'រក្សាទម្រង់សិក្សា និងបន្តប្រឡងលើវិញ្ញាសាដទៃទៀតដើម្បីបង្កើនចំណាត់ថ្នាក់!'
                : 'សូមបន្តរំលឹកឯកសារ និងធ្វើតេស្តឡើងវិញដើម្បីពង្រឹងលទ្ធផលឱ្យបានលើស 80%!'
              }
            </span>
          </div>
          <span className="text-[10px] text-slate-400">
            ធ្វើបច្ចុប្បន្នភាពស្វ័យប្រវត្តិតាមពេលវេលាជាក់ស្តែង
          </span>
        </div>
      )}
    </div>
  );
}
