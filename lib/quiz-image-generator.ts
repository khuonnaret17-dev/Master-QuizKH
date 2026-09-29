// html-to-image and html2canvas dynamically imported on demand to keep initial bundle ultra fast

export interface QuizInput {
  question: string;
  type?: "mcq" | "qa";
  options?: string[] | Record<string, string>;
  correctIndex?: number;
  correctAnswer?: string;
  answer?: string;
  explanation?: string;
}

export interface MinistryInput {
  khmerName?: string;
  name?: string;
  logo?: string;
}

export interface PosterConfig {
  layout?: 'MODERN_DARK' | 'EDITORIAL_LIGHT' | 'ROYAL_GOLD';
  footerBrand?: string;
  footerTagline?: string;
  footerHandle?: string;
  showCorrectAnswer?: boolean;
  showExplanation?: boolean;
  customCategory?: string;
  programLogo?: string;
  includeProgramLogo?: boolean;
}

export async function imageUrlToDataUrl(url: string): Promise<string> {
  const FALLBACK_LOGO_SVG = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><rect width="100" height="100" rx="20" fill="%23D4AF37"/><text x="50" y="62" font-size="42" text-anchor="middle" fill="%23031F33" font-family="sans-serif" font-weight="bold">V</text></svg>`;
  
  if (!url) return FALLBACK_LOGO_SVG;
  if (url.startsWith("data:")) return url;

  try {
    const res = await fetch(url, { mode: 'cors' });
    if (!res.ok) throw new Error("Fetch failed");
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string' && reader.result.length > 100) {
          resolve(reader.result);
        } else {
          resolve(FALLBACK_LOGO_SVG);
        }
      };
      reader.onerror = () => resolve(FALLBACK_LOGO_SVG);
      reader.readAsDataURL(blob);
    });
  } catch {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        try {
          const canvas = document.createElement("canvas");
          canvas.width = img.width || 100;
          canvas.height = img.height || 100;
          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.drawImage(img, 0, 0);
            const dataUrl = canvas.toDataURL("image/png");
            if (dataUrl && dataUrl.length > 100) {
              resolve(dataUrl);
              return;
            }
          }
        } catch {
          // ignore tainted canvas
        }
        resolve(FALLBACK_LOGO_SVG);
      };
      img.onerror = () => resolve(FALLBACK_LOGO_SVG);
      img.src = url;
    });
  }
}

/**
 * Generates a beautiful modern-style poster image Blob of a quiz item, 
 * customizable with layout styles, option visibility, and personalized footer.
 */
export async function generateQuizImageBlob(
  quiz: QuizInput,
  ministry?: MinistryInput,
  config?: PosterConfig
): Promise<Blob> {
  const defaultAppLogo = config?.programLogo?.trim() || "https://i.ibb.co/FkGwqJVL/3-QCM-Ep4-1.jpg";
  const rawMinistryLogo = ministry?.logo || defaultAppLogo;
  const includeProgramLogo = config?.includeProgramLogo !== false;

  // Convert logos to Data URLs to prevent CORS/tainted canvas errors in html-to-image / html2canvas
  const [appLogo, ministryLogo] = await Promise.all([
    imageUrlToDataUrl(defaultAppLogo),
    imageUrlToDataUrl(rawMinistryLogo)
  ]);

  const layout = config?.layout || 'MODERN_DARK';
  const showCorrectAnswer = config?.showCorrectAnswer !== false;
  const showExplanation = config?.showExplanation !== false;
  const footerBrand = config?.footerBrand?.trim() || "Master Quiz KH • វិញ្ញាសាផ្លូវការ";
  const footerTagline = config?.footerTagline?.trim() || "កម្មវិធីត្រៀមប្រឡងក្របខ័ណ្ឌរដ្ឋ និងស្ថាប័នសាធារណៈ";
  const footerHandle = config?.footerHandle?.trim() || "@qiuzs_bot";

  const ministryName = ministry?.khmerName || ministry?.name || config?.customCategory || "វិញ្ញាសាទូទៅ";
  const categoryTag = config?.customCategory || (quiz.type === 'qa' ? "សំណួរ-ចម្លើយ" : "ពហុជ្រើសរើស (MCQ)");

  // Determine type
  const isMcq =
    quiz.type === "mcq" ||
    (quiz.options &&
      (Array.isArray(quiz.options)
        ? quiz.options.length > 0
        : Object.keys(quiz.options).length > 0));

  // Parse options
  let parsedOptions: { label: string; text: string; isCorrect: boolean }[] = [];
  if (isMcq && quiz.options) {
    if (Array.isArray(quiz.options)) {
      const labels = ["ក", "ខ", "គ", "ឃ", "ង", "ច", "ឆ"];
      parsedOptions = quiz.options
        .filter((opt) => opt && opt.trim() !== "")
        .map((opt, idx) => ({
          label: labels[idx] || String.fromCharCode(65 + idx),
          text: opt,
          isCorrect: showCorrectAnswer && quiz.correctIndex === idx,
        }));
    } else if (typeof quiz.options === "object") {
      const entries = Object.entries(quiz.options);
      parsedOptions = entries.map(([key, val]) => {
        let displayLabel = key;
        if (key === "A") displayLabel = "ក";
        else if (key === "B") displayLabel = "ខ";
        else if (key === "C") displayLabel = "គ";
        else if (key === "D") displayLabel = "ឃ";

        return {
          label: displayLabel,
          text: val,
          isCorrect: showCorrectAnswer && quiz.correctAnswer === key,
        };
      });
    }
  }

  // Create card container
  const card = document.createElement("div");
  card.style.position = "absolute";
  card.style.top = "-9999px";
  card.style.left = "-9999px";
  card.style.width = "660px";
  card.style.boxSizing = "border-box";
  card.style.opacity = "1";
  card.style.pointerEvents = "none";

  const escapeHTML = (unsafe?: string) => {
    if (!unsafe) return "";
    return unsafe
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  };

  // Define theme-dependent styles
  let themeStyles = "";
  if (layout === 'EDITORIAL_LIGHT') {
    themeStyles = `
      .poster-card {
        background: linear-gradient(150deg, #FFFFFF 0%, #F8FAFC 55%, #F1F5F9 100%);
        border: 2px solid #E2E8F0;
        box-shadow: 0 30px 60px -15px rgba(15, 23, 42, 0.18);
        color: #0F172A;
      }
      .poster-badge-top {
        background: #094C72;
        color: #FFFFFF;
      }
      .app-name { color: #094C72; }
      .app-tagline { color: #64748B; }
      .ministry-badge {
        background: #F1F5F9;
        border: 1px solid #CBD5E1;
        color: #094C72;
      }
      .question-badge {
        background: #EFF6FF;
        color: #1D4ED8;
        border: 1px solid #BFDBFE;
      }
      .question-text {
        color: #094C72;
        text-shadow: none;
      }
      .option-item {
        background: #FFFFFF;
        border: 1.5px solid #E2E8F0;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.03);
      }
      .option-item-correct {
        background: #F0FDF4;
        border: 2px solid #16A34A;
        box-shadow: 0 4px 16px rgba(22, 163, 74, 0.15);
      }
      .option-circle {
        background: #F8FAFC;
        border: 1.5px solid #CBD5E1;
        color: #334155;
      }
      .option-circle-correct {
        background: #16A34A;
        border-color: #16A34A;
        color: #FFFFFF;
        box-shadow: 0 0 10px rgba(22, 163, 74, 0.35);
      }
      .option-text { color: #334155; }
      .option-text-correct { color: #0F172A; font-weight: 700; }
      .answer-container {
        background: #F8FAFC;
        border-left: 5px solid #094C72;
        border-top: 1px solid #E2E8F0;
        border-right: 1px solid #E2E8F0;
        border-bottom: 1px solid #E2E8F0;
        box-shadow: 0 4px 12px rgba(0,0,0,0.03);
      }
      .answer-label { color: #094C72; }
      .answer-text { color: #1E293B; }
      .explanation-container {
        background: #F1F5F9;
        border: 1.5px dashed #94A3B8;
      }
      .explanation-header { color: #094C72; }
      .explanation-body { color: #475569; }
      .poster-footer {
        border-top: 1.5px solid #E2E8F0;
        background: #FFFFFF;
      }
      .footer-brand { color: #094C72; }
      .footer-tagline { color: #64748B; }
      .footer-handle {
        background: #094C72;
        color: #FFFFFF;
      }
    `;
  } else if (layout === 'ROYAL_GOLD') {
    themeStyles = `
      .poster-card {
        background: linear-gradient(145deg, #093754 0%, #051F30 65%, #02101A 100%);
        border: 2px solid #D4AF37;
        box-shadow: 0 35px 75px -15px rgba(2, 16, 26, 0.95);
        color: #F8FAFC;
      }
      .poster-badge-top {
        background: linear-gradient(90deg, #D4AF37 0%, #FCECB8 100%);
        color: #031F33;
      }
      .app-name { color: #FCECB8; }
      .app-tagline { color: #94A3B8; }
      .ministry-badge {
        background: rgba(212, 175, 55, 0.18);
        border: 1px solid rgba(212, 175, 55, 0.4);
        color: #FCECB8;
      }
      .question-badge {
        background: rgba(212, 175, 55, 0.2);
        color: #FCECB8;
        border: 1px solid #D4AF37;
      }
      .question-text {
        color: #FFFFFF;
        text-shadow: 0 2px 8px rgba(0, 0, 0, 0.5);
      }
      .option-item {
        background: rgba(9, 55, 84, 0.45);
        border: 1px solid rgba(212, 175, 55, 0.25);
      }
      .option-item-correct {
        background: linear-gradient(90deg, rgba(212, 175, 55, 0.25) 0%, rgba(212, 175, 55, 0.1) 100%);
        border: 2px solid #D4AF37;
        box-shadow: 0 0 20px rgba(212, 175, 55, 0.3);
      }
      .option-circle {
        background: rgba(255, 255, 255, 0.08);
        border: 1.5px solid rgba(212, 175, 55, 0.35);
        color: #F8FAFC;
      }
      .option-circle-correct {
        background: #D4AF37;
        border-color: #D4AF37;
        color: #031F33;
        box-shadow: 0 0 14px rgba(212, 175, 55, 0.5);
      }
      .option-text { color: #E2E8F0; }
      .option-text-correct { color: #FFFFFF; font-weight: 700; }
      .answer-container {
        background: rgba(212, 175, 55, 0.1);
        border-left: 5px solid #D4AF37;
        border-top: 1px solid rgba(212, 175, 55, 0.2);
        border-right: 1px solid rgba(212, 175, 55, 0.2);
        border-bottom: 1px solid rgba(212, 175, 55, 0.2);
      }
      .answer-label { color: #FCECB8; }
      .answer-text { color: #FFFFFF; }
      .explanation-container {
        background: rgba(0, 0, 0, 0.25);
        border: 1.5px dashed rgba(212, 175, 55, 0.4);
      }
      .explanation-header { color: #FCECB8; }
      .explanation-body { color: #CBD5E1; }
      .poster-footer {
        border-top: 1.5px solid rgba(212, 175, 55, 0.3);
        background: rgba(3, 31, 51, 0.5);
      }
      .footer-brand { color: #FCECB8; }
      .footer-tagline { color: #94A3B8; }
      .footer-handle {
        background: linear-gradient(90deg, #D4AF37 0%, #FCECB8 100%);
        color: #031F33;
      }
    `;
  } else {
    // MODERN_DARK (Default)
    themeStyles = `
      .poster-card {
        background: linear-gradient(145deg, #0A263D 0%, #051624 55%, #020C14 100%);
        border: 1.5px solid rgba(226, 189, 85, 0.45);
        box-shadow: 0 35px 70px -15px rgba(0, 0, 0, 0.85);
        color: #F8FAFC;
      }
      .poster-badge-top {
        background: #E2BD55;
        color: #092C44;
      }
      .app-name { color: #FCECB8; }
      .app-tagline { color: #94A3B8; }
      .ministry-badge {
        background: rgba(226, 189, 85, 0.15);
        border: 1px solid rgba(226, 189, 85, 0.35);
        color: #FCECB8;
      }
      .question-badge {
        background: rgba(226, 189, 85, 0.15);
        color: #E2BD55;
        border: 1px solid rgba(226, 189, 85, 0.4);
      }
      .question-text {
        color: #FFFFFF;
        text-shadow: 0 2px 10px rgba(0,0,0,0.3);
      }
      .option-item {
        background: rgba(255, 255, 255, 0.04);
        border: 1px solid rgba(255, 255, 255, 0.1);
      }
      .option-item-correct {
        background: rgba(226, 189, 85, 0.14);
        border: 2px solid #E2BD55;
        box-shadow: 0 4px 20px rgba(226, 189, 85, 0.18);
      }
      .option-circle {
        background: rgba(255, 255, 255, 0.08);
        border: 1.5px solid rgba(255, 255, 255, 0.2);
        color: #F1F5F9;
      }
      .option-circle-correct {
        background: #E2BD55;
        border-color: #E2BD55;
        color: #092C44;
        box-shadow: 0 0 12px rgba(226, 189, 85, 0.4);
      }
      .option-text { color: #CBD5E1; }
      .option-text-correct { color: #FFFFFF; font-weight: 700; }
      .answer-container {
        background: rgba(226, 189, 85, 0.08);
        border-left: 5px solid #E2BD55;
        border-top: 1px solid rgba(255,255,255,0.06);
        border-right: 1px solid rgba(255,255,255,0.06);
        border-bottom: 1px solid rgba(255,255,255,0.06);
      }
      .answer-label { color: #FCECB8; }
      .answer-text { color: #FFFFFF; }
      .explanation-container {
        background: rgba(0, 0, 0, 0.25);
        border: 1.5px dashed rgba(226, 189, 85, 0.35);
      }
      .explanation-header { color: #FCECB8; }
      .explanation-body { color: #94A3B8; }
      .poster-footer {
        border-top: 1px solid rgba(226, 189, 85, 0.25);
        background: rgba(5, 22, 36, 0.5);
      }
      .footer-brand { color: #FCECB8; }
      .footer-tagline { color: #94A3B8; }
      .footer-handle {
        background: #E2BD55;
        color: #092C44;
      }
    `;
  }

  // HTML and CSS Construction
  card.innerHTML = `
    <style>
      .poster-card {
        font-family: system-ui, -apple-system, sans-serif, 'Khmer OS', 'Khmer OS System';
        border-radius: 28px;
        padding: 0;
        position: relative;
        overflow: hidden;
        box-sizing: border-box;
        width: 660px;
      }
      
      /* Subtle radial ambiance */
      .poster-card::before {
        content: '';
        position: absolute;
        top: -120px;
        right: -120px;
        width: 360px;
        height: 360px;
        background: radial-gradient(circle, rgba(226, 189, 85, 0.12) 0%, transparent 70%);
        pointer-events: none;
        z-index: 1;
      }

      .poster-header-bar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 12px 36px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        font-size: 10px;
        font-weight: 800;
        letter-spacing: 0.05em;
        text-transform: uppercase;
        position: relative;
        z-index: 2;
      }

      .poster-badge-top {
        padding: 3px 10px;
        border-radius: 6px;
        font-size: 9.5px;
        font-weight: 800;
        display: inline-flex;
        align-items: center;
        gap: 4px;
      }
      
      .poster-body {
        padding: 32px 36px 36px 36px;
        position: relative;
        z-index: 2;
      }

      .header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 26px;
      }
      
      .header-left {
        display: flex;
        align-items: center;
        gap: 14px;
      }
      
      .app-logo-container {
        position: relative;
        width: 54px;
        height: 54px;
        border-radius: 16px;
        border: 2px solid #D4AF37;
        background: #FFFFFF;
        box-shadow: 0 6px 16px rgba(0,0,0,0.15);
        overflow: hidden;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      
      .app-logo {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
      
      .brand-info {
        display: flex;
        flex-direction: column;
      }
      
      .app-name {
        font-weight: 800;
        font-size: 15px;
        line-height: 1.4;
      }
      
      .app-tagline {
        font-size: 10.5px;
        font-weight: 600;
        margin-top: 2px;
      }
      
      .ministry-badge {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 7px 14px;
        border-radius: 12px;
        font-size: 11.5px;
        font-weight: 700;
      }

      .ministry-logo {
        width: 22px;
        height: 22px;
        border-radius: 50%;
        object-fit: contain;
        background: white;
        padding: 1.5px;
      }
      
      .question-badge {
        font-weight: 800;
        font-size: 10px;
        padding: 5px 12px;
        border-radius: 8px;
        display: inline-block;
        margin-bottom: 16px;
        letter-spacing: 0.02em;
      }
      
      .question-text {
        font-size: 18.5px;
        font-weight: 700;
        line-height: 1.7;
        margin-bottom: 24px;
        white-space: pre-wrap;
      }
      
      .options-grid {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
      
      .option-item {
        border-radius: 16px;
        padding: 14px 18px;
        display: flex;
        align-items: center;
        gap: 14px;
        box-sizing: border-box;
      }
      
      .option-circle {
        width: 28px;
        height: 28px;
        border-radius: 50%;
        font-weight: 800;
        font-size: 12px;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
      }
      
      .option-text {
        font-size: 14.5px;
        line-height: 1.55;
        flex: 1;
      }

      .answer-container {
        border-radius: 6px 16px 16px 6px;
        padding: 18px 22px;
        margin-top: 14px;
        box-sizing: border-box;
      }

      .answer-label {
        font-weight: 800;
        font-size: 11.5px;
        margin-bottom: 6px;
        letter-spacing: 0.03em;
        text-transform: uppercase;
      }

      .answer-text {
        font-size: 14.5px;
        line-height: 1.7;
        white-space: pre-wrap;
      }
      
      .explanation-container {
        border-radius: 16px;
        padding: 18px 22px;
        margin-top: 24px;
        box-sizing: border-box;
      }
      
      .explanation-header {
        font-weight: 800;
        font-size: 11.5px;
        margin-bottom: 8px;
        display: flex;
        align-items: center;
        gap: 6px;
      }
      
      .explanation-body {
        font-size: 13px;
        line-height: 1.7;
        white-space: pre-wrap;
      }
      
      /* Modern Poster Footer */
      .poster-footer {
        padding: 20px 36px;
        position: relative;
        z-index: 2;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
      }

      .footer-left {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }

      .footer-brand {
        font-size: 12.5px;
        font-weight: 800;
        letter-spacing: 0.02em;
      }

      .footer-tagline {
        font-size: 10px;
        font-weight: 500;
      }

      .footer-handle {
        padding: 6px 14px;
        border-radius: 10px;
        font-size: 11px;
        font-weight: 800;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        letter-spacing: 0.02em;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      }

      ${themeStyles}
    </style>
    
    <div class="poster-card">
      <div class="poster-header-bar">
        <span class="poster-badge-top">🇰🇭 OFFICIAL WORKSHEET</span>
        <span>${escapeHTML(categoryTag)}</span>
      </div>

      <div class="poster-body">
        <div class="header">
          <div class="header-left">
            ${includeProgramLogo ? `
            <div class="app-logo-container" title="Program Logo">
              <img class="app-logo" src="${appLogo}" alt="Program Logo" crossorigin="anonymous" />
            </div>
            ` : ''}
            <div class="brand-info">
              <span class="app-name">វិញ្ញាសា • កម្មវិធីត្រៀមប្រឡង</span>
              <span class="app-tagline">Vignasa Cambodia Platform</span>
            </div>
          </div>
          
          <div class="ministry-badge">
            <img class="ministry-logo" src="${ministryLogo}" alt="Ministry Logo" crossorigin="anonymous" />
            <span>${escapeHTML(ministryName)}</span>
          </div>
        </div>
        
        <div>
          <span class="question-badge">${isMcq ? "សំណួរពហុជ្រើសរើស (MCQ)" : "សំណួរ-ចម្លើយខ្លី"}</span>
          <div class="question-text">${escapeHTML(quiz.question)}</div>
          
          ${
            isMcq
              ? `
            <div class="options-grid">
              ${parsedOptions
                .map(
                  (opt) => `
                <div class="option-item ${opt.isCorrect ? "option-item-correct" : ""}">
                  <div class="option-circle ${opt.isCorrect ? "option-circle-correct" : ""}">
                    ${opt.label}
                  </div>
                  <div class="option-text ${opt.isCorrect ? "option-text-correct" : ""}">
                    ${escapeHTML(opt.text)}
                  </div>
                  ${opt.isCorrect ? `<span style="font-size: 13px;">✅</span>` : ''}
                </div>
              `
                )
                .join("")}
            </div>
          `
              : showCorrectAnswer ? `
            <div class="answer-container">
              <div class="answer-label">ចម្លើយត្រឹមត្រូវ</div>
              <div class="answer-text">${escapeHTML(quiz.answer) || "សូមពិនិត្យការពន្យល់លម្អិតខាងក្រោម"}</div>
            </div>
          ` : `
            <div class="answer-challenge-box" style="margin-top: 16px; padding: 14px 18px; border-radius: 14px; border: 1.5px dashed rgba(226, 189, 85, 0.4); background: rgba(226, 189, 85, 0.06); display: flex; align-items: center; gap: 10px;">
              <span style="font-size: 16px;">✍️</span>
              <span style="font-size: 13px; font-weight: 700; opacity: 0.9;">សូមចូលរួមបញ្ចេញមតិ ឬពិនិត្យចម្លើយក្នុងសារអត្ថបទខាងក្រោម 👇</span>
            </div>
          `
          }
          
          ${
            showCorrectAnswer && showExplanation && quiz.explanation && quiz.explanation.trim() !== ""
              ? `
            <div class="explanation-container">
              <div class="explanation-header">
                <span>💡 ការពន្យល់ និងឯកសារយោង</span>
              </div>
              <div class="explanation-body">${escapeHTML(quiz.explanation)}</div>
            </div>
          `
              : ""
          }
        </div>
      </div>
      
      <div class="poster-footer">
        <div class="footer-left">
          <div class="footer-brand">${escapeHTML(footerBrand)}</div>
          <div class="footer-tagline">${escapeHTML(footerTagline)}</div>
        </div>
        <div class="footer-handle">
          <span>✈️</span>
          <span>${escapeHTML(footerHandle)}</span>
        </div>
      </div>
    </div>
  `;

  // Append to DOM
  document.body.appendChild(card);

  try {
    // Wait for images inside the card to load
    const imgs = Array.from(card.querySelectorAll("img"));
    await Promise.all(
      imgs.map((img) => {
        if (img.complete) return Promise.resolve();
        return new Promise<void>((resolve) => {
          img.onload = () => resolve();
          img.onerror = () => resolve();
        });
      })
    );

    // Wait for layout and fonts
    await new Promise((resolve) => setTimeout(resolve, 500));

    let blob: Blob | null = null;
    const cardElement = (card.firstElementChild as HTMLElement) || card;

    try {
      if (cardElement) {
        const { toBlob } = await import('html-to-image');
        const b = await toBlob(cardElement, {
          pixelRatio: 2,
          skipFonts: true,
          cacheBust: true,
          backgroundColor: layout === 'EDITORIAL_LIGHT' ? '#F8FAFC' : '#041421',
        });
        if (b && b.size > 0) {
          blob = b;
        }
      }
    } catch (e1) {
      console.warn("html-to-image failed, falling back to html2canvas", e1);
    }

    if ((!blob || blob.size === 0) && cardElement) {
      const { default: html2canvas } = await import('html2canvas');
      const canvas = await html2canvas(cardElement, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        logging: false,
        backgroundColor: layout === 'EDITORIAL_LIGHT' ? '#F8FAFC' : '#041421',
        width: 660,
      });
      
      blob = await new Promise<Blob>((resolve, reject) => {
        try {
          canvas.toBlob((b) => {
            if (b && b.size > 0) {
              resolve(b);
            } else {
              const dataUrl = canvas.toDataURL('image/png');
              if (!dataUrl || !dataUrl.includes(',')) {
                reject(new Error("Canvas generated invalid data URL"));
                return;
              }
              const arr = dataUrl.split(',');
              const mime = arr[0]?.match(/:(.*?);/)?.[1] || 'image/png';
              const bstr = atob(arr[1] || "");
              let n = bstr.length;
              const u8arr = new Uint8Array(n);
              while (n--) {
                u8arr[n] = bstr.charCodeAt(n);
              }
              const resBlob = new Blob([u8arr], { type: mime });
              resolve(resBlob);
            }
          }, 'image/png');
        } catch (err) {
          reject(err);
        }
      });
    }

    if (!blob || blob.size === 0) {
      console.warn("DOM snapshot failed, using canvas rendering fallback.");
      const fallbackCanvas = document.createElement("canvas");
      fallbackCanvas.width = 1320;
      fallbackCanvas.height = 1400;
      const ctx = fallbackCanvas.getContext("2d");
      if (ctx) {
        // Gradient background
        const grad = ctx.createLinearGradient(0, 0, 1320, 1400);
        if (layout === 'EDITORIAL_LIGHT') {
          grad.addColorStop(0, "#FFFFFF");
          grad.addColorStop(1, "#F1F5F9");
          ctx.fillStyle = grad;
          ctx.fillRect(0, 0, 1320, 1400);
          ctx.strokeStyle = "#E2E8F0";
        } else {
          grad.addColorStop(0, "#0A263D");
          grad.addColorStop(1, "#020C14");
          ctx.fillStyle = grad;
          ctx.fillRect(0, 0, 1320, 1400);
          ctx.strokeStyle = "#D4AF37";
        }
        ctx.lineWidth = 12;
        ctx.strokeRect(24, 24, 1272, 1352);

        // Header
        ctx.fillStyle = layout === 'EDITORIAL_LIGHT' ? "#094C72" : "#FCECB8";
        ctx.font = "bold 38px sans-serif";
        ctx.fillText(ministryName, 60, 110);

        // Question
        ctx.fillStyle = layout === 'EDITORIAL_LIGHT' ? "#0F172A" : "#FFFFFF";
        ctx.font = "bold 36px sans-serif";
        const text = String(quiz.question || "សំណួរវិញ្ញាសា");
        const words = text.split(' ');
        let line = "";
        let testY = 220;
        for (let i = 0; i < words.length; i++) {
          const testLine = line + words[i] + " ";
          const metrics = ctx.measureText(testLine);
          if (metrics.width > 1180 && i > 0) {
            ctx.fillText(line, 60, testY);
            line = words[i] + " ";
            testY += 56;
          } else {
            line = testLine;
          }
        }
        ctx.fillText(line, 60, testY);

        // Footer brand
        ctx.fillStyle = layout === 'EDITORIAL_LIGHT' ? "#094C72" : "#FCECB8";
        ctx.font = "bold 26px sans-serif";
        ctx.fillText(footerBrand, 60, 1310);
        ctx.font = "bold 24px sans-serif";
        ctx.fillText(`✈️ ${footerHandle}`, 1000, 1310);

        blob = await new Promise<Blob>((resolve) => {
          fallbackCanvas.toBlob((b) => {
            if (b && b.size > 0) {
              resolve(b);
            } else {
              const tinyDataUrl = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
              const arr = tinyDataUrl.split(',');
              const bstr = atob(arr[1] || "");
              let n = bstr.length;
              const u8arr = new Uint8Array(n);
              while (n--) u8arr[n] = bstr.charCodeAt(n);
              resolve(new Blob([u8arr], { type: 'image/png' }));
            }
          }, 'image/png');
        });
      }
    }

    if (!blob || blob.size === 0) {
      throw new Error("Unable to capture non-empty image from DOM.");
    }

    return blob;
  } finally {
    if (document.body.contains(card)) {
      document.body.removeChild(card);
    }
  }
}
