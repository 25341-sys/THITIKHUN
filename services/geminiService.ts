
import { GoogleGenAI, Type } from "@google/genai";
import { DetectedFace } from '../types';

if (!process.env.API_KEY) {
  throw new Error("API_KEY environment variable not set");
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const responseSchema = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      gender: {
        type: Type.STRING,
        enum: ['male', 'female', 'unknown'],
        description: 'The perceived gender of the person.'
      },
      boundingBox: {
        type: Type.OBJECT,
        properties: {
          x: { type: Type.NUMBER, description: 'Normalized horizontal position (from 0 to 1) of the top-left corner.' },
          y: { type: Type.NUMBER, description: 'Normalized vertical position (from 0 to 1) of the top-left corner.' },
          width: { type: Type.NUMBER, description: 'Normalized width (from 0 to 1) of the box.' },
          height: { type: Type.NUMBER, description: 'Normalized height (from 0 to 1) of the box.' }
        },
        required: ['x', 'y', 'width', 'height']
      }
    },
    required: ['gender', 'boundingBox']
  }
};

const PROMPT = `Analyze the provided image to detect all human faces. For each face found, determine the perceived gender (male or female). Provide the output as a JSON array. Each element in the array should be an object representing a single face, containing two keys: 'gender' and 'boundingBox'. The 'boundingBox' should be an object with 'x', 'y', 'width', and 'height' keys, representing the normalized coordinates (from 0.0 to 1.0) of the box around the face. If no faces are found, return an empty array. Respond ONLY with the JSON array.`;

export const detectFaces = async (base64Image: string): Promise<DetectedFace[]> => {
  try {
    const imagePart = {
      inlineData: {
        mimeType: 'image/jpeg',
        data: base64Image,
      },
    };
    
    const textPart = {
        text: PROMPT
    };

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: { parts: [imagePart, textPart] },
        config: {
            responseMimeType: "application/json",
            responseSchema: responseSchema,
        }
    });

    const jsonText = response.text.trim();
    if (!jsonText) {
        return [];
    }

    const detectedFaces = JSON.parse(jsonText);
    return detectedFaces as DetectedFace[];
  } catch (error) {
    console.error("Error detecting faces:", error);
    throw new Error("Failed to get response from Gemini API.");
  }
};
