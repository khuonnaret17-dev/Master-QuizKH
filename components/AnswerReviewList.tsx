'use client';

import React, { useState } from 'react';
import { CheckCircle2, XCircle, Heart, Eye, EyeOff, Search, Lightbulb, BookOpen } from 'lucide-react';
import { Quiz, QuizType } from '@/lib/types';
import { useFirebase } from '@/lib/FirebaseProvider';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/lib/utils';

export interface AnswerReviewItem {
  questionNumber: number;
  quiz: Quiz;
  userAnswer?: string;
  isCorrect?: boolean;
}

interface AnswerReviewListProps {
  items: AnswerReviewItem[];
  quizType: QuizType;
  title?: string;
  subtitle?: string;
  className?: string;
}

export const AnswerReviewList: React.FC<AnswerReviewListProps> = ({
  items,
  quizType,
  title = "ផ្ទៀងផ្ទាត់សំណួរ និងចម្លើយដែលបានឆ្លើយ",
  subtitle = "ពិនិត្យឡើងវិញនូវសំណួរ ចម្លើយរបស់អ្នក និងចម្លើយត្រឹមត្រូវ",
  className
}) => {
  const { toggleFavorite, favorites } = useFirebase();
  const [filter, setFilter] = useState<'all' | 'correct' | 'incorrect'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isOpen, setIsOpen] = useState(true);

  if (!items || items.length === 0) return null;

  const totalCount = items.length;
  const correctCount = items.filter(i => i.isCorrect).length;
  const incorrectCount = totalCount - correctCount;

  const filteredItems = items.filter(item => {
    if (filter === 'correct' && !item.isCorrect) return false;
    if (filter === 'incorrect' && item.isCorrect) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const questionMatch = item.quiz.question?.toLowerCase().includes(q);
      const explanationMatch = item.quiz.explanation?.toLowerCase().includes(q);
      const answerMatch = item.quiz.answer?.toLowerCase().includes(q);
      return questionMatch || explanationMatch || answerMatch;
    }
    return true;
  });

  return (
    <div className={cn("w-full text-left space-y-4", className)}>
      {/* Header Bar with Toggle */}
      <div className="bg-slate-900 text-white p-4 sm:p-5 rounded-2xl sm:rounded-3xl shadow-lg border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-slate-950 font-bold shadow-md shrink-0">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm sm:text-base font-bold font-khmer flex items-center gap-2">
              <span>{title}</span>
              <span className="text-xs bg-amber-400/20 text-amber-300 px-2 py-0.5 rounded-full border border-amber-400/30">
                {items.length} សំណួរ
              </span>
            </h3>
            <p className="text-[11px] sm:text-xs text-slate-300 font-khmer mt-0.5">
              {subtitle}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="self-start sm:self-auto inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl border border-slate-700 transition-colors cursor-pointer font-khmer shrink-0"
        >
          {isOpen ? (
            <>
              <EyeOff className="w-3.5 h-3.5 text-amber-400" />
              <span>បិទផ្ទាំងផ្ទៀងផ្ទាត់ (Hide)</span>
            </>
          ) : (
            <>
              <Eye className="w-3.5 h-3.5 text-emerald-400" />
              <span>បើកផ្ទាំងផ្ទៀងផ្ទាត់ (View)</span>
            </>
          )}
        </button>
      </div>

      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            className="space-y-4 overflow-hidden"
          >
            {/* Filter Pills & Search */}
            <div className="bg-slate-50 p-3 sm:p-4 rounded-2xl border border-slate-200/80 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              {/* Filter Tabs */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
                <button
                  type="button"
                  onClick={() => setFilter('all')}
                  className={cn(
                    "px-3 py-1.5 rounded-xl text-xs font-bold font-khmer transition-all cursor-pointer whitespace-nowrap",
                    filter === 'all'
                      ? "bg-slate-900 text-white shadow-xs"
                      : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
                  )}
                >
                  ទាំងអស់ ({totalCount})
                </button>
                {quizType === 'MULTIPLE_CHOICE' && (
                  <>
                    <button
                      type="button"
                      onClick={() => setFilter('correct')}
                      className={cn(
                        "px-3 py-1.5 rounded-xl text-xs font-bold font-khmer transition-all cursor-pointer whitespace-nowrap inline-flex items-center gap-1.5",
                        filter === 'correct'
                          ? "bg-emerald-600 text-white shadow-xs"
                          : "bg-white text-emerald-700 hover:bg-emerald-50 border border-emerald-200"
                      )}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>ឆ្លើយត្រូវ ({correctCount})</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setFilter('incorrect')}
                      className={cn(
                        "px-3 py-1.5 rounded-xl text-xs font-bold font-khmer transition-all cursor-pointer whitespace-nowrap inline-flex items-center gap-1.5",
                        filter === 'incorrect'
                          ? "bg-rose-600 text-white shadow-xs"
                          : "bg-white text-rose-700 hover:bg-rose-50 border border-rose-200"
                      )}
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      <span>ឆ្លើយខុស ({incorrectCount})</span>
                    </button>
                  </>
                )}
              </div>

              {/* Search Box if more than 5 items */}
              {totalCount > 5 && (
                <div className="relative min-w-[180px] sm:max-w-xs w-full sm:w-auto">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="ស្វែងរកសំណួរ..."
                    className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl focus:border-blue-500 focus:outline-none font-khmer"
                  />
                </div>
              )}
            </div>

            {/* Questions List */}
            <div className="space-y-3.5 max-h-[550px] overflow-y-auto pr-1">
              {filteredItems.length === 0 ? (
                <div className="p-8 text-center bg-white rounded-2xl border border-slate-200 text-slate-500 text-xs font-khmer">
                  មិនមានសំណួរត្រូវនឹងលក្ខខណ្ឌចម្រាញ់នេះទេ។
                </div>
              ) : (
                filteredItems.map(({ questionNumber, quiz, userAnswer, isCorrect }, idx) => {
                  const isFavorite = favorites.includes(quiz.id);

                  return (
                    <motion.div
                      key={quiz.id || idx}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.2, delay: idx * 0.03 }}
                      className={cn(
                        "bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-5 border transition-all shadow-xs space-y-3.5",
                        isCorrect
                          ? "border-emerald-200/80 hover:border-emerald-300"
                          : quizType === 'MULTIPLE_CHOICE'
                          ? "border-rose-200/80 hover:border-rose-300"
                          : "border-slate-200 hover:border-blue-200"
                      )}
                    >
                      {/* Top Question Header */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-800 text-[11px] font-bold font-khmer border border-slate-200">
                            សំណួរទី {questionNumber}
                          </span>

                          {quizType === 'MULTIPLE_CHOICE' && (
                            isCorrect ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[11px] font-bold font-khmer border border-emerald-200">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                <span>ឆ្លើយត្រូវ</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-700 text-[11px] font-bold font-khmer border border-rose-200">
                                <XCircle className="w-3 h-3 text-rose-600" />
                                <span>ឆ្លើយខុស</span>
                              </span>
                            )
                          )}
                        </div>

                        {/* Favorite Button */}
                        <button
                          type="button"
                          onClick={() => toggleFavorite(quiz.id)}
                          className={cn(
                            "p-1.5 rounded-full transition-colors cursor-pointer shrink-0 border",
                            isFavorite
                              ? "bg-rose-50 text-rose-600 border-rose-200 shadow-2xs"
                              : "bg-slate-50 text-slate-400 hover:text-rose-500 hover:bg-rose-50/50 border-slate-200"
                          )}
                          title={isFavorite ? "ដកចេញពីសំណួរចូលចិត្ត" : "រក្សាទុកជាសំណួរចូលចិត្ត"}
                        >
                          <Heart className={cn("w-4 h-4", isFavorite && "fill-rose-500 text-rose-500")} />
                        </button>
                      </div>

                      {/* Question Text */}
                      <div className="text-slate-900 font-bold text-sm sm:text-base leading-relaxed font-khmer break-words-khmer">
                        {quiz.question}
                      </div>

                      {/* Multiple Choice Options Preview */}
                      {quizType === 'MULTIPLE_CHOICE' && quiz.options && (
                        <div className="grid grid-cols-1 gap-2 pt-1">
                          {Object.entries(quiz.options).map(([key, value]) => {
                            const isThisCorrect = key === quiz.correctAnswer;
                            const isThisUserSelected = key === userAnswer;

                            let optionStyles = "p-3 rounded-xl border text-xs sm:text-sm font-khmer transition-all flex items-start gap-2.5 ";
                            if (isThisCorrect) {
                              optionStyles += "bg-emerald-50/90 border-emerald-500 text-emerald-950 font-bold shadow-xs";
                            } else if (isThisUserSelected && !isThisCorrect) {
                              optionStyles += "bg-rose-50/90 border-rose-400 text-rose-950 font-medium line-through opacity-90";
                            } else {
                              optionStyles += "bg-slate-50/60 border-slate-200 text-slate-600";
                            }

                            return (
                              <div key={key} className={optionStyles}>
                                <div className="flex items-center justify-center w-5 h-5 rounded-full bg-white text-slate-800 text-[10px] font-bold shrink-0 border border-slate-200 shadow-2xs mt-0.5">
                                  {key.toUpperCase()}
                                </div>
                                <div className="flex-1 leading-snug">
                                  <span>{value}</span>
                                </div>
                                <div className="shrink-0 flex items-center gap-1 ml-1">
                                  {isThisCorrect && (
                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-100/90 px-2 py-0.5 rounded-md">
                                      <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                      <span>ចម្លើយត្រូវ</span>
                                    </span>
                                  )}
                                  {isThisUserSelected && !isThisCorrect && (
                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-700 bg-rose-100/90 px-2 py-0.5 rounded-md">
                                      <XCircle className="w-3 h-3 text-rose-600" />
                                      <span>ចម្លើយរបស់អ្នក</span>
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Q_AND_A or Vocabulary Answer Preview */}
                      {(quizType === 'Q_AND_A' || quizType === 'VOCABULARY') && (
                        <div className="p-3.5 bg-emerald-50/80 border border-emerald-300/80 rounded-2xl space-y-1.5">
                          <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-800 font-khmer">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                            <span>ចម្លើយផ្លូវការ (Official Answer)៖</span>
                          </div>
                          <p className="text-xs sm:text-sm text-emerald-950 leading-relaxed font-khmer">
                            {quiz.answer || quiz.explanation || "មិនទាន់មានចម្លើយលម្អិត"}
                          </p>
                        </div>
                      )}

                      {/* Explanation Section */}
                      {quiz.explanation && quizType === 'MULTIPLE_CHOICE' && (
                        <div className="p-3.5 bg-blue-50/70 border border-blue-200/70 rounded-2xl flex items-start gap-2.5">
                          <Lightbulb className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                          <div className="space-y-0.5">
                            <span className="text-[11px] font-bold text-blue-900 font-khmer block">
                              ការពន្យល់បន្ថែម (Explanation)៖
                            </span>
                            <p className="text-xs text-blue-950/80 leading-relaxed font-khmer">
                              {quiz.explanation}
                            </p>
                          </div>
                        </div>
                      )}
                    </motion.div>
                  );
                })
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
