'use client';

import React from 'react';
import Link from 'next/link';
import { GraduationCap, CheckCircle2 } from 'lucide-react';
import SafeImage from '@/components/SafeImage';
import { Ministry, Progress as UserProgress } from '@/lib/types';
import { motion } from 'motion/react';
import { cn } from '@/lib/utils';

interface MinistryCardProps {
  ministry: Ministry;
  idx: number;
  onSelect: (ministry: Ministry, action?: string) => void;
  progress?: { completedCount?: number; totalCount?: number };
}

const MinistryCard = React.memo(function MinistryCard({ ministry, idx, onSelect, progress }: MinistryCardProps) {
  const quizzesLength = ministry.quizzes?.length || 0;
  const compCount = progress?.completedCount ?? 0;
  const totalCount = progress?.totalCount ?? quizzesLength;
  const percentage = totalCount > 0 ? (compCount / totalCount) * 100 : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: Math.min(idx * 0.02, 0.15) }}
    >
      <div 
        className={cn(
          "group relative bg-white p-3.5 sm:p-5 md:p-6 rounded-2xl sm:rounded-3xl shadow-sm border border-slate-200 flex flex-col sm:flex-row sm:items-stretch gap-3.5 sm:gap-6 cursor-pointer transition-all hover:shadow-md hover:border-blue-200 overflow-hidden",
          percentage === 100 && "bg-slate-50/50"
        )}
        onClick={() => onSelect(ministry)}
      >
        {/* Top Info on mobile: Logo + Title */}
        <div className="flex items-center sm:items-start gap-3.5 sm:gap-6 flex-1 min-w-0">
          {/* Logo Section */}
          <div className="relative w-16 h-16 sm:w-28 sm:h-28 md:w-36 md:h-36 bg-slate-50 rounded-2xl flex items-center justify-center p-1.5 sm:p-3 border border-slate-100 group-hover:bg-white transition-colors duration-300 flex-shrink-0">
            {ministry.logo ? (
              <SafeImage 
                src={ministry.logo} 
                alt={ministry.name} 
                fill
                className="object-contain p-1 sm:p-2 group-hover:scale-105 transition-transform duration-500"
                style={{
                  backgroundColor: '#ffffff',
                  borderStyle: 'solid',
                  borderWidth: '3px',
                  borderColor: '#0f0fef',
                  borderRadius: '20px'
                }}
              />
            ) : (
              <GraduationCap className="w-8 h-8 sm:w-12 sm:h-12 text-slate-200" />
            )}
            
            {percentage === 100 && (
              <div className="absolute -top-1 -right-1 bg-emerald-500 text-white p-0.5 sm:p-1 rounded-full shadow-lg z-20">
                <CheckCircle2 className="w-3 h-3 sm:w-4 sm:h-4" />
              </div>
            )}
          </div>
          
          {/* Title Info */}
          <div className="flex-1 min-w-0">
            <div className="flex justify-between items-start mb-1 sm:mb-2">
              <div className="space-y-0.5 sm:space-y-1 min-w-0 flex-1 pr-2">
                <h3 className="text-base sm:text-xl md:text-2xl font-bold text-slate-900 group-hover:text-blue-600 transition-colors truncate font-khmer">
                  {ministry.khmerName || ministry.name}
                </h3>
                <p className="text-[10px] sm:text-xs md:text-sm font-medium text-slate-400 uppercase tracking-wider truncate">
                  {ministry.name}
                </p>
              </div>
              <span className="hidden sm:inline-block bg-slate-100 text-slate-500 text-[10px] font-mono px-2 py-0.5 rounded-lg shrink-0">
                {ministry.id.toUpperCase()}
              </span>
            </div>

            <p className="hidden sm:block text-xs sm:text-sm text-slate-600 leading-relaxed line-clamp-2 mb-3 font-khmer">
              {ministry.description}
            </p>

            <div className="hidden sm:block mt-auto space-y-2">
              <div className="flex justify-between items-end">
                <span className="text-[10px] sm:text-[11px] font-bold text-slate-400 uppercase tracking-wider font-khmer">
                  {quizzesLength} វិញ្ញាសា
                </span>
                <span className="text-[10px] sm:text-[11px] font-bold text-slate-900">{Math.round(percentage)}%</span>
              </div>
              <div className="h-1.5 sm:h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                <div 
                  style={{ width: `${percentage}%` }}
                  className={cn(
                    "h-full rounded-full transition-all duration-300",
                    percentage === 100 ? "bg-emerald-500" : "bg-blue-600"
                  )}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Mobile Progress Bar (visible only on mobile screens < sm) */}
        <div className="sm:hidden space-y-1.5 w-full">
          <div className="flex justify-between items-center text-[10px]">
            <span className="font-bold text-slate-500 font-khmer">
              {quizzesLength} វិញ្ញាសា
            </span>
            <span className="font-bold text-slate-900 font-sans">{Math.round(percentage)}%</span>
          </div>
          <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
            <div 
              style={{ width: `${percentage}%` }}
              className={cn(
                "h-full rounded-full transition-all duration-300",
                percentage === 100 ? "bg-emerald-500" : "bg-blue-600"
              )}
            />
          </div>
        </div>

        {/* Action Buttons: Full width 2-column grid on mobile */}
        <div className="grid grid-cols-2 gap-2 sm:gap-3 w-full sm:w-auto sm:flex sm:flex-col sm:justify-end shrink-0 pt-2 sm:pt-0 sm:border-l sm:border-slate-100 sm:pl-4">
          <Link 
            href={`/ministry/${ministry.id}?tab=MCQ`}
            prefetch={true}
            onClick={(e) => { e.stopPropagation(); onSelect(ministry, 'MCQ'); }}
            className="text-center bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 sm:py-2.5 px-3 rounded-xl transition-colors shadow-sm text-xs sm:text-sm font-khmer whitespace-nowrap"
          >
            ចូលធ្វើតេស្ត
          </Link>
          <Link 
            href={`/ministry/${ministry.id}?tab=DOCUMENTS`}
            prefetch={true}
            onClick={(e) => { e.stopPropagation(); onSelect(ministry, 'DOCUMENTS'); }}
            className="text-center bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2 sm:py-2.5 px-3 rounded-xl transition-colors shadow-sm text-xs sm:text-sm font-khmer whitespace-nowrap"
          >
            មើលឯកសារ
          </Link>
        </div>
      </div>
    </motion.div>
  );
});

interface MinistryListProps {
  ministries: Ministry[];
  onSelect: (ministry: Ministry, action?: string) => void;
  userProgress: UserProgress;
}

export const MinistryList: React.FC<MinistryListProps> = React.memo(function MinistryList({ ministries, onSelect, userProgress }) {
  return (
    <div className="space-y-8 md:space-y-12">
      <div className="grid grid-cols-1 gap-6 md:gap-8">
        {ministries.map((ministry, idx) => (
          <MinistryCard 
            key={ministry.id}
            ministry={ministry}
            idx={idx}
            onSelect={onSelect}
            progress={userProgress[ministry.id]}
          />
        ))}
      </div>
    </div>
  );
});
