import React, { useState, useEffect } from 'react';
import { Download, AlertTriangle, Lightbulb, Loader2 } from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { motion, AnimatePresence } from 'motion/react';
import { RiskData, SavedPortfolio } from '../types';
import { cn } from '../lib/utils';

interface RiskAnalysisProps {
  riskData: RiskData | null;
  savedPortfolios: SavedPortfolio[];
}

export const RiskAnalysis: React.FC<RiskAnalysisProps> = ({ riskData, savedPortfolios }) => {
  const [activeTestIdx, setActiveTestIdx] = useState(0);
  const [hoveredCell, setHoveredCell] = useState<{ row: string, col: string } | null>(null);

  const [selectedSavedId, setSelectedSavedId] = useState<string>('current');
  const [localRiskData, setLocalRiskData] = useState<RiskData | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (selectedSavedId === 'current') {
      setLocalRiskData(riskData);
      return;
    }

    const saved = savedPortfolios.find(p => p.id === selectedSavedId);
    if (!saved) return;

    setIsLoading(true);
    fetch('/api/risk-data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        weights: saved.optimization.weights,
        investment: saved.investment || 100000
      })
    })
      .then(res => res.json())
      .then(data => {
        setLocalRiskData(data);
        setActiveTestIdx(0);
      })
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, [selectedSavedId, riskData, savedPortfolios]);

  const displayData = localRiskData || riskData;

  if (!displayData) return <div className="flex items-center justify-center h-full">Loading...</div>;

  const activeTest = displayData.stressTests && displayData.stressTests.length > 0
    ? displayData.stressTests[activeTestIdx]
    : { id: 'fallback', scenario: 'N/A', impact: 0, estLoss: 0, description: 'No data' };

  return (
    <div className="space-y-8 animate-in fade-in duration-700 font-risk">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h1 className="text-4xl font-extrabold text-slate-900 font-display">Risk Analysis</h1>
          <p className="text-slate-500">Deep dive into asset correlations and market stress scenarios.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <div className="relative">
            <select
              value={selectedSavedId}
              onChange={(e) => setSelectedSavedId(e.target.value)}
              className="appearance-none bg-white border border-slate-200 pl-4 pr-10 py-2 rounded-xl font-bold text-slate-900 hover:bg-slate-50 transition-colors focus:outline-none focus:ring-2 focus:ring-ares-green cursor-pointer"
            >
              <option value="current">Dashboard Portfolio</option>
              {savedPortfolios.length > 0 && <optgroup label="Saved Portfolios">
                {savedPortfolios.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </optgroup>}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-400">
              <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" /></svg>
            </div>
          </div>
          <button className="bg-white border border-slate-200 px-4 py-2 rounded-xl font-bold flex items-center gap-2 hover:bg-slate-50 transition-colors">
            <Download className="w-4 h-4" /> Export PDF
          </button>
        </div>
      </header>

      {/* Actionable Insights */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 text-ares-green animate-spin" />
        </div>
      ) : (
        <>
          {displayData.insights && displayData.insights.length > 0 && (
            <div className="bg-indigo-50 border border-indigo-100 p-6 rounded-3xl">
              <h3 className="text-lg font-bold text-indigo-900 mb-4 flex items-center gap-2">
                <Lightbulb className="w-5 h-5 text-indigo-500" /> AI Risk Assessment {selectedSavedId !== 'current' && `(${savedPortfolios.find(p => p.id === selectedSavedId)?.name})`}
              </h3>
              <ul className="space-y-3">
                {displayData.insights.map((insight, idx) => {
                  const [title, ...descParts] = insight.split(':');
                  return (
                    <li key={idx} className="flex items-start gap-3 text-indigo-800 text-sm">
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 mt-2 shrink-0" />
                      <span>
                        <strong className="font-extrabold">{title}:</strong> {descParts.join(':')}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
              <h3 className="font-bold text-xl mb-8 flex items-center gap-2">
                Correlation Matrix
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-slate-400 uppercase text-[10px] font-black tracking-widest">
                      <th className="p-4 text-left">Asset</th>
                      {displayData.correlationMatrix.map(row => (
                        <th
                          key={row.id}
                          className={cn(
                            "p-4 text-center transition-colors",
                            hoveredCell?.col === row.id ? "text-ares-green" : ""
                          )}
                        >
                          {row.id}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {riskData.correlationMatrix.map((row) => (
                      <tr key={row.id}>
                        <td className={cn(
                          "p-4 font-bold uppercase transition-colors",
                          hoveredCell?.row === row.id ? "text-ares-green" : "text-slate-900"
                        )}>
                          {row.id}
                        </td>
                        {riskData.correlationMatrix.map(col => {
                          const val = row[col.id];
                          const isHovered = hoveredCell?.row === row.id || hoveredCell?.col === col.id;
                          return (
                            <td
                              key={col.id}
                              className="p-2"
                              onMouseEnter={() => setHoveredCell({ row: row.id, col: col.id })}
                              onMouseLeave={() => setHoveredCell(null)}
                            >
                              <div
                                className={cn(
                                  "p-4 rounded-xl text-center font-bold transition-all",
                                  isHovered ? "ring-2 ring-ares-green/30 scale-105" : "",
                                  val === 1 ? "bg-ares-green text-white" :
                                    val > 0.6 ? "bg-emerald-100 text-emerald-700" : "bg-emerald-50 text-emerald-600"
                                )}
                              >
                                {val.toFixed(2)}
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-6 flex flex-wrap items-center gap-4 text-xs font-bold text-slate-500 justify-end">
                <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-ares-green"></div> 1.00 (Identical)</div>
                <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-emerald-100"></div> &gt; 0.60 (High)</div>
                <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-emerald-50"></div> &lt; 0.60 (Low)</div>
              </div>
            </div>

            <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
              <h3 className="font-bold text-xl mb-8">Contribution to Risk</h3>
              <div className="h-64 mb-8">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={riskData.riskContribution}
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {riskData.riskContribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-4">
                {riskData.riskContribution.map((item) => (
                  <div key={item.name}>
                    <div className="flex justify-between text-sm mb-2">
                      <span className="font-bold text-slate-700">{item.name}</span>
                      <span className="text-slate-500 font-medium">{item.value}%</span>
                    </div>
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${item.value}%` }}
                        className="h-full"
                        style={{ backgroundColor: item.color }}
                      ></motion.div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-white border border-rose-100 p-8 rounded-3xl shadow-sm relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-64 h-64 bg-rose-50 rounded-full -mr-32 -mt-32 opacity-50 group-hover:scale-110 transition-transform duration-700"></div>
            <div className="relative z-10">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-8">
                <div className="flex items-center gap-4">
                  <div className="p-4 bg-rose-50 rounded-2xl text-rose-500 shrink-0">
                    <AlertTriangle className="w-8 h-8" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-2xl text-slate-900">Stress Test Scenarios</h3>
                    <p className="text-slate-500">See how your portfolio performs during historical drawdowns.</p>
                  </div>
                </div>

                <div className="flex gap-2 p-1 bg-slate-50 rounded-xl overflow-x-auto border border-slate-100">
                  {riskData.stressTests?.map((test, idx) => (
                    <button
                      key={test.id}
                      onClick={() => setActiveTestIdx(idx)}
                      className={cn(
                        "px-4 py-2 text-xs font-bold rounded-lg whitespace-nowrap transition-all",
                        activeTestIdx === idx
                          ? "bg-white text-rose-600 shadow-sm border border-slate-200"
                          : "text-slate-500 hover:text-slate-700 hover:bg-slate-100"
                      )}
                    >
                      {test.scenario}
                    </button>
                  ))}
                </div>
              </div>

              <AnimatePresence mode="wait">
                <motion.div
                  key={activeTest.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                  className="grid grid-cols-1 lg:grid-cols-4 gap-6"
                >
                  <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100 lg:col-span-3 flex flex-col justify-center">
                    <h4 className="text-lg font-bold text-slate-900 mb-2">{activeTest.scenario}</h4>
                    <p className="text-sm text-slate-600">{activeTest.description}</p>
                    <div className="mt-4 inline-flex items-center gap-2 bg-rose-50 text-rose-700 px-3 py-1.5 rounded-lg text-xs font-bold w-max">
                      <AlertTriangle className="w-4 h-4" /> Market Drop: {Math.abs(activeTest.impact).toFixed(1)}%
                    </div>
                  </div>
                  <div className="p-6 bg-rose-600 text-white rounded-2xl shadow-lg shadow-rose-200 flex flex-col justify-center relative overflow-hidden">
                    <div className="relative z-10">
                      <p className="text-[10px] opacity-70 font-black uppercase tracking-widest mb-2">Est. Portfolio Loss</p>
                      <div className="flex items-end gap-1 font-display tracking-tight">
                        <span className="text-2xl opacity-80 mb-1">-$</span>
                        <p className="text-5xl font-black">{(activeTest.estLoss / 1000).toFixed(0)}K</p>
                      </div>
                    </div>
                    <AlertTriangle className="w-32 h-32 absolute -right-6 -bottom-6 opacity-10 text-rose-950" />
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
