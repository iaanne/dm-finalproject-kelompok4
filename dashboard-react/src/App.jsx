import React, { useState, useEffect, useMemo, startTransition } from 'react';
import Papa from 'papaparse';
import {
  TrendingUp,
  AlertTriangle,
  TrendingDown,
  Info,
  ShieldAlert,
  DollarSign,
  Layers,
  Globe,
  Sliders,
  Calendar,
  ChevronRight,
  Sparkles,
  BookOpen,
  CheckCircle,
  Activity
} from 'lucide-react';

// Color Mapping for Stability
const COLORS = {
  stable: '#10b981', // emerald-500
  moderate: '#f59e0b', // amber-500
  vulnerable: '#ef4444', // red-500
  grid: '#1e293b', // slate-800
  text: '#94a3b8' // slate-400
};

const COLOR_MAP = {
  'A - Stable': COLORS.stable,
  'B - Moderate': COLORS.moderate,
  'C - Vulnerable': COLORS.vulnerable
};

const defaultLayout = {
  paper_bgcolor: 'rgba(0,0,0,0)',
  plot_bgcolor: 'rgba(0,0,0,0)',
  font: {
    color: '#94a3b8',
    family: 'ui-sans-serif, system-ui, -apple-system, sans-serif'
  },
  margin: { t: 30, b: 40, l: 50, r: 20 },
  xaxis: {
    type: 'linear',
    gridcolor: '#1e293b',
    zerolinecolor: '#1e293b',
    tickfont: { color: '#94a3b8', size: 10 }
  },
  yaxis: {
    type: 'linear',
    gridcolor: '#1e293b',
    zerolinecolor: '#1e293b',
    tickfont: { color: '#94a3b8', size: 10 }
  }
};

function App() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filter States
  const [selectedCurrencies, setSelectedCurrencies] = useState([]);
  const [yearRange, setYearRange] = useState([2015, 2023]);
  const [localYearRange, setLocalYearRange] = useState([2015, 2023]);
  const [activeTab, setActiveTab] = useState('overview');

  // Single Currency Inspection State
  const [inspectCurrency, setInspectCurrency] = useState('');

  // Load Data
  useEffect(() => {
    Papa.parse('/data_clustering_monthly.csv', {
      download: true,
      header: true,
      dynamicTyping: true,
      skipEmptyLines: true,
      complete: (results) => {
        if (results.errors.length > 0) {
          console.error("PapaParse errors:", results.errors);
        }
        
        const parsedData = results.data.map(d => ({
          ...d,
          PCA1: d.PCA1 !== null && d.PCA1 !== undefined ? parseFloat(d.PCA1) : null,
          PCA2: d.PCA2 !== null && d.PCA2 !== undefined ? parseFloat(d.PCA2) : null,
          DateStr: `${d.Year}-${String(d.Month).padStart(2, '0')}`,
          VolPct: d.Volatility * 100
        }));

        // Sort chronologically
        parsedData.sort((a, b) => {
          if (a.Year !== b.Year) return a.Year - b.Year;
          return a.Month - b.Month;
        });

        setData(parsedData);
        
        // Auto-select all currencies initially
        const currencies = Array.from(new Set(parsedData.map(item => item.Currency))).filter(Boolean);
        setSelectedCurrencies(currencies);
        if (currencies.length > 0) {
          setInspectCurrency(currencies[0]);
        }

        const years = parsedData.map(d => d.Year).filter(Boolean);
        if (years.length > 0) {
          const minYr = Math.min(...years);
          const maxYr = Math.max(...years);
          setYearRange([minYr, maxYr]);
          setLocalYearRange([minYr, maxYr]);
        }
        
        setLoading(false);
      },
      error: (err) => {
        console.error("Error loading CSV:", err);
        setError("Gagal memuat data CSV stabilitas mata uang.");
        setLoading(false);
      }
    });
  }, []);

  // Available metadata lists
  const allCurrencies = useMemo(() => {
    return Array.from(new Set(data.map(d => d.Currency))).filter(Boolean).sort();
  }, [data]);

  const allYears = useMemo(() => {
    const years = data.map(d => d.Year).filter(Boolean);
    if (years.length === 0) return [2015, 2023];
    return [Math.min(...years), Math.max(...years)];
  }, [data]);

  // Filtered Data
  const filteredData = useMemo(() => {
    return data.filter(d => 
      selectedCurrencies.includes(d.Currency) &&
      d.Year >= yearRange[0] &&
      d.Year <= yearRange[1]
    );
  }, [data, selectedCurrencies, yearRange]);

  // Handle Multi-select Currency Toggle
  const toggleCurrency = (currency) => {
    const nextCurrencies = selectedCurrencies.includes(currency)
      ? (selectedCurrencies.length > 1 ? selectedCurrencies.filter(c => c !== currency) : selectedCurrencies)
      : [...selectedCurrencies, currency];
    
    startTransition(() => {
      setSelectedCurrencies(nextCurrencies);
    });
  };

  // Select All / Deselect All
  const handleSelectAllCurrencies = (all = true) => {
    startTransition(() => {
      if (all) {
        setSelectedCurrencies(allCurrencies);
      } else {
        if (allCurrencies.length > 0) {
          setSelectedCurrencies([allCurrencies[0]]); // Keep at least one
        }
      }
    });
  };

  // Metrics calculation
  const metrics = useMemo(() => {
    const total = filteredData.length;
    if (total === 0) return { total: 0, stableRatio: 0, moderateRatio: 0, vulnerableRatio: 0, avgVolatility: 0 };
    
    const stableCount = filteredData.filter(d => d.Stability_Label === 'A - Stable').length;
    const moderateCount = filteredData.filter(d => d.Stability_Label === 'B - Moderate').length;
    const vulnerableCount = filteredData.filter(d => d.Stability_Label === 'C - Vulnerable').length;

    const stableRatio = (stableCount / total) * 100;
    const moderateRatio = (moderateCount / total) * 100;
    const vulnerableRatio = (vulnerableCount / total) * 100;
    
    const sumVolatility = filteredData.reduce((acc, curr) => acc + (curr.Volatility || 0), 0);
    const avgVolatility = (sumVolatility / total) * 100;

    return {
      total,
      stableRatio,
      moderateRatio,
      vulnerableRatio,
      avgVolatility
    };
  }, [filteredData]);

  // Tab 1: PCA Data Setup
  const pcaSeries = useMemo(() => {
    const stable = [];
    const moderate = [];
    const vulnerable = [];

    filteredData.forEach(d => {
      if (d.PCA1 === null || d.PCA2 === null) return;
      const point = {
        PCA1: d.PCA1,
        PCA2: d.PCA2,
        Currency: d.Currency,
        Year: d.Year,
        Month: d.Month,
        Volatility: d.Volatility,
        Inflation: d.Inflation,
        Mean: d.Mean,
        Stability_Label: d.Stability_Label,
        AHC_Cluster: d.AHC_Cluster
      };

      if (d.Stability_Label === 'A - Stable') stable.push(point);
      else if (d.Stability_Label === 'B - Moderate') moderate.push(point);
      else if (d.Stability_Label === 'C - Vulnerable') vulnerable.push(point);
    });

    return { stable, moderate, vulnerable };
  }, [filteredData]);

  // Tab 1: Pie Chart Data
  const pieChartData = useMemo(() => {
    const counts = { stable: 0, moderate: 0, vulnerable: 0 };
    filteredData.forEach(d => {
      if (d.Stability_Label === 'A - Stable') counts.stable++;
      else if (d.Stability_Label === 'B - Moderate') counts.moderate++;
      else if (d.Stability_Label === 'C - Vulnerable') counts.vulnerable++;
    });

    const total = counts.stable + counts.moderate + counts.vulnerable;
    if (total === 0) return [];

    return [
      { name: 'Stable', value: counts.stable, color: COLORS.stable },
      { name: 'Moderate', value: counts.moderate, color: COLORS.moderate },
      { name: 'Vulnerable', value: counts.vulnerable, color: COLORS.vulnerable }
    ];
  }, [filteredData]);

  // Tab 1: Bar Chart Data (Stability Distribution per Currency)
  const barChartData = useMemo(() => {
    const currencyMap = {};
    
    // Initialize
    allCurrencies.forEach(curr => {
      currencyMap[curr] = { currency: curr, Stable: 0, Moderate: 0, Vulnerable: 0 };
    });

    // Populate
    filteredData.forEach(d => {
      if (!currencyMap[d.Currency]) return;
      if (d.Stability_Label === 'A - Stable') currencyMap[d.Currency].Stable++;
      else if (d.Stability_Label === 'B - Moderate') currencyMap[d.Currency].Moderate++;
      else if (d.Stability_Label === 'C - Vulnerable') currencyMap[d.Currency].Vulnerable++;
    });

    return Object.values(currencyMap).filter(item => 
      selectedCurrencies.includes(item.currency)
    );
  }, [filteredData, allCurrencies, selectedCurrencies]);

  // Tab 2: Selected Currency Timeline Data
  const currencyTimelineData = useMemo(() => {
    if (!inspectCurrency) return [];
    return data.filter(d => 
      d.Currency === inspectCurrency &&
      d.Year >= yearRange[0] &&
      d.Year <= yearRange[1]
    );
  }, [data, inspectCurrency, yearRange]);

  // Tab 3: Latest Month Health Index & Policy Actions
  const policyActionData = useMemo(() => {
    if (data.length === 0) return [];
    
    // Find the latest year and month in the dataset
    const years = data.map(d => d.Year).filter(Boolean);
    const maxYear = Math.max(...years);
    const months = data.filter(d => d.Year === maxYear).map(d => d.Month).filter(Boolean);
    const maxMonth = Math.max(...months);

    // Filter data for the latest month
    const latestMonthData = data.filter(d => d.Year === maxYear && d.Month === maxMonth);

    return latestMonthData.map(d => {
      const volScore = Math.min((d.Volatility || 0) * 300, 50); // weight max 50
      const infScore = Math.min(Math.max((d.Inflation || 0) * 2, 0), 30); // weight max 30
      const pctScore = Math.min(Math.abs(d.Pct_Change || 0) * 2, 20); // weight max 20
      
      const rawScore = volScore + infScore + pctScore;
      const vulnerabilityScore = Math.round(Math.min(rawScore, 100));

      let riskLevel = 'Low';
      let riskColor = 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
      let policyAdvice = '';

      if (d.Stability_Label === 'C - Vulnerable' || vulnerabilityScore >= 60) {
        riskLevel = 'High';
        riskColor = 'text-rose-400 bg-rose-500/10 border-rose-500/20';
        policyAdvice = 'Lakukan intervensi valas (FX intervention) langsung untuk menstabilkan kurs bilateral. Pertimbangkan penyesuaian suku bunga acuan domestik guna meredam pelemahan kurs dan outflow modal.';
      } else if (d.Stability_Label === 'B - Moderate' || vulnerabilityScore >= 35) {
        riskLevel = 'Medium';
        riskColor = 'text-amber-400 bg-amber-500/10 border-amber-500/20';
        policyAdvice = 'Verbal intervention & persiapan bantalan likuiditas ganda (liquidity buffer). Dorong transaksi lindung nilai (hedging) bagi pelaku pasar domestik.';
      } else {
        riskLevel = 'Low';
        riskColor = 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
        policyAdvice = 'Tidak diperlukan intervensi pasar langsung. Fokus pada penguatan cadangan devisa dan stabilitas makroprudensial.';
      }

      return {
        ...d,
        vulnerabilityScore,
        riskLevel,
        riskColor,
        policyAdvice,
        latestDateStr: `${maxYear}-${String(maxMonth).padStart(2, '0')}`
      };
    });
  }, [data]);

  // Tab 3: Local Currency Transaction (LCT) Bilateral Matrix
  const lctBilateralMatrix = useMemo(() => {
    if (data.length === 0) return [];

    const currencyStats = {};
    const uniqueMonths = Array.from(new Set(data.map(d => d.DateStr))).sort().reverse();
    const last12Months = uniqueMonths.slice(0, 12);

    allCurrencies.forEach(curr => {
      const currData = data.filter(d => d.Currency === curr && last12Months.includes(d.DateStr));
      const stableMonths = currData.filter(d => d.Stability_Label === 'A - Stable').length;
      
      const stabilityRatio = currData.length > 0 ? (stableMonths / currData.length) : 0;
      const avgVol = currData.length > 0 ? (currData.reduce((acc, val) => acc + (val.Volatility || 0), 0) / currData.length) : 0;
      
      currencyStats[curr] = {
        currency: curr,
        stabilityRatio,
        avgVol
      };
    });

    const pairs = [];
    for (let i = 0; i < allCurrencies.length; i++) {
      for (let j = i + 1; j < allCurrencies.length; j++) {
        const c1 = allCurrencies[i];
        const c2 = allCurrencies[j];
        const stat1 = currencyStats[c1];
        const stat2 = currencyStats[c2];

        const combinedStability = stat1.stabilityRatio * stat2.stabilityRatio;
        const avgVol = (stat1.avgVol + stat2.avgVol) / 2;
        
        const rawScore = (combinedStability * 100) - (avgVol * 200);
        const compatibilityScore = Math.max(0, Math.round(Math.min(rawScore, 100)));

        let status = 'Rendah';
        let statusBadgeColor = 'text-rose-400 bg-rose-500/10 border-rose-500/20';
        let recommendation = '';

        if (compatibilityScore >= 75) {
          status = 'Tinggi';
          statusBadgeColor = 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
          recommendation = 'Sangat Layak. Rekomendasikan implementasi penuh kerangka kerja LCT bilateral. Kurangi penggunaan USD untuk transaksi perdagangan langsung.';
        } else if (compatibilityScore >= 45) {
          status = 'Sedang';
          statusBadgeColor = 'text-amber-400 bg-amber-500/10 border-amber-500/20';
          recommendation = 'Layak Terbatas. Cocok untuk kerja sama LCT terbatas pada sektor ritel/pariwisata menggunakan Quick Response (QR) cross-border.';
        } else {
          status = 'Kurang Layak';
          statusBadgeColor = 'text-rose-400 bg-rose-500/10 border-rose-500/20';
          recommendation = 'Tunda Kerjasama. Stabilitas salah satu mata uang kurang memadai. Fokus pada stabilisasi internal nilai tukar terlebih dahulu.';
        }

        pairs.push({
          c1,
          c2,
          compatibilityScore,
          status,
          statusBadgeColor,
          recommendation,
          stat1,
          stat2
        });
      }
    }

    return pairs.sort((a, b) => b.compatibilityScore - a.compatibilityScore);
  }, [data, allCurrencies]);

  // 1. PLOTLY: PCA Scatter Plot
  useEffect(() => {
    if (activeTab !== 'overview' || pcaSeries.stable.length === 0 || !window.Plotly) return;
    const el = document.getElementById('pca-scatter-plotly');
    if (!el) return;

    const traces = [
      {
        x: pcaSeries.stable.map(p => p.PCA1),
        y: pcaSeries.stable.map(p => p.PCA2),
        mode: 'markers',
        type: 'scatter',
        name: 'A - Stable',
        text: pcaSeries.stable.map(p => `${p.Currency} (${p.Year}-${String(p.Month).padStart(2, '0')})<br>Vol: ${(p.Volatility*100).toFixed(2)}%<br>Inf: ${p.Inflation.toFixed(2)}%<br>Kurs: ${p.Mean.toFixed(2)}`),
        hoverinfo: 'text',
        marker: { color: COLORS.stable, size: 7, opacity: 0.8 }
      },
      {
        x: pcaSeries.moderate.map(p => p.PCA1),
        y: pcaSeries.moderate.map(p => p.PCA2),
        mode: 'markers',
        type: 'scatter',
        name: 'B - Moderate',
        text: pcaSeries.moderate.map(p => `${p.Currency} (${p.Year}-${String(p.Month).padStart(2, '0')})<br>Vol: ${(p.Volatility*100).toFixed(2)}%<br>Inf: ${p.Inflation.toFixed(2)}%<br>Kurs: ${p.Mean.toFixed(2)}`),
        hoverinfo: 'text',
        marker: { color: COLORS.moderate, size: 8, opacity: 0.85 }
      },
      {
        x: pcaSeries.vulnerable.map(p => p.PCA1),
        y: pcaSeries.vulnerable.map(p => p.PCA2),
        mode: 'markers',
        type: 'scatter',
        name: 'C - Vulnerable',
        text: pcaSeries.vulnerable.map(p => `${p.Currency} (${p.Year}-${String(p.Month).padStart(2, '0')})<br>Vol: ${(p.Volatility*100).toFixed(2)}%<br>Inf: ${p.Inflation.toFixed(2)}%<br>Kurs: ${p.Mean.toFixed(2)}`),
        hoverinfo: 'text',
        marker: { color: COLORS.vulnerable, size: 9, opacity: 0.9 }
      }
    ];

    const layout = {
      ...defaultLayout,
      xaxis: { ...defaultLayout.xaxis, title: 'PCA1' },
      yaxis: { ...defaultLayout.yaxis, title: 'PCA2' },
      legend: { orientation: 'h', y: -0.2, font: { color: '#94a3b8', size: 10 } },
      margin: { t: 20, b: 60, l: 40, r: 20 },
      height: 380,
      autosize: true
    };

    window.Plotly.react(el, traces, layout, { responsive: true, displayModeBar: false });
  }, [activeTab, pcaSeries]);

  // 2. PLOTLY: Pie Chart
  useEffect(() => {
    if (activeTab !== 'overview' || pieChartData.length === 0 || !window.Plotly) return;
    const el = document.getElementById('pie-plotly');
    if (!el) return;

    const traces = [{
      values: pieChartData.map(d => d.value),
      labels: pieChartData.map(d => d.name),
      type: 'pie',
      hole: 0.4,
      marker: {
        colors: pieChartData.map(d => d.color)
      },
      textinfo: 'percent',
      hoverinfo: 'label+value+percent',
      textfont: { color: '#ffffff' }
    }];

    const layout = {
      ...defaultLayout,
      margin: { t: 20, b: 30, l: 10, r: 10 },
      height: 260,
      showlegend: true,
      legend: { orientation: 'h', y: -0.1, font: { color: '#94a3b8', size: 10 } },
      autosize: true
    };

    window.Plotly.react(el, traces, layout, { responsive: true, displayModeBar: false });
  }, [activeTab, pieChartData]);

  // 3. PLOTLY: Stacked Bar Chart
  useEffect(() => {
    if (activeTab !== 'overview' || barChartData.length === 0 || !window.Plotly) return;
    const el = document.getElementById('bar-plotly');
    if (!el) return;

    const traces = [
      {
        x: barChartData.map(d => d.currency),
        y: barChartData.map(d => d.Stable),
        name: 'A - Stable',
        type: 'bar',
        marker: { color: COLORS.stable }
      },
      {
        x: barChartData.map(d => d.currency),
        y: barChartData.map(d => d.Moderate),
        name: 'B - Moderate',
        type: 'bar',
        marker: { color: COLORS.moderate }
      },
      {
        x: barChartData.map(d => d.currency),
        y: barChartData.map(d => d.Vulnerable),
        name: 'C - Vulnerable',
        type: 'bar',
        marker: { color: COLORS.vulnerable }
      }
    ];

    const layout = {
      ...defaultLayout,
      barmode: 'stack',
      xaxis: { ...defaultLayout.xaxis, type: 'category' },
      margin: { t: 20, b: 40, l: 30, r: 15 },
      height: 260,
      legend: { orientation: 'h', y: -0.2, font: { color: '#94a3b8', size: 10 } },
      autosize: true
    };

    window.Plotly.react(el, traces, layout, { responsive: true, displayModeBar: false });
  }, [activeTab, barChartData]);

  // 4. PLOTLY: Volatility vs Inflation Line Chart
  useEffect(() => {
    if (activeTab !== 'monitoring' || currencyTimelineData.length === 0 || !window.Plotly) return;
    const el = document.getElementById('line-plotly');
    if (!el) return;

    const traces = [
      {
        x: currencyTimelineData.map(d => d.DateStr),
        y: currencyTimelineData.map(d => d.VolPct),
        name: 'Volatilitas (An.)',
        type: 'scatter',
        mode: 'lines',
        line: { color: '#6366f1', width: 2 },
        yaxis: 'y'
      },
      {
        x: currencyTimelineData.map(d => d.DateStr),
        y: currencyTimelineData.map(d => d.Inflation),
        name: 'Inflasi',
        type: 'scatter',
        mode: 'lines',
        line: { color: '#eab308', width: 2 },
        yaxis: 'y2'
      }
    ];

    const layout = {
      ...defaultLayout,
      xaxis: { ...defaultLayout.xaxis, type: 'category', title: 'Bulan' },
      yaxis: { 
        ...defaultLayout.yaxis, 
        title: 'Volatilitas (%)', 
        titlefont: { color: '#6366f1' },
        tickfont: { color: '#6366f1', size: 10 }
      },
      yaxis2: {
        title: 'Inflasi (%)',
        titlefont: { color: '#eab308' },
        tickfont: { color: '#eab308', size: 10 },
        overlaying: 'y',
        side: 'right',
        gridcolor: 'rgba(0,0,0,0)'
      },
      margin: { t: 25, b: 50, l: 45, r: 45 },
      height: 320,
      legend: { orientation: 'h', y: -0.2, font: { color: '#94a3b8', size: 10 } },
      autosize: true
    };

    window.Plotly.react(el, traces, layout, { responsive: true, displayModeBar: false });
  }, [activeTab, currencyTimelineData]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-200">
        <Activity className="h-10 w-10 text-indigo-500 animate-pulse mb-4" />
        <p className="text-lg font-semibold animate-pulse">Memuat Hub Pemantauan Stabilitas Mata Uang ASEAN...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-rose-400 p-6">
        <ShieldAlert className="h-12 w-12 text-rose-500 mb-4" />
        <p className="text-lg font-semibold mb-2">{error}</p>
        <p className="text-sm text-slate-500">Pastikan file data_clustering_monthly.csv diletakkan di direktori public.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      
      {/* Header */}
      <header className="border-b border-slate-900 bg-slate-900/40 backdrop-blur-md sticky top-0 z-50 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-600/10 p-2 rounded-xl border border-indigo-500/20">
            <Globe className="h-6 w-6 text-indigo-400" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight bg-gradient-to-r from-indigo-200 via-slate-100 to-indigo-200 bg-clip-text text-transparent">
              ASEAN Central Bank Stability Hub
            </h1>
            <p className="text-xs text-slate-500">Agglomerative Hierarchical Clustering (AHC) Analysis System</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500 font-mono">v1.3.0</span>
        </div>
      </header>

      <div className="flex-1 flex flex-col lg:flex-row">
        
        {/* Sidebar Filters */}
        <aside className="w-full lg:w-80 border-r border-slate-900 bg-slate-900/20 p-6 space-y-6 shrink-0">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-900">
            <Sliders className="h-4 w-4 text-indigo-400" />
            <h2 className="font-bold text-sm text-slate-300">Filter Analisis</h2>
          </div>

          {/* Currency List Selector */}
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <label className="text-xs font-semibold text-slate-400 tracking-wider uppercase">Pilih Mata Uang</label>
              <div className="flex gap-2">
                <button 
                  onClick={() => handleSelectAllCurrencies(true)} 
                  className="text-[10px] text-indigo-400 hover:text-indigo-300 transition"
                >
                  Semua
                </button>
                <span className="text-slate-700 text-[10px]">|</span>
                <button 
                  onClick={() => handleSelectAllCurrencies(false)} 
                  className="text-[10px] text-indigo-400 hover:text-indigo-300 transition"
                >
                  Reset
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-1 gap-2">
              {allCurrencies.map(curr => (
                <button
                  key={curr}
                  onClick={() => toggleCurrency(curr)}
                  className={`flex items-center justify-between px-3 py-2 rounded-xl border text-xs font-semibold transition ${
                    selectedCurrencies.includes(curr)
                      ? 'bg-indigo-600/10 border-indigo-500/40 text-indigo-200'
                      : 'bg-slate-900/40 border-slate-900 text-slate-500 hover:border-slate-800 hover:text-slate-400'
                  }`}
                >
                  <span>{curr} terhadap USD</span>
                  <div className={`w-2.5 h-2.5 rounded-full ${
                    selectedCurrencies.includes(curr) ? 'bg-indigo-500' : 'bg-transparent border border-slate-700'
                  }`} />
                </button>
              ))}
            </div>
          </div>

          {/* Year Slider */}
          <div className="space-y-3">
            <label className="text-xs font-semibold text-slate-400 tracking-wider uppercase flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" /> Rentang Tahun
            </label>
            <div className="space-y-4 px-1">
              <div className="flex justify-between text-xs font-mono text-slate-400">
                <span>{localYearRange[0]}</span>
                <span>{localYearRange[1]}</span>
              </div>
              <div className="flex gap-2">
                <input
                  type="range"
                  min={allYears[0]}
                  max={localYearRange[1]}
                  value={localYearRange[0]}
                  onChange={(e) => setLocalYearRange([parseInt(e.target.value), localYearRange[1]])}
                  onMouseUp={() => startTransition(() => setYearRange(localYearRange))}
                  onTouchEnd={() => startTransition(() => setYearRange(localYearRange))}
                  className="w-full h-1.5 bg-slate-900 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                />
                <input
                  type="range"
                  min={localYearRange[0]}
                  max={allYears[1]}
                  value={localYearRange[1]}
                  onChange={(e) => setLocalYearRange([localYearRange[0], parseInt(e.target.value)])}
                  onMouseUp={() => startTransition(() => setYearRange(localYearRange))}
                  onTouchEnd={() => startTransition(() => setYearRange(localYearRange))}
                  className="w-full h-1.5 bg-slate-900 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                />
              </div>
            </div>
          </div>

        </aside>

        {/* Main Content */}
        <main className="flex-1 p-6 lg:p-8 space-y-8 overflow-y-auto">
          
          {/* Navigation Tabs */}
          <div className="flex border-b border-slate-900">
            <button
              onClick={() => startTransition(() => setActiveTab('overview'))}
              className={`pb-4 px-6 text-sm font-bold relative transition ${
                activeTab === 'overview' ? 'text-indigo-400' : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              Overview Kesehatan Regional
              {activeTab === 'overview' && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-500 rounded-full" />
              )}
            </button>
            <button
              onClick={() => startTransition(() => setActiveTab('monitoring'))}
              className={`pb-4 px-6 text-sm font-bold relative transition ${
                activeTab === 'monitoring' ? 'text-indigo-400' : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              Pemantauan Detil Mata Uang
              {activeTab === 'monitoring' && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-500 rounded-full" />
              )}
            </button>
            <button
              onClick={() => startTransition(() => setActiveTab('policy'))}
              className={`pb-4 px-6 text-sm font-bold relative transition ${
                activeTab === 'policy' ? 'text-indigo-400' : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              Kebijakan Central Bank (LCT & Intervensi)
              {activeTab === 'policy' && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-500 rounded-full" />
              )}
            </button>
          </div>

          {/* Aggregate Metrics Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-slate-900/30 border border-slate-900 p-5 rounded-2xl space-y-1.5">
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Rasio Vulnerable</span>
              <p className="text-2xl font-extrabold text-rose-400">{metrics.vulnerableRatio.toFixed(1)}%</p>
              <span className="text-[10px] text-rose-500/50 block">Proporsi kondisi rentan</span>
            </div>
            <div className="bg-slate-900/30 border border-slate-900 p-5 rounded-2xl space-y-1.5">
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Rasio Moderate</span>
              <p className="text-2xl font-extrabold text-amber-400">{metrics.moderateRatio.toFixed(1)}%</p>
              <span className="text-[10px] text-amber-500/50 block">Proporsi kondisi sedang</span>
            </div>
            <div className="bg-slate-900/30 border border-slate-900 p-5 rounded-2xl space-y-1.5">
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Rasio Stable</span>
              <p className="text-2xl font-extrabold text-emerald-400">{metrics.stableRatio.toFixed(1)}%</p>
              <span className="text-[10px] text-emerald-500/50 block">Proporsi kondisi aman</span>
            </div>
            <div className="bg-slate-900/30 border border-slate-900 p-5 rounded-2xl space-y-1.5">
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Rerata Volatilitas (ASEAN)</span>
              <p className="text-2xl font-extrabold text-indigo-400">{metrics.avgVolatility.toFixed(2)}%</p>
              <span className="text-[10px] text-indigo-500/50 block">Disetahunkan (Annualized)</span>
            </div>
          </div>

          {/* TAB 1: OVERVIEW KESEHATAN REGIONAL */}
          {activeTab === 'overview' && (
            <div className="space-y-8">
              
              {/* PCA Scatter Chart */}
              <div className="bg-slate-900/40 border border-slate-900 rounded-3xl p-6 space-y-4">
                <div>
                  <h3 className="text-base font-bold text-slate-200">PCA Scatter Plot — Agglomerative Clustering (AHC)</h3>
                  <p className="text-xs text-slate-500">Visualisasi 2 dimensi hasil reduksi fitur (PCA) mata uang ASEAN terhadap USD.</p>
                </div>
                {filteredData.length === 0 ? (
                  <div className="h-96 flex items-center justify-center text-slate-500 text-sm">Tidak ada data untuk filter saat ini.</div>
                ) : (
                  <div id="pca-scatter-plotly" className="w-full bg-transparent rounded-2xl" />
                )}
              </div>

              {/* Pie and Bar Charts side by side */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                
                {/* Pie Chart: Proportion */}
                <div className="bg-slate-900/40 border border-slate-900 rounded-3xl p-6 space-y-4 flex flex-col justify-between">
                  <div>
                    <h3 className="text-base font-bold text-slate-200">Rasio Label Stabilitas</h3>
                    <p className="text-xs text-slate-500">Proporsi keseluruhan status kesehatan mata uang dalam rentang waktu terpilih.</p>
                  </div>
                  {pieChartData.length === 0 ? (
                    <div className="h-64 flex items-center justify-center text-slate-500 text-sm">Tidak ada data.</div>
                  ) : (
                    <div id="pie-plotly" className="w-full bg-transparent rounded-2xl" />
                  )}
                </div>

                {/* Stacked Bar Chart: Stability per Currency */}
                <div className="bg-slate-900/40 border border-slate-900 rounded-3xl p-6 space-y-4 flex flex-col justify-between">
                  <div>
                    <h3 className="text-base font-bold text-slate-200">Distribusi Stabilitas per Mata Uang</h3>
                    <p className="text-xs text-slate-500">Membandingkan frekuensi status stabilitas mata uang individu.</p>
                  </div>
                  {barChartData.length === 0 ? (
                    <div className="h-64 flex items-center justify-center text-slate-500 text-sm">Tidak ada data.</div>
                  ) : (
                    <div id="bar-plotly" className="w-full bg-transparent rounded-2xl" />
                  )}
                </div>

              </div>
            </div>
          )}

          {/* TAB 2: PEMANTAUAN DETIL MATA UANG */}
          {activeTab === 'monitoring' && (
            <div className="space-y-8">
              
              {/* Header and Currency Selector */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-slate-900/30 border border-slate-900 rounded-2xl p-5">
                <div>
                  <h3 className="text-base font-bold text-slate-200">Inspeksi Mendalam Mata Uang</h3>
                  <p className="text-xs text-slate-500">Pilih satu mata uang untuk melihat performa tren historis dan perubahan status stabilitas.</p>
                </div>
                <div className="flex gap-2 shrink-0">
                  {allCurrencies.map(curr => (
                    <button
                      key={curr}
                      onClick={() => startTransition(() => setInspectCurrency(curr))}
                      className={`px-4 py-2 rounded-xl text-xs font-bold transition border ${
                        inspectCurrency === curr
                          ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-600/20'
                          : 'bg-slate-900/50 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-300'
                      }`}
                    >
                      {curr}
                    </button>
                  ))}
                </div>
              </div>

              {inspectCurrency ? (
                <>
                  {/* Grid Timeline Bar */}
                  <div className="bg-slate-900/40 border border-slate-900 rounded-3xl p-6 space-y-4">
                    <div>
                      <h3 className="text-base font-bold text-slate-200">Timeline Kesehatan Bulanan: {inspectCurrency}</h3>
                      <p className="text-xs text-slate-500">Setiap blok merepresentasikan status stabilitas pada bulan tertentu. Transisi warna menggambarkan volatilitas bursa.</p>
                    </div>
                    <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-12 gap-2 pb-2">
                      {currencyTimelineData.map((d, index) => {
                        const bgClr = d.Stability_Label === 'A - Stable' 
                          ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400' 
                          : d.Stability_Label === 'B - Moderate' 
                          ? 'bg-amber-500/10 border-amber-500/40 text-amber-400'
                          : 'bg-rose-500/10 border-rose-500/40 text-rose-400';
                        return (
                          <div 
                            key={index} 
                            className={`p-2 rounded-xl border text-center text-xs flex flex-col items-center justify-center font-mono ${bgClr}`}
                            title={`Date: ${d.DateStr}\nMean: ${d.Mean?.toFixed(2)}\nVolatility: ${(d.Volatility*100).toFixed(2)}%\nInflation: ${d.Inflation?.toFixed(2)}%`}
                          >
                            <span className="font-bold text-[9px] text-slate-500">{d.Year}</span>
                            <span className="font-extrabold text-[11px]">{String(d.Month).padStart(2, '0')}</span>
                            <span className="text-[8px] font-bold mt-1 opacity-80">
                              {d.Stability_Label === 'A - Stable' ? 'STB' : d.Stability_Label === 'B - Moderate' ? 'MOD' : 'VUL'}
                            </span>
                          </div>
                        );
                      })}
                      {currencyTimelineData.length === 0 && (
                        <div className="col-span-full py-6 text-center text-slate-500 text-xs">Tidak ada data untuk tahun terpilih.</div>
                      )}
                    </div>
                  </div>

                  {/* Volatility vs Inflation Line Chart */}
                  <div className="bg-slate-900/40 border border-slate-900 rounded-3xl p-6 space-y-4">
                    <div>
                      <h3 className="text-base font-bold text-slate-200">Korelasi Volatilitas & Inflasi Historis — {inspectCurrency}</h3>
                      <p className="text-xs text-slate-500">Menganalisis hubungan pergerakan tingkat volatilitas (kiri) dengan tingkat inflasi domestik (kanan).</p>
                    </div>
                    {currencyTimelineData.length === 0 ? (
                      <div className="h-80 flex items-center justify-center text-slate-500 text-sm">Tidak ada data.</div>
                    ) : (
                      <div id="line-plotly" className="w-full bg-transparent rounded-2xl" />
                    )}
                  </div>
                </>
              ) : (
                <div className="text-center py-12 text-slate-500 text-sm">Pilih mata uang untuk memulai analisis detail.</div>
              )}
            </div>
          )}

          {/* TAB 3: KEBIJAKAN CENTRAL BANK */}
          {activeTab === 'policy' && (
            <div className="space-y-8">
              
              {/* Radar Intervensi */}
              <div className="bg-slate-900/40 border border-slate-900 rounded-3xl p-6 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="bg-rose-500/10 p-2 rounded-xl border border-rose-500/20">
                    <ShieldAlert className="h-5 w-5 text-rose-400" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-200">Intervensi Pasar & Stabilitas Terkini</h3>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-900/80 text-slate-400 font-bold uppercase tracking-wider">
                      <tr>
                        <th className="p-4 rounded-l-xl">Mata Uang</th>
                        <th className="p-4">Bulan Terkini</th>
                        <th className="p-4">Stability Label</th>
                        <th className="p-4">Volatilitas (An.)</th>
                        <th className="p-4">Perubahan Bulanan (MoM)</th>
                        <th className="p-4 rounded-r-xl">Vulnerability Index</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-900">
                      {policyActionData.map((d, index) => (
                        <tr key={index} className="hover:bg-slate-900/30 transition">
                          <td className="p-4 font-bold text-slate-200">{d.Currency} / USD</td>
                          <td className="p-4 font-mono text-slate-400">{d.latestDateStr}</td>
                          <td className="p-4">
                            <span 
                              className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold border"
                              style={{ 
                                color: COLOR_MAP[d.Stability_Label], 
                                backgroundColor: `${COLOR_MAP[d.Stability_Label]}10`,
                                borderColor: `${COLOR_MAP[d.Stability_Label]}30`
                              }}
                            >
                              {d.Stability_Label}
                            </span>
                          </td>
                          <td className="p-4 font-mono text-slate-300">{(d.Volatility * 100).toFixed(2)}%</td>
                          <td className={`p-4 font-mono font-bold ${d.Pct_Change >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {d.Pct_Change >= 0 ? '+' : ''}{d.Pct_Change?.toFixed(2)}%
                          </td>
                          <td className="p-4">
                            <div className="flex items-center gap-2">
                              <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-mono border ${d.riskColor}`}>
                                {d.vulnerabilityScore}% ({d.riskLevel})
                              </span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* LCT Candidates */}
              <div className="bg-slate-900/40 border border-slate-900 rounded-3xl p-6 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="bg-emerald-500/10 p-2 rounded-xl border border-emerald-500/20">
                    <CheckCircle className="h-5 w-5 text-emerald-400" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-200">Kandidat Kerjasama Local Currency Transaction (LCT)</h3>
                    <p className="text-xs text-slate-500">Analisis kelayakan LCT bilateral ASEAN untuk mengurangi ketergantungan USD, dievaluasi berdasarkan stabilitas 12 bulan terakhir.</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {lctBilateralMatrix.slice(0, 6).map((pair, index) => (
                    <div 
                      key={index} 
                      className="bg-slate-950/40 border border-slate-900 rounded-2xl p-5 space-y-4 flex flex-col justify-between"
                    >
                      <div className="flex justify-between items-start">
                        <div className="space-y-1">
                          <h4 className="text-sm font-bold text-slate-200 flex items-center gap-1.5">
                            {pair.c1} <span className="text-slate-600 text-xs font-normal">↔</span> {pair.c2}
                          </h4>
                          <p className="text-[10px] text-slate-500">Stabilitas Historis Bilateral</p>
                        </div>
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${pair.statusBadgeColor}`}>
                          Kompatibilitas: {pair.compatibilityScore}% ({pair.status})
                        </span>
                      </div>

                      {/* comparison meter */}
                      <div className="grid grid-cols-2 gap-4 bg-slate-900/30 p-3 rounded-xl border border-slate-900">
                        <div className="space-y-0.5 text-center border-r border-slate-900">
                          <span className="text-[9px] text-slate-500 font-bold uppercase">{pair.c1} Stable Ratio</span>
                          <p className="text-sm font-extrabold text-slate-300">{(pair.stat1.stabilityRatio * 100).toFixed(0)}%</p>
                        </div>
                        <div className="space-y-0.5 text-center">
                          <span className="text-[9px] text-slate-500 font-bold uppercase">{pair.c2} Stable Ratio</span>
                          <p className="text-sm font-extrabold text-slate-300">{(pair.stat2.stabilityRatio * 100).toFixed(0)}%</p>
                        </div>
                      </div>

                      {/* Rekomendasi kebijakan LCT dihapus */}
                    </div>
                  ))}
                </div>
              </div>

            </div>
          )}

        </main>
      </div>

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-900/30 py-4 text-center text-xs text-slate-600">
        <p>© 2026 ASEAN Currency Stability Hub</p>
      </footer>
    </div>
  );
}

export default App;
