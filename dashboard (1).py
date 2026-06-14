import streamlit as st
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns
import plotly.express as px
import plotly.graph_objects as go
from plotly.subplots import make_subplots

st.set_page_config(layout="wide", page_title="Dashboard Clustering Stabilitas Mata Uang ASEAN")

CSV_PATH = r"D:\Tugas Kuliah\Semester 4\Data Mining\Final Project\data_clustering_monthly.csv"

@st.cache_data
def load_data():
    df = pd.read_csv(CSV_PATH)
    df["Date"] = pd.to_datetime(df["Year"].astype(str) + "-" + df["Month"].astype(str).str.zfill(2) + "-01")
    return df

df = load_data()

ALGO_MAP = {
    "K-Means": "KMeans_Cluster",
    "DBSCAN": "DBSCAN_Cluster",
    "AHC": "AHC_Cluster",
    "K-Medoids": "KMedoids_Cluster",
}

COLOR_MAP = {"A - Stable": "#2ECC71", "B - Moderate": "#F1C40F", "C - Vulnerable": "#E74C3C"}

st.title("Dashboard Clustering Stabilitas Mata Uang ASEAN terhadap USD")
st.markdown("Perbandingan **K-Means, DBSCAN, AHC, K-Medoids** — Granularitas Bulanan (2015–2023)")

# ---- Sidebar Filters ----
st.sidebar.header("Filter")
selected_algo = st.sidebar.selectbox("Algoritma", list(ALGO_MAP.keys()))
selected_currencies = st.sidebar.multiselect("Mata Uang", sorted(df["Currency"].unique()), default=sorted(df["Currency"].unique()))
year_range = st.sidebar.slider("Rentang Tahun", int(df["Year"].min()), int(df["Year"].max()), (2015, 2023))

algo_col = ALGO_MAP[selected_algo]
mask = df["Currency"].isin(selected_currencies) & df["Year"].between(*year_range)
df_filt = df[mask].copy()

# ---- Metrics ----
st.subheader("Ringkasan")
col1, col2, col3, col4 = st.columns(4)
n_clusters = df_filt[algo_col].nunique()
n_noise = (df_filt[algo_col] == -1).sum()
stable_pct = (df_filt["Stability_Label"] == "A - Stable").sum() / len(df_filt) * 100
col1.metric("Total Observasi", len(df_filt))
col2.metric("Jumlah Cluster", n_clusters if algo_col != "DBSCAN_Cluster" else n_clusters - (1 if n_noise > 0 else 0))
col3.metric("Noise (DBSCAN)", n_noise)
col4.metric("Stable Ratio", f"{stable_pct:.1f}%")

# ---- PCA Scatter ----
st.subheader(f"PCA Scatter — {selected_algo}")
fig_scatter = px.scatter(
    df_filt,
    x="PCA1",
    y="PCA2",
    color="Stability_Label",
    color_discrete_map=COLOR_MAP,
    symbol="Currency",
    hover_data=["Currency", "Year", "Month", "Stability_Label", algo_col],
    title=f"Proyeksi 2D PCA — Warna: Stability Label, Bentuk: Currency",
    height=500,
)
fig_scatter.update_traces(marker=dict(size=6))
st.plotly_chart(fig_scatter, use_container_width=True)

# ---- Cluster Timeline ----
st.subheader(f"Cluster Timeline per Mata Uang — {selected_algo}")

fig_timeline = make_subplots(
    rows=2, cols=3,
    subplot_titles=sorted(selected_currencies),
    vertical_spacing=0.12, horizontal_spacing=0.05,
)

color_seq = px.colors.qualitative.Set2
cluster_ids = sorted(df_filt[algo_col].unique())
cluster_color_map = {cid: color_seq[i % len(color_seq)] for i, cid in enumerate(cluster_ids)}

for idx, currency in enumerate(sorted(selected_currencies)):
    row, col = idx // 3 + 1, idx % 3 + 1
    cdf = df_filt[df_filt["Currency"] == currency].sort_values("Date")
    for cid in cluster_ids:
        sub = cdf[cdf[algo_col] == cid]
        fig_timeline.add_trace(
            go.Scatter(x=sub["Date"], y=[cid] * len(sub), mode="markers",
                       marker=dict(color=cluster_color_map[cid], size=5),
                       name=f"Cluster {cid}" if idx == 0 else None,
                       showlegend=(idx == 0)),
            row=row, col=col,
        )
    fig_timeline.update_xaxes(title_text="", row=row, col=col)
    fig_timeline.update_yaxes(title_text="Cluster", row=row, col=col, tickmode="array",
                               tickvals=cluster_ids)

fig_timeline.update_layout(height=400, margin=dict(t=40))
st.plotly_chart(fig_timeline, use_container_width=True)

# ---- Stability Distribution ----
st.subheader("Distribusi Stabilitas")
col_left, col_right = st.columns(2)

with col_left:
    stability_counts = df_filt["Stability_Label"].value_counts().reindex(["A - Stable", "B - Moderate", "C - Vulnerable"])
    fig_pie = go.Figure(data=[go.Pie(
        labels=stability_counts.index,
        values=stability_counts.values,
        marker=dict(colors=[COLOR_MAP.get(l, "#999") for l in stability_counts.index]),
        hole=0.4,
    )])
    fig_pie.update_layout(title="Proporsi Label Stabilitas", height=350)
    st.plotly_chart(fig_pie, use_container_width=True)

with col_right:
    crosstab = pd.crosstab(df_filt["Currency"], df_filt["Stability_Label"])
    for col in ["A - Stable", "B - Moderate", "C - Vulnerable"]:
        if col not in crosstab.columns:
            crosstab[col] = 0
    crosstab = crosstab[["A - Stable", "B - Moderate", "C - Vulnerable"]]
    fig_bar = go.Figure()
    for label in ["A - Stable", "B - Moderate", "C - Vulnerable"]:
        fig_bar.add_trace(go.Bar(
            name=label, x=crosstab.index, y=crosstab[label],
            marker_color=COLOR_MAP[label],
        ))
    fig_bar.update_layout(barmode="stack", title="Distribusi Stabilitas per Mata Uang", height=350)
    st.plotly_chart(fig_bar, use_container_width=True)

# ---- Algorithm Comparison ----
st.subheader("Perbandingan Algoritma (Stability Label Distribution)")
algo_cols = list(ALGO_MAP.values())
comparison_data = []
for algo_name, col_name in ALGO_MAP.items():
    temp = df_filt.groupby(col_name)["Stability_Label"].first().reset_index()
    temp["Algoritma"] = algo_name
    comparison_data.append(temp)
comp_df = pd.concat(comparison_data, ignore_index=True)

fig_comp = px.histogram(
    df_filt.melt(id_vars=["Currency", "Year", "Month", "Stability_Label"],
                  value_vars=algo_cols, var_name="Algoritma", value_name="Cluster"),
    x="Stability_Label", color="Stability_Label", facet_col="Algoritma",
    color_discrete_map=COLOR_MAP,
    category_orders={"Stability_Label": ["A - Stable", "B - Moderate", "C - Vulnerable"]},
    title="Distribusi Label Stabilitas per Algoritma",
    height=400,
)
fig_comp.for_each_annotation(lambda a: a.update(text=a.text.split("=")[-1]))
st.plotly_chart(fig_comp, use_container_width=True)

# ---- Data Table ----
st.subheader("Data Tabel")
with st.expander("Lihat data mentah"):
    display_cols = ["Date", "Currency", "Mean", "Std", "Volatility", "Pct_Change",
                     "Inflation", "DPI", "PCA1", "PCA2",
                     "KMeans_Cluster", "DBSCAN_Cluster", "AHC_Cluster", "KMedoids_Cluster",
                     "Stability_Label"]
    st.dataframe(df_filt[display_cols].sort_values(["Currency", "Date"]), use_container_width=True)

st.markdown("---")
st.markdown("**Projek Akhir Data Mining 2025/2026 — Clustering Stabilitas Mata Uang ASEAN terhadap USD**")
