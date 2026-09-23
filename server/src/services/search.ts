import { config } from "../config.js";
import { query } from "../db.js";
import { embedTexts } from "./ai.js";
import { displayFilename } from "./filename.js";
import { searchVectors } from "./vectorStore.js";

export interface SearchResult {
  chunkId: string;
  documentId: string;
  documentName: string;
  fileExtension: string | null;
  snippet: string;
  pageNo: number | null;
  sectionTitle: string | null;
  score: number;
  method: "hybrid" | "embedding" | "fulltext" | "keyword";
}

interface Candidate {
  row: any;
  semanticScore: number;
  fulltextScore: number;
  keywordScore: number;
}

function tokens(input: string) {
  const normalized = input.toLowerCase().replace(/\s+/g, "");
  const result = new Set<string>();
  for (const match of normalized.matchAll(/[a-z0-9_]{2,}|[\u4e00-\u9fff]{2}/g)) {
    result.add(match[0]);
  }
  return [...result];
}

function snippet(content: string, queryText: string) {
  const lower = content.toLowerCase();
  const firstToken = tokens(queryText).find((token) => lower.includes(token));
  const position = firstToken ? lower.indexOf(firstToken) : 0;
  const start = Math.max(0, position - 120);
  const end = Math.min(content.length, start + 520);
  return `${start > 0 ? "…" : ""}${content.slice(start, end)}${end < content.length ? "…" : ""}`;
}

function cosine(a: number[], b: number[]) {
  if (a.length !== b.length || !a.length) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let index = 0; index < a.length; index += 1) {
    dot += a[index] * b[index];
    normA += a[index] ** 2;
    normB += b[index] ** 2;
  }
  return normA && normB ? dot / (Math.sqrt(normA) * Math.sqrt(normB)) : 0;
}

function normalizeScores(values: number[]) {
  const max = Math.max(...values, 0);
  return max > 0 ? values.map((value) => value / max) : values.map(() => 0);
}

function toResult(candidate: Candidate, score: number, method: SearchResult["method"]): SearchResult {
  return {
    chunkId: String(candidate.row.chunk_id),
    documentId: String(candidate.row.document_id),
    documentName: displayFilename(candidate.row.original_file_name),
    fileExtension: candidate.row.file_extension ?? null,
    snippet: snippet(candidate.row.content, candidate.row.queryText ?? ""),
    pageNo: candidate.row.page_no,
    sectionTitle: candidate.row.section_title,
    score,
    method,
  };
}

export async function searchKnowledge(ownerId: string, question: string, limit = 6): Promise<SearchResult[]> {
  const [fulltextRows, rows] = await Promise.all([
    query<any>(
      `SELECT c.chunk_id, c.document_id, d.original_file_name, d.file_extension, c.content, c.page_no, c.section_title,
              MATCH(c.content) AGAINST (? IN NATURAL LANGUAGE MODE) AS score
       FROM document_chunk c
       INNER JOIN documents d ON d.document_id = c.document_id
       WHERE d.owner_id = ? AND d.parse_status = 'parsed' AND d.deleted_at IS NULL
         AND MATCH(c.content) AGAINST (? IN NATURAL LANGUAGE MODE)
       ORDER BY score DESC LIMIT ?`,
      [question, ownerId, question, Math.max(limit * 4, 20)],
    ).catch(() => []),
    query<any>(
      `SELECT c.chunk_id, c.document_id, d.original_file_name, d.file_extension, c.content, c.page_no, c.section_title,
              c.embedding_json
       FROM document_chunk c
       INNER JOIN documents d ON d.document_id = c.document_id
       WHERE d.owner_id = ? AND d.parse_status = 'parsed' AND d.deleted_at IS NULL
       ORDER BY c.chunk_id DESC LIMIT ?`,
      [ownerId, config.maxEmbeddingCandidates],
    ),
  ]);
  if (!rows.length) return [];

  const fulltextScores = normalizeScores(fulltextRows.map((row: any) => Number(row.score)));
  const candidates = new Map<string, Candidate>();
  fulltextRows.forEach((row: any, index: number) => {
    candidates.set(String(row.chunk_id), {
      row: { ...row, queryText: question },
      semanticScore: 0,
      fulltextScore: fulltextScores[index],
      keywordScore: 0,
    });
  });

  const queryTokens = tokens(question);
  for (const row of rows) {
    const content = row.content.toLowerCase();
    const keywordScore = queryTokens.reduce((total, token) => total + (content.includes(token) ? 1 : 0), 0);
    const existing = candidates.get(String(row.chunk_id));
    candidates.set(String(row.chunk_id), {
      row: { ...row, queryText: question },
      semanticScore: existing?.semanticScore ?? 0,
      fulltextScore: existing?.fulltextScore ?? 0,
      keywordScore,
    });
  }

  const questionVector = await embedTexts([question]).catch(() => null);
  if (questionVector?.[0]) {
    const vectorHits = await searchVectors(questionVector[0], ownerId, Math.max(limit * 4, 20)).catch(() => []);
    for (const hit of vectorHits) {
      const existing = candidates.get(hit.chunkId);
      candidates.set(hit.chunkId, {
        row: {
          ...(existing?.row ?? {}),
          chunk_id: hit.chunkId,
          document_id: hit.payload.documentId,
          original_file_name: hit.payload.documentName,
          file_extension: hit.payload.fileExtension,
          content: hit.payload.content,
          page_no: hit.payload.pageNo,
          section_title: hit.payload.sectionTitle,
          queryText: question,
        },
        semanticScore: hit.score,
        fulltextScore: existing?.fulltextScore ?? 0,
        keywordScore: existing?.keywordScore ?? 0,
      });
    }
    for (const candidate of candidates.values()) {
      if (candidate.semanticScore > 0) continue;
      let vector: number[] | null = null;
      try {
        vector = Array.isArray(candidate.row.embedding_json)
          ? candidate.row.embedding_json
          : candidate.row.embedding_json
            ? JSON.parse(candidate.row.embedding_json)
            : null;
      } catch {
        vector = null;
      }
      if (vector) candidate.semanticScore = cosine(questionVector[0], vector);
    }
  }

  const ranked = [...candidates.values()]
    .map((candidate) => {
      const hasSemantic = candidate.semanticScore > 0;
      const hasFulltext = candidate.fulltextScore > 0;
      const hasKeyword = candidate.keywordScore > 0;
      const score = hasSemantic
        ? candidate.semanticScore * 0.7 + candidate.fulltextScore * 0.2 + Math.min(candidate.keywordScore, 3) / 3 * 0.1
        : hasFulltext
          ? candidate.fulltextScore * 0.8 + Math.min(candidate.keywordScore, 3) / 3 * 0.2
          : Math.min(candidate.keywordScore, 3) / 3;
      return { candidate, score, hasSemantic, hasFulltext, hasKeyword };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return ranked.map((item) => toResult(
    item.candidate,
    item.score,
    item.hasSemantic && (item.hasFulltext || item.hasKeyword)
      ? "hybrid"
      : item.hasSemantic
        ? "embedding"
        : item.hasFulltext
          ? "fulltext"
          : "keyword",
  ));
}
