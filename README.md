<img src="web/public/idun.png" alt="IDUN" width="90" align="left"><div align="left"><h1>IDUN: <ins>I</ins>ntegrating <ins>D</ins>ata-lake of <ins>U</ins>nstructured <ins>N</ins>ature</h1></div>

<div align="left">

[![Live Demo](https://img.shields.io/badge/Live%20Demo-GitHub%20Pages-blue?style=flat-square)](https://dtak-upc.github.io/IDUN/)
[![License: GPL-3.0](https://img.shields.io/badge/License-GPL--3.0-green.svg?style=flat-square)](LICENSE)

</div>

**IDUN** is an interactive research prototype for **discovery-driven integration of disjoint tables and text** in multi-modal data lakes.

🌐 **Public Demo:** [https://dtak-upc.github.io/IDUN/](https://dtak-upc.github.io/IDUN/)

---

## What is IDUN?

In modern data lakes (particularly across healthcare, biomedicine, and enterprise analytics), valuable information is fragmented across:
- **Disjoint Tabular Sources:** Relational tables (such as diagnoses, medications, lab tests, and procedures) that lack shared foreign keys, common entity identifiers, or aligned schemas.
- **Unstructured Text:** Clinical notes, discharge summaries, and medical reports that describe relationships naturally but remain disconnected from relational databases.

Traditional schema matching and entity resolution techniques fail when tables share neither attribute names nor overlapping key distributions. **IDUN** overcomes this limitation by leveraging unstructured narrative text as **text-mediated join paths**. Rather than relying on manual foreign-key engineering or monolithic prompt-based LLM generation, IDUN discovers latent semantic connections between relational rows and narrative sentences, maps them into a shared space, and materializes high-purity integrated tables with complete provenance.

> **Note on Live Inference:** Live model inference and GPU cross-attention execution are locked in this public web demonstration due to a parallel publication (LOKI) being under review. Everything will be hosted eventually. All interactive discovery, evidences, integration, and materialized relations as joined tables are actual inference results (pre-computed) using synthetic benchmark data and fully navigable.

---

## How It Works

IDUN’s end-to-end integration pipeline comprises four core stages:

```mermaid
flowchart LR
    subgraph S1["1. Data Lake"]
        direction TB
        T1["Tabular Sources (CSVs)"]
        T2["Unstructured Narratives (TXT)"]
        T1 ~~~ T2
    end

    subgraph S2["2. LOKI Discovery Engine"]
        direction TB
        L1["Bidirectional Cross-Attention"]
        L2["Text-Mediated Join Paths"]
        L1 --> L2
    end

    subgraph S3["3. Evidence Workbench"]
        direction TB
        E1["Dual-Pane Synchronizer"]
        E2["Span-Level Ground-Truth"]
        E1 --> E2
    end

    subgraph S4["4. Materialization"]
        direction TB
        M1["2D Relationship Space (HDBSCAN)"]
        M2["Materialized Relational Tables"]
        M1 --> M2
    end

    S1 --> S2
    S2 --> S3
    S3 --> S4
```

1. **Heterogeneous Lake Ingestion & Profiling:** Ingests raw tabular CSVs and narrative TXT documents without requiring pre-aligned schemas or primary-foreign key pairs.
2. **Latent-Space Discovery (LOKI):** Employs **LOKI** (*Latent-Space Optimization for Knowledge Integration*), using bidirectional cross-attention with query-dependent gating to project table rows and text sentences into a joint space, scoring candidate connections across disjoint tables.
3. **Evidence-Linked Grounding:** Discovered semantic joins are not black-box guesses; each connection links directly to supporting narrative text excerpts with character-level span highlighting.
4. **Relationship Space & Materialization:** Visualizes row-pair contextual embeddings in a 2D projection space clustered via **HDBSCAN**. Filtered high-purity paths are categorized into specific relationship types (e.g., *medication used for diagnosis*, *indication*, *therapeutic use*) and materialized into structured relational tables.

---

## Navigating the Website

When exploring the [interactive prototype](https://dtak-upc.github.io/IDUN/), you can navigate through the following dedicated views:

### 1. Data Lake
* **Explore Sources:** Browse the example data lake comprising independent tabular sources (diagnoses, medications) and clinical narrative notes.
* **Inspect Source Records:** View raw records, column definitions, and narrative texts.
* **Lake Profiling:** Inspect indexing metrics, representative coverage, and candidate search preparation.

### 2. Discover
* **Candidate Join Paths:** Explore semantic connections surfaced across disjoint sources.
* **Shared-Text Bridges:** Inspect cross-table bridges where narrative text provides the missing semantic link between distinct relational rows.

### 3. Evidence
* **Interactive Workbench:** Dual-pane synchronizer linking structured table rows to original narrative text spans.
* **Ground-Truth Provenance:** Click on candidate pairs to immediately highlight the exact sentences and clinical passages that justify the relationship.

### 4. Integration
* **2D Relationship Space:** A high-contrast constellation projection map visualizing HDBSCAN-clustered row pairs (supported, withheld, and conflicting pairs) in real time. Select individual points to inspect their underlying relationship.
* **Relationship Tables:** Browse materialized relational tables organized by semantic relation category.
* **Differential Comparison:** Compare results across runs to inspect newly proposed, changed, or withheld relationships.

### 5. Activity & Settings
* **Event Ledger:** Trace historical indexing, discovery, and materialization events.
* **Model Configurations:** View provider specifications (e.g., in-process Hugging Face models, Ollama, LM Studio, or OpenAI-compatible backends) supported by the full research backend.

---

## Quick Start (Running Locally)

To run the frontend prototype locally:

### Prerequisites
* **Node.js**: 22.12 or later (Node 24 recommended).

### Installation & Launch

```bash
# Clone the repository
git clone https://github.com/dtak-upc/IDUN.git
cd IDUN

# Install dependencies
npm ci

# Start the local development server
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

### Building for Production

```bash
# Type check and build the static showcase bundle
npm run build:showcase

# Package for GitHub Pages publication
npm run build:pages
```

---

## Research Foundations

IDUN is built on foundational research in multimodal data discovery and integration, text conceptualization, and representation learning:

* **LOKI:** *Discovery-Driven Integration of Disjoint Tables via Text* (under review at VLDB 2027) - A novel horizontal bi-directional cross-attention architecture for text-mediated join-path discovery.
* **THOR:** *Mitigating Data Sparsity in Integrated Data through Text Conceptualization* (ICDE 2024) - Deep concept mapping and data augmentation for sparse data lakes.
* **Foundational Paper:** *Text Data Integration* In Data Engineering for Data Science (Springer 2026) - A comprehensive survey of text data integration techniques and their applications in data engineering.

---

 ## To Cite the **ICDE-2024** Paper:
 ```ruby
@INPROCEEDINGS{rahman2024mitigating,
        author={Rahman, Md Ataur and Nadal, Sergi and Romero, Oscar and Sacharidis, Dimitris},
        booktitle={2024 IEEE 40th International Conference on Data Engineering (ICDE)}, 
        title={Mitigating Data Sparsity in Integrated Data through Text Conceptualization}, 
        year={2024},
        volume={},
        number={},
        pages={3490-3504},
        keywords={Annotations;Data integration;Knowledge graphs;Information retrieval;Data engineering;Data models;Complexity theory;Data Integration;Information Extraction;Entity Recognition;Slot-filling},
        doi={10.1109/ICDE60146.2024.00269}
}
```

 ## To Cite the Book Chapter on "Text Data Integration":
 ```ruby
@Inbook{AtaurRahman2026,
        author="Ataur Rahman, Md.
        and Sacharidis, Dimitris
        and Romero, Oscar
        and Nadal, Sergi",
        editor="Dejaegere, Gilles
        and Abell{\'o}, Alberto
        and Torp, Kristian
        and Simitsis, Alkis",
        title="Text Data Integration",
        bookTitle="Data Engineering for Data Science ",
        year="2026",
        publisher="Springer Nature Switzerland",
        address="Cham",
        pages="3--32",
        isbn="978-3-032-18765-9",
        doi="10.1007/978-3-032-18765-9_1",
        url="https://doi.org/10.1007/978-3-032-18765-9_1"
}
```

 ## To Cite our "LOKI" paper:
 ```ruby
@misc{rahman2026discoverydrivenintegrationdisjointtables,
      title={Discovery-Driven Integration of Disjoint Tables via Text}, 
      author={Md Ataur Rahman and Dimitris Sacharidis and Oscar Romero and Sergi Nadal},
      year={2026},
      eprint={2609.26658},
      archivePrefix={arXiv},
      primaryClass={cs.IR},
      url={https://arxiv.org/abs/2609.26658}, 
}
```

## License

This project is licensed under the **GNU General Public License v3.0 (GPL-3.0)**. See the [LICENSE](LICENSE) file for details.
