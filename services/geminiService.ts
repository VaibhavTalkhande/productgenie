
import { GoogleGenAI, Type } from "@google/genai";
import type { ProductAnalysis, AnalysisResult, CsvProduct } from '../types';

const API_KEY = process.env.API_KEY;

if (!API_KEY) {
  throw new Error("API_KEY environment variable not set. Please ensure it's configured in your environment.");
}

const ai = new GoogleGenAI({ apiKey: API_KEY });

const productAnalysisSchema = {
  type: Type.OBJECT,
  properties: {
    userProduct: {
      type: Type.OBJECT,
      properties: {
        url: { type: Type.STRING },
        productName: { type: Type.STRING, description: "A realistic, brand-name product name derived from the URL or input data." },
        currentPrice: { type: Type.NUMBER, description: "A realistic current price for the user's product." },
      },
      required: ["productName", "currentPrice"],
    },
    competitors: {
      type: Type.ARRAY,
      description: "A list of competitor analyses, one for each provided competitor URL or from web search.",
      items: {
        type: Type.OBJECT,
        properties: {
          url: { type: Type.STRING },
          productName: { type: Type.STRING, description: "A realistic, brand-name product name for the competitor's product." },
          price: { type: Type.NUMBER, description: "The competitor's current price." },
          stockStatus: { type: Type.STRING, enum: ['In Stock', 'Low Stock', 'Out of Stock'], description: "The current stock status of the competitor's product." },
          priceTrend: { type: Type.STRING, enum: ['up', 'down', 'stable'], description: "The recent price trend of the competitor's product." },
        },
        required: ["url", "productName", "price", "stockStatus", "priceTrend"],
      },
    },
    suggestedPrice: {
      type: Type.NUMBER,
      description: "The AI-recommended optimal price for the user's product.",
    },
    reasoning: {
      type: Type.STRING,
      description: "A detailed, step-by-step explanation for the suggested price, considering competitor prices, stock, and market position.",
    },
    marketSummary: {
      type: Type.STRING,
      description: "A brief, one-paragraph overview of the current market landscape based on the provided competitors.",
    },
  },
  required: ["userProduct", "competitors", "suggestedPrice", "reasoning", "marketSummary"],
};


export const analyzeSingleProduct = async (userProductUrl: string, competitorUrls: string[]): Promise<ProductAnalysis> => {
  const prompt = `
    You are PredictGenie, an expert AI pricing analyst for e-commerce businesses. Your goal is to provide actionable pricing intelligence.

    Analyze the user's product and their competitors based on the following URLs. For each URL, generate a plausible, brand-specific product name and a realistic price in USD. Also, estimate stock status and recent price trends for competitors.

    User's product URL: ${userProductUrl}
    Competitor URLs:
    ${competitorUrls.map(url => `- ${url}`).join('\n')}

    Based on your analysis of the competitive landscape, determine an optimal selling price for the user's product. This price should aim to maximize profitability while remaining competitive.

    Provide a concise market summary and a detailed reasoning for your price suggestion. The reasoning should clearly reference competitor data points (prices, stock, etc.).

    Please provide the full analysis in the requested JSON format.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: productAnalysisSchema,
        temperature: 0.5,
      },
    });

    const jsonText = response.text.trim();
    if (!jsonText) {
        throw new Error("Received an empty response from the AI. The model might be unable to process the request with the given inputs.");
    }
    const result = JSON.parse(jsonText) as ProductAnalysis;
    return result;
  } catch (error) {
    console.error("Error calling Gemini API for single product:", error);
    if (error instanceof Error) {
        throw new Error(`Failed to get analysis from PredictGenie. Reason: ${error.message}`);
    }
    throw new Error("An unknown error occurred while analyzing prices.");
  }
};


export const analyzeBatchProducts = async (products: CsvProduct[]): Promise<AnalysisResult> => {
    const productDataString = products.map(p => 
        `- Product: "${p.productName}", Price: ${p.currentPrice}, URL: ${p.userProductUrl || 'N/A'}, Competitors: [${p.competitorUrls.join(', ')}]`
    ).join('\n');

    const prompt = `
    You are PredictGenie, an expert AI pricing analyst for e-commerce businesses. Your goal is to provide actionable pricing intelligence for a batch of products.

    Analyze the following list of products. For each product:
    1.  If competitor URLs are provided, analyze them directly.
    2.  If competitor URLs are NOT provided, you MUST use your web search tool to find 2-3 top online competitors for the given product name.
    3.  For each competitor found or provided, generate a plausible, brand-specific product name, a realistic price in USD, and estimate their stock status and recent price trend.
    4.  Provide a concise market summary and detailed reasoning for each product's price suggestion.

    Batch Product Data:
    ${productDataString}

    Return ONLY a single JSON object inside a \`\`\`json ... \`\`\` markdown block.
    The JSON object must contain a 'results' key. The value of 'results' must be an array of analysis objects, one for each product in the input batch. 
    Each analysis object must contain: userProduct (object with productName, currentPrice), competitors (array of objects), suggestedPrice (number), reasoning (string), and marketSummary (string).
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }], // Enable web search
        temperature: 0.5,
      },
    });

    const sources = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];

    let jsonText = response.text.trim();
    const jsonMatch = jsonText.match(/```json\n?([\s\S]*?)\n?```/);
    if (jsonMatch && jsonMatch[1]) {
        jsonText = jsonMatch[1];
    }

    if (!jsonText) {
        throw new Error("Received an empty or invalid response from the AI for batch analysis.");
    }

    const parsedResult = JSON.parse(jsonText);
    
    if (!parsedResult.results || !Array.isArray(parsedResult.results)) {
        throw new Error("API response is missing the 'results' array or it is not in the correct format.");
    }
    
    // Add sources to each result item
    const resultsWithSources: AnalysisResult = parsedResult.results.map((item: ProductAnalysis) => ({
        ...item,
        sources: sources.length > 0 ? sources : undefined,
    }));

    return resultsWithSources;
  } catch (error) {
    console.error("Error calling Gemini API for batch analysis:", error);
    if (error instanceof Error) {
        throw new Error(`Failed to get batch analysis from PredictGenie. Reason: ${error.message}`);
    }
    throw new Error("An unknown error occurred while analyzing the batch of products.");
  }
};
