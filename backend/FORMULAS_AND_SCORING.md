# ECHOSNARE — Formula & Scoring Reference

> Implementation reference for the scoring, graph, coordination, similarity, forensic, and observability logic used by the backend.
>
> This document is intentionally more mathematical than the top-level README. It explains **how signals become numbers**, while the README explains **what the system is for**.

---

## 1. Scoring Philosophy

ECHOSNARE does not use one universal "fake" score.

The backend keeps several distinct quantities separate:

- **Content risk** — how strongly the text exhibits misinformation-like signals.
- **Bot score** — how strongly an account exhibits the configured behavioral indicators.
- **Temporal coordination score** — how densely and tightly accounts post within the coordination window.
- **Linguistic fingerprint score** — how strongly account writing styles form shared clusters.
- **Graph behavior score** — how strongly the campaign graph exhibits clustered, dense, behaviorally suspicious structure.
- **Campaign confidence** — a fusion of content, narrative similarity, and graph behavior.
- **Threat severity** — a categorical operational assessment derived from campaign and behavioral evidence.

These values should never be interpreted as a single probability of truth.

---

## 2. ContentAnalyzer

### 2.1 LLM + lexical fusion

For each analyzed text:

```text
final_content_score = 0.15 * lexical_score + 0.85 * llm_score
```

where both component scores are on a 0–100 scale.

The LLM is prompted for Indian social-media context and strict structured output. The lexical scorer provides a deterministic, inspectable signal and an offline fallback.

### 2.2 Lexical signals

The lexical layer uses features such as:

- suspicious phrase hits
- uppercase ratio
- exclamation/question density
- URL count
- numeric-claim density
- urgency tokens
- short-text penalty

The lexical score is deliberately subordinate to the LLM in the normal path, but remains available when the model is unavailable.

### 2.3 Confidence

The documented confidence transformation is:

```text
confidence = min(0.99, 0.4 + abs(score - 50) / 100)
```

This makes the model less confident near the ambiguous midpoint and more confident toward the extremes, while never reaching 1.0.

---

## 3. Bot Detection

ECHOSNARE has two bot-scoring paths:

1. **Primary coarse Cypher score** persisted in Neo4j.
2. **Composite Python score** used by `NetworkMapper`, enriched with graph metrics.

### 3.1 Coarse Cypher score

The Neo4j path adds:

```text
+0.25 if post_count > 50
+0.20 if age_days < 30
+0.20 if following > followers * 10
```

This is a lightweight database-side screening signal that is persisted as `a.bot_score`.

### 3.2 Composite bot score

The richer Python path first derives normalized signals:

```text
age_signal          = 1 - min(age_days / 365, 1)
frequency_signal    = min(posting_frequency / 20, 1)
connectivity_signal = min(degree / 10, 1)
ratio_signal        = 1.00 if followers/following < 0.3
                      0.45 if followers/following < 1.0
                      0.15 otherwise
pagerank_signal     = min(PageRank * 25, 1)
betweenness_signal  = min(Betweenness * 20, 1)
clustering_signal   = 1 - min(clustering_coefficient, 1)
verified_signal     = 0 if verified else 0.15
```

The composite is:

```text
bot_score = 100 * min(
    1,
    0.22 * age_signal
  + 0.18 * frequency_signal
  + 0.14 * connectivity_signal
  + 0.12 * ratio_signal
  + 0.08 * pagerank_signal
  + 0.10 * betweenness_signal
  + 0.10 * clustering_signal
  + verified_signal
)
```

The result is rounded to two decimals.

### Interpretation

A high score means that the account matches more of the configured suspicious-behavior indicators. It is **not** a proof that the account is a bot.

---

## 4. Graph Metrics

### 4.1 PageRank

NetworkX computes PageRank with damping factor:

```text
alpha = 0.85
```

Conceptually, high PageRank means a node receives structural importance from other connected nodes.

ECHOSNARE uses this as an influence/amplification signal rather than a truth signal.

### 4.2 Betweenness centrality

NetworkX computes normalized betweenness centrality. It measures how frequently a node lies on shortest paths between other nodes.

In an influence graph, a high-betweenness account can act as a bridge between otherwise separated communities.

### 4.3 Clustering coefficient

NetworkX computes each node's local clustering coefficient.

The bot-scoring pipeline uses:

```text
clustering_signal = 1 - clustering_coefficient
```

so lower local clustering contributes more strongly to the configured bot-risk score.

### 4.4 Graph density

For an undirected graph with `n` nodes and `m` edges:

```text
density = 2m / (n(n - 1))
```

The fallback NetworkX path also uses `nx.density(graph)`.

The Neo4j path derives the same normalized quantity from live node/edge counts.

---

## 5. TemporalCoordinator

### 5.1 Coordination window

```text
COORDINATION_WINDOW_SECONDS = 60
```

For every pair of accounts, every cross-account post pair is compared:

```text
absolute_delay = |timestamp_1 - timestamp_2|
```

If:

```text
absolute_delay <= 60 seconds
```

the pair is flagged as a temporal coordination event.

### 5.2 Coordination density

If there are `N` accounts, the number of account pairs is:

```text
pair_count = N(N - 1) / 2
```

The implementation calculates:

```text
density = flagged_pairs / pair_count
```

Note that multiple post pairs can contribute to `flagged_pairs`, so this is a deliberately sensitive coordination measure rather than a strict binary account-pair ratio.

### 5.3 Score

Let `d` be the coordination density and `M` the median flagged delay.

```text
score = min(
    100,
    min(1, d / 3) * 60
    + max(0, (60 - M) / 60) * 40
)
```

Interpretation:

- 60% of the score is driven by **how much coordination is observed**.
- 40% is driven by **how tightly synchronized the flagged events are**.

### 5.4 Confidence

```text
confidence = min(
    1.0,
    0.35
    + flagged_pairs * 0.08
    + ((60 - median_delay) / 60) * 0.4
)
```

The confidence is bounded to `[0, 1]`.

---

## 6. LinguisticFingerprinter

Each account is represented using four stylometric features over its recent posts:

```text
1. average sentence length
2. vocabulary diversity = unique_tokens / total_tokens
3. punctuation density = punctuation_chars / total_chars
4. emoji frequency = emoji_count / total_chars
```

### 6.1 Feature normalization

The four-dimensional account matrix is scaled with `MinMaxScaler`.

### 6.2 Clustering

DBSCAN is used with:

```text
eps = 0.8
min_samples = 2
```

A cluster therefore represents accounts whose normalized stylometric profiles are sufficiently close under the configured density criterion.

### 6.3 Pairwise similarity

Cosine similarity is computed on the raw feature matrix.

```text
cos_sim(x, y) = (x · y) / (||x|| ||y||)
```

### 6.4 Fingerprint score

For non-singleton input:

```text
cluster_bonus = number_of_non_noise_clusters / number_of_accounts
within_cluster_similarity = mean(cosine similarity of same-cluster pairs)

score = min(
    100,
    cluster_bonus * 55
    + within_cluster_similarity * 45
)
```

An account with too little comparison data is handled conservatively; a single supplied profile gets a score of `0.0`.

---

## 7. CampaignDetector

Campaign detection fuses three views of a campaign:

1. average content risk
2. narrative similarity
3. graph behavior

### 7.1 Content risk

For all campaign posts:

```text
content_risk = mean(ContentAnalyzer(post).misinformation_score)
```

### 7.2 Narrative similarity

When `all-MiniLM-L6-v2` is available:

```text
similarity = mean(cosine_similarity(narrative_embedding, post_embeddings)) * 100
```

The implementation computes normalized embeddings and uses their dot product, which is equivalent to cosine similarity for unit-normalized vectors.

Fallback behavior uses token overlap instead.

### 7.3 Graph behavior

Current implementation:

```text
graph_behavior = min(
    100,
    35 * cluster_count
    + 300 * density
    + 0.35 * bot_pressure
)
```

where:

```text
bot_pressure = mean(account_bot_score)
```

This explicitly gives graph structure a large influence on campaign detection.

### 7.4 Campaign confidence

```text
confidence = min(
    99,
    0.35 * content_risk
    + 0.25 * narrative_similarity
    + 0.40 * graph_behavior
)
```

Campaign detection is triggered when:

```text
confidence >= 55
```

This threshold is a **campaign-detection threshold**, not a probability that the narrative is true or false.

### 7.5 Why graph behavior has 40%

The weighting encodes the central design principle:

```text
how the narrative moved
        >
what any one post looked like
```

The content can indicate risk, but coordinated propagation is a network phenomenon.

---

## 8. ThreatClassifier

Threat classification is a separate operational layer.

Deterministic fallback rules are:

```text
IF bot_pressure > 70
   OR (campaign_detected AND cluster_count > 2 AND confidence > 70)
THEN
   type = "Possible State-Level Operation"
   severity = "critical"

ELSE IF campaign_detected AND bot_pressure > 40
THEN
   type = "Coordinated Inauthentic Behavior"
   severity = "high"

ELSE IF content_risk > 50
THEN
   type = "Organic Misinformation"
   severity = "medium"

ELSE
   type = "Organic Misinformation"
   severity = "low"
```

The generative-model path can provide a richer classification and explanation; the rule ladder exists as a deterministic fallback.

---

## 9. AIOperationDetector

The detector combines four signals with equal weight:

```text
AI operation score =
    0.25 * burstiness_signal
  + 0.25 * perplexity_signal
  + 0.25 * semantic_consistency_signal
  + 0.25 * topic_drift_signal
```

The backend computes/derives these signals from account posts. The documented interpretation is:

- **Burstiness** — unnatural regularity in posting/length patterns.
- **Bigram perplexity** — lower values indicate more predictable text.
- **Semantic consistency** — unusually high similarity across posts can indicate templated generation.
- **Topic drift** — minimal drift between consecutive posts can indicate narrow scripted operation.

With fewer than 3 posts, the implementation returns a neutral score of `25.0` rather than fabricating an AI-operation judgement.

Verdict bands:

```text
score >= 75 → LIKELY_AI
score >= 45 → POSSIBLY_AI
otherwise   → LIKELY_HUMAN
```

These are operational heuristics, not source-of-authorship proof.

---

## 10. Image Forensics

Image analysis deliberately separates two questions.

### 10.1 Editing / manipulation heuristic

The current heuristic starts at:

```text
score = 0.15
```

and adds:

```text
+0.20 if EXIF metadata is absent
+0.15 if a Software tag is present
+0.05 if DateTime is absent
+0.25 if ELA max difference > 25
+0.15 if ELA max difference > 10 (instead of the >25 branch)
```

The result is capped to the configured range.

ELA is produced by JPEG q90 recompression, differencing, and amplification.

### 10.2 AI-generated image evidence

Three Hugging Face image classifiers are queried in parallel.

The ensemble uses the **second-highest returned probability** rather than the maximum. This means two independent models must agree strongly before the ensemble confidently flags an image.

If only one model responds, its probability is clamped below the flag threshold.

### 10.3 Fusion

When AI probability is confident:

```text
manipulation = 0.6 * ai_probability + 0.4 * heuristic
```

Otherwise:

```text
manipulation = heuristic
```

The AI-generation result therefore cannot erase ELA/EXIF editing evidence.

---

## 11. WhatsAppAnalyzer

The analyzer begins with a base score:

```text
base = 20
```

Weighted signal families are:

```text
health_misinfo      +25
political_misinfo   +25
unnamed_authority   +20
conspiracy_markers  +20
urgency_language    +15
share_bait          +15
```

Forward depth contributes:

```text
+ min(forward_depth * 5, 15)
```

The total is capped:

```text
final_score = min(97, total)
```

The same component also estimates whether the message is a forward using markers such as `FWD:`, forwarding phrases, and common Hindi/Hinglish share language.

This score describes the **risk/signature of the message**, not its factual truth.

---

## 12. Graph Persistence and Materialized Relationships

The primary graph is Neo4j AuraDB.

Core relationships:

```text
(Account)-[:SHARED]->(Post)
(Account)-[:PART_OF]->(Campaign)
(Post)-[:PART_OF]->(Campaign)
(Account)-[:INTERACTS]->(Account)
(Account)-[:COORDINATES_WITH]->(Account)
```

### Coordination edge

`COORDINATES_WITH` is intended to be a materialized observation from ingestion-time temporal comparison, with:

```text
delay_seconds
```

stored on the relationship.

This converts repeated coordination checks into a graph traversal/query problem.

---

## 13. Community Detection

### Neo4j primary path

The backend fetches account-to-account `COORDINATES_WITH` and `INTERACTS` edges and applies label propagation.

Conceptually:

```text
initially: label(node) = node_id

repeat up to 10 rounds:
    each node observes neighbor labels
    node adopts the dominant neighboring label

stop when labels stop changing
```

The resulting groups become `cluster_id` values persisted to Account nodes.

### NetworkX fallback

The fallback uses:

```text
greedy_modularity_communities(graph)
```

which seeks communities with strong internal connectivity relative to the partitioned graph.

---

## 14. Observability / Agent Logs

Each agent execution is tracked through the agent roster/telemetry layer.

The implementation records at least:

```text
agent identity
execution/task occurrence
last-active time
```

The purpose is not cosmetic dashboard decoration. It provides an operational view of whether a particular agent was actually invoked and when it was last active.

The architecture's `/agents/status` surface is designed to report task counts and last-active timestamps from these records rather than static demo counters.

---

## 15. What These Formulas Do NOT Mean

The following distinctions are mandatory when interpreting outputs:

```text
bot_score              ≠ proof of bot identity
coordination_score     ≠ proof of conspiracy
content_risk           ≠ factual falsity
campaign_confidence    ≠ probability the claim is false
source existence       ≠ source correctness
threat severity        ≠ truth verdict
```

The system is an **investigation and intelligence layer**. Its strongest output is a traceable combination of evidence, propagation structure, and explicit limitations.

---

## 16. Quick Reference

```text
CONTENT
0.15 lexical + 0.85 LLM

BOT
100 × weighted behavioral signals

TEMPORAL
60-second window
60% density + 40% timing tightness

LINGUISTIC
DBSCAN + cosine similarity
55% cluster component + 45% within-cluster similarity

CAMPAIGN
35% content + 25% narrative + 40% graph behavior

IMAGE
ELA/EXIF heuristic + second-highest AI model score

WHATSAPP
base 20 + weighted pattern signals + capped forward-depth contribution

GRAPH
Neo4j primary
NetworkX fallback
```

---

## 17. Source of Truth

This file documents the formulas implemented in the backend as of the current repository revision. When a formula changes in code, update this reference in the same change so the implementation and documentation do not drift.
