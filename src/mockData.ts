import type { KnowledgeDoc, ChatMessage } from "./types";

export const initialDocs: KnowledgeDoc[] = [
  {
    id: "d1",
    name: "机器学习导论-第三章-支持向量机.pdf",
    type: "PDF",
    category: "课程资料",
    uploadedAt: "2026-09-02 10:20",
    sizeKB: 842,
    status: "parsed",
    summary:
      "本章介绍支持向量机（SVM）的基本原理，包括最大间隔分类器、核函数方法以及软间隔的引入，并给出了对偶问题的推导过程。",
    keyPoints: ["最大间隔分类器", "核函数与非线性映射", "软间隔与松弛变量", "对偶问题与KKT条件"],
    outline: [
      "1. SVM 的直观理解与几何意义",
      "2. 硬间隔线性可分情形的推导",
      "3. 软间隔与惩罚系数 C",
      "4. 核技巧与常见核函数",
      "5. 与逻辑回归的对比",
    ],
  },
  {
    id: "d2",
    name: "基于Transformer的文本摘要研究综述.docx",
    type: "Word",
    category: "论文",
    uploadedAt: "2026-09-03 14:05",
    sizeKB: 1230,
    status: "parsed",
    summary:
      "综述了近年来基于 Transformer 架构的文本摘要方法，对比了抽取式与生成式摘要的优缺点，并总结了当前评价指标（ROUGE、BERTScore）的局限性。",
    keyPoints: ["抽取式 vs 生成式摘要", "预训练语言模型的应用", "ROUGE 与 BERTScore", "长文档摘要的挑战"],
    outline: [
      "1. 研究背景与摘要任务定义",
      "2. 抽取式方法综述",
      "3. 生成式方法与预训练模型",
      "4. 评价指标对比",
      "5. 开放问题与未来方向",
    ],
  },
  {
    id: "d3",
    name: "毕设开题报告-个人知识库系统.md",
    type: "Markdown",
    category: "项目文档",
    uploadedAt: "2026-09-05 09:40",
    sizeKB: 36,
    status: "parsed",
    summary:
      "本开题报告说明了个人知识库系统的研究背景、目标与技术路线，重点阐述了文档解析、向量检索与大模型问答相结合的整体方案。",
    keyPoints: ["个人知识库", "向量检索", "RAG 问答", "来源可追溯"],
    outline: ["1. 研究背景", "2. 需求分析", "3. 技术路线", "4. 进度安排"],
  },
  {
    id: "d4",
    name: "数据库系统概论-课堂笔记-第五周.txt",
    type: "TXT",
    category: "课程资料",
    uploadedAt: "2026-09-06 16:12",
    sizeKB: 12,
    status: "parsed",
    summary: "第五周课堂笔记，主要覆盖关系代数运算与SQL查询优化的基本思路。",
    keyPoints: ["关系代数", "SQL 查询优化", "索引选择"],
    outline: ["1. 关系代数基本运算", "2. 查询优化基本思路", "3. 常见索引类型"],
  },
  {
    id: "d5",
    name: "扫描版-实验数据表.pdf",
    type: "PDF",
    category: "项目文档",
    uploadedAt: "2026-09-07 11:30",
    sizeKB: 5400,
    status: "failed",
  },
  {
    id: "d6",
    name: "知识图谱构建方法调研.docx",
    type: "Word",
    category: "论文",
    uploadedAt: "2026-09-09 20:18",
    sizeKB: 980,
    status: "parsing",
  },
];

export const initialMessages: ChatMessage[] = [
  {
    id: "m1",
    role: "user",
    content: "SVM 里的软间隔是什么意思？",
  },
  {
    id: "m2",
    role: "assistant",
    content:
      "软间隔是为了让 SVM 能够处理线性不可分或存在噪声的数据而引入的机制。它通过引入松弛变量允许部分样本出现在间隔内甚至被错误分类，并用惩罚系数 C 控制间隔宽度与分类错误之间的权衡：C 越大，模型对误分类的惩罚越重，间隔趋于变窄。",
    sources: [
      {
        docId: "d1",
        docName: "机器学习导论-第三章-支持向量机.pdf",
        snippet:
          "……为了处理线性不可分的情况，我们为每个样本引入松弛变量 ξᵢ ≥ 0，并在目标函数中加入惩罚项 C·Σξᵢ，从而在最大间隔与训练误差之间取得平衡……",
      },
    ],
  },
];
