import pandas as pd

# Load the monthly clustering data
df = pd.read_csv("c:\\Users\\Asus\\Documents\\SAINS_DATA_UNS\\SEMESTER_4\\DATA_MINING\\PROJECT\\dm-finalproject-kelompok4\\data_clustering_monthly.csv")

# Compute crosstab for AHC
ahc_crosstab = pd.crosstab(df['Currency'], df['AHC_Cluster'])
ahc_crosstab['Total'] = ahc_crosstab.sum(axis=1)

print("=== DISTRIBUSI KLASTER AHC PER MATA UANG ===")
print(ahc_crosstab)
print("\n=== PROFIL RATA-RATA AHC ===")
print(df.groupby('AHC_Cluster')[['Mean', 'Std', 'Volatility', 'Pct_Change', 'Inflation']].mean().round(4))
