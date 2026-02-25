import React from 'react';
import { Download, AlertTriangle } from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { motion } from 'motion/react';
import { RiskData } from '../types';
import { cn } from '../lib/utils';

interface RiskAnalysisProps {
  riskData: RiskData | null;
}

export const RiskAnalysis: React.FC<RiskAnalysisProps> = ({ riskData }) => {
  if (!riskData) return <div className="flex items-center justify-center h-full">Loading...</div>;

  return (
    <div className="space-y-8 animate-in fade-in duration-700 font-risk">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h1 className="text-4xl font-extrabold text-slate-900 font-display">Risk Analysis</h1>
          <p className="text-slate-500">Deep dive into asset correlations and market stress scenarios.</p>
        </div>
        <div className="flex gap-3">
          <button className="bg-white border border-slate-200 px-4 py-2 rounded-xl font-bold flex items-center gap-2 hover:bg-slate-50 transition-colors">
            <Download className="w-4 h-4" /> Export PDF
          </button>
          <button className="bg-slate-900 text-white px-4 py-2 rounded-xl font-bold hover:bg-slate-800 transition-colors">Last 30 Days</button>
        </div>
      </header>

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
                  {riskData.correlationMatrix.map(row => (
                    <th key={row.id} className="p-4 text-center">{row.id}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {riskData.correlationMatrix.map((row) => (
                  <tr key={row.id}>
                    <td className="p-4 font-bold text-slate-900 uppercase">{row.id}</td>
                    {riskData.correlationMatrix.map(col => {
                      const val = row[col.id];
                      return (
                        <td key={col.id} className="p-2">
                          <div 
                            className={cn(
                              "p-4 rounded-xl text-center font-bold transition-all hover:scale-105",
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
          <div className="flex items-center gap-4 mb-8">
            <div className="p-4 bg-rose-50 rounded-2xl text-rose-500">
              <AlertTriangle className="w-8 h-8" />
            </div>
            <div>
              <h3 className="font-extrabold text-2xl text-slate-900">Stress Test: {riskData.stressTest.scenario}</h3>
              <p className="text-slate-500">{riskData.stressTest.description}</p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100">
              <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-2">Scenario Impact</p>
              <p className="text-3xl font-black text-rose-500">{riskData.stressTest.impact.toFixed(1)}%</p>
              <p className="text-xs text-slate-500 mt-1">Market Crash Simulation</p>
            </div>
            <div className="p-6 bg-rose-600 text-white rounded-2xl shadow-lg shadow-rose-200 lg:col-start-4">
              <p className="text-[10px] opacity-70 font-black uppercase tracking-widest mb-2">Est. Portfolio Loss</p>
              <p className="text-3xl font-black">-${(riskData.stressTest.estLoss / 1000).toFixed(0)}K</p>
              <p className="text-xs opacity-70 mt-1">Potential Drawdown</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
