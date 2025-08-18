
import React, { useState } from 'react';
import type { AnalysisResult, Competitor, ProductAnalysis } from '../types';
import { Card } from './common/Card';
import { ArrowUpIcon } from './icons/ArrowUpIcon';
import { ArrowDownIcon } from './icons/ArrowDownIcon';
import { EqualsIcon } from './icons/EqualsIcon';

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
};

const TrendIcon: React.FC<{ trend: Competitor['priceTrend'] }> = ({ trend }) => {
  switch (trend) {
    case 'up':
      return <ArrowUpIcon className="w-5 h-5 text-red-400" />;
    case 'down':
      return <ArrowDownIcon className="w-5 h-5 text-green-400" />;
    case 'stable':
      return <EqualsIcon className="w-5 h-5 text-gray-400" />;
    default:
      return null;
  }
};

const StockStatusBadge: React.FC<{ status: Competitor['stockStatus'] }> = ({ status }) => {
    const baseClasses = "px-2 py-0.5 text-xs font-semibold rounded-full";
    let colorClasses = "";
    switch (status) {
        case "In Stock":
            colorClasses = "bg-green-800 text-green-200";
            break;
        case "Low Stock":
            colorClasses = "bg-yellow-800 text-yellow-200";
            break;
        case "Out of Stock":
            colorClasses = "bg-red-800 text-red-200";
            break;
    }
    return <span className={`${baseClasses} ${colorClasses}`}>{status}</span>;
};

const SingleResultDisplay: React.FC<{ analysis: ProductAnalysis }> = ({ analysis }) => {
  const { userProduct, competitors, suggestedPrice, reasoning, marketSummary } = analysis;
  return (
    <div className="space-y-8">
      <Card className="bg-gradient-to-br from-teal-900 via-slate-800 to-slate-800 border-brand-primary">
        <h2 className="text-xl font-bold text-white mb-2">PredictGenie Suggestion</h2>
        <div className="flex items-baseline justify-center text-center my-6">
          <span className="text-5xl font-extrabold text-white tracking-tight">{formatCurrency(suggestedPrice)}</span>
        </div>
        <h3 className="font-semibold text-white mb-2">Reasoning:</h3>
        <p className="text-dark-text-secondary text-sm">{reasoning}</p>
      </Card>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="md:col-span-1">
          <h3 className="font-bold text-white mb-2">Your Product</h3>
          <p className="text-sm text-dark-text-secondary truncate" title={userProduct.productName}>{userProduct.productName}</p>
          <p className="text-3xl font-bold text-brand-primary mt-2">{formatCurrency(userProduct.currentPrice)}</p>
           {userProduct.url && <a href={userProduct.url} target="_blank" rel="noopener noreferrer" className="text-xs text-slate-500 hover:text-brand-primary mt-1 block truncate">
                {userProduct.url}
            </a>}
        </Card>

        <Card className="md:col-span-2">
            <h3 className="font-bold text-white mb-2">Market Summary</h3>
            <p className="text-sm text-dark-text-secondary">{marketSummary}</p>
        </Card>
      </div>

      <div>
        <h2 className="text-xl font-bold text-white mb-4">Competitor Analysis</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {competitors.map((competitor, index) => (
            <Card key={index}>
              <div className="flex flex-col h-full">
                <div className="flex-grow">
                    <p className="font-semibold text-white truncate" title={competitor.productName}>{competitor.productName}</p>
                    <a href={competitor.url} target="_blank" rel="noopener noreferrer" className="text-xs text-slate-500 hover:text-brand-primary block truncate">
                        {competitor.url}
                    </a>
                </div>
                <div className="mt-4 flex items-center justify-between">
                  <p className="text-2xl font-bold text-dark-text-primary">{formatCurrency(competitor.price)}</p>
                  <TrendIcon trend={competitor.priceTrend} />
                </div>
                <div className="mt-2">
                    <StockStatusBadge status={competitor.stockStatus} />
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
};


const BatchResultDisplay: React.FC<{ results: AnalysisResult }> = ({ results }) => {
    const [expandedRow, setExpandedRow] = useState<number | null>(null);

    const getPriceChange = (current: number, suggested: number) => {
        if (current === 0) return { value: 0, class: 'text-gray-400' };
        const change = ((suggested - current) / current) * 100;
        let colorClass = 'text-gray-400';
        if (change > 0) colorClass = 'text-green-400';
        if (change < 0) colorClass = 'text-red-400';
        return { value: change, class: colorClass };
    };

    return (
        <Card>
            <h2 className="text-xl font-bold text-white mb-4">Batch Analysis Results</h2>
            <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                    <thead className="border-b border-dark-border">
                        <tr>
                            <th className="py-2 px-3 text-left font-semibold text-dark-text-secondary">Product</th>
                            <th className="py-2 px-3 text-right font-semibold text-dark-text-secondary">Your Price</th>
                            <th className="py-2 px-3 text-right font-semibold text-dark-text-secondary">Suggested Price</th>
                            <th className="py-2 px-3 text-right font-semibold text-dark-text-secondary">Change</th>
                            <th className="py-2 px-3 text-center font-semibold text-dark-text-secondary">Details</th>
                        </tr>
                    </thead>
                    <tbody>
                        {results.map((item, index) => {
                            const change = getPriceChange(item.userProduct.currentPrice, item.suggestedPrice);
                            const isExpanded = expandedRow === index;
                            return (
                                <React.Fragment key={index}>
                                    <tr className="border-b border-dark-border hover:bg-slate-800/50">
                                        <td className="py-3 px-3 text-white font-medium truncate max-w-xs" title={item.userProduct.productName}>{item.userProduct.productName}</td>
                                        <td className="py-3 px-3 text-right text-dark-text-secondary">{formatCurrency(item.userProduct.currentPrice)}</td>
                                        <td className="py-3 px-3 text-right text-brand-primary font-bold">{formatCurrency(item.suggestedPrice)}</td>
                                        <td className={`py-3 px-3 text-right font-medium ${change.class}`}>{change.value.toFixed(1)}%</td>
                                        <td className="py-3 px-3 text-center">
                                            <button onClick={() => setExpandedRow(isExpanded ? null : index)} className="text-brand-primary hover:text-teal-300">
                                                {isExpanded ? 'Hide' : 'View'}
                                            </button>
                                        </td>
                                    </tr>
                                    {isExpanded && (
                                        <tr className="bg-slate-900/50">
                                            <td colSpan={5} className="p-4">
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                    <div>
                                                        <h4 className="font-semibold text-white mb-2">Reasoning</h4>
                                                        <p className="text-dark-text-secondary text-sm">{item.reasoning}</p>
                                                        <h4 className="font-semibold text-white mt-4 mb-2">Market Summary</h4>
                                                        <p className="text-dark-text-secondary text-sm">{item.marketSummary}</p>
                                                    </div>
                                                    <div>
                                                        <h4 className="font-semibold text-white mb-2">Competitors</h4>
                                                        <ul className="space-y-2">
                                                            {item.competitors.map((c, i) => (
                                                                <li key={i} className="flex justify-between items-center text-dark-text-secondary">
                                                                    <span className="truncate pr-2" title={c.productName}>{c.productName}</span>
                                                                    <div className="flex items-center space-x-2 flex-shrink-0">
                                                                        <StockStatusBadge status={c.stockStatus} />
                                                                        <span className="font-mono text-white">{formatCurrency(c.price)}</span>
                                                                        <TrendIcon trend={c.priceTrend} />
                                                                    </div>
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    </div>
                                                </div>
                                                {item.sources && item.sources.length > 0 && (
                                                    <div className="mt-4 pt-4 border-t border-dark-border">
                                                        <h4 className="font-semibold text-white mb-2">Sources</h4>
                                                        <ul className="list-disc list-inside space-y-1">
                                                            {item.sources.map((source, i) => (
                                                                <li key={i} className="text-sm text-dark-text-secondary truncate">
                                                                    <a href={source.web.uri} target="_blank" rel="noopener noreferrer" className="text-brand-primary hover:underline" title={source.web.uri}>
                                                                        {source.web.title || source.web.uri}
                                                                    </a>
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                    )}
                                </React.Fragment>
                            )
                        })}
                    </tbody>
                </table>
            </div>
        </Card>
    );
};

export const ResultsDisplay: React.FC<{ result: AnalysisResult }> = ({ result }) => {
  return (
      <div className="mt-8 space-y-8 animate-fade-in">
          {result.length === 1 ? (
              <SingleResultDisplay analysis={result[0]} />
          ) : (
              <BatchResultDisplay results={result} />
          )}
      </div>
  );
};
