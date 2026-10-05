'use client';

import React, { useState, useMemo } from 'react';
import { useFirebase } from '@/lib/FirebaseProvider';
import { MinistryList } from '@/components/MinistryList';
import SafeImage from '@/components/SafeImage';
import { ArrowLeft, Heart, Search, HelpCircle, Globe, FileText, Download, Play, BookOpen, ExternalLink, CheckCircle2, Copy, Check, Sparkles, X } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'motion/react';
import { Button } from '@/components/ui/button';
import { Quiz } from '@/lib/types';

interface FavoriteQuestionItem extends Quiz {
  ministryId: string;
  ministryName: string;
  ministryLogo: string;
}

interface FavoriteLessonItem {
  id: string;
  category: string;
  ministryId: string;
  ministryName: string;
  ministryLogo: string;
  itemCount: number;
}

export default function FavoritesPage() {
  const { ministries, documents, user, favorites, toggleFavorite, userProgress } = useFirebase();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<'ALL' | 'QUESTIONS' | 'LESSONS' | 'MINISTRIES'>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isPracticing, setIsPracticing] = useState(false);
  const [practiceIdx, setPracticeIdx] = useState(0);
  const [practiceAnswer, setPracticeAnswer] = useState<string | null>(null);
  const [practiceShowExp, setPracticeShowExp] = useState(false);
  const [practiceScore, setPracticeScore] = useState(0);
  const [practiceFinished, setPracticeFinished] = useState(false);

  // 1. Extract Saved Questions
  const favoriteQuestions = useMemo(() => {
    const list: FavoriteQuestionItem[] = [];
    ministries.forEach(m => {
      (m.quizzes || []).forEach(q => {
        if (favorites.includes(q.id)) {
          list.push({
            ...q,
            ministryId: m.id,
            ministryName: m.khmerName || m.name,
            ministryLogo: m.logo
          });
        }
      });
    });
    return list;
  }, [ministries, favorites]);

  // 2. Extract Saved Lessons / Categories
  const favoriteLessons = useMemo(() => {
    const list: FavoriteLessonItem[] = [];
    const seen = new Set<string>();

    ministries.forEach(m => {
      const catCount: Record<string, number> = {};
      (m.quizzes || []).forEach(q => {
        if (q.category) {
          catCount[q.category] = (catCount[q.category] || 0) + 1;
        }
      });

      Object.keys(catCount).forEach(cat => {
        const keyGeneral = `lesson_${encodeURIComponent(cat)}`;
        const keySpecific = `lesson_${m.id}_${encodeURIComponent(cat)}`;

        if ((favorites.includes(keyGeneral) || favorites.includes(keySpecific)) && !seen.has(`${m.id}_${cat}`)) {
          seen.add(`${m.id}_${cat}`);
          list.push({
            id: favorites.includes(keySpecific) ? keySpecific : keyGeneral,
            category: cat,
            ministryId: m.id,
            ministryName: m.khmerName || m.name,
            ministryLogo: m.logo,
            itemCount: catCount[cat] || 0
          });
        }
      });
    });
    return list;
  }, [ministries, favorites]);

  // 3. Extract Saved PDF Documents
  const favoriteDocuments = useMemo(() => {
    return documents.filter(doc => favorites.includes(doc.id)).map(doc => {
      const ministry = ministries.find(m => m.id === doc.ministryId);
      return {
        ...doc,
        ministryName: ministry?.khmerName || ministry?.name || 'ក្រសួង',
        ministryLogo: ministry?.logo
      };
    });
  }, [documents, favorites, ministries]);

  // 4. Extract Saved Ministries
  const favoriteMinistries = useMemo(() => {
    return ministries.filter(m => favorites.includes(m.id));
  }, [ministries, favorites]);

  // Filtered by Search Term
  const filteredQuestions = useMemo(() => {
    if (!searchTerm.trim()) return favoriteQuestions;
    const term = searchTerm.toLowerCase();
    return favoriteQuestions.filter(q => 
      q.question.toLowerCase().includes(term) ||
      q.category.toLowerCase().includes(term) ||
      q.ministryName.toLowerCase().includes(term) ||
      (q.explanation && q.explanation.toLowerCase().includes(term))
    );
  }, [favoriteQuestions, searchTerm]);

  const filteredLessons = useMemo(() => {
    if (!searchTerm.trim()) return favoriteLessons;
    const term = searchTerm.toLowerCase();
    return favoriteLessons.filter(l => 
      l.category.toLowerCase().includes(term) ||
      l.ministryName.toLowerCase().includes(term)
    );
  }, [favoriteLessons, searchTerm]);

  const filteredDocuments = useMemo(() => {
    if (!searchTerm.trim()) return favoriteDocuments;
    const term = searchTerm.toLowerCase();
    return favoriteDocuments.filter(d => 
      d.title.toLowerCase().includes(term) ||
      d.ministryName.toLowerCase().includes(term)
    );
  }, [favoriteDocuments, searchTerm]);

  const filteredMinistries = useMemo(() => {
    if (!searchTerm.trim()) return favoriteMinistries;
    const term = searchTerm.toLowerCase();
    return favoriteMinistries.filter(m => 
      (m.khmerName && m.khmerName.toLowerCase().includes(term)) ||
      m.name.toLowerCase().includes(term) ||
      (m.description && m.description.toLowerCase().includes(term))
    );
  }, [favoriteMinistries, searchTerm]);

  const totalFavoriteCount = favoriteQuestions.length + favoriteLessons.length + favoriteDocuments.length + favoriteMinistries.length;

  const handleCopyText = (text: string, id: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  // Practice Mode Handlers
  const startPractice = () => {
    if (favoriteQuestions.length === 0) return;
    setPracticeIdx(0);
    setPracticeAnswer(null);
    setPracticeShowExp(false);
    setPracticeScore(0);
    setPracticeFinished(false);
    setIsPracticing(true);
  };

  const handlePracticeSelect = (optionKey: string) => {
    if (practiceShowExp) return;
    setPracticeAnswer(optionKey);
    setPracticeShowExp(true);
    const curr = favoriteQuestions[practiceIdx];
    if (optionKey === curr.correctAnswer) {
      setPracticeScore(prev => prev + 1);
    }
  };

  const handlePracticeNext = () => {
    if (practiceIdx < favoriteQuestions.length - 1) {
      setPracticeIdx(prev => prev + 1);
      setPracticeAnswer(null);
      setPracticeShowExp(false);
    } else {
      setPracticeFinished(true);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 text-center bg-slate-50">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white p-8 rounded-3xl border border-slate-200 shadow-xl max-w-md w-full"
        >
          <div className="w-16 h-16 rounded-2xl bg-rose-50 text-rose-500 flex items-center justify-center mx-auto mb-4">
            <Heart className="w-8 h-8 fill-rose-500" />
          </div>
          <h2 className="text-xl font-black text-slate-800 mb-2 font-khmer">សូមចូលគណនី</h2>
          <p className="text-xs text-slate-500 font-khmer mb-6">
            សូមចូលគណនីដើម្បីមើល និងគ្រប់គ្រងសំណួរ ឬមេរៀនដែលអ្នកបានរក្សាទុកក្នុងបញ្ជីចូលចិត្ត។
          </p>
          <Link href="/" className="inline-block px-6 py-3 bg-[#094C72] text-white font-bold rounded-xl hover:bg-[#073652] transition-colors font-khmer text-sm">
            ត្រឡប់ទៅទំព័រដើមដើម្បីចូលគណនី
          </Link>
        </motion.div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 pt-6 sm:pt-8 md:pt-12 pb-12 sm:pb-16 px-3.5 sm:px-6 md:px-10 overflow-x-hidden">
      <div className="max-w-6xl mx-auto space-y-6 sm:space-y-8">
        
        {/* Top Header */}
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 sm:p-6 md:p-8 rounded-2xl sm:rounded-3xl shadow-sm border border-slate-200/80">
          <div className="flex items-center gap-3.5">
            <Link 
              href="/" 
              className="p-2 sm:p-2.5 bg-slate-50 rounded-2xl border border-slate-200 hover:bg-slate-100 transition-colors text-slate-600"
              title="ត្រឡប់ទៅទំព័រដើម"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-rose-50 rounded-xl text-rose-500">
                  <Heart className="w-5 h-5 fill-rose-500" />
                </div>
                <h1 className="text-xl sm:text-2xl font-black text-slate-900 font-khmer">
                  បញ្ជីចូលចិត្ត (Favorites)
                </h1>
              </div>
              <p className="text-xs text-slate-500 font-khmer mt-0.5">
                សំណួរ មេរៀន និងឯកសារដែលអ្នកបានរក្សាទុកសម្រាប់រៀនត្រៀមប្រឡង
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-center">
            {favoriteQuestions.length > 0 && (
              <Button
                onClick={startPractice}
                className="bg-gradient-to-r from-[#094C72] to-[#1565C0] hover:from-[#073956] hover:to-[#0d47a1] text-white font-khmer font-bold text-xs sm:text-sm px-4 py-2.5 rounded-xl shadow-md flex items-center gap-2"
              >
                <Play className="w-4 h-4 fill-current text-amber-300" />
                <span>ធ្វើតេស្តសំណួរចូលចិត្ត ({favoriteQuestions.length})</span>
              </Button>
            )}
          </div>
        </header>

        {/* Search & Tabs Filter Bar */}
        <div className="space-y-4">
          {/* Search Box */}
          <div className="relative max-w-xl">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4 pointer-events-none" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="ស្វែងរកក្នុងបញ្ជីចូលចិត្ត (សំណួរ, មេរៀន, ក្រសួង)..."
              className="w-full pl-11 pr-10 py-3 bg-white border border-slate-200 rounded-2xl text-xs sm:text-sm text-slate-800 shadow-2xs focus:outline-none focus:ring-2 focus:ring-[#094C72] font-khmer"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 rounded-full"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Navigation Tabs */}
          <div className="flex flex-wrap gap-1.5 sm:gap-2 border-b border-slate-200 pb-2">
            <button
              onClick={() => setActiveTab('ALL')}
              className={`px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold font-khmer transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'ALL'
                  ? 'bg-[#094C72] text-white shadow-sm'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              <span>ទាំងអស់</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${activeTab === 'ALL' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'}`}>
                {totalFavoriteCount}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('QUESTIONS')}
              className={`px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold font-khmer transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'QUESTIONS'
                  ? 'bg-[#094C72] text-white shadow-sm'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              <HelpCircle className="w-3.5 h-3.5" />
              <span>សំណួរចូលចិត្ត</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${activeTab === 'QUESTIONS' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'}`}>
                {favoriteQuestions.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('LESSONS')}
              className={`px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold font-khmer transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'LESSONS'
                  ? 'bg-[#094C72] text-white shadow-sm'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>មេរៀន & ឯកសារ</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${activeTab === 'LESSONS' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'}`}>
                {favoriteLessons.length + favoriteDocuments.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('MINISTRIES')}
              className={`px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold font-khmer transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'MINISTRIES'
                  ? 'bg-[#094C72] text-white shadow-sm'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              <Globe className="w-3.5 h-3.5" />
              <span>ក្រសួង/ស្ថាប័ន</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${activeTab === 'MINISTRIES' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'}`}>
                {favoriteMinistries.length}
              </span>
            </button>
          </div>
        </div>

        {/* Content Section */}
        {totalFavoriteCount === 0 ? (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-20 bg-white rounded-3xl border border-dashed border-slate-300 p-6 space-y-4"
          >
            <div className="w-16 h-16 rounded-full bg-rose-50 text-rose-400 flex items-center justify-center mx-auto shadow-inner">
              <Heart className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-slate-800 font-khmer">មិនទាន់មានទិន្នន័យក្នុងបញ្ជីចូលចិត្ត</h3>
            <p className="text-xs sm:text-sm text-slate-500 font-khmer max-w-md mx-auto">
              នៅពេលអ្នកកំពុងធ្វើតេស្ត ឬអានឯកសារវិញ្ញាសា សូមចុចលើរូបបេះដូង <Heart className="w-3.5 h-3.5 inline text-rose-500 fill-rose-500" /> ដើម្បីរក្សាទុកសំណួរ ឬមេរៀនសំខាន់ៗមកទីនេះ។
            </p>
            <Link href="/" className="inline-flex items-center gap-2 px-6 py-2.5 bg-[#094C72] text-white font-bold rounded-xl hover:bg-[#073652] transition-colors font-khmer text-xs">
              <span>ទៅកាន់បញ្ជីវិញ្ញាសាដើម្បីចាប់ផ្ដើម</span>
            </Link>
          </motion.div>
        ) : (
          <div className="space-y-8">
            
            {/* 1. QUESTIONS SECTION */}
            {(activeTab === 'ALL' || activeTab === 'QUESTIONS') && (
              <section className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <HelpCircle className="w-5 h-5 text-[#094C72]" />
                    <h2 className="text-lg sm:text-xl font-bold text-slate-900 font-khmer">
                      សំណួរដែលបានរក្សាទុក ({filteredQuestions.length})
                    </h2>
                  </div>
                  {filteredQuestions.length > 0 && activeTab === 'ALL' && (
                    <button 
                      onClick={() => setActiveTab('QUESTIONS')} 
                      className="text-xs text-blue-600 hover:underline font-khmer"
                    >
                      មើលទាំងអស់
                    </button>
                  )}
                </div>

                {filteredQuestions.length === 0 ? (
                  activeTab === 'QUESTIONS' && (
                    <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center text-slate-500 text-xs font-khmer">
                      រកមិនឃើញសំណួរត្រូវនឹងការស្វែងរករបស់អ្នកទេ។
                    </div>
                  )
                ) : (
                  <div className="grid grid-cols-1 gap-4">
                    {filteredQuestions.map((q, idx) => (
                      <div 
                        key={q.id}
                        className="bg-white p-4 sm:p-6 rounded-2xl sm:rounded-3xl border border-slate-200 shadow-xs hover:shadow-md transition-all space-y-4"
                      >
                        {/* Card Top: Ministry info & Type Badge */}
                        <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-7 h-7 sm:w-8 sm:h-8 relative rounded-lg overflow-hidden shrink-0 bg-slate-50 p-1 border border-slate-100">
                              <SafeImage src={q.ministryLogo} alt={q.ministryName} fill className="object-contain" />
                            </div>
                            <div className="min-w-0">
                              <span className="text-xs font-bold text-slate-800 font-khmer truncate block">
                                {q.ministryName}
                              </span>
                              <span className="text-[10px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md font-khmer inline-block truncate max-w-[200px] sm:max-w-none">
                                {q.category}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 font-khmer">
                              {q.type === 'MULTIPLE_CHOICE' ? 'ពហុជ្រើសរើស' : q.type === 'Q_AND_A' ? 'សំណួរចម្លើយ' : 'ពន្យល់ពាក្យ'}
                            </span>
                            <button
                              onClick={() => toggleFavorite(q.id)}
                              className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-full transition-colors"
                              title="ដកចេញពីបញ្ជីចូលចិត្ត"
                            >
                              <Heart className="w-4 h-4 fill-rose-500" />
                            </button>
                          </div>
                        </div>

                        {/* Question Text */}
                        <div className="flex items-start gap-2.5">
                          <span className="w-6 h-6 rounded-full bg-[#094C72]/10 text-[#094C72] text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                            {idx + 1}
                          </span>
                          <h3 className="text-sm sm:text-base md:text-lg font-bold text-slate-900 leading-relaxed font-khmer whitespace-pre-wrap break-words-khmer flex-1">
                            {q.question}
                          </h3>
                        </div>

                        {/* Options / Answer */}
                        {q.options && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pl-8">
                            {Object.entries(q.options).map(([optKey, optVal]) => {
                              const isCorrect = optKey === q.correctAnswer;
                              return (
                                <div 
                                  key={optKey}
                                  className={`p-2.5 sm:p-3 rounded-xl border text-xs sm:text-sm flex items-start gap-2 font-khmer ${
                                    isCorrect 
                                      ? 'bg-emerald-50 border-emerald-300 text-emerald-900 font-bold' 
                                      : 'bg-slate-50 border-slate-200 text-slate-700'
                                  }`}
                                >
                                  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                                    isCorrect ? 'bg-emerald-600 text-white' : 'bg-white text-slate-500 border border-slate-200'
                                  }`}>
                                    {optKey}
                                  </span>
                                  <span className="flex-1 break-words-khmer">{optVal}</span>
                                  {isCorrect && <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />}
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {q.answer && (
                          <div className="pl-8">
                            <div className="bg-blue-50/70 p-3 sm:p-4 rounded-xl border border-blue-100 text-xs sm:text-sm font-khmer text-slate-800">
                              <span className="font-bold text-blue-900 block mb-1">ចម្លើយផ្លូវការ៖</span>
                              <p className="whitespace-pre-wrap leading-relaxed break-words-khmer">{q.answer}</p>
                            </div>
                          </div>
                        )}

                        {/* Explanation */}
                        {q.explanation && (
                          <div className="pl-8">
                            <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-200/60 text-xs text-slate-700 font-khmer">
                              <span className="font-bold text-amber-900 block mb-1">💡 ពន្យល់បន្ថែម៖</span>
                              <p className="italic leading-relaxed whitespace-pre-wrap break-words-khmer">{q.explanation}</p>
                            </div>
                          </div>
                        )}

                        {/* Card Actions Footer */}
                        <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs pl-8">
                          <button
                            onClick={() => handleCopyText(`${q.question}\n${q.answer || (q.correctAnswer ? `ចម្លើយត្រឹមត្រូវ: ${q.correctAnswer}` : '')}`, q.id)}
                            className="inline-flex items-center gap-1.5 text-slate-500 hover:text-[#094C72] transition-colors font-khmer"
                          >
                            {copiedId === q.id ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
                            <span>{copiedId === q.id ? 'បានចម្លង!' : 'ចម្លងសំណួរ'}</span>
                          </button>

                          <Link
                            href={`/ministry/${q.ministryId}?tab=${q.type === 'MULTIPLE_CHOICE' ? 'MCQ' : q.type === 'Q_AND_A' ? 'QA' : 'VOCABULARY'}&category=${encodeURIComponent(q.category)}`}
                            className="inline-flex items-center gap-1 text-[#094C72] hover:underline font-bold font-khmer"
                          >
                            <span>រៀនក្នុងក្រសួងនេះ</span>
                            <ExternalLink className="w-3.5 h-3.5" />
                          </Link>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            )}

            {/* 2. LESSONS & DOCUMENTS SECTION */}
            {(activeTab === 'ALL' || activeTab === 'LESSONS') && (
              <section className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <BookOpen className="w-5 h-5 text-[#094C72]" />
                    <h2 className="text-lg sm:text-xl font-bold text-slate-900 font-khmer">
                      មេរៀន និង ឯកសារយោង ({filteredLessons.length + filteredDocuments.length})
                    </h2>
                  </div>
                </div>

                {filteredLessons.length === 0 && filteredDocuments.length === 0 ? (
                  activeTab === 'LESSONS' && (
                    <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center text-slate-500 text-xs font-khmer">
                      មិនទាន់មានមេរៀន ឬឯកសារក្នុងបញ្ជីចូលចិត្តនៅឡើយទេ។
                    </div>
                  )
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Saved Lessons */}
                    {filteredLessons.map(l => (
                      <div 
                        key={l.id}
                        className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-2xs hover:shadow-md transition-all flex items-start justify-between gap-3"
                      >
                        <div className="flex items-start gap-3 min-w-0">
                          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center shrink-0 border border-amber-200">
                            <BookOpen className="w-5 h-5" />
                          </div>
                          <div className="min-w-0">
                            <span className="text-[10px] text-slate-500 font-khmer block truncate">
                              {l.ministryName}
                            </span>
                            <h4 className="font-bold text-sm sm:text-base text-slate-900 font-khmer truncate">
                              {l.category}
                            </h4>
                            <span className="text-xs text-blue-600 font-khmer">
                              {l.itemCount} សំណួរក្នុងផ្នែកនេះ
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            onClick={() => toggleFavorite(l.id)}
                            className="p-2 text-rose-500 hover:bg-rose-50 rounded-xl transition-colors"
                            title="ដកចេញពីបញ្ជីចូលចិត្ត"
                          >
                            <Heart className="w-4 h-4 fill-rose-500" />
                          </button>
                          <Link
                            href={`/ministry/${l.ministryId}?tab=MCQ&category=${encodeURIComponent(l.category)}`}
                            className="inline-flex items-center gap-1.5 px-3 py-2 bg-[#094C72] hover:bg-[#073652] text-white rounded-xl text-xs font-bold font-khmer transition-all shadow-xs"
                            title="បើកធ្វើតេស្តមេរៀននេះ"
                          >
                            <Play className="w-3.5 h-3.5 fill-current text-amber-300" />
                            <span>រៀនមេរៀន</span>
                          </Link>
                        </div>
                      </div>
                    ))}

                    {/* Saved PDF Documents */}
                    {filteredDocuments.map(doc => (
                      <div 
                        key={doc.id}
                        className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-2xs hover:shadow-md transition-all flex items-start justify-between gap-3"
                      >
                        <div className="flex items-start gap-3 min-w-0">
                          <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0 border border-rose-100">
                            <FileText className="w-5 h-5" />
                          </div>
                          <div className="min-w-0">
                            <span className="text-[10px] text-slate-500 font-khmer block truncate">
                              {doc.ministryName} • ឯកសារ PDF
                            </span>
                            <h4 className="font-bold text-xs sm:text-sm text-slate-900 font-khmer line-clamp-2">
                              {doc.title}
                            </h4>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            onClick={() => toggleFavorite(doc.id)}
                            className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-xl transition-colors"
                            title="ដកចេញពីបញ្ជីចូលចិត្ត"
                          >
                            <Heart className="w-4 h-4 fill-rose-500" />
                          </button>
                          <a
                            href={doc.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 bg-slate-50 hover:bg-blue-600 hover:text-white rounded-xl text-slate-600 transition-colors"
                            title="ទាញយក / បើកមើល"
                          >
                            <Download className="w-4 h-4" />
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            )}

            {/* 3. MINISTRIES SECTION */}
            {(activeTab === 'ALL' || activeTab === 'MINISTRIES') && filteredMinistries.length > 0 && (
              <section className="space-y-4">
                <div className="flex items-center gap-2">
                  <Globe className="w-5 h-5 text-[#094C72]" />
                  <h2 className="text-lg sm:text-xl font-bold text-slate-900 font-khmer">
                    ក្រសួងដែលបានរក្សាទុក ({filteredMinistries.length})
                  </h2>
                </div>

                <MinistryList 
                  ministries={filteredMinistries}
                  userProgress={userProgress}
                  onSelect={(m, act) => {
                    router.push(`/ministry/${m.id}${act ? `?tab=${act}` : ''}`);
                  }}
                />
              </section>
            )}

          </div>
        )}

      </div>

      {/* Interactive Practice Mode Modal for Favorite Questions */}
      {isPracticing && favoriteQuestions.length > 0 && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-3xl p-5 sm:p-8 max-w-2xl w-full shadow-2xl border border-slate-200 relative max-h-[92vh] overflow-y-auto space-y-6"
          >
            {/* Top Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-500" />
                <h3 className="font-bold text-slate-900 font-khmer text-base sm:text-lg">
                  ធ្វើតេស្តសំណួរចូលចិត្ត ({practiceIdx + 1}/{favoriteQuestions.length})
                </h3>
              </div>
              <button 
                onClick={() => setIsPracticing(false)}
                className="p-1.5 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {!practiceFinished ? (
              <div className="space-y-6">
                {/* Active Question Info */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-slate-500 font-khmer">
                    <span>{favoriteQuestions[practiceIdx].ministryName} • {favoriteQuestions[practiceIdx].category}</span>
                    <span className="font-bold text-[#094C72]">ពិន្ទុ: {practiceScore}/{practiceIdx + (practiceShowExp ? 1 : 0)}</span>
                  </div>
                  
                  {/* Progress bar */}
                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                    <div 
                      className="bg-[#094C72] h-full transition-all duration-300"
                      style={{ width: `${((practiceIdx + 1) / favoriteQuestions.length) * 100}%` }}
                    />
                  </div>

                  <h4 className="text-base sm:text-xl font-bold text-slate-900 font-khmer leading-relaxed pt-2 whitespace-pre-wrap break-words-khmer">
                    {favoriteQuestions[practiceIdx].question}
                  </h4>
                </div>

                {/* Multiple Choice Options */}
                {favoriteQuestions[practiceIdx].options && (
                  <div className="grid grid-cols-1 gap-2.5">
                    {Object.entries(favoriteQuestions[practiceIdx].options!).map(([key, val]) => {
                      const isSelected = practiceAnswer === key;
                      const isCorrect = practiceShowExp && key === favoriteQuestions[practiceIdx].correctAnswer;
                      const isWrong = practiceShowExp && isSelected && !isCorrect;

                      return (
                        <button
                          key={key}
                          disabled={practiceShowExp}
                          onClick={() => handlePracticeSelect(key)}
                          className={`w-full p-3.5 sm:p-4 rounded-xl text-left border-2 flex items-center justify-between gap-3 transition-all font-khmer text-xs sm:text-sm cursor-pointer ${
                            !practiceShowExp && 'bg-white border-slate-200 hover:border-[#094C72] hover:bg-slate-50'
                          } ${
                            isCorrect && 'bg-emerald-50 border-emerald-500 text-emerald-900 font-bold'
                          } ${
                            isWrong && 'bg-rose-50 border-rose-500 text-rose-900 font-bold'
                          } ${
                            practiceShowExp && !isCorrect && !isWrong && 'opacity-60 bg-slate-50 border-slate-200'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <span className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center font-bold text-xs">
                              {key}
                            </span>
                            <span className="break-words-khmer">{val}</span>
                          </div>
                          {isCorrect && <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Direct Answer for Q&A or Explanation */}
                {favoriteQuestions[practiceIdx].answer && (
                  <div className="p-4 rounded-xl bg-blue-50 border border-blue-200 text-xs sm:text-sm font-khmer">
                    <span className="font-bold text-blue-900 block mb-1">ចម្លើយ៖</span>
                    <p className="whitespace-pre-wrap leading-relaxed">{favoriteQuestions[practiceIdx].answer}</p>
                  </div>
                )}

                {practiceShowExp && favoriteQuestions[practiceIdx].explanation && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs font-khmer text-slate-700"
                  >
                    <span className="font-bold text-amber-900 block mb-1">💡 ពន្យល់៖</span>
                    <p className="italic leading-relaxed">{favoriteQuestions[practiceIdx].explanation}</p>
                  </motion.div>
                )}

                {/* Footer Controls */}
                <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                  <Button
                    onClick={handlePracticeNext}
                    className="bg-[#094C72] text-white hover:bg-[#073956] font-khmer font-bold text-xs sm:text-sm px-6 py-2.5 rounded-xl"
                  >
                    {practiceIdx < favoriteQuestions.length - 1 ? 'សំណួរបន្ទាប់' : 'បញ្ចប់ការធ្វើតេស្ត'}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 space-y-4">
                <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-10 h-10" />
                </div>
                <h4 className="text-xl font-black text-slate-900 font-khmer">អបអរសាទរ! អ្នកបានបញ្ចប់សំណួរចូលចិត្ត</h4>
                <p className="text-sm text-slate-600 font-khmer">
                  ពិន្ទុរបស់អ្នក៖ <span className="font-black text-[#094C72] text-lg">{practiceScore}</span> / {favoriteQuestions.length}
                </p>
                <div className="pt-4 flex items-center justify-center gap-3">
                  <Button
                    onClick={startPractice}
                    className="bg-[#094C72] text-white font-khmer font-bold text-xs px-5 py-2.5 rounded-xl"
                  >
                    ធ្វើតេស្តឡើងវិញ
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setIsPracticing(false)}
                    className="border-slate-200 font-khmer font-bold text-xs px-5 py-2.5 rounded-xl"
                  >
                    បិទ
                  </Button>
                </div>
              </div>
            )}
          </motion.div>
        </div>
      )}
    </main>
  );
}
