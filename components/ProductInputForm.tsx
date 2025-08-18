
import React, { useState, useMemo } from 'react';
import { Card } from './common/Card';
import { PlusIcon } from './icons/PlusIcon';
import { TrashIcon } from './icons/TrashIcon';
import type { CsvProduct } from '../types';

interface ProductInputFormProps {
  onAnalyze: (input: { type: 'url', userProductUrl: string, competitorUrls: string[] } | { type: 'csv', products: CsvProduct[] }) => void;
  isLoading: boolean;
}

export const ProductInputForm: React.FC<ProductInputFormProps> = ({ onAnalyze, isLoading }) => {
  const [inputMode, setInputMode] = useState<'url' | 'csv'>('url');

  // URL mode state
  const [userProductUrl, setUserProductUrl] = useState('https://www.example-store.com/products/pro-camera-x1');
  const [competitorUrls, setCompetitorUrls] = useState([
    'https://www.competitor-a.com/pro-camera-x1',
    'https://www.competitor-b.com/cameras/pro-cam-x1-model',
  ]);
  
  // CSV mode state
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvError, setCsvError] = useState<string | null>(null);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvData, setCsvData] = useState<Record<string, string>[]>([]);
  const [fieldMapping, setFieldMapping] = useState({
    productName: '',
    currentPrice: '',
    userProductUrl: '',
    competitorUrls: [] as string[],
  });

  const handleCompetitorUrlChange = (index: number, value: string) => {
    const newUrls = [...competitorUrls];
    newUrls[index] = value;
    setCompetitorUrls(newUrls);
  };

  const addCompetitor = () => setCompetitorUrls([...competitorUrls, '']);
  const removeCompetitor = (index: number) => setCompetitorUrls(competitorUrls.filter((_, i) => i !== index));

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setCsvFile(file || null);
    setCsvError(null);
    setCsvHeaders([]);
    setCsvData([]);
    setFieldMapping({ productName: '', currentPrice: '', userProductUrl: '', competitorUrls: [] });

    if (file) {
      if (!file.type.includes('csv') && !file.name.endsWith('.csv')) {
        setCsvError("Invalid file type. Please upload a .csv file.");
        return;
      }
      try {
        const { headers, data } = await parseCsv(file);
        setCsvHeaders(headers);
        setCsvData(data);
      } catch (error) {
        setCsvError(error instanceof Error ? error.message : "Failed to parse CSV.");
      }
    }
  };

  const parseCsv = (file: File): Promise<{ headers: string[], data: Record<string, string>[] }> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const text = event.target?.result as string;
          // Normalize line endings and filter empty rows
          const rows = text.replace(/\r\n/g, '\n').split('\n').map(row => row.trim()).filter(row => row);
          if (rows.length < 2) return reject(new Error("CSV file must contain a header row and at least one data row."));
          
          const headerRow = rows.shift()!;
          const headers = headerRow.split(',').map(h => h.trim());
          
          // Regex to split by comma, but ignore commas inside double quotes
          const regex = /,(?=(?:(?:[^"]*"){2})*[^"]*$)/;

          const data = rows.map((row) => {
            const values = row.split(regex).map(val => val.trim().replace(/^"|"$/g, '')); // Trim and remove surrounding quotes
            
            return headers.reduce((obj, header, index) => {
              obj[header] = values[index] || '';
              return obj;
            }, {} as Record<string, string>);
          });
          resolve({ headers, data });
        } catch (e) {
            reject(e instanceof Error ? e : new Error("An unexpected error occurred during CSV parsing."));
        }
      };
      reader.onerror = () => reject(new Error("Failed to read the file."));
      reader.readAsText(file);
    });
  };

  const handleCompetitorHeaderToggle = (header: string) => {
    setFieldMapping(prev => {
        const newCompetitorUrls = prev.competitorUrls.includes(header)
            ? prev.competitorUrls.filter(h => h !== header)
            : [...prev.competitorUrls, header];
        return { ...prev, competitorUrls: newCompetitorUrls };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;

    if (inputMode === 'url') {
      const nonEmptyCompetitors = competitorUrls.filter(url => url.trim() !== '');
      if (userProductUrl.trim() && nonEmptyCompetitors.length > 0) {
        onAnalyze({ type: 'url', userProductUrl, competitorUrls: nonEmptyCompetitors });
      }
    } else {
      setCsvError(null);
      if (!csvFile) return setCsvError("Please select a CSV file.");
      if (!fieldMapping.productName || !fieldMapping.currentPrice) {
        return setCsvError("You must map columns for 'Product Name' and 'Current Price'.");
      }

      try {
        const { validProducts, errors } = csvData.reduce<{ validProducts: CsvProduct[], errors: string[] }>((acc, row, index) => {
          const rowNum = index + 2; // For user-facing messages (1-based index + header)
          const productName = row[fieldMapping.productName];

          // Silently skip rows that are likely blank
          if (!productName || productName.trim() === '') {
            return acc;
          }

          const priceString = (row[fieldMapping.currentPrice] || '').replace(/[^0-9.-]+/g, "");

          if (priceString === '') {
            acc.errors.push(`Row ${rowNum}: Price is missing.`);
            return acc;
          }

          const price = parseFloat(priceString);

          if (isNaN(price)) {
            acc.errors.push(`Row ${rowNum}: Invalid price value "${row[fieldMapping.currentPrice]}".`);
            return acc;
          }

          const competitorUrls = fieldMapping.competitorUrls.map(header => row[header]).filter(Boolean);

          acc.validProducts.push({
            productName: productName,
            currentPrice: price,
            userProductUrl: row[fieldMapping.userProductUrl] || '',
            competitorUrls: competitorUrls,
          });

          return acc;
        }, { validProducts: [], errors: [] });
        
        if (validProducts.length === 0) {
          const errorMessage = errors.length > 0 ? errors.join(' ') : "The CSV contains no rows that could be analyzed.";
          return setCsvError(`Analysis failed. ${errorMessage}`);
        }

        if (errors.length > 0) {
          setCsvError(`Warning: Skipped ${errors.length} invalid rows. Reasons: ${errors.join(' ')}`);
        } else {
          setCsvError(null); // Clear previous errors
        }

        onAnalyze({ type: 'csv', products: validProducts });

      } catch (error) {
        setCsvError(error instanceof Error ? error.message : "Failed to process products from CSV.");
      }
    }
  };

  const downloadSampleCsv = () => {
    const csvContent = "productName,currentPrice,userProductUrl,competitorUrl_1,competitorUrl_2\n" +
      "\"Pro Camera X1, with stand\",499.99,https://yourstore.com/pro-camera,https://competitorA.com/camera-x1,https://competitorB.com/pro-cam-x1\n" +
      "Wireless Headphones Z,$149.00,https://yourstore.com/headphones-z,https://competitorA.com/headphones-z-pro,https://competitorC.com/audio/wireless-z\n" +
      "Smart Fitness Watch V2,229.50,https://yourstore.com/smart-watch,,\n";
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", "sample_products.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };
  
  const TabButton = ({ mode, children }: {mode: 'url' | 'csv', children: React.ReactNode}) => (
      <button type="button" role="tab" aria-selected={inputMode === mode} onClick={() => setInputMode(mode)}
          className={`px-4 py-2 text-sm font-semibold rounded-md transition-colors ${inputMode === mode ? 'bg-brand-primary text-white' : 'text-dark-text-secondary hover:bg-slate-700'}`}>
          {children}
      </button>
  );

  const CsvMappingInterface = () => (
    <div className="mt-6 space-y-4 p-4 border border-dark-border rounded-lg bg-slate-900/50">
        <h3 className="font-semibold text-white">Map Your CSV Columns</h3>
        <p className="text-sm text-dark-text-secondary">Match the columns from your file to the required fields.</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Required fields */}
            <div>
                <label className="block text-sm font-medium text-dark-text-secondary mb-1">Product Name <span className="text-red-400">*</span></label>
                <select value={fieldMapping.productName} onChange={e => setFieldMapping(prev => ({...prev, productName: e.target.value}))} className="w-full bg-slate-900 border border-dark-border rounded-md px-3 py-2 text-sm">
                    <option value="">Select column...</option>
                    {csvHeaders.map(h => <option key={`pn-${h}`} value={h}>{h}</option>)}
                </select>
            </div>
            <div>
                <label className="block text-sm font-medium text-dark-text-secondary mb-1">Current Price <span className="text-red-400">*</span></label>
                <select value={fieldMapping.currentPrice} onChange={e => setFieldMapping(prev => ({...prev, currentPrice: e.target.value}))} className="w-full bg-slate-900 border border-dark-border rounded-md px-3 py-2 text-sm">
                    <option value="">Select column...</option>
                    {csvHeaders.map(h => <option key={`cp-${h}`} value={h}>{h}</option>)}
                </select>
            </div>
            <div>
                <label className="block text-sm font-medium text-dark-text-secondary mb-1">Your Product URL <span className="text-xs">(Optional)</span></label>
                <select value={fieldMapping.userProductUrl} onChange={e => setFieldMapping(prev => ({...prev, userProductUrl: e.target.value}))} className="w-full bg-slate-900 border border-dark-border rounded-md px-3 py-2 text-sm">
                    <option value="">Select column...</option>
                    {csvHeaders.map(h => <option key={`up-${h}`} value={h}>{h}</option>)}
                </select>
            </div>
        </div>
        <div>
            <label className="block text-sm font-medium text-dark-text-secondary mb-2">Competitor URLs <span className="text-xs">(Optional)</span></label>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 max-h-40 overflow-y-auto p-2 border border-dark-border rounded-md">
                {csvHeaders.map(header => (
                    <label key={`comp-${header}`} className="flex items-center space-x-2 text-sm p-1 rounded-md hover:bg-slate-700 transition-colors">
                        <input type="checkbox" checked={fieldMapping.competitorUrls.includes(header)} onChange={() => handleCompetitorHeaderToggle(header)} className="rounded bg-slate-800 border-slate-600 text-brand-primary focus:ring-brand-primary"/>
                        <span className="truncate" title={header}>{header}</span>
                    </label>
                ))}
            </div>
             <p className="text-xs text-dark-text-secondary mt-2">If no competitor URLs are mapped, PredictGenie will use web search to find them.</p>
        </div>
    </div>
  );

  return (
    <Card>
      <div role="tablist" className="flex space-x-2 border-b border-dark-border mb-6 pb-4">
          <TabButton mode="url">Analyze by URL</TabButton>
          <TabButton mode="csv">Analyze by CSV</TabButton>
      </div>

      <form onSubmit={handleSubmit}>
        {inputMode === 'url' ? (
          <div className="space-y-6">
            <div>
              <label htmlFor="user-product-url" className="block text-sm font-medium text-dark-text-secondary mb-2">Your Product URL</label>
              <input type="url" id="user-product-url" value={userProductUrl} onChange={(e) => setUserProductUrl(e.target.value)} placeholder="https://www.yourstore.com/product" required className="w-full bg-slate-900 border border-dark-border rounded-md px-3 py-2 text-dark-text-primary focus:ring-2 focus:ring-brand-primary focus:border-brand-primary transition"/>
            </div>
            <div>
              <h3 className="text-sm font-medium text-dark-text-secondary mb-2">Competitor Product URLs</h3>
              <div className="space-y-3">
                {competitorUrls.map((url, index) => (
                  <div key={index} className="flex items-center space-x-2">
                    <input type="url" value={url} onChange={(e) => handleCompetitorUrlChange(index, e.target.value)} placeholder={`https://www.competitor${index + 1}.com/product`} required className="flex-grow bg-slate-900 border border-dark-border rounded-md px-3 py-2 text-dark-text-primary focus:ring-2 focus:ring-brand-primary focus:border-brand-primary transition"/>
                    <button type="button" onClick={() => removeCompetitor(index)} className="p-2 text-dark-text-secondary hover:text-red-400 transition rounded-md hover:bg-slate-700" aria-label="Remove competitor"><TrashIcon className="w-5 h-5" /></button>
                  </div>
                ))}
              </div>
              <button type="button" onClick={addCompetitor} className="mt-4 flex items-center space-x-2 text-sm text-brand-primary hover:text-teal-300 transition"><PlusIcon className="w-5 h-5" /><span>Add Competitor</span></button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label htmlFor="csv-upload" className="block text-sm font-medium text-dark-text-secondary mb-2">Upload Products CSV</label>
              <input type="file" id="csv-upload" accept=".csv" onChange={handleFileChange} className="w-full text-sm text-dark-text-secondary file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-slate-700 file:text-dark-text-primary hover:file:bg-slate-600"/>
            </div>
            {csvHeaders.length > 0 ? <CsvMappingInterface /> : null}
            {csvError && <p className={`text-sm mt-2 ${csvError.startsWith('Warning:') ? 'text-yellow-400' : 'text-red-400'}`}>{csvError}</p>}
            <div>
                <button type="button" onClick={downloadSampleCsv} className="text-sm text-brand-primary hover:text-teal-300 transition">Download Sample CSV</button>
            </div>
          </div>
        )}
        <div className="mt-8 pt-6 border-t border-dark-border">
          <button type="submit" disabled={isLoading} className="w-full flex justify-center items-center bg-brand-primary text-white font-bold py-3 px-4 rounded-md hover:bg-brand-secondary transition-colors disabled:bg-slate-600 disabled:cursor-not-allowed">
            {isLoading ? 'Analyzing...' : 'Analyze Prices'}
          </button>
        </div>
      </form>
    </Card>
  );
};
