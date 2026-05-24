/* eslint-disable react/no-unescaped-entities */
'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { Search, Plus, ChevronLeft, ChevronRight, Edit2, Copy, Trash2, Clock, User, ChevronDown, Braces } from 'lucide-react'
import type { RuleSetDetailDto, RuleSetListItemDto } from '../../../../contracts/types/businessFoundation'
import { fetchActivityApi, type PageDto } from './api-client'
import styles from './rule-library.module.css'

export function RuleLibraryPage() {
  const [rulePage, setRulePage] = useState<PageDto<RuleSetListItemDto> | null>(null)
  const [selectedRule, setSelectedRule] = useState<RuleSetDetailDto | null>(null)
  const selectedSummary = rulePage?.items[0]

  useEffect(() => {
    let cancelled = false
    fetchActivityApi<PageDto<RuleSetListItemDto>>('/api/rule-sets?pageSize=20')
      .then((page) => {
        if (cancelled) return
        setRulePage(page)
        const first = page.items[0]
        if (first) return fetchActivityApi<RuleSetDetailDto>(`/api/rule-sets/${first.ruleSetId}`)
        return null
      })
      .then((detail) => {
        if (!cancelled && detail) setSelectedRule(detail)
      })
      .catch(() => {
        if (!cancelled) setRulePage(null)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const visibleRules = useMemo(() => rulePage?.items.slice(0, 4) ?? null, [rulePage])
  const ruleCount = rulePage?.total ?? 42
  const enabledCount = rulePage?.items.filter((item) => item.status === 'ENABLED').length ?? 38
  const draftCount = rulePage?.items.filter((item) => item.status === 'DRAFT').length ?? 4

  return (
    <div className={styles.layout}>
      
      {/* Left Sidebar */}
      <div className={styles.leftSidebar}>
        <div className={styles.sidebarHeader}>
          <div className={styles.searchRow}>
            <div className={styles.searchInput}>
              <Search size={14} color="var(--muted)" />
              <input type="text" placeholder="搜索规则集名称..." />
            </div>
            <button className={styles.btnAdd}><Plus size={16} /></button>
          </div>
          <div className={styles.tabs}>
            <div className={`${styles.tab} ${styles.active}`}>所有 ({ruleCount})</div>
            <div className={styles.tab}>已启用 ({enabledCount})</div>
            <div className={styles.tab}>草稿 ({draftCount})</div>
          </div>
        </div>

        <div className={styles.ruleList}>
          {visibleRules ? visibleRules.map((rule, index) => (
            <div className={`${styles.ruleCard} ${index === 0 ? styles.active : ''}`} key={rule.ruleSetId}>
              <div className={styles.ruleTitleRow}>
                <div className={styles.ruleTitle}>{rule.name}</div>
                <span className={`${styles.statusBadge} ${rule.status === 'DRAFT' ? styles.statusDraft : styles.statusActive}`}>{rule.status === 'DRAFT' ? '草稿' : rule.status === 'DISABLED' ? '已禁用' : '已启用'}</span>
              </div>
              <div className={styles.ruleMetaRow}>来源: {rule.source} | 运行中 {rule.activeRunCount} 个</div>
              <div className={styles.ruleAuthorRow}>
                <div style={{display:'flex', alignItems:'center', gap:'4px'}}><User size={12}/> by {rule.updatedBy}</div>
                <span className={styles.versionBadge}>{rule.version}</span>
              </div>
            </div>
          )) : (
          <>
            <div className={`${styles.ruleCard} ${styles.active}`}>
              <div className={styles.ruleTitleRow}>
                <div className={styles.ruleTitle}>天猫618黄金类目执行清单</div>
                <span className={`${styles.statusBadge} ${styles.statusActive}`}>已启用</span>
              </div>
              <div className={styles.ruleMetaRow}>适用范围: 8个大类 | 42 条规则</div>
              <div className={styles.ruleAuthorRow}>
                <div style={{display:'flex', alignItems:'center', gap:'4px'}}><User size={12}/> by op_team</div>
                <span className={styles.versionBadge}>v2.0</span>
              </div>
            </div>

          <div className={styles.ruleCard}>
            <div className={styles.ruleTitleRow}>
              <div className={styles.ruleTitle}>京东618通用规则底座</div>
              <span className={`${styles.statusBadge} ${styles.statusActive}`}>已启用</span>
            </div>
            <div className={styles.ruleMetaRow}>适用范围: 全站 | 18 条规则</div>
            <div className={styles.ruleAuthorRow}>
              <div style={{display:'flex', alignItems:'center', gap:'4px'}}><User size={12}/> by compliance_team</div>
              <span className={styles.versionBadge}>v1.5</span>
            </div>
          </div>
          </>
          )}

          <div className={styles.ruleCard}>
            <div className={styles.ruleTitleRow}>
              <div className={styles.ruleTitle}>母婴类目日常准入规范</div>
              <span className={`${styles.statusBadge} ${styles.statusActive}`}>已启用</span>
            </div>
            <div className={styles.ruleMetaRow}>适用范围: 母婴 | 24 条规则</div>
            <div className={styles.ruleAuthorRow}>
              <div style={{display:'flex', alignItems:'center', gap:'4px'}}><User size={12}/> by qa_team</div>
              <span className={styles.versionBadge}>v3.1</span>
            </div>
          </div>

          <div className={styles.ruleCard}>
            <div className={styles.ruleTitleRow}>
              <div className={styles.ruleTitle}>美妆宣称词黑名单 (草案)</div>
              <span className={`${styles.statusBadge} ${styles.statusDraft}`}>草稿</span>
            </div>
            <div className={styles.ruleMetaRow}>适用范围: 美妆 | 120+ 词条</div>
            <div className={styles.ruleAuthorRow}>
              <div style={{display:'flex', alignItems:'center', gap:'4px'}}><User size={12}/> by legal_team</div>
              <span className={styles.versionBadge}>v0.1</span>
            </div>
          </div>
        </div>

        <div className={styles.pagination}>
          <span>1 / 5 页</span>
          <div className={styles.pageControls}>
            <div className={styles.pageBtn}><ChevronLeft size={14}/></div>
            <div className={styles.pageBtn}><ChevronRight size={14}/></div>
          </div>
        </div>
      </div>

      {/* Right Main Panel */}
      <div className={styles.mainPanel}>
        <div className={styles.panelHeader}>
          <div className={styles.headerTitleRow}>
            <div className={styles.mainTitle}>{selectedRule?.name ?? selectedSummary?.name ?? '天猫618黄金类目执行清单'}</div>
            <div className={styles.headerActions}>
              <button className="secondaryButton"><Edit2 size={14}/> 编辑</button>
              <button className="secondaryButton"><Copy size={14}/> 创建新版本</button>
              <button className="secondaryButton" style={{color:'#dc2626', borderColor:'#fca5a5'}}><Trash2 size={14}/> 禁用</button>
            </div>
          </div>
          <div className={styles.headerMetaRow}>
            <div className={styles.metaItem}><span style={{color:'var(--primary)', background:'rgba(36, 107, 255, 0.1)', padding:'2px 6px', borderRadius:'4px', fontSize:'12px', fontWeight:500}}>版本 {selectedRule?.version ?? selectedSummary?.version ?? 'v2.0'} (生产中)</span></div>
            <div className={styles.metaItem}><Clock size={14}/> 生效时间 2025-05-20 ~ 2025-06-20</div>
            <div className={styles.metaItem}><User size={14}/> 最后更新 {selectedRule?.updatedAt ? new Date(selectedRule.updatedAt).toLocaleString('zh-CN') : '昨天 14:30'} by {selectedRule?.updatedBy ?? selectedSummary?.updatedBy ?? 'op_team'}</div>
          </div>
        </div>

        <div className={styles.panelTabs}>
          <div className={styles.panelTab}>规则概况</div>
          <div className={`${styles.panelTab} ${styles.active}`}>JSON 定义</div>
        </div>

        <div className={styles.editorContainer}>
          {/* Fake Code Editor */}
          <div className={styles.codeArea}>
<div className={styles.codeLine}><span className={styles.lineNumber}>1</span><span className={styles.codeContent}><span className={styles.tokenPunctuation}>{'{'}</span></span></div>
<div className={styles.codeLine}><span className={styles.lineNumber}>2</span><span className={styles.codeContent}>  <span className={styles.tokenKey}>"rule_set"</span><span className={styles.tokenPunctuation}>: </span><span className={styles.tokenString}>"tmall_618_golden"</span><span className={styles.tokenPunctuation}>,</span></span></div>
<div className={styles.codeLine}><span className={styles.lineNumber}>3</span><span className={styles.codeContent}>  <span className={styles.tokenKey}>"metadata"</span><span className={styles.tokenPunctuation}>: {'{'}</span></span></div>
<div className={styles.codeLine}><span className={styles.lineNumber}>4</span><span className={styles.codeContent}>    <span className={styles.tokenKey}>"version"</span><span className={styles.tokenPunctuation}>: </span><span className={styles.tokenString}>"v2.0"</span><span className={styles.tokenPunctuation}>,</span></span></div>
<div className={styles.codeLine}><span className={styles.lineNumber}>5</span><span className={styles.codeContent}>    <span className={styles.tokenKey}>"description"</span><span className={styles.tokenPunctuation}>: </span><span className={styles.tokenString}>"天猫 618 大促核心类目准入检查基线"</span></span></div>
<div className={styles.codeLine}><span className={styles.lineNumber}>6</span><span className={styles.codeContent}>  <span className={styles.tokenPunctuation}>{'}'},</span></span></div>
<div className={styles.codeLine}><span className={styles.lineNumber}>7</span><span className={styles.codeContent}>  <span className={styles.tokenKey}>"global_filters"</span><span className={styles.tokenPunctuation}>: {'{'}</span></span></div>
<div className={styles.codeLine}><span className={styles.lineNumber}>8</span><span className={styles.codeContent}>    <span className={styles.tokenKey}>"categories"</span><span className={styles.tokenPunctuation}>: [</span><span className={styles.tokenString}>"美妆"</span><span className={styles.tokenPunctuation}>, </span><span className={styles.tokenString}>"个护"</span><span className={styles.tokenPunctuation}>, </span><span className={styles.tokenString}>"家清"</span><span className={styles.tokenPunctuation}>],</span></span></div>
<div className={styles.codeLine}><span className={styles.lineNumber}>9</span><span className={styles.codeContent}>    <span className={styles.tokenKey}>"price_range"</span><span className={styles.tokenPunctuation}>: [</span><span className={styles.tokenNumber}>50</span><span className={styles.tokenPunctuation}>, </span><span className={styles.tokenNumber}>5000</span><span className={styles.tokenPunctuation}>]</span></span></div>
<div className={styles.codeLine}><span className={styles.lineNumber}>10</span><span className={styles.codeContent}>  <span className={styles.tokenPunctuation}>{'}'},</span></span></div>
<div className={styles.codeLine}><span className={styles.lineNumber}>11</span><span className={styles.codeContent}>  <span className={styles.tokenKey}>"rules"</span><span className={styles.tokenPunctuation}>: [</span></span></div>
<div className={styles.codeLine}><span className={styles.lineNumber}>12</span><span className={styles.codeContent}>    <span className={styles.tokenPunctuation}>{'{'}</span></span></div>
<div className={styles.codeLine}><span className={styles.lineNumber}>13</span><span className={styles.codeContent}>      <span className={styles.tokenKey}>"id"</span><span className={styles.tokenPunctuation}>: </span><span className={styles.tokenString}>"rule_1"</span><span className={styles.tokenPunctuation}>,</span></span></div>
<div className={styles.codeLine}><span className={styles.lineNumber}>14</span><span className={styles.codeContent}>      <span className={styles.tokenKey}>"name"</span><span className={styles.tokenPunctuation}>: </span><span className={styles.tokenString}>"必填字段校验"</span><span className={styles.tokenPunctuation}>,</span></span></div>
<div className={styles.codeLine}><span className={styles.lineNumber}>15</span><span className={styles.codeContent}>      <span className={styles.tokenKey}>"type"</span><span className={styles.tokenPunctuation}>: </span><span className={styles.tokenString}>"presence"</span><span className={styles.tokenPunctuation}>,</span></span></div>
<div className={styles.codeLine}><span className={styles.lineNumber}>16</span><span className={styles.codeContent}>      <span className={styles.tokenKey}>"fields"</span><span className={styles.tokenPunctuation}>: [</span><span className={styles.tokenString}>"brand_name"</span><span className={styles.tokenPunctuation}>, </span><span className={styles.tokenString}>"net_content"</span><span className={styles.tokenPunctuation}>],</span></span></div>
<div className={styles.codeLine}><span className={styles.lineNumber}>17</span><span className={styles.codeContent}>      <span className={styles.tokenKey}>"severity"</span><span className={styles.tokenPunctuation}>: </span><span className={styles.tokenString}>"blocking"</span></span></div>
<div className={styles.codeLine}><span className={styles.lineNumber}>18</span><span className={styles.codeContent}>    <span className={styles.tokenPunctuation}>{'}'},</span></span></div>
<div className={styles.codeLine}><span className={styles.lineNumber}>19</span><span className={styles.codeContent}>    <span className={styles.tokenPunctuation}>{'{'}</span></span></div>
<div className={styles.codeLine}><span className={styles.lineNumber}>20</span><span className={styles.codeContent}>      <span className={styles.tokenKey}>"id"</span><span className={styles.tokenPunctuation}>: </span><span className={styles.tokenString}>"rule_2"</span><span className={styles.tokenPunctuation}>,</span></span></div>
<div className={styles.codeLine}><span className={styles.lineNumber}>21</span><span className={styles.codeContent}>      <span className={styles.tokenKey}>"name"</span><span className={styles.tokenPunctuation}>: </span><span className={styles.tokenString}>"违禁宣称词排查"</span><span className={styles.tokenPunctuation}>,</span></span></div>
<div className={styles.codeLine}><span className={styles.lineNumber}>22</span><span className={styles.codeContent}>      <span className={styles.tokenKey}>"type"</span><span className={styles.tokenPunctuation}>: </span><span className={styles.tokenString}>"regex_match"</span><span className={styles.tokenPunctuation}>,</span></span></div>
<div className={styles.codeLine}><span className={styles.lineNumber}>23</span><span className={styles.codeContent}>      <span className={styles.tokenKey}>"pattern"</span><span className={styles.tokenPunctuation}>: </span><span className={styles.tokenString}>"(国家级|最高级|最佳|第一)"</span><span className={styles.tokenPunctuation}>,</span></span></div>
<div className={styles.codeLine}><span className={styles.lineNumber}>24</span><span className={styles.codeContent}>      <span className={styles.tokenKey}>"severity"</span><span className={styles.tokenPunctuation}>: </span><span className={styles.tokenString}>"blocking"</span></span></div>
<div className={styles.codeLine}><span className={styles.lineNumber}>25</span><span className={styles.codeContent}>    <span className={styles.tokenPunctuation}>{'}'}</span></span></div>
<div className={styles.codeLine}><span className={styles.lineNumber}>26</span><span className={styles.codeContent}>  <span className={styles.tokenPunctuation}>]</span></span></div>
<div className={styles.codeLine}><span className={styles.lineNumber}>27</span><span className={styles.codeContent}><span className={styles.tokenPunctuation}>{'}'}</span></span></div>
          </div>

          {/* Outline Sidebar */}
          <div className={styles.outlineSidebar}>
            <div className={styles.outlineHeader}>结构大纲</div>
            <div className={styles.outlineBody}>
              <div className={styles.outlineNode}><Braces size={14} color="#ce9178"/> rule_set</div>
              <div className={styles.outlineNode}><Braces size={14} color="#ce9178"/> metadata</div>
              <div className={styles.outlineNode}><Braces size={14} color="#ce9178"/> global_filters</div>
              <div className={styles.outlineNode}><ChevronDown size={14} color="var(--muted)"/><Braces size={14} color="#ce9178"/> rules <span style={{color:'var(--muted)'}}>[42]</span></div>
              <div className={styles.outlineIndent}>
                <div className={styles.outlineNode}><Braces size={14} color="#ce9178"/> rule_1 (必填字段校验)</div>
                <div className={styles.outlineNode}><Braces size={14} color="#ce9178"/> rule_2 (违禁宣称词排查)</div>
                <div className={styles.outlineNode}><Braces size={14} color="#ce9178"/> rule_3 (资质有效期校验)</div>
                <div className={styles.outlineNode}><Braces size={14} color="#ce9178"/> rule_4 (促销价一致性)</div>
                <div className={styles.outlineNode}><Braces size={14} color="#ce9178"/> rule_5 (库存阈值拦截)</div>
              </div>
            </div>
          </div>
        </div>
      </div>

    </div>
  )
}
