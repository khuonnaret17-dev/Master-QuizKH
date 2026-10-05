import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI, Type, Schema } from "@google/genai";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { imageBase64, mimeType = "image/jpeg" } = body;

    if (!imageBase64) {
      return NextResponse.json(
        { success: false, error: "រូបភាពត្រូវបានទាមទារ (Missing image data)" },
        { status: 400 }
      );
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { 
          success: false, 
          error: "GEMINI_API_KEY is not configured on the server." 
        },
        { status: 500 }
      );
    }

    const ai = new GoogleGenAI({ apiKey });

    // Clean base64 string if data URL prefix exists
    const cleanBase64 = imageBase64.replace(/^data:image\/[a-zA-Z+]+;base64,/, "");

    const prompt = `You are an expert OCR and exam question analyzer for Cambodian civil service exams (វិញ្ញាសាប្រឡងក្របខ័ណ្ឌរដ្ឋ និងស្ថាប័នរដ្ឋ) and general knowledge tests in Khmer and English.
Analyze the provided image carefully and extract all questions, multiple choice options, answers, and explanations.

Guidelines:
1. Support both Khmer and English text accurately. Keep Khmer script pristine without missing vowels or subscript characters.
2. For Multiple Choice Questions (MCQ):
   - Extract the question text cleanly (remove question number prefixes like "១. ", "1. ", "សំណួរទី ១៖").
   - Extract 2 to 4+ options cleanly. Do NOT include option letter prefixes like "ក.", "ខ.", "A.", "B." inside the option text strings.
   - Identify the correctIndex (0 for first option, 1 for second, etc.) based on checkmarks, circles, highlights, answer keys, or logical correctness.
   - Set type to "mcq".
3. For Short Answer / Q&A Questions (QA):
   - Extract the question text cleanly.
   - Extract the answer text.
   - Set type to "qa".
4. Extract any reference or explanation (ឯកសារយោង/ការពន្យល់) if present.
5. If the image contains a category or subject title at the top, capture it in suggestedCategory.

Return a valid JSON object matching the requested schema.`;

    const responseSchema: Schema = {
      type: Type.OBJECT,
      properties: {
        suggestedCategory: {
          type: Type.STRING,
          description: "Title or category inferred from the image header if visible"
        },
        items: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              type: {
                type: Type.STRING,
                enum: ["mcq", "qa"],
                description: "Type of question: mcq for multiple choice, qa for short answer"
              },
              question: {
                type: Type.STRING,
                description: "Clean question text in Khmer or English"
              },
              options: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "Array of choice text strings without letter prefixes (for MCQ)"
              },
              correctIndex: {
                type: Type.INTEGER,
                description: "Zero-based index of correct option (0 for A/ក, 1 for B/ខ, etc.)"
              },
              answer: {
                type: Type.STRING,
                description: "Answer text for QA or detailed answer"
              },
              explanation: {
                type: Type.STRING,
                description: "Explanation or reference if visible in image"
              }
            },
            required: ["question", "type"]
          }
        }
      },
      required: ["items"]
    };

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          role: "user",
          parts: [
            {
              inlineData: {
                mimeType,
                data: cleanBase64,
              },
            },
            {
              text: prompt,
            },
          ],
        },
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: responseSchema,
        temperature: 0.1,
      },
    });

    const responseText = response.text || "{}";
    let parsedResult;
    try {
      parsedResult = JSON.parse(responseText);
    } catch {
      // Clean possible code blocks if any
      const cleaned = responseText.replace(/```json\n?|\n?```/g, "").trim();
      parsedResult = JSON.parse(cleaned);
    }

    return NextResponse.json({
      success: true,
      data: parsedResult,
    });
  } catch (error: unknown) {
    console.error("Error extracting quiz from image:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to analyze image with Gemini AI",
      },
      { status: 500 }
    );
  }
}
