import streamlit as st
import pandas as pd
import numpy as np
import plotly.express as px
import plotly.graph_objects as go
from plotly.subplots import make_subplots

st.set_page_config(layout="wide", page_title="Dashboard Clustering Stabilitas Mata Uang ASEAN")

# Gunakan jalur relatif agar bisa dijalankan di mana saja
CSV_PATH = "data_clustering_monthly.csv"

@st.cache_data
def load_data():
    df = pd.read_csv(CSV_PATH)
    df["Date"] = pd.to_datetime(df["Year"].astype(str) + "-" + df["Month"].astype(str).str.zfill(2) + "-01")
    return df

df = load_data()

# Menggunakan AHC sebagai satu-satunya algoritma
ALGO_NAME = "AHC"
ALGO_COL = "AHC_Cluster"
COLOR_MAP = {"A - Stable": "#2ECC71", "B - Moderate": "#F1C40F", "C - Vulnerable": "#E74C3C"}

st.title("Dashboard Clustering Stabilitas Mata Uang ASEAN terhadap USD")
st.markdown("Analisis Klasterisasi **AHC (Agglomerative Hierarchical Clustering)** — Granularitas Bulanan (2015–2023)")

# ---- Sidebar Filters ----
st.sidebar.header("Filter")
selected_currencies = st.sidebar.multiselect("Mata Uang", sorted(df["Currency"].unique()), default=sorted(df["Currency"].unique()))
year_range = st.sidebar.slider("Rentang Tahun", int(df["Year"].min()), int(df["Year"].max()), (2015, 2023))

mask = df["Currency"].isin(selected_currencies) & df["Year"].between(*year_range)
df_filt = df[mask].copy()

# ---- Metrics ----
st.subheader("Ringkasan")
col1, col2, col3 = st.columns(3)
n_clusters = df_filt[ALGO_COL].nunique()
stable_pct = (df_filt["Stability_Label"] == "A - Stable").sum() / len(df_filt) * 100

col1.metric("Total Observasi", len(df_filt))
col2.metric("Jumlah Cluster", n_clusters)
col3.metric("Stable Ratio", f"{stable_pct:.1f}%")

# ---- PCA Scatter ----
st.subheader("PCA Scatter — AHC")
fig_scatter = px.scatter(
    df_filt,
    x="PCA1",
    y="PCA2",
    color="Stability_Label",
    color_discrete_map=COLOR_MAP,
    symbol="Currency",
    hover_data=["Currency", "Year", "Month", "Stability_Label", ALGO_COL],
    title="Proyeksi 2D PCA — Warna: Stability Label, Bentuk: Currency",
    height=500,
)
fig_scatter.update_traces(marker=dict(size=6))
st.plotly_chart(fig_scatter, use_container_width=True)

# ---- Cluster Timeline ----
st.subheader("Cluster Timeline per Mata Uang — AHC")

if len(selected_currencies) > 0:
    # Mengatur subplot dinamis berdasarkan jumlah mata uang terpilih
    n_cols = min(3, len(selected_currencies))
    n_rows = (len(selected_currencies) + 2) // 3
    
    fig_timeline = make_subplots(
        rows=n_rows, cols=n_cols,
        subplot_titles=sorted(selected_currencies),
        vertical_spacing=0.15 if n_rows > 1 else 0.12,
        horizontal_spacing=0.08,
    )

    color_seq = px.colors.qualitative.Set2
    cluster_ids = sorted(df_filt[ALGO_COL].unique())
    cluster_color_map = {cid: color_seq[i % len(color_seq)] for i, cid in enumerate(cluster_ids)}

    for idx, currency in enumerate(sorted(selected_currencies)):
        row = idx // 3 + 1
        col = idx % 3 + 1
        cdf = df_filt[df_filt["Currency"] == currency].sort_values("Date")
        for cid in cluster_ids:
            sub = cdf[cdf[ALGO_COL] == cid]
            fig_timeline.add_trace(
                go.Scatter(x=sub["Date"], y=[cid] * len(sub), mode="markers",
                           marker=dict(color=cluster_color_map[cid], size=6),
                           name=f"Cluster {cid}" if idx == 0 else None,
                           showlegend=(idx == 0)),
                row=row, col=col,
            )
        fig_timeline.update_xaxes(title_text="", row=row, col=col)
        fig_timeline.update_yaxes(title_text="Cluster", row=row, col=col, tickmode="array",
                                   tickvals=cluster_ids)

    fig_timeline.update_layout(height=250 * n_rows, margin=dict(t=40, b=40))
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
    fig_pie.update_layout(title="Proporsi Label Stabilitas (AHC)", height=350)
    st.plotly_chart(fig_pie, use_container_width=True)

with col_right:
    crosstab = pd.crosstab(df_filt["Currency"], df_filt["Stability_Label"])
    for col_name in ["A - Stable", "B - Moderate", "C - Vulnerable"]:
        if col_name not in crosstab.columns:
            crosstab[col_name] = 0
    crosstab = crosstab[["A - Stable", "B - Moderate", "C - Vulnerable"]]
    
    fig_bar = go.Figure()
    for label in ["A - Stable", "B - Moderate", "C - Vulnerable"]:
        fig_bar.add_trace(go.Bar(
            name=label, x=crosstab.index, y=crosstab[label],
            marker_color=COLOR_MAP[label],
        ))
    fig_bar.update_layout(barmode="stack", title="Distribusi Stabilitas per Mata Uang (AHC)", height=350)
    st.plotly_chart(fig_bar, use_container_width=True)

# ---- Data Table ----
st.subheader("Data Tabel")
with st.expander("Lihat data mentah"):
    display_cols = ["Date", "Currency", "Mean", "Std", "Volatility", "Pct_Change",
                     "Inflation", "DPI", "PCA1", "PCA2",
                     "AHC_Cluster", "Stability_Label"]
    st.dataframe(df_filt[display_cols].sort_values(["Currency", "Date"]), use_container_width=True)

st.markdown("---")
st.markdown("**Projek Akhir Data Mining 2025/2026 — Clustering Stabilitas Mata Uang ASEAN terhadap USD menggunakan AHC**")
