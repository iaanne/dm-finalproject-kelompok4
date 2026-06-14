import yfinance as yf
import pandas as pd
import numpy as np
from sklearn.preprocessing import StandardScaler
from sklearn.cluster import DBSCAN
from sklearn.metrics import silhouette_score, davies_bouldin_score

# 1. Download Exchange Rate Data
tickers = {
    'IDR': 'IDR=X',
    'MYR': 'MYR=X',
    'THB': 'THB=X',
    'PHP': 'PHP=X',
    'SGD': 'SGD=X',
    'VND': 'VND=X'
}
start_date = '2015-01-01'
end_date = '2026-01-01'

print("Downloading exchange rate data...")
df_kurs_list = {}
for currency, ticker in tickers.items():
    print(f"Downloading {currency} ({ticker})...")
    # Try downloading up to 3 times to handle intermittent failures
    for attempt in range(3):
        try:
            data = yf.download(ticker, start=start_date, end=end_date)
            if isinstance(data.columns, pd.MultiIndex):
                prices = data.xs('Close', axis=1, level=0)
            else:
                if 'Close' in data.columns:
                    prices = data['Close']
                else:
                    prices = data
            
            # Squeeze to Series if it is a DataFrame with 1 column
            if isinstance(prices, pd.DataFrame):
                prices = prices.squeeze()
                
            if not prices.empty and prices.isnull().sum() < len(prices):
                df_kurs_list[currency] = prices
                print(f"Successfully downloaded {currency}. Shape: {prices.shape}")
                break
            else:
                print(f"Downloaded data for {currency} is empty or all NaN.")
        except Exception as e:
            print(f"Attempt {attempt+1} failed for {currency}: {e}")
    else:
        print(f"Failed to download {currency} after 3 attempts.")

# Combine into df_kurs
df_kurs = pd.DataFrame(df_kurs_list)
print(f"Data kurs shape: {df_kurs.shape}")
print("Missing values in daily rates:")
print(df_kurs.isnull().sum())

# Preprocessing: Forward fill
df_kurs_clean = df_kurs.ffill()
df_kurs_clean.index = pd.to_datetime(df_kurs_clean.index)
df_kurs_clean['Year'] = df_kurs_clean.index.year
df_kurs_clean['Month'] = df_kurs_clean.index.month

# 2. Read Inflation Data
csv_path = r"C:\Users\Asus\Documents\SAINS_DATA_UNS\SEMESTER_4\DATA_MINING\PROJECT\DATA\API_FP.CPI.TOTL.ZG_DS2_en_csv_v2_250039.csv"
df_inflation_raw = pd.read_csv(csv_path, skiprows=4)

iso3_mapping = {
    'IDN': 'IDR', 'MYS': 'MYR', 'THA': 'THB',
    'PHL': 'PHP', 'SGP': 'SGD', 'VNM': 'VND'
}
df_inflation = df_inflation_raw[df_inflation_raw['Country Code'].isin(iso3_mapping.keys())].copy()
df_inflation['Currency'] = df_inflation['Country Code'].map(iso3_mapping)

years_cols = [str(y) for y in range(2015, 2026) if str(y) in df_inflation.columns]
df_inflation_melt = df_inflation.melt(
    id_vars=['Currency'], 
    value_vars=years_cols,
    var_name='Year', 
    value_name='Inflation'
)
df_inflation_melt['Year'] = df_inflation_melt['Year'].astype(int)

# Interpolate inflation
monthly_infl_rows = []
for currency in df_inflation_melt['Currency'].unique():
    curr_data = df_inflation_melt[df_inflation_melt['Currency'] == currency].sort_values('Year')
    years_arr = curr_data['Year'].values
    infl_arr = curr_data['Inflation'].values

    for i, year in enumerate(years_arr):
        current_infl = infl_arr[i]
        if i < len(years_arr) - 1:
            next_infl = infl_arr[i + 1]
        else:
            if len(years_arr) >= 2:
                delta = infl_arr[-1] - infl_arr[-2]
                next_infl = current_infl + delta
            else:
                next_infl = current_infl

        for month in range(1, 13):
            frac = month / 13
            monthly_infl = current_infl + (next_infl - current_infl) * frac
            monthly_infl_rows.append({
                'Currency': currency,
                'Year': year,
                'Month': month,
                'Inflation': monthly_infl
            })

df_inflation_monthly = pd.DataFrame(monthly_infl_rows)
df_inflation_monthly['Year'] = df_inflation_monthly['Year'].astype(int)
df_inflation_monthly = df_inflation_monthly.dropna(subset=['Inflation'])

# 3. Aggregate Monthly Features
agregasi_list = []
for currency in df_kurs_clean.columns:
    if currency in ['Year', 'Month']:
        continue
    for (year, month), group in df_kurs_clean.groupby(['Year', 'Month']):
        if len(group) < 15:
            continue
            
        prices = group[currency].dropna()
        if len(prices) == 0:
            continue
            
        first_price = prices.iloc[0]
        prices_rebased = (prices / first_price) * 100
        mean_kurs = prices_rebased.mean()
        std_kurs = prices_rebased.std()
        
        log_returns = np.log(prices / prices.shift(1)).dropna()
        if len(log_returns) > 1:
            volatility = log_returns.std() * np.sqrt(252)
        else:
            volatility = 0.0
        
        end_price = prices.iloc[-1]
        pct_change = ((end_price - first_price) / first_price) * 100
        
        infl_val = np.nan
        infl_row = df_inflation_monthly[
            (df_inflation_monthly['Currency'] == currency) & 
            (df_inflation_monthly['Year'] == year) & 
            (df_inflation_monthly['Month'] == month)
        ]
        if not infl_row.empty:
            infl_val = infl_row['Inflation'].values[0]
            
        agregasi_list.append({
            'Currency': currency,
            'Year': year,
            'Month': month,
            'Mean': mean_kurs,
            'Std': std_kurs,
            'Volatility': volatility,
            'Pct_Change': pct_change,
            'Inflation': infl_val
        })

df_agg = pd.DataFrame(agregasi_list).dropna()
print(f"Shape of aggregated data: {df_agg.shape}")
print(df_agg['Currency'].value_counts())

# 4. Scaling
features = ['Mean', 'Std', 'Volatility', 'Pct_Change', 'Inflation']
X = df_agg[features].values
scaler = StandardScaler()
X_scaled = scaler.fit_transform(X)

# 5. Grid Search for DBSCAN under different noise thresholds
print("\n--- Running Grid Search under various outlier constraints ---")
eps_range = np.arange(0.3, 3.0, 0.1)
min_samples_range = range(2, 6)

results = []
for eps in eps_range:
    for min_samples in min_samples_range:
        db = DBSCAN(eps=eps, min_samples=min_samples)
        labels = db.fit_predict(X_scaled)
        
        n_clusters = len(set(labels)) - (1 if -1 in labels else 0)
        n_noise = list(labels).count(-1)
        noise_pct = n_noise / len(X_scaled)
        
        if n_clusters >= 2:
            mask = labels != -1
            if mask.sum() > 1:
                try:
                    ss = silhouette_score(X_scaled[mask], labels[mask])
                    dbi = davies_bouldin_score(X_scaled[mask], labels[mask])
                    results.append({
                        'eps': eps,
                        'min_samples': min_samples,
                        'n_clusters': n_clusters,
                        'n_noise': n_noise,
                        'noise_pct': noise_pct,
                        'silhouette': ss,
                        'dbi': dbi
                    })
                except Exception as e:
                    pass

df_res = pd.DataFrame(results)

# Display top configurations for different noise thresholds
thresholds = [0.05, 0.10, 0.15, 0.20, 0.30, 0.50, 1.00]
for t in thresholds:
    subset = df_res[df_res['noise_pct'] <= t]
    if not subset.empty:
        best = subset.loc[subset['silhouette'].idxmax()]
        print(f"\nBest with Max Noise = {t*100:.0f}%:")
        print(f"  eps: {best['eps']:.2f}")
        print(f"  min_samples: {int(best['min_samples'])}")
        print(f"  clusters: {int(best['n_clusters'])}")
        print(f"  noise points: {int(best['n_noise'])} ({best['noise_pct']*100:.1f}%)")
        print(f"  silhouette score (excl. noise): {best['silhouette']:.4f}")
        print(f"  dbi (excl. noise): {best['dbi']:.4f}")
    else:
        print(f"\nNo configurations found with noise <= {t*100:.0f}%")
