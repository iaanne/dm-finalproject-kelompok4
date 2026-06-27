# Perbandingan Algoritma Clustering untuk Klasterisasi Stabilitas Mata Uang ASEAN terhadap USD

Dashboard interaktif untuk memonitor stabilitas mata uang ASEAN (IDR, MYR, THB, PHP, SGD, VND) terhadap USD menggunakan empat algoritma clustering (K-Means, DBSCAN, AHC, K-Medoids), dilengkapi analisis kebijakan LCT bilateral.

**Kelompok 4 — Data Mining 4B**

| Anggota | Peran |
|---------|-------|
| Nadhifa Sakha Tri Yasmin (L0224036) | Data Acquisition & Preprocessing |
| Jimly Syahbatin (L0224033) | Clustering Modeling & Evaluation |
| Adrian Farrel Aziz Yatyoga (L0224040) | Dashboard & Visualisasi |

---

## Arsitektur Pipeline

```
DATA ACQUISITION           PREPROCESSING                  CLUSTERING                VISUALIZATION
┌────────────────────┐    ┌────────────────────┐    ┌────────────────────┐    ┌────────────────────┐
│  Yahoo Finance     │    │  Forward-fill      │    │  K-Means (k=3)    │    │  Streamlit         │
│  yfinance          │───→│  Monthly Aggr.     │───→│  DBSCAN (eps=0.5) │───→│  dashboard.py      │
│  6 pairs (2015-25) │    │  (Mean, Std,       │    │  AHC (ward, k=3)  │    │  (Python)          │
└────────────────────┘    │   Volatility,       │    │  K-Medoids (k=3)  │    └────────────────────┘
                          │   Pct_Change)       │    └────────────────────┘           │
┌────────────────────┐    │  + Inflation (WB)   │                                    ▼
│  World Bank CSV    │    │  StandardScaler     │                           ┌────────────────────┐
│  CPI Inflation     │───→│  PCA (2 components) │                           │  React Dashboard   │
│  2015-2025         │    └────────────────────┘                           │  ASEAN Stability   │
└────────────────────┘                                                     │  Hub (Vite +       │
                                                                           │   Plotly.js)       │
                                                                           └────────────────────┘
```

### Alur Data
1. **Data Acquisition** — Yahoo Finance (yfinance) untuk 6 pair mata uang ASEAN (IDR, MYR, THB, PHP, SGD, VND) + World Bank CPI Inflation dari CSV
2. **Preprocessing** — Forward-fill missing values, agregasi harian ke bulanan (Mean, Std, Volatility, Pct_Change), interpolasi inflasi, StandardScaler, PCA 2 komponen
3. **Clustering** — 4 algoritma: K-Means (k=3), DBSCAN (eps=0.5, min_samples=5), AHC (ward, k=3), K-Medoids (k=3)
4. **Visualization** — Streamlit dashboard + React dashboard interaktif dengan PCA scatter, timeline, analisis kebijakan LCT

---

## Dataset

| Sumber | Data | Rentang Waktu | Jumlah Observasi |
|--------|------|---------------|------------------|
| Yahoo Finance | IDR=X, MYR=X, THB=X, PHP=X, SGD=X, VND=X | 2015–2025 | 720 (6 kurs × 12 bulan × 10 tahun) |
| World Bank | CPI Inflation (FP.CPI.TOTL.ZG) | 2015–2025 | Tahunan, diinterpolasi ke bulanan |

### Fitur yang Digunakan
| Fitur | Deskripsi |
|-------|-----------|
| `Mean` | Rata-rata kurs harian per bulan |
| `Std` | Standar deviasi kurs harian per bulan |
| `Volatility` | Volatilitas tahunan (std × √252) |
| `Pct_Change` | Persentase perubahan MoM (rebased to 100) |
| `Inflation` | CPI Inflation (World Bank, diinterpolasi) |
| `PCA1`, `PCA2` | 2 komponen utama dari StandardScaler (~70% variance) |

---

## Tech Stack

| Layer | Teknologi |
|-------|-----------|
| Data Source | Yahoo Finance API (`yfinance`), World Bank CSV |
| Preprocessing | Pandas, NumPy, Scikit-learn (StandardScaler, PCA) |
| Clustering | Scikit-learn (KMeans, DBSCAN, AgglomerativeClustering), SciPy |
| Evaluation | Silhouette Score, Davies-Bouldin Index, Calinski-Harabasz Index |
| Dashboard (Python) | Streamlit, Plotly |
| Dashboard (Frontend) | React 19, Vite, Tailwind CSS 4, Plotly.js, PapaParse, Recharts |
| Environment | Python 3.12, venv |

---

## Struktur Folder

```
dm-finalproject-kelompok4/
├── DATA/                            # Dataset mentah
│   ├── API_FP.CPI.TOTL.ZG_DS2_en_csv_v2_250039.csv   # Inflasi World Bank
│   ├── Metadata_Country_...csv       # Metadata negara
│   └── Metadata_Indicator_...csv     # Metadata indikator
│
├── scratch/                         # Eksperimen
│   └── test_dbscan.py               #   Grid search DBSCAN hyperparameter
│
├── dashboard.py                     # Streamlit dashboard (Python)
├── dashboard (1).py                 # Backup Streamlit dashboard
│
├── data_clustering_monthly.csv      # Hasil akhir clustering (720 rows × 17 cols)
│
├── project_pipeline_monthly_fix_insyaAllah.ipynb   # Pipeline utama (2244 lines)
├── project_pipeline_monthly_fix.ipynb              # Pipeline v1 (1913 lines)
├── project_pipeline_monthly(2).ipynb               # Template kosong
│
├── dashboard-react/                 # Frontend React (Vite)
│   ├── src/
│   │   ├── App.jsx                  #   Komponen utama (3 tabs dashboard)
│   │   ├── App.css                  #   Styling
│   │   ├── index.css                #   Tailwind CSS v4
│   │   └── main.jsx                 #   Entry point React
│   ├── index.html                   #   HTML shell + Plotly CDN
│   ├── package.json                 #   Dependencies
│   └── vite.config.js               #   Vite config
│
├── venv/                            # Python virtual environment
└── dm-finalproject-kelompok4.code-workspace   # VS Code workspace
```

---

## Metodologi Clustering

| Algoritma | Parameter | Metric Utama |
|-----------|-----------|-------------|
| **K-Means** | k=3 (dari elbow method) | Silhouette, DBI, CH Index |
| **DBSCAN** | eps=0.5, min_samples=5 | Silhouette (excl. noise), DBI |
| **AHC** | ward linkage, k=3 | Silhouette, DBI, CH Index, dendrogram |
| **K-Medoids** | k=3 | Silhouette, DBI |

### Stability Labeling (berdasarkan AHC + threshold volatilitas)
| Label | Keterangan | Rentang Volatilitas |
|-------|------------|-------------------|
| **A — Stable** | Mata uang stabil, risiko rendah | Rendah |
| **B — Moderate** | Fluktuasi terkendali | Sedang |
| **C — Vulnerable** | Volatilitas tinggi, rentan krisis | Tinggi |

---

## Evaluasi Clustering

*(Hasil evaluasi akan muncul setelah menjalankan notebook)*

### Perbandingan Algoritma
| Algoritma | Silhouette Score | DBI | CH Index |
|-----------|-----------------|-----|----------|
| K-Means (k=3) | ... | ... | ... |
| DBSCAN (eps=0.5) | ... | ... | ... |
| AHC (ward, k=3) | ... | ... | ... |
| K-Medoids (k=3) | ... | ... | ... |

---

## Cara Menjalankan

### Prasyarat
- Python 3.12+
- Node.js 18+
- Virtual environment (venv)

### 1. Setup Virtual Environment
```bash
python -m venv venv
source venv/bin/activate  # Linux/Mac
# atau
venv\Scripts\activate     # Windows
pip install -r requirements.txt
```
> Jika belum ada `requirements.txt`, install manual:
```bash
pip install yfinance pandas numpy scikit-learn scipy matplotlib seaborn streamlit plotly jupyter kneed
```

### 2. Jalankan Pipeline Clustering (Jupyter Notebook)
```bash
jupyter notebook project_pipeline_monthly_fix_insyaAllah.ipynb
```
Jalankan seluruh cell secara berurutan untuk:
- Download data Yahoo Finance
- Preprocessing & feature engineering
- PCA dimensionality reduction
- Clustering (K-Means, DBSCAN, AHC, K-Medoids)
- Evaluasi & export CSV

### 3. Jalankan Streamlit Dashboard
```bash
streamlit run dashboard.py
```
Dashboard akan terbuka di `http://localhost:8501`

### 4. Jalankan React Dashboard
```bash
cd dashboard-react
npm install
npm run dev
```
Dashboard akan terbuka di `http://localhost:5173`

### 5. (Opsional) DBSCAN Hyperparameter Tuning
```bash
python scratch/test_dbscan.py
```

---

## Endpoint Dashboard

| Tab | Fitur |
|-----|-------|
| **Overview Kesehatan Regional** | Metric cards, PCA scatter, donut chart, stacked bar, filter tahun & mata uang |
| **Pemantauan Detil Mata Uang** | Timeline grid stabilitas, dual-axis chart (Volatility vs Inflation) |
| **Kebijakan Central Bank** | Radar intervensi, LCT Bilateral Compatibility Matrix, rekomendasi kebijakan |

---

## Hasil & Insights

- **AHC (Ward, k=3)** dipilih sebagai metode utama untuk stability labeling karena hasilnya paling konsisten dan interpretable
- **SGD** dan **MYR** cenderung paling stabil (cluster A)
- **IDR** dan **VND** paling rentan (cluster C)
- **LCT Bilateral Compatibility Matrix** memberikan rekomendasi pairwise untuk kerja sama mata uang bilateral guna mengurangi ketergantungan pada USD

---

## Troubleshooting

| Masalah | Solusi |
|---------|--------|
| `yfinance` gagal download | Periksa koneksi internet; coba ulang atau gunakan data backup |
| Streamlit error module not found | `pip install streamlit plotly` |
| React npm error | `cd dashboard-react && rm -rf node_modules && npm install` |
| Plotly chart tidak muncul | Pastikan koneksi internet (CDN Plotly.js) |
| Dataset kosong | Jalankan ulang notebook untuk generate `data_clustering_monthly.csv` |
| Ingin reset data | Hapus `data_clustering_monthly.csv` dan regenerate via notebook |
