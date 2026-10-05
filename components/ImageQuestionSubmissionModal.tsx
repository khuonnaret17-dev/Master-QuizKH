'use client';

import React, { useState, useRef, useEffect, useId } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  Upload, 
  Sparkles, 
  MapPin, 
  CheckCircle2, 
  AlertCircle, 
  Building2, 
  BookOpen, 
  Layers, 
  Plus, 
  Trash2, 
  HelpCircle,
  FileImage,
  RefreshCw,
  FolderPlus,
  ArrowRight,
  ListOrdered
} from 'lucide-react';
import { Ministry } from '@/lib/types';
import { db } from '@/lib/firebase';
import { doc, setDoc } from 'firebase/firestore';

export interface ExtractedQuestionItem {
  id: string;
  type: 'mcq' | 'qa';
  question: string;
  options?: string[];
  correctIndex?: number;
  answer?: string;
  explanation?: string;
}

export interface PlacementLocation {
  ministryId: string;
  type: 'mcq' | 'qa';
  categoryName: string;
  subCategoryName?: string;
  positionMode: 'END' | 'START' | 'SPECIFIC';
  specificIndex: number; // 1-based index for user
}

interface ImageQuestionSubmissionModalProps {
  isOpen: boolean;
  onClose: () => void;
  ministries: Ministry[];
  initialMinistryId?: string;
  initialType?: 'mcq' | 'qa';
  initialCategoryName?: string;
  initialSubCategoryName?: string;
  onQuestionsPlaced?: (targetMinistryId: string, updatedMinistry: Ministry) => void;
}

export default function ImageQuestionSubmissionModal({
  isOpen,
  onClose,
  ministries,
  initialMinistryId,
  initialType = 'mcq',
  initialCategoryName,
  initialSubCategoryName,
  onQuestionsPlaced,
}: ImageQuestionSubmissionModalProps) {
  const fileInputId = useId();
  // Image states
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedMimeType, setSelectedMimeType] = useState<string>('image/jpeg');
  const [imageFileName, setImageFileName] = useState<string>('');
  const [isExtracting, setIsExtracting] = useState<boolean>(false);
  const [extractionError, setExtractionError] = useState<string | null>(null);

  // Extracted items
  const [extractedItems, setExtractedItems] = useState<ExtractedQuestionItem[]>([]);
  const [suggestedCategoryFromAI, setSuggestedCategoryFromAI] = useState<string>('');

  // Location specification
  const [targetMinistryId, setTargetMinistryId] = useState<string>(initialMinistryId || (ministries[0]?.id || ''));
  const [targetType, setTargetType] = useState<'mcq' | 'qa'>(initialType);
  const [targetCategory, setTargetCategory] = useState<string>(initialCategoryName || '');
  const [isCreatingNewCategory, setIsCreatingNewCategory] = useState<boolean>(false);
  const [newCategoryName, setNewCategoryName] = useState<string>('');
  const [targetSubCategory, setTargetSubCategory] = useState<string>(initialSubCategoryName || '');
  const [isCreatingNewSubCategory, setIsCreatingNewSubCategory] = useState<boolean>(false);
  const [newSubCategoryName, setNewSubCategoryName] = useState<string>('');
  const [positionMode, setPositionMode] = useState<'END' | 'START' | 'SPECIFIC'>('END');
  const [specificIndex, setSpecificIndex] = useState<number>(1);

  // Saving state
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Sync initial props
  useEffect(() => {
    if (initialMinistryId) setTargetMinistryId(initialMinistryId);
    if (initialType) setTargetType(initialType);
    if (initialCategoryName) {
      setTargetCategory(initialCategoryName);
      setIsCreatingNewCategory(false);
    }
    if (initialSubCategoryName) {
      setTargetSubCategory(initialSubCategoryName);
      setIsCreatingNewSubCategory(false);
    }
  }, [initialMinistryId, initialType, initialCategoryName, initialSubCategoryName, isOpen]);

  // Selected ministry object
  const currentMinistry = ministries.find((m) => m.id === targetMinistryId);

  // Available categories in current ministry based on type
  const availableCategories = React.useMemo(() => {
    if (!currentMinistry) return [];
    if (targetType === 'mcq') {
      return (currentMinistry.mcqs || []).map((c) => c.category).filter(Boolean);
    } else {
      return (currentMinistry.shortAnswers || []).map((c) => c.category).filter(Boolean);
    }
  }, [currentMinistry, targetType]);

  // Set default category if not selected or invalid
  useEffect(() => {
    if (!isCreatingNewCategory) {
      if (availableCategories.length > 0 && !availableCategories.includes(targetCategory)) {
        setTargetCategory(availableCategories[0]);
      } else if (availableCategories.length === 0) {
        setIsCreatingNewCategory(true);
        setNewCategoryName(suggestedCategoryFromAI || 'វិញ្ញាសាថ្មី');
      }
    }
  }, [availableCategories, targetCategory, isCreatingNewCategory, suggestedCategoryFromAI]);

  // Available sub-categories in current category
  const availableSubCategories = React.useMemo(() => {
    if (!currentMinistry || !targetCategory || isCreatingNewCategory) return [];
    if (targetType === 'mcq') {
      const cat = (currentMinistry.mcqs || []).find((c) => c.category === targetCategory);
      return (cat?.subCategories || []).map((s) => s.category).filter(Boolean);
    } else {
      const cat = (currentMinistry.shortAnswers || []).find((c) => c.category === targetCategory);
      return (cat?.subCategories || []).map((s) => s.category).filter(Boolean);
    }
  }, [currentMinistry, targetCategory, targetType, isCreatingNewCategory]);

  // Count items currently in target location for position index guidance
  const currentItemCountAtLocation = React.useMemo(() => {
    if (!currentMinistry || !targetCategory || isCreatingNewCategory) return 0;
    if (targetType === 'mcq') {
      const cat = (currentMinistry.mcqs || []).find((c) => c.category === targetCategory);
      if (!cat) return 0;
      if (targetSubCategory && !isCreatingNewSubCategory) {
        const sub = (cat.subCategories || []).find((s) => s.category === targetSubCategory);
        return sub?.items?.length || 0;
      }
      return cat.items?.length || 0;
    } else {
      const cat = (currentMinistry.shortAnswers || []).find((c) => c.category === targetCategory);
      if (!cat) return 0;
      if (targetSubCategory && !isCreatingNewSubCategory) {
        const sub = (cat.subCategories || []).find((s) => s.category === targetSubCategory);
        return sub?.items?.length || 0;
      }
      return cat.items?.length || 0;
    }
  }, [currentMinistry, targetCategory, targetSubCategory, targetType, isCreatingNewCategory, isCreatingNewSubCategory]);

  // Reset states on modal open/close
  const handleClose = () => {
    setSelectedImage(null);
    setExtractedItems([]);
    setExtractionError(null);
    setSaveSuccessMessage(null);
    setIsExtracting(false);
    setIsSaving(false);
    onClose();
  };

  // Handle image upload from file or paste
  const processImageFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      setExtractionError('សូមជ្រើសរើសឯកសារជារូបភាព (PNG, JPG, WebP, etc.)');
      return;
    }
    setImageFileName(file.name);
    setSelectedMimeType(file.type);
    setExtractionError(null);
    setSaveSuccessMessage(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      setSelectedImage(result);
    };
    reader.readAsDataURL(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processImageFile(file);
    }
  };

  // Clipboard paste listener
  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith('image/')) {
        const file = items[i].getAsFile();
        if (file) {
          processImageFile(file);
          break;
        }
      }
    }
  };

  // Call Gemini AI Image Extraction API
  const handleExtractFromImage = async () => {
    if (!selectedImage) {
      setExtractionError('សូមបញ្ចូលរូបភាពសំណួរជាមុនសិន!');
      return;
    }

    setIsExtracting(true);
    setExtractionError(null);
    setSaveSuccessMessage(null);

    try {
      const res = await fetch('/api/extract-quiz-from-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: selectedImage,
          mimeType: selectedMimeType || 'image/jpeg',
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'បរាជ័យក្នុងការវិភាគរូបភាព');
      }

      const items = data.data?.items || [];
      if (!items || items.length === 0) {
        throw new Error('ពុំបានរកឃើញសំណួរនៅក្នុងរូបភាពនេះឡើយ។ សូមសាកល្បងរូបភាពច្បាស់ជាងនេះ។');
      }

      const formatted: ExtractedQuestionItem[] = items.map((it: { type?: string; question?: string; options?: string[]; correctIndex?: number; answer?: string; explanation?: string }, idx: number) => ({
        id: `extracted_${Date.now()}_${idx}`,
        type: it.type === 'qa' ? 'qa' : 'mcq',
        question: it.question || '',
        options: it.options && it.options.length > 0 ? it.options : ['', '', '', ''],
        correctIndex: typeof it.correctIndex === 'number' ? it.correctIndex : 0,
        answer: it.answer || '',
        explanation: it.explanation || '',
      }));

      setExtractedItems(formatted);

      // Auto adjust target type based on primary extracted type
      if (formatted[0]?.type) {
        setTargetType(formatted[0].type);
      }

      if (data.data?.suggestedCategory) {
        setSuggestedCategoryFromAI(data.data.suggestedCategory);
        if (isCreatingNewCategory || availableCategories.length === 0) {
          setNewCategoryName(data.data.suggestedCategory);
        }
      }
    } catch (err: unknown) {
      console.error('Extraction error:', err);
      setExtractionError(err instanceof Error ? err.message : 'មានបញ្ហាក្នុងដំណើរការវិភាគរូបភាព');
    } finally {
      setIsExtracting(false);
    }
  };

  // Manual editing helpers for extracted items
  const updateExtractedItem = (index: number, updated: Partial<ExtractedQuestionItem>) => {
    setExtractedItems((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], ...updated };
      return copy;
    });
  };

  const removeExtractedItem = (index: number) => {
    setExtractedItems((prev) => prev.filter((_, i) => i !== index));
  };

  const addNewQuestionItem = () => {
    setExtractedItems((prev) => [
      ...prev,
      {
        id: `manual_${Date.now()}`,
        type: targetType,
        question: 'សំណួរថ្មី',
        options: targetType === 'mcq' ? ['', '', '', ''] : undefined,
        correctIndex: 0,
        answer: targetType === 'qa' ? '' : undefined,
        explanation: '',
      },
    ]);
  };

  // Submit and Place Question(s) into Specified Location
  const handleSaveAndPlace = async () => {
    if (!currentMinistry) {
      setExtractionError('សូមជ្រើសរើសស្ថាប័ន ឬ វិញ្ញាសាគោលដៅ!');
      return;
    }
    if (extractedItems.length === 0) {
      setExtractionError('មិនមានសំណួរសម្រាប់ដាក់បញ្ចូលឡើយ!');
      return;
    }

    const finalCategoryName = (isCreatingNewCategory ? newCategoryName.trim() : targetCategory.trim()) || 'វិញ្ញាសាទូទៅ';
    const finalSubCategoryName = targetSubCategory && targetSubCategory !== '__NONE__'
      ? (isCreatingNewSubCategory ? newSubCategoryName.trim() : targetSubCategory.trim())
      : undefined;

    setIsSaving(true);
    setExtractionError(null);
    setSaveSuccessMessage(null);

    try {
      const ministryCopy: Ministry = JSON.parse(JSON.stringify(currentMinistry));

      if (targetType === 'mcq') {
        if (!ministryCopy.mcqs) ministryCopy.mcqs = [];

        // Format items to insert
        const newMcqItems = extractedItems.map((item) => ({
          question: item.question,
          options: item.options || ['', '', '', ''],
          correctIndex: item.correctIndex ?? 0,
          explanation: item.explanation || '',
        }));

        // Find or create category
        let catIndex = ministryCopy.mcqs.findIndex((c) => c.category === finalCategoryName);
        if (catIndex === -1) {
          ministryCopy.mcqs.push({
            category: finalCategoryName,
            items: [],
            subCategories: [],
          });
          catIndex = ministryCopy.mcqs.length - 1;
        }

        const targetCat = ministryCopy.mcqs[catIndex];

        if (finalSubCategoryName) {
          if (!targetCat.subCategories) targetCat.subCategories = [];
          let subIndex = targetCat.subCategories.findIndex((s) => s.category === finalSubCategoryName);
          if (subIndex === -1) {
            targetCat.subCategories.push({
              category: finalSubCategoryName,
              items: [],
            });
            subIndex = targetCat.subCategories.length - 1;
          }
          const targetSub = targetCat.subCategories[subIndex];
          if (!targetSub.items) targetSub.items = [];

          // Place according to positionMode
          if (positionMode === 'START') {
            targetSub.items = [...newMcqItems, ...targetSub.items];
          } else if (positionMode === 'SPECIFIC') {
            const insertIdx = Math.max(0, Math.min(specificIndex - 1, targetSub.items.length));
            targetSub.items.splice(insertIdx, 0, ...newMcqItems);
          } else {
            // END
            targetSub.items = [...targetSub.items, ...newMcqItems];
          }
        } else {
          if (!targetCat.items) targetCat.items = [];

          // Place according to positionMode
          if (positionMode === 'START') {
            targetCat.items = [...newMcqItems, ...targetCat.items];
          } else if (positionMode === 'SPECIFIC') {
            const insertIdx = Math.max(0, Math.min(specificIndex - 1, targetCat.items.length));
            targetCat.items.splice(insertIdx, 0, ...newMcqItems);
          } else {
            // END
            targetCat.items = [...targetCat.items, ...newMcqItems];
          }
        }
      } else {
        // QA
        if (!ministryCopy.shortAnswers) ministryCopy.shortAnswers = [];

        const newQaItems = extractedItems.map((item) => ({
          question: item.question,
          answer: item.answer || '',
          explanation: item.explanation || '',
        }));

        let catIndex = ministryCopy.shortAnswers.findIndex((c) => c.category === finalCategoryName);
        if (catIndex === -1) {
          ministryCopy.shortAnswers.push({
            category: finalCategoryName,
            items: [],
            subCategories: [],
          });
          catIndex = ministryCopy.shortAnswers.length - 1;
        }

        const targetCat = ministryCopy.shortAnswers[catIndex];

        if (finalSubCategoryName) {
          if (!targetCat.subCategories) targetCat.subCategories = [];
          let subIndex = targetCat.subCategories.findIndex((s) => s.category === finalSubCategoryName);
          if (subIndex === -1) {
            targetCat.subCategories.push({
              category: finalSubCategoryName,
              items: [],
            });
            subIndex = targetCat.subCategories.length - 1;
          }
          const targetSub = targetCat.subCategories[subIndex];
          if (!targetSub.items) targetSub.items = [];

          if (positionMode === 'START') {
            targetSub.items = [...newQaItems, ...targetSub.items];
          } else if (positionMode === 'SPECIFIC') {
            const insertIdx = Math.max(0, Math.min(specificIndex - 1, targetSub.items.length));
            targetSub.items.splice(insertIdx, 0, ...newQaItems);
          } else {
            targetSub.items = [...targetSub.items, ...newQaItems];
          }
        } else {
          if (!targetCat.items) targetCat.items = [];

          if (positionMode === 'START') {
            targetCat.items = [...newQaItems, ...targetCat.items];
          } else if (positionMode === 'SPECIFIC') {
            const insertIdx = Math.max(0, Math.min(specificIndex - 1, targetCat.items.length));
            targetCat.items.splice(insertIdx, 0, ...newQaItems);
          } else {
            targetCat.items = [...targetCat.items, ...newQaItems];
          }
        }
      }

      // Save directly to Firestore
      const docRef = doc(db, 'ministries', ministryCopy.id);
      await setDoc(docRef, ministryCopy, { merge: true });

      if (onQuestionsPlaced) {
        onQuestionsPlaced(ministryCopy.id, ministryCopy);
      }

      const destinationInfo = `${ministryCopy.khmerName || ministryCopy.name} > ${finalCategoryName}${finalSubCategoryName ? ` > ${finalSubCategoryName}` : ''}`;
      setSaveSuccessMessage(`បានដាក់បញ្ចូលសំណួរចំនួន ${extractedItems.length} ដោយជោគជ័យទៅកាន់៖ ${destinationInfo} (${positionMode === 'START' ? 'ខាងដើមគេ' : positionMode === 'SPECIFIC' ? `លំដាប់ទី ${specificIndex}` : 'ខាងចុងគេ'}) 🎉`);

      // Clear after success
      setTimeout(() => {
        handleClose();
      }, 2000);
    } catch (err: unknown) {
      console.error('Save error:', err);
      setExtractionError(err instanceof Error ? err.message : 'បរាជ័យក្នុងការរក្សាទុកសំណួរទៅកាន់ទីតាំង');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div 
        className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/70 backdrop-blur-sm overflow-y-auto"
        onPaste={handlePaste}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-4xl overflow-hidden flex flex-col max-h-[92vh]"
        >
          {/* Modal Header */}
          <div className="p-5 sm:p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20">
                <FileImage className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-slate-900 text-base sm:text-lg flex items-center gap-2 font-khmer">
                  <span>ការបញ្ជូនសំណួរពីរូបភាព</span>
                  <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                    Image Submission &amp; Placement
                  </span>
                </h3>
                <p className="text-xs text-slate-500 font-khmer">
                  វិភាគសំណួរពីរូបភាព និងកំណត់ទីតាំងដែលត្រូវដាក់បញ្ចូលក្នុងស្ថាប័ន / វិញ្ញាសា
                </p>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="w-9 h-9 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Modal Body */}
          <div className="p-5 sm:p-6 overflow-y-auto space-y-6 flex-1 text-slate-800">
            {/* Alerts */}
            {saveSuccessMessage && (
              <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-start gap-3 text-xs font-semibold font-khmer animate-in fade-in">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">{saveSuccessMessage}</div>
              </div>
            )}

            {extractionError && (
              <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-red-800 flex items-start gap-3 text-xs font-semibold font-khmer">
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">{extractionError}</div>
                <button onClick={() => setExtractionError(null)} className="text-red-400 hover:text-red-600">
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Step 1: Image Upload & Preview */}
            <div className="bg-slate-50/60 p-4 sm:p-5 rounded-2xl border border-slate-200 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-blue-600 text-white font-black text-xs flex items-center justify-center">
                    ១
                  </span>
                  <h4 className="font-bold text-slate-900 text-sm font-khmer">
                    បញ្ចូលរូបភាពសំណួរ (Upload Question Image)
                  </h4>
                </div>
                <span className="text-[11px] text-slate-400 font-medium font-khmer">
                  អាចចុច Copy រូបភាព ហើយចុច Paste (Ctrl+V) បាន
                </span>
              </div>

              {!selectedImage ? (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-slate-300 hover:border-blue-500 hover:bg-blue-50/40 rounded-2xl p-6 sm:p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-all group"
                >
                  <input
                    id={fileInputId}
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                    <Upload className="w-7 h-7" />
                  </div>
                  <p className="font-bold text-slate-800 text-sm font-khmer">
                    ចុចទីនេះដើម្បីជ្រើសរើសរូបភាព ឬ អូសទម្លាក់រូបភាពចូល
                  </p>
                  <p className="text-xs text-slate-400 mt-1 font-khmer">
                    គាំទ្រ PNG, JPG, JPEG, WebP, HEIC (រូបថតក្រដាសប្រឡង, Screenshot វិញ្ញាសា...)
                  </p>
                </div>
              ) : (
                <div className="flex flex-col sm:flex-row gap-4 items-start bg-white p-4 rounded-2xl border border-slate-200">
                  <div className="w-full sm:w-48 h-40 bg-slate-100 rounded-xl overflow-hidden relative border border-slate-200 flex-shrink-0 flex items-center justify-center">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={selectedImage}
                      alt="Uploaded Quiz Submission"
                      className="w-full h-full object-contain"
                    />
                  </div>

                  <div className="flex-1 space-y-3 w-full">
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-800 text-xs truncate max-w-[200px]">
                          {imageFileName || 'រូបភាពសំណួរដែលបានបញ្ចូល'}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedImage(null);
                            setExtractedItems([]);
                          }}
                          className="text-xs text-red-500 hover:text-red-700 font-bold flex items-center gap-1 font-khmer"
                        >
                          <Trash2 className="w-3.5 h-3.5" /> លុបរូបភាព
                        </button>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        រូបភាពរួចរាល់សម្រាប់ការវិភាគអត្ថបទសំណួរដោយស្វ័យប្រវត្តិ
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2 pt-2">
                      <button
                        type="button"
                        onClick={handleExtractFromImage}
                        disabled={isExtracting}
                        className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded-xl font-bold text-xs flex items-center gap-2 shadow-md shadow-blue-500/20 transition-all font-khmer cursor-pointer"
                      >
                        {isExtracting ? (
                          <>
                            <RefreshCw className="w-4 h-4 animate-spin" />
                            <span>កំពុងវិភាគរូបភាពដោយ AI...</span>
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-4 h-4 text-amber-300" />
                            <span>{extractedItems.length > 0 ? 'វិភាគរូបភាពឡើងវិញ' : 'ទាញយកសំណួរពីរូបភាព (Extract Questions)'}</span>
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs font-khmer"
                      >
                        ប្តូររូបភាពផ្សេង
                      </button>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleFileChange}
                        className="hidden"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Step 2: SPECIFY QUESTION LOCATION (THE CORE REQUIREMENT) */}
            <div className="bg-blue-50/40 p-4 sm:p-5 rounded-2xl border border-blue-200/80 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-blue-600 text-white font-black text-xs flex items-center justify-center">
                    ២
                  </span>
                  <h4 className="font-black text-slate-900 text-sm font-khmer flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-blue-600" />
                    <span>កំណត់ទីតាំងដែលត្រូវដាក់សំណួរ (Specify Question Placement Location)</span>
                  </h4>
                </div>
                <span className="text-[10px] font-extrabold text-blue-700 uppercase tracking-wider px-2 py-0.5 rounded-md bg-blue-100">
                  ចាំបាច់ (Required)
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* 1. Target Ministry / Subject */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 font-khmer block flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-blue-600" />
                    <span>១. ស្ថាប័ន ឬ វិញ្ញាសាគោលដៅ (Target Ministry/Subject)</span>
                  </label>
                  <select
                    value={targetMinistryId}
                    onChange={(e) => {
                      setTargetMinistryId(e.target.value);
                      setIsCreatingNewCategory(false);
                      setTargetSubCategory('');
                    }}
                    className="w-full text-xs font-bold font-khmer p-2.5 bg-white border border-slate-300 rounded-xl focus:border-blue-600 outline-none shadow-xs text-slate-800"
                  >
                    <optgroup label="🏛️ ក្រសួង ស្ថាប័នរដ្ឋ (Institutions)">
                      {ministries
                        .filter((m) => (m.groupType || 'INSTITUTION') === 'INSTITUTION')
                        .map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.khmerName} ({m.name})
                          </option>
                        ))}
                    </optgroup>
                    <optgroup label="📚 មុខវិជ្ជា និងវិញ្ញាសា (Subjects)">
                      {ministries
                        .filter((m) => m.groupType === 'SUBJECT')
                        .map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.khmerName} ({m.name})
                          </option>
                        ))}
                    </optgroup>
                  </select>
                </div>

                {/* 2. Target Question Type */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 font-khmer block flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-blue-600" />
                    <span>២. ប្រភេទផ្នែកសំណួរ (Question Section Type)</span>
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setTargetType('mcq')}
                      className={`p-2.5 rounded-xl border text-left cursor-pointer transition-all flex items-center gap-2 ${
                        targetType === 'mcq'
                          ? 'bg-purple-50 border-purple-500 text-purple-900 font-bold shadow-xs ring-1 ring-purple-500/30'
                          : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <span className="text-sm">🔘</span>
                      <div>
                        <div className="text-xs font-bold font-khmer">ពហុជ្រើសរើស (MCQ)</div>
                        <div className="text-[10px] text-slate-400 font-normal">ជម្រើស A, B, C, D</div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setTargetType('qa')}
                      className={`p-2.5 rounded-xl border text-left cursor-pointer transition-all flex items-center gap-2 ${
                        targetType === 'qa'
                          ? 'bg-pink-50 border-pink-500 text-pink-900 font-bold shadow-xs ring-1 ring-pink-500/30'
                          : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <span className="text-sm">📝</span>
                      <div>
                        <div className="text-xs font-bold font-khmer">សំណួរ-ចម្លើយ (Q&amp;A)</div>
                        <div className="text-[10px] text-slate-400 font-normal">ចម្លើយខ្លីលម្អិត</div>
                      </div>
                    </button>
                  </div>
                </div>

                {/* 3. Target Category */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-700 font-khmer flex items-center gap-1.5">
                      <BookOpen className="w-3.5 h-3.5 text-blue-600" />
                      <span>៣. ជំពូក / ប្រភេទមេរៀន (Target Category)</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setIsCreatingNewCategory(!isCreatingNewCategory);
                        if (!isCreatingNewCategory && !newCategoryName) {
                          setNewCategoryName(suggestedCategoryFromAI || 'វិញ្ញាសាថ្មី');
                        }
                      }}
                      className="text-[11px] font-bold text-blue-600 hover:text-blue-800 font-khmer flex items-center gap-1"
                    >
                      {isCreatingNewCategory ? 'ជ្រើសរើសជំពូកដែលមានស្រាប់' : '+ បង្កើតជំពូកថ្មី'}
                    </button>
                  </div>

                  {isCreatingNewCategory ? (
                    <div className="relative">
                      <input
                        type="text"
                        value={newCategoryName}
                        onChange={(e) => setNewCategoryName(e.target.value)}
                        placeholder="ឧ. វិញ្ញាសាទី១, សំណួរត្រៀមប្រឡង, ចំណេះដឹងទូទៅ..."
                        className="w-full text-xs font-bold font-khmer p-2.5 bg-white border-2 border-blue-400 rounded-xl focus:border-blue-600 outline-none shadow-xs text-slate-800"
                      />
                      <span className="absolute right-3 top-2.5 text-[10px] bg-blue-100 text-blue-700 font-bold px-1.5 py-0.5 rounded">
                        ជំពូកថ្មី
                      </span>
                    </div>
                  ) : (
                    <select
                      value={targetCategory}
                      onChange={(e) => {
                        setTargetCategory(e.target.value);
                        setTargetSubCategory('');
                      }}
                      className="w-full text-xs font-bold font-khmer p-2.5 bg-white border border-slate-300 rounded-xl focus:border-blue-600 outline-none shadow-xs text-slate-800"
                    >
                      {availableCategories.length === 0 ? (
                        <option value="">(មិនទាន់មានជំពូកនៅឡើយ - សូមបង្កើតជំពូកថ្មី)</option>
                      ) : (
                        availableCategories.map((cat, idx) => (
                          <option key={idx} value={cat}>
                            {cat}
                          </option>
                        ))
                      )}
                    </select>
                  )}
                </div>

                {/* 4. Target Sub-Category (Optional) */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-700 font-khmer flex items-center gap-1.5">
                      <FolderPlus className="w-3.5 h-3.5 text-blue-600" />
                      <span>៤. អនុជំពូក / Sub-Category (ស្រេចចិត្ត)</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => setIsCreatingNewSubCategory(!isCreatingNewSubCategory)}
                      className="text-[11px] font-bold text-blue-600 hover:text-blue-800 font-khmer"
                    >
                      {isCreatingNewSubCategory ? 'ជ្រើសរើសអនុជំពូក' : '+ បង្កើតអនុជំពូក'}
                    </button>
                  </div>

                  {isCreatingNewSubCategory ? (
                    <input
                      type="text"
                      value={newSubCategoryName}
                      onChange={(e) => setNewSubCategoryName(e.target.value)}
                      placeholder="ឧ. ផ្នែកទី១, ជំពូកតូច..."
                      className="w-full text-xs font-bold font-khmer p-2.5 bg-white border border-slate-300 rounded-xl focus:border-blue-600 outline-none shadow-xs text-slate-800"
                    />
                  ) : (
                    <select
                      value={targetSubCategory}
                      onChange={(e) => setTargetSubCategory(e.target.value)}
                      className="w-full text-xs font-bold font-khmer p-2.5 bg-white border border-slate-300 rounded-xl focus:border-blue-600 outline-none shadow-xs text-slate-800"
                    >
                      <option value="">(គ្មានអនុជំពូក - ដាក់នៅជំពូកធំផ្ទាល់)</option>
                      {availableSubCategories.map((sub, idx) => (
                        <option key={idx} value={sub}>
                          ↳ {sub}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </div>

              {/* 5. Placement Position / Order */}
              <div className="pt-2 border-t border-blue-200/60 space-y-2">
                <label className="text-xs font-bold text-slate-700 font-khmer block flex items-center gap-1.5">
                  <ListOrdered className="w-3.5 h-3.5 text-blue-600" />
                  <span>៥. ទីតាំងលំដាប់សំណួរដែលត្រូវដាក់ (Placement Order / Position)</span>
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setPositionMode('END')}
                    className={`p-2.5 rounded-xl border text-left cursor-pointer transition-all ${
                      positionMode === 'END'
                        ? 'bg-blue-600 text-white border-blue-600 shadow-sm font-bold'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <div className="text-xs font-bold font-khmer flex items-center gap-1">
                      <span>⏬ ដាក់នៅខាងចុងគេ (End)</span>
                    </div>
                    <div className={`text-[10px] mt-0.5 ${positionMode === 'END' ? 'text-blue-100' : 'text-slate-400'}`}>
                      បន្តបន្ទាប់ពីសំណួរចុងក្រោយ (លំដាប់ទី {currentItemCountAtLocation + 1})
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPositionMode('START')}
                    className={`p-2.5 rounded-xl border text-left cursor-pointer transition-all ${
                      positionMode === 'START'
                        ? 'bg-blue-600 text-white border-blue-600 shadow-sm font-bold'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <div className="text-xs font-bold font-khmer flex items-center gap-1">
                      <span>⏫ ដាក់នៅខាងដើមគេ (First)</span>
                    </div>
                    <div className={`text-[10px] mt-0.5 ${positionMode === 'START' ? 'text-blue-100' : 'text-slate-400'}`}>
                      ជាសំណួរទី ១ ក្នុងជំពូកនេះ
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPositionMode('SPECIFIC')}
                    className={`p-2.5 rounded-xl border text-left cursor-pointer transition-all ${
                      positionMode === 'SPECIFIC'
                        ? 'bg-blue-600 text-white border-blue-600 shadow-sm font-bold'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <div className="text-xs font-bold font-khmer flex items-center gap-1">
                      <span>🎯 ជ្រើសរើសលំដាប់ជាក់លាក់</span>
                    </div>
                    <div className={`text-[10px] mt-0.5 ${positionMode === 'SPECIFIC' ? 'text-blue-100' : 'text-slate-400'}`}>
                      បញ្ចូលនៅលំដាប់ទី # តាមចិត្ត
                    </div>
                  </button>
                </div>

                {positionMode === 'SPECIFIC' && (
                  <div className="flex items-center gap-2 p-2.5 bg-white rounded-xl border border-blue-200">
                    <span className="text-xs font-bold text-slate-700 font-khmer">
                      បញ្ចូលនៅលំដាប់សំណួរទី៖
                    </span>
                    <input
                      type="number"
                      min="1"
                      max={currentItemCountAtLocation + 1}
                      value={specificIndex}
                      onChange={(e) => setSpecificIndex(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-16 p-1.5 text-center font-bold text-sm bg-slate-50 border border-slate-300 rounded-lg outline-none focus:border-blue-600"
                    />
                    <span className="text-[11px] text-slate-500 font-khmer">
                      (បច្ចុប្បន្នមាន {currentItemCountAtLocation} សំណួរក្នុងជំពូកនេះ)
                    </span>
                  </div>
                )}
              </div>

              {/* Location Summary Badge */}
              <div className="p-3 bg-white rounded-xl border border-blue-200/80 flex items-center gap-2 text-xs font-khmer text-slate-800">
                <div className="p-1.5 bg-blue-50 text-blue-600 rounded-lg">
                  <ArrowRight className="w-4 h-4" />
                </div>
                <div className="flex-1">
                  <span className="font-bold text-slate-500">ទីតាំងដែលបានបញ្ជាក់៖ </span>
                  <span className="font-black text-blue-900">
                    {currentMinistry?.khmerName || currentMinistry?.name}
                  </span>
                  <span className="text-slate-400 mx-1">›</span>
                  <span className="font-bold text-purple-800">
                    {targetType === 'mcq' ? 'ពហុជ្រើសរើស (MCQ)' : 'សំណួរ-ចម្លើយ (Q&A)'}
                  </span>
                  <span className="text-slate-400 mx-1">›</span>
                  <span className="font-bold text-slate-900">
                    {isCreatingNewCategory ? newCategoryName || 'ជំពូកថ្មី' : targetCategory}
                  </span>
                  {targetSubCategory && targetSubCategory !== '__NONE__' && (
                    <>
                      <span className="text-slate-400 mx-1">›</span>
                      <span className="font-semibold text-slate-700">
                        {isCreatingNewSubCategory ? newSubCategoryName : targetSubCategory}
                      </span>
                    </>
                  )}
                  <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900">
                    {positionMode === 'START' ? 'ទីតាំង៖ ដើមគេ (#1)' : positionMode === 'SPECIFIC' ? `ទីតាំង៖ លំដាប់ទី #${specificIndex}` : 'ទីតាំង៖ ចុងគេ'}
                  </span>
                </div>
              </div>
            </div>

            {/* Step 3: Extracted Questions Preview & Editor */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-blue-600 text-white font-black text-xs flex items-center justify-center">
                    ៣
                  </span>
                  <h4 className="font-bold text-slate-900 text-sm font-khmer">
                    សំណួរដែលបានទាញយក ({extractedItems.length})
                  </h4>
                </div>
                <button
                  type="button"
                  onClick={addNewQuestionItem}
                  className="px-3 py-1.5 text-xs font-bold text-blue-600 bg-blue-50 rounded-xl hover:bg-blue-100 transition-colors flex items-center gap-1 font-khmer"
                >
                  <Plus className="w-3.5 h-3.5" /> បន្ថែមសំណួរដោយដៃ
                </button>
              </div>

              {extractedItems.length === 0 ? (
                <div className="p-8 text-center bg-slate-50 rounded-2xl border border-slate-200 text-slate-400 space-y-2">
                  <HelpCircle className="w-8 h-8 mx-auto text-slate-300" />
                  <p className="text-xs font-bold font-khmer text-slate-600">
                    មិនទាន់មានសំណួរនៅឡើយទេ
                  </p>
                  <p className="text-[11px] font-khmer text-slate-400">
                    សូមបញ្ចូលរូបភាព រួចចុច &quot;ទាញយកសំណួរពីរូបភាព&quot; ឬចុច &quot;បន្ថែមសំណួរដោយដៃ&quot;
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {extractedItems.map((item, idx) => (
                    <div
                      key={item.id || idx}
                      className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-3 relative group"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-black uppercase text-blue-700 bg-blue-50 px-2 py-0.5 rounded font-khmer">
                          សំណួរទី {idx + 1} ({item.type === 'mcq' ? 'MCQ' : 'Q&A'})
                        </span>
                        <button
                          type="button"
                          onClick={() => removeExtractedItem(idx)}
                          className="text-slate-300 hover:text-red-500 p-1 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Question Text */}
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                          ខ្លឹមសារសំណួរ (Question)
                        </label>
                        <textarea
                          rows={2}
                          value={item.question}
                          onChange={(e) => updateExtractedItem(idx, { question: e.target.value })}
                          className="w-full text-xs font-bold p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:border-blue-500 outline-none text-slate-900 resize-none font-khmer"
                          placeholder="បញ្ចូលសំណួរ..."
                        />
                      </div>

                      {/* MCQ Choices or QA Answer */}
                      {item.type === 'mcq' ? (
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                            ជម្រើសចម្លើយ (ជ្រើសរើសចម្លើយត្រឹមត្រូវដោយចុច Radio button)
                          </label>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {(item.options || ['', '', '', '']).map((opt, oIdx) => {
                              const labels = ['ក (A)', 'ខ (B)', 'គ (C)', 'ឃ (D)'];
                              const isCorrect = item.correctIndex === oIdx;
                              return (
                                <div
                                  key={oIdx}
                                  className={`flex items-center gap-2 p-1.5 rounded-xl border transition-colors ${
                                    isCorrect
                                      ? 'bg-emerald-50/70 border-emerald-300 ring-1 ring-emerald-400/30'
                                      : 'bg-slate-50 border-slate-200'
                                  }`}
                                >
                                  <input
                                    type="radio"
                                    name={`correct_${item.id || idx}`}
                                    checked={isCorrect}
                                    onChange={() => updateExtractedItem(idx, { correctIndex: oIdx })}
                                    className="cursor-pointer ml-1 text-emerald-600 focus:ring-emerald-500"
                                    title="កំណត់ជាចម្លើយត្រឹមត្រូវ"
                                  />
                                  <span className="text-[10px] font-bold text-slate-500 w-10 flex-shrink-0 font-khmer">
                                    {labels[oIdx] || `Option ${oIdx + 1}`}
                                  </span>
                                  <input
                                    type="text"
                                    value={opt}
                                    onChange={(e) => {
                                      const newOpts = [...(item.options || ['', '', '', ''])];
                                      newOpts[oIdx] = e.target.value;
                                      updateExtractedItem(idx, { options: newOpts });
                                    }}
                                    className="flex-1 text-xs px-2 py-1 bg-white border border-slate-200 rounded-lg outline-none focus:border-blue-400 font-khmer"
                                    placeholder={`ជម្រើស ${oIdx + 1}...`}
                                  />
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ) : (
                        <div>
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                            ចម្លើយត្រឹមត្រូវ (Answer)
                          </label>
                          <textarea
                            rows={2}
                            value={item.answer || ''}
                            onChange={(e) => updateExtractedItem(idx, { answer: e.target.value })}
                            className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:border-blue-500 outline-none text-slate-900 resize-none font-khmer"
                            placeholder="បញ្ចូលចម្លើយ..."
                          />
                        </div>
                      )}

                      {/* Explanation */}
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                          ការពន្យល់ និងឯកសារយោង (Explanation / Reference - ស្រេចចិត្ត)
                        </label>
                        <input
                          type="text"
                          value={item.explanation || ''}
                          onChange={(e) => updateExtractedItem(idx, { explanation: e.target.value })}
                          className="w-full text-[11px] px-2.5 py-1.5 bg-slate-50/50 border border-slate-200 rounded-xl focus:border-purple-400 outline-none text-slate-600 font-khmer"
                          placeholder="ឧ. យោងច្បាប់ស្តីពី... ឬ ពន្យល់..."
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Modal Footer */}
          <div className="p-4 sm:p-6 border-t border-slate-100 bg-slate-50/90 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="text-xs text-slate-500 font-khmer">
              {extractedItems.length > 0 ? (
                <span>
                  ត្រៀមដាក់បញ្ចូល <b>{extractedItems.length} សំណួរ</b> ទៅកាន់ <b>{currentMinistry?.khmerName || currentMinistry?.name}</b>
                </span>
              ) : (
                <span>សូមជ្រើសរើសរូបភាពសំណួរ និងកំណត់ទីតាំង</span>
              )}
            </div>

            <div className="flex items-center gap-2.5 w-full sm:w-auto">
              <button
                type="button"
                onClick={handleClose}
                className="flex-1 sm:flex-none px-5 py-2.5 border border-slate-200 hover:bg-slate-100 text-slate-600 font-bold text-xs rounded-xl transition-all font-khmer"
              >
                បោះបង់
              </button>

              <button
                type="button"
                onClick={handleSaveAndPlace}
                disabled={isSaving || extractedItems.length === 0}
                className="flex-1 sm:flex-none px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-black text-xs rounded-xl shadow-lg shadow-blue-600/20 transition-all flex items-center justify-center gap-2 font-khmer cursor-pointer"
              >
                {isSaving ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>កំពុងដាក់បញ្ចូល...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>ដាក់បញ្ចូលទៅទីតាំងដែលបានជ្រើសរើស</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
