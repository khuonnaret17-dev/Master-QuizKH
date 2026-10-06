'use client';



import { useState, useMemo, useEffect } from 'react';
import { useFirebase } from '@/lib/FirebaseProvider';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, XCircle, ArrowLeft, RotateCcw, Trophy, Brain, Heart, Play, PlayCircle, Send, ExternalLink, Lock, Crown, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { DAILY_FREE_QUESTIONS_LIMIT, TELEGRAM_HANDLE, TELEGRAM_UNLOCK_URL } from '@/lib/daily-usage';
import { AnswerReviewList } from '@/components/AnswerReviewList';
import { Quiz } from '@/lib/types';

export default function QuizPage() {
  const { 
    ministries, 
    loading, 
    authLoading, 
    userRole, 
    isPremium, 
    favorites, 
    toggleFavorite,
    dailyQuestionsRemaining, 
    hasReachedDailyLimit, 
    recordDailyQuestion 
  } = useFirebase();

  const isStandardAccount = !isPremium && userRole !== 'ADMIN';
  const [currentStep, setCurrentStep] = useState(0);
  const [score, setScore] = useState(0);
  const [showResult, setShowResult] = useState(false);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [quizSeed, setQuizSeed] = useState(0);
  const [hasSavedProgress, setHasSavedProgress] = useState(false);
  const [userAnswers, setUserAnswers] = useState<{ [key: number]: number }>({});

  // Restore saved quick quiz if available
  useEffect(() => {
    try {
      const raw = localStorage.getItem('vignasa_quick_quiz_progress');
      if (raw) {
        const data = JSON.parse(raw);
        if (data && typeof data.step === 'number' && data.step > 0 && !data.finished) {
          setHasSavedProgress(true);
        }
      }
    } catch {
      // ignore
    }
  }, []);

  const resumeSavedQuiz = () => {
    try {
      const raw = localStorage.getItem('vignasa_quick_quiz_progress');
      if (raw) {
        const data = JSON.parse(raw);
        setCurrentStep(data.step || 0);
        setScore(data.score || 0);
        setQuizSeed(data.seed || 0);
        setSelectedOption(null);
        setIsAnswered(false);
        setHasSavedProgress(false);
      }
    } catch {
      setHasSavedProgress(false);
    }
  };

  const discardSavedQuiz = () => {
    try {
      localStorage.removeItem('vignasa_quick_quiz_progress');
    } catch {
      // ignore
    }
    setHasSavedProgress(false);
    resetQuiz();
  };

  // Generate a quiz from ministries data - 10 questions for a complete daily test session
  const quizzes = useMemo(() => {
    if (ministries.length < 4 || quizSeed < 0) return [];
    
    // Create 10 questions from ministries for the daily test
    return ministries.slice(0, 10).map((m, i) => {
      const isKhmerQuestion = i % 2 === 0;
      const options = [m, ...ministries.filter(x => x.id !== m.id).sort(() => 0.5 - Math.random()).slice(0, 3)]
        .sort(() => 0.5 - Math.random());
      
      return {
        id: `quick_q_${m.id}`,
        ministryId: m.id,
        question: isKhmerQuestion 
          ? `តើ " ${m.khmerName} " មានឈ្មោះជាភាសាអង់គ្លេសថាអ្វី?`
          : `Which ministry is responsible for: "${m.description}"?`,
        options: options.map(o => isKhmerQuestion ? o.name : o.khmerName),
        correctIndex: options.findIndex(o => o.id === m.id),
        explanation: `${m.khmerName} is ${m.name}.`
      };
    });
  }, [ministries, quizSeed]);

  const handleAnswer = (index: number) => {
    if (isAnswered) return;
    if (isStandardAccount) {
      recordDailyQuestion();
    }
    setSelectedOption(index);
    setUserAnswers(prev => ({ ...prev, [currentStep]: index }));
    setIsAnswered(true);
    const newScore = index === quizzes[currentStep]?.correctIndex ? score + 1 : score;
    if (index === quizzes[currentStep]?.correctIndex) {
      setScore(newScore);
    }
    try {
      localStorage.setItem('vignasa_quick_quiz_progress', JSON.stringify({
        step: currentStep,
        score: newScore,
        seed: quizSeed,
        finished: false
      }));
    } catch {
      // ignore
    }
  };

  const nextQuestion = () => {
    if (currentStep < quizzes.length - 1) {
      const nextStep = currentStep + 1;
      setCurrentStep(nextStep);
      setSelectedOption(null);
      setIsAnswered(false);
      try {
        localStorage.setItem('vignasa_quick_quiz_progress', JSON.stringify({
          step: nextStep,
          score,
          seed: quizSeed,
          finished: false
        }));
      } catch {
        // ignore
      }
    } else {
      setShowResult(true);
      try {
        localStorage.removeItem('vignasa_quick_quiz_progress');
      } catch {
        // ignore
      }
    }
  };

  const resetQuiz = () => {
    setCurrentStep(0);
    setScore(0);
    setShowResult(false);
    setSelectedOption(null);
    setIsAnswered(false);
    setUserAnswers({});
    setQuizSeed(s => s + 1);
    try {
      localStorage.removeItem('vignasa_quick_quiz_progress');
    } catch {
      // ignore
    }
  };

  const isDailyLimitBlocked = isStandardAccount && hasReachedDailyLimit;

  if (loading || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-transparent text-slate-700 font-bold">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-500"></div>
          <p className="text-sm">កំពុងផ្ទៀងផ្ទាត់សមាជិកភាព...</p>
        </div>
      </div>
    );
  }

  if (isDailyLimitBlocked) {
    return (
      <div className="min-h-screen bg-transparent tma-top-spacing pt-20 sm:pt-24 md:pt-28 pb-16 px-4 flex items-center justify-center">
        <div className="max-w-md w-full">
          <header className="mb-6">
            <Link href="/" className="inline-flex items-center text-slate-500 hover:text-slate-800 transition-colors font-khmer text-xs sm:text-sm font-bold">
              <ArrowLeft className="w-4 h-4 mr-2" />
              ត្រឡប់ទៅដើមវិញ (Home)
            </Link>
          </header>

          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="p-8 text-center rounded-[2.5rem] bg-white border-2 border-amber-400/40 shadow-2xl relative overflow-hidden"
          >
            <div className="w-20 h-20 mx-auto rounded-3xl bg-amber-50 flex items-center justify-center text-amber-600 border border-amber-200 mb-5 shadow-inner">
              <Lock className="w-10 h-10" />
            </div>

            <div className="space-y-3 mb-6">
              <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-amber-100 border border-amber-200 text-amber-800 text-xs font-bold uppercase tracking-wider font-khmer">
                <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                <span>កូតាឥតគិតថ្លៃ ១០ សំណួរ/ថ្ងៃ បានពេញហើយ</span>
              </div>

              <h2 className="text-2xl font-black text-slate-900 leading-tight font-khmer">
                អ្នកបានបញ្ចប់កូតាធ្វើតេស្តប្រចាំថ្ងៃ!
              </h2>

              <p className="text-sm text-slate-600 leading-relaxed font-khmer">
                គណនីធម្មតាអាចធ្វើតេស្តចំនួន <span className="font-bold text-[#094C72]">១០ សំណួរក្នុងមួយថ្ងៃ</span>។ អ្នកបានឆ្លើយគ្រប់ចំនួន {DAILY_FREE_QUESTIONS_LIMIT} សំណួរ សម្រាប់ថ្ងៃនេះរួចរាល់ហើយ។
              </p>
            </div>

            {/* Telegram Unlock Box */}
            <div className="p-5 bg-gradient-to-br from-[#0088cc]/10 via-blue-50/80 to-indigo-50/60 rounded-3xl border-2 border-[#0088cc]/30 text-left space-y-3 mb-6 shadow-sm">
              <div className="flex items-center gap-2.5 text-[#0088cc] font-black text-sm font-khmer">
                <Send className="w-4 h-4 -rotate-12" />
                <span>ដោះសោការធ្វើតេស្តពេញលេញ (Full Access)</span>
              </div>
              <p className="text-xs text-slate-600 font-khmer leading-relaxed">
                ដើម្បីដោះសោការធ្វើតេស្តគ្រប់វិញ្ញាសាដោយគ្មានដែនកំណត់សំណួរ សូមទំនាក់ទំនងមកកាន់ Telegram៖
              </p>
              <a
                href={TELEGRAM_UNLOCK_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 w-full py-3.5 px-4 bg-gradient-to-r from-[#0088cc] to-[#0077b5] hover:from-[#0077b5] hover:to-[#00669c] text-white font-black rounded-xl shadow-md transition-all text-sm font-khmer group cursor-pointer"
              >
                <Send className="w-4 h-4 group-hover:scale-110 transition-transform" />
                <span>ទាក់ទង Telegram {TELEGRAM_HANDLE} ដើម្បីដោះសោ</span>
                <ExternalLink className="w-3.5 h-3.5 opacity-70" />
              </a>
            </div>

            <Link
              href="/"
              className="inline-block w-full py-3 text-slate-500 hover:text-slate-800 font-bold text-xs font-khmer border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
            >
              ត្រឡប់ទៅទំព័រដើម
            </Link>
          </motion.div>
        </div>
      </div>
    );
  }

  if (quizzes.length === 0) {
    return (
      <div className="min-h-screen bg-transparent flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
          <Brain className="w-12 h-12 text-slate-400 mx-auto mb-4" />
          <h2 className="text-xl font-black text-slate-800 mb-2 font-khmer">មិនទាន់មានទិន្នន័យគ្រប់គ្រាន់សម្រាប់វិញ្ញាសាតេស្តទេ</h2>
          <p className="text-sm text-slate-500 mb-6 font-khmer">ត្រូវការទិន្នន័យស្ថាប័នយ៉ាងតិច ៤ ដើម្បីបង្កើតសំណួរពហុជ្រើសរើស។</p>
          <Link href="/" className="inline-flex items-center gap-2 px-6 py-2.5 bg-[#094C72] text-white font-bold rounded-xl text-xs font-khmer hover:bg-[#073652] transition-colors">
            <ArrowLeft className="w-4 h-4" />
            ត្រឡប់ទៅទំព័រដើម
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-transparent tma-top-spacing pt-20 sm:pt-24 md:pt-28 pb-16 sm:pb-24 px-4 sm:px-8 md:px-12 overflow-x-hidden">
      <div className="max-w-2xl mx-auto">
        <header className="mb-8 sm:mb-12 flex items-center justify-between gap-3 flex-wrap">
          <Link href="/" className="inline-flex items-center text-slate-600 hover:text-slate-900 transition-all text-xs sm:text-sm font-bold bg-white px-4 py-2 sm:px-5 sm:py-2.5 rounded-2xl border border-slate-200 shadow-2xs cursor-pointer font-khmer">
            <ArrowLeft className="w-4 h-4 mr-1.5" />
            ទំព័រដើម (Home)
          </Link>
          <div className="flex items-center gap-2.5 flex-wrap">
            {/* Daily Quota Badge */}
            {isStandardAccount ? (
              <div className="bg-amber-50 px-3.5 py-2 sm:px-4 sm:py-2.5 rounded-2xl border border-amber-200 shadow-2xs flex items-center gap-1.5 text-xs text-amber-900 font-khmer">
                <span className="font-bold">កូតាថ្ងៃនេះ៖</span>
                <span>{Math.max(0, dailyQuestionsRemaining)}/{DAILY_FREE_QUESTIONS_LIMIT}</span>
                <a
                  href={TELEGRAM_UNLOCK_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#0088cc] hover:text-[#006699] font-black underline ml-1"
                >
                  ដោះសោ
                </a>
              </div>
            ) : (
              <div className="bg-emerald-50 px-3.5 py-2 sm:px-4 sm:py-2.5 rounded-2xl border border-emerald-200 shadow-2xs flex items-center gap-1.5 text-xs text-emerald-800 font-khmer">
                <Crown className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                <span className="font-bold">Premium</span>
              </div>
            )}

            <Link 
              href="/favorites"
              className="bg-white px-3.5 py-2 sm:px-4.5 sm:py-2.5 rounded-2xl border border-slate-200 shadow-2xs flex items-center gap-2 text-xs sm:text-sm font-bold text-slate-700 hover:text-rose-600 transition-all cursor-pointer"
              title="មើលបញ្ជីចូលចិត្ត"
            >
              <Heart className={`w-4 h-4 ${favorites.length > 0 ? 'text-rose-500 fill-rose-500' : 'text-slate-400'}`} />
              <span className="hidden sm:inline font-khmer">ចូលចិត្ត</span>
              {favorites.length > 0 && (
                <span className="px-2 py-0.5 bg-rose-500 text-white rounded-full text-[10px] font-bold shadow-xs">
                  {favorites.length}
                </span>
              )}
            </Link>
            <div className="bg-white px-4 sm:px-5 py-2 sm:py-2.5 rounded-2xl border border-slate-200 shadow-2xs flex items-center gap-2">
              <Trophy className="w-4 h-4 text-amber-500" />
              <span className="font-bold text-slate-800 text-xs sm:text-sm">Score: {score}</span>
            </div>
          </div>
        </header>

        {hasSavedProgress && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 p-4 rounded-2xl bg-gradient-to-r from-[#094C72] to-[#1565C0] text-white flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-lg border border-amber-400/40"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-400/20 text-amber-300 flex items-center justify-center shrink-0">
                <PlayCircle className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-amber-300 uppercase tracking-wider">
                  រកឃើញវិញ្ញាសាពីមុន • RESUME TEST
                </p>
                <p className="text-xs sm:text-sm font-medium text-white">
                  តើអ្នកចង់បន្តធ្វើតេស្តដែលមិនទាន់ចប់ទេ?
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <button
                onClick={resumeSavedQuiz}
                className="flex-1 sm:flex-initial px-3.5 py-2 bg-gradient-to-r from-[#E2BD55] to-[#D4AF37] hover:from-[#d4af37] hover:to-[#c59d2a] text-[#094C72] font-black rounded-xl text-xs transition-colors font-khmer shadow-sm flex items-center justify-center gap-1"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>បន្តធ្វើតេស្ត (Resume)</span>
              </button>
              <button
                onClick={discardSavedQuiz}
                className="px-3 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs transition-colors font-khmer"
              >
                ចាប់ផ្ដើមថ្មី
              </button>
            </div>
          </motion.div>
        )}

        <AnimatePresence mode="wait">
          {!showResult ? (
            <motion.div
              key="quiz"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.05 }}
              className="bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-8 shadow-xl border border-slate-100 overflow-hidden"
            >
              <div className="mb-6 sm:mb-8">
                <span className="text-[10px] sm:text-xs font-bold text-blue-600 bg-blue-50 px-2.5 sm:px-3 py-1 rounded-full uppercase tracking-widest">
                  Question {currentStep + 1} of {quizzes.length}
                </span>
                <div className="flex justify-between items-start gap-3 sm:gap-4">
                  <h2 className="text-lg sm:text-2xl font-bold text-slate-900 mt-3 sm:mt-4 leading-tight break-words-khmer">
                    {quizzes[currentStep].question}
                  </h2>
                  <button 
                    onClick={() => toggleFavorite(quizzes[currentStep].id || `quick_q_${quizzes[currentStep].ministryId}`)}
                    className={`mt-3 sm:mt-4 px-2.5 py-1.5 rounded-full transition-all shrink-0 flex items-center gap-1.5 text-xs font-bold font-khmer border cursor-pointer ${
                      favorites.includes(quizzes[currentStep].id || `quick_q_${quizzes[currentStep].ministryId}`) 
                        ? 'text-rose-600 bg-rose-50 border-rose-200 shadow-2xs' 
                        : 'text-slate-500 bg-white border-slate-200 hover:text-rose-500 hover:border-rose-200'
                    }`}
                    title="រក្សាទុកក្នុងបញ្ជីសំណួរចូលចិត្ត"
                  >
                    <Heart className={`w-4 h-4 ${favorites.includes(quizzes[currentStep].id || `quick_q_${quizzes[currentStep].ministryId}`) ? 'fill-rose-500 text-rose-500' : 'text-slate-400'}`} />
                    <span className="hidden sm:inline">ចូលចិត្ត</span>
                  </button>
                </div>
              </div>

              <div className="grid gap-4">
                {quizzes[currentStep].options.map((option, index) => {
                   const isCorrect = index === quizzes[currentStep].correctIndex;
                   const isSelected = selectedOption === index;
                   
                   let buttonClass = "w-full p-4 rounded-2xl border-2 text-left transition-all relative overflow-hidden ";
                   if (!isAnswered) {
                     buttonClass += "border-slate-100 hover:border-blue-200 hover:bg-blue-50/30 text-slate-700 font-medium";
                   } else if (isCorrect) {
                     buttonClass += "border-emerald-500 bg-emerald-50 text-emerald-900 font-bold";
                   } else if (isSelected && !isCorrect) {
                     buttonClass += "border-red-500 bg-red-50 text-red-900 font-bold";
                   } else {
                     buttonClass += "border-slate-50 bg-slate-50 text-slate-400";
                   }

                   return (
                     <button
                       key={index}
                       onClick={() => handleAnswer(index)}
                       disabled={isAnswered}
                       className={buttonClass}
                     >
                       <span className="relative z-10 flex items-center justify-between">
                         {option}
                         {isAnswered && isCorrect && <CheckCircle2 className="w-5 h-5 text-emerald-500" />}
                         {isAnswered && isSelected && !isCorrect && <XCircle className="w-5 h-5 text-red-500" />}
                       </span>
                     </button>
                   );
                })}
              </div>

              {isAnswered && (
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-8 pt-8 border-t border-slate-100"
                >
                  <p className="text-slate-500 text-sm mb-6 flex items-start gap-2 italic">
                    <Brain className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
                    {quizzes[currentStep].explanation}
                  </p>
                  <button 
                    onClick={nextQuestion}
                    className="w-full py-4 bg-slate-900 text-white rounded-2xl font-bold hover:bg-slate-800 transition-all shadow-lg shadow-slate-900/20"
                  >
                    {currentStep === quizzes.length - 1 ? 'Finish' : 'Next Question'}
                  </button>
                </motion.div>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="result"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white rounded-3xl p-12 shadow-xl border border-slate-100 text-center"
            >
              <div className="w-24 h-24 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-6">
                <Trophy className="w-12 h-12 text-amber-500" />
              </div>
              <h2 className="text-3xl font-black text-slate-900 mb-2 font-khmer">បញ្ចប់ការធ្វើតេស្ត!</h2>
              <p className="text-slate-500 mb-6 font-khmer">អ្នកឆ្លើយត្រូវ {score} នៃ {quizzes.length} សំណួរ។</p>

              {/* Answer Review Section */}
              <div className="mb-6 text-left">
                <AnswerReviewList
                  items={quizzes.map((q, idx) => {
                    const pickedIdx = userAnswers[idx];
                    const optionKeys = ['a', 'b', 'c', 'd'];
                    const userPickKey = pickedIdx !== undefined ? optionKeys[pickedIdx] : undefined;
                    const correctKey = optionKeys[q.correctIndex];
                    const isCorrect = pickedIdx === q.correctIndex;

                    const quizObj: Quiz = {
                      id: q.id,
                      category: 'ទូទៅ',
                      type: 'MULTIPLE_CHOICE',
                      question: q.question,
                      options: {
                        a: q.options[0] || '',
                        b: q.options[1] || '',
                        c: q.options[2] || '',
                        d: q.options[3] || ''
                      },
                      correctAnswer: correctKey,
                      explanation: q.explanation
                    };

                    return {
                      questionNumber: idx + 1,
                      quiz: quizObj,
                      userAnswer: userPickKey,
                      isCorrect
                    };
                  })}
                  quizType="MULTIPLE_CHOICE"
                  title="ផ្ទៀងផ្ទាត់សំណួរ និងចម្លើយទាំង ១០ នៃតេស្តនេះ"
                  subtitle="ពិនិត្យមើលចម្លើយរបស់អ្នក និងចម្លើយត្រឹមត្រូវ"
                />
              </div>
              
              {/* Telegram Unlock Box */}
              {isStandardAccount && (
                <div className="p-5 bg-gradient-to-br from-[#0088cc]/10 via-blue-50/80 to-indigo-50/60 rounded-3xl border-2 border-[#0088cc]/30 text-left space-y-3 mb-6 shadow-sm">
                  <div className="flex items-center gap-2.5 text-[#0088cc] font-black text-sm font-khmer">
                    <Send className="w-4 h-4 -rotate-12" />
                    <span>ដោះសោការធ្វើតេស្តពេញលេញគ្មានដែនកំណត់</span>
                  </div>
                  <p className="text-xs text-slate-600 font-khmer leading-relaxed">
                    គណនីធម្មតាអាចធ្វើតេស្ត ១០ សំណួរក្នុងមួយថ្ងៃ។ ដើម្បីដោះសោការធ្វើតេស្តពេញលេញគ្រប់វិញ្ញាសាដោយគ្មានដែនកំណត់ សូមទំនាក់ទំនងតាមរយៈ Telegram៖
                  </p>
                  <a
                    href={TELEGRAM_UNLOCK_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-2 w-full py-3.5 px-4 bg-gradient-to-r from-[#0088cc] to-[#0077b5] hover:from-[#0077b5] hover:to-[#00669c] text-white font-black rounded-xl shadow-md transition-all text-sm font-khmer group cursor-pointer"
                  >
                    <Send className="w-4 h-4 group-hover:scale-110 transition-transform" />
                    <span>ទាក់ទង Telegram {TELEGRAM_HANDLE} ដើម្បីដោះសោ</span>
                    <ExternalLink className="w-3.5 h-3.5 opacity-70" />
                  </a>
                </div>
              )}

              <div className="flex gap-4">
                <button 
                  onClick={resetQuiz}
                  className="flex-1 py-4 bg-slate-100 text-slate-700 rounded-2xl font-bold hover:bg-slate-200 transition-all flex items-center justify-center gap-2"
                >
                  <RotateCcw className="w-5 h-5" />
                  Try Again
                </button>
                <Link 
                  href="/"
                  className="flex-1 py-4 bg-blue-600 text-white rounded-2xl font-bold hover:bg-blue-700 transition-all flex items-center justify-center"
                >
                  Go Home
                </Link>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
