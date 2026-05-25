import { createRequire } from 'node:module'

const require = createRequire(new URL('../../frontend/package.json', import.meta.url))
const { Client } = require('pg')

const collectedAt = '2026-05-24T10:00:00.000Z'
const connectorCode = 'connector_tmall_jewelry_demo'
const ruleName = '618 活动准入规则'
const ruleText = '618珠宝类目报名要求：库存不少于20件，好评率不少于92%，黄金/铂金/钻石/彩宝/翡翠商品必须具备有效证书；近30天最低价不得低于活动价；已参加互斥品牌日活动的SKU不得报名。'

const rows = [
  { platform: 'tmall', storeId: 'ctf-flagship', externalSkuId: 'gold-ring-001', productName: '足金999古法莲花戒指 5.2g', category: '黄金饰品', brand: '周大福', sourceUrl: 'https://demo.tmall.test/jewelry/gold-ring-001', rowIndex: 1, sales30d: 386, positiveRate: 0.982, stock: 168, originalPrice: 3899, lowestPrice30d: 3599, campaignPrice: 3499, joinedBrandDay: false, certificateStatus: 'valid', raw: { material: 'Au999', weight: '5.2g', certificate: '国检证书已上传' } },
  { platform: 'tmall', storeId: 'ctf-flagship', externalSkuId: 'diamond-necklace-002', productName: '18K金钻石项链 0.18ct', category: '钻石饰品', brand: '周大福', sourceUrl: 'https://demo.tmall.test/jewelry/diamond-necklace-002', rowIndex: 2, sales30d: 142, positiveRate: 0.964, stock: 42, originalPrice: 4999, lowestPrice30d: 4599, campaignPrice: 4399, joinedBrandDay: false, certificateStatus: 'valid', raw: { diamond: '0.18ct', color: 'H', clarity: 'SI', certificate: 'GIA摘要' } },
  { platform: 'tmall', storeId: 'ctf-flagship', externalSkuId: 'sapphire-bracelet-003', productName: '天然蓝宝石手链 3.1ct', category: '彩宝饰品', brand: '周大福', sourceUrl: 'https://demo.tmall.test/jewelry/sapphire-bracelet-003', rowIndex: 3, sales30d: 38, positiveRate: 0.931, stock: 9, originalPrice: 6999, lowestPrice30d: 6599, campaignPrice: 6299, joinedBrandDay: false, certificateStatus: 'missing', raw: { gem: 'sapphire', certificate: '缺少国检证书编号' } },
  { platform: 'tmall', storeId: 'ctf-flagship', externalSkuId: 'gold-pendant-004', productName: '足金转运珠吊坠 2.8g', category: '黄金饰品', brand: '周大福', sourceUrl: 'https://demo.tmall.test/jewelry/gold-pendant-004', rowIndex: 4, sales30d: 516, positiveRate: 0.976, stock: 18, originalPrice: 2199, lowestPrice30d: 1999, campaignPrice: 1899, joinedBrandDay: false, certificateStatus: 'valid', raw: { material: 'Au999', weight: '2.8g', stockRisk: 'low' } },
  { platform: 'jd', storeId: 'jd-jewelry', externalSkuId: 'pearl-earring-005', productName: 'Akoya 海水珍珠耳钉 7-7.5mm', category: '珍珠饰品', brand: '京东珠宝', sourceUrl: 'https://demo.jd.test/jewelry/pearl-earring-005', rowIndex: 5, sales30d: 206, positiveRate: 0.951, stock: 73, originalPrice: 1599, lowestPrice30d: 1399, campaignPrice: 1299, joinedBrandDay: false, certificateStatus: 'valid', raw: { pearl: 'Akoya', diameter: '7-7.5mm', certificate: 'valid' } },
  { platform: 'jd', storeId: 'jd-jewelry', externalSkuId: 'jade-bangle-006', productName: '冰糯种翡翠手镯 56圈口', category: '翡翠玉石', brand: '京东珠宝', sourceUrl: 'https://demo.jd.test/jewelry/jade-bangle-006', rowIndex: 6, sales30d: 27, positiveRate: 0.887, stock: 5, originalPrice: 12800, lowestPrice30d: 11800, campaignPrice: 10999, joinedBrandDay: true, certificateStatus: 'ambiguous', raw: { jade: '翡翠A货待复核', size: '56', joinedBrandDay: true } },
  { platform: 'tmall', storeId: 'ctf-flagship', externalSkuId: 'platinum-chain-007', productName: 'Pt950铂金锁骨链 3.6g', category: '铂金饰品', brand: '周大福', sourceUrl: 'https://demo.tmall.test/jewelry/platinum-chain-007', rowIndex: 7, sales30d: 96, positiveRate: 0.948, stock: 64, originalPrice: 3299, lowestPrice30d: 3099, campaignPrice: 2999, joinedBrandDay: false, certificateStatus: 'valid', raw: { material: 'Pt950', weight: '3.6g' } },
  { platform: 'jd', storeId: 'jd-jewelry', externalSkuId: 'gold-bar-008', productName: '投资金条 20g Au9999', category: '投资金', brand: '京东珠宝', sourceUrl: 'https://demo.jd.test/jewelry/gold-bar-008', rowIndex: 8, sales30d: 61, positiveRate: 0.992, stock: 112, originalPrice: 12599, lowestPrice30d: 12380, campaignPrice: 12199, joinedBrandDay: false, certificateStatus: 'valid', raw: { material: 'Au9999', weight: '20g', priceLock: 'enabled' } },
  { platform: 'tmall', storeId: 'ctf-flagship', externalSkuId: 'gold-bangle-009', productName: '足金999古法素圈手镯 18.6g', category: '黄金饰品', brand: '周大福', sourceUrl: 'https://demo.tmall.test/jewelry/gold-bangle-009', rowIndex: 9, sales30d: 74, positiveRate: 0.981, stock: 31, originalPrice: 13999, lowestPrice30d: 13680, campaignPrice: 13299, joinedBrandDay: false, certificateStatus: 'valid', raw: { material: 'Au999', weight: '18.6g', craft: '古法' } },
  { platform: 'tmall', storeId: 'ctf-flagship', externalSkuId: 'gold-earring-010', productName: '足金小福牌耳钉 1.4g', category: '黄金饰品', brand: '周大福', sourceUrl: 'https://demo.tmall.test/jewelry/gold-earring-010', rowIndex: 10, sales30d: 238, positiveRate: 0.968, stock: 16, originalPrice: 1299, lowestPrice30d: 1199, campaignPrice: 1099, joinedBrandDay: false, certificateStatus: 'valid', raw: { material: 'Au999', weight: '1.4g', stockRisk: 'medium' } },
  { platform: 'tmall', storeId: 'ctf-flagship', externalSkuId: 'diamond-ring-011', productName: '18K金钻石戒指 0.30ct H色 SI', category: '钻石饰品', brand: '周大福', sourceUrl: 'https://demo.tmall.test/jewelry/diamond-ring-011', rowIndex: 11, sales30d: 64, positiveRate: 0.954, stock: 27, originalPrice: 8999, lowestPrice30d: 8299, campaignPrice: 7999, joinedBrandDay: false, certificateStatus: 'valid', raw: { diamond: '0.30ct', color: 'H', clarity: 'SI', certificate: 'GIA摘要' } },
  { platform: 'jd', storeId: 'jd-jewelry', externalSkuId: 'diamond-earring-012', productName: '钻石耳钉 0.10ct 一对', category: '钻石饰品', brand: '京东珠宝', sourceUrl: 'https://demo.jd.test/jewelry/diamond-earring-012', rowIndex: 12, sales30d: 119, positiveRate: 0.925, stock: 22, originalPrice: 2399, lowestPrice30d: 2199, campaignPrice: 2099, joinedBrandDay: false, certificateStatus: 'valid', raw: { diamond: '0.10ct pair', certificate: 'valid' } },
  { platform: 'jd', storeId: 'jd-jewelry', externalSkuId: 'diamond-pendant-013', productName: '18K白金钻石吊坠 0.25ct', category: '钻石饰品', brand: '京东珠宝', sourceUrl: 'https://demo.jd.test/jewelry/diamond-pendant-013', rowIndex: 13, sales30d: 33, positiveRate: 0.918, stock: 28, originalPrice: 6999, lowestPrice30d: 6699, campaignPrice: 6399, joinedBrandDay: false, certificateStatus: 'valid', raw: { diamond: '0.25ct', certificate: 'valid', reviewHint: 'positiveRate close to threshold' } },
  { platform: 'tmall', storeId: 'ctf-flagship', externalSkuId: 'ruby-ring-014', productName: '天然红宝石戒指 1.2ct', category: '彩宝饰品', brand: '周大福', sourceUrl: 'https://demo.tmall.test/jewelry/ruby-ring-014', rowIndex: 14, sales30d: 26, positiveRate: 0.936, stock: 14, originalPrice: 9800, lowestPrice30d: 9300, campaignPrice: 8999, joinedBrandDay: false, certificateStatus: 'valid', raw: { gem: 'ruby', carat: '1.2ct', origin: 'Mozambique' } },
  { platform: 'jd', storeId: 'jd-jewelry', externalSkuId: 'emerald-necklace-015', productName: '祖母绿镶钻项链 0.85ct', category: '彩宝饰品', brand: '京东珠宝', sourceUrl: 'https://demo.jd.test/jewelry/emerald-necklace-015', rowIndex: 15, sales30d: 18, positiveRate: 0.941, stock: 8, originalPrice: 15800, lowestPrice30d: 14999, campaignPrice: 14599, joinedBrandDay: false, certificateStatus: 'ambiguous', raw: { gem: 'emerald', certificate: '证书照片模糊待复核' } },
  { platform: 'jd', storeId: 'jd-jewelry', externalSkuId: 'tourmaline-bracelet-016', productName: '碧玺多宝手串 7mm', category: '彩宝饰品', brand: '京东珠宝', sourceUrl: 'https://demo.jd.test/jewelry/tourmaline-bracelet-016', rowIndex: 16, sales30d: 86, positiveRate: 0.957, stock: 46, originalPrice: 1899, lowestPrice30d: 1699, campaignPrice: 1599, joinedBrandDay: false, certificateStatus: 'valid', raw: { gem: 'tourmaline', diameter: '7mm' } },
  { platform: 'tmall', storeId: 'ctf-flagship', externalSkuId: 'jade-pendant-017', productName: '翡翠平安扣吊坠 18mm', category: '翡翠玉石', brand: '周大福', sourceUrl: 'https://demo.tmall.test/jewelry/jade-pendant-017', rowIndex: 17, sales30d: 57, positiveRate: 0.946, stock: 35, originalPrice: 3680, lowestPrice30d: 3380, campaignPrice: 3299, joinedBrandDay: false, certificateStatus: 'valid', raw: { jade: '翡翠A货', size: '18mm' } },
  { platform: 'jd', storeId: 'jd-jewelry', externalSkuId: 'jade-bead-018', productName: '和田玉青白玉手串 8mm', category: '翡翠玉石', brand: '京东珠宝', sourceUrl: 'https://demo.jd.test/jewelry/jade-bead-018', rowIndex: 18, sales30d: 41, positiveRate: 0.902, stock: 19, originalPrice: 2680, lowestPrice30d: 2499, campaignPrice: 2399, joinedBrandDay: false, certificateStatus: 'valid', raw: { jade: '和田玉', diameter: '8mm', reviewHint: 'stock and rating risk' } },
  { platform: 'tmall', storeId: 'ctf-flagship', externalSkuId: 'pearl-necklace-019', productName: 'Akoya 海水珍珠项链 7.5-8mm', category: '珍珠饰品', brand: '周大福', sourceUrl: 'https://demo.tmall.test/jewelry/pearl-necklace-019', rowIndex: 19, sales30d: 102, positiveRate: 0.972, stock: 52, originalPrice: 5999, lowestPrice30d: 5599, campaignPrice: 5299, joinedBrandDay: false, certificateStatus: 'valid', raw: { pearl: 'Akoya', diameter: '7.5-8mm', certificate: 'valid' } },
  { platform: 'jd', storeId: 'jd-jewelry', externalSkuId: 'pearl-bracelet-020', productName: '淡水珍珠手链 6-7mm', category: '珍珠饰品', brand: '京东珠宝', sourceUrl: 'https://demo.jd.test/jewelry/pearl-bracelet-020', rowIndex: 20, sales30d: 157, positiveRate: 0.949, stock: 11, originalPrice: 899, lowestPrice30d: 799, campaignPrice: 759, joinedBrandDay: false, certificateStatus: 'missing', raw: { pearl: 'freshwater', diameter: '6-7mm', certificate: 'missing' } },
  { platform: 'tmall', storeId: 'ctf-flagship', externalSkuId: 'platinum-ring-021', productName: 'Pt950铂金情侣对戒 单只', category: '铂金饰品', brand: '周大福', sourceUrl: 'https://demo.tmall.test/jewelry/platinum-ring-021', rowIndex: 21, sales30d: 89, positiveRate: 0.963, stock: 29, originalPrice: 2899, lowestPrice30d: 2699, campaignPrice: 2599, joinedBrandDay: false, certificateStatus: 'valid', raw: { material: 'Pt950', weight: '3.1g' } },
  { platform: 'jd', storeId: 'jd-jewelry', externalSkuId: 'k-gold-bracelet-022', productName: '18K玫瑰金手链 2.4g', category: 'K金饰品', brand: '京东珠宝', sourceUrl: 'https://demo.jd.test/jewelry/k-gold-bracelet-022', rowIndex: 22, sales30d: 126, positiveRate: 0.934, stock: 67, originalPrice: 1999, lowestPrice30d: 1799, campaignPrice: 1699, joinedBrandDay: false, certificateStatus: 'valid', raw: { material: '18K rose gold', weight: '2.4g' } },
  { platform: 'tmall', storeId: 'ctf-flagship', externalSkuId: 'k-gold-necklace-023', productName: '18K金小蛮腰项链', category: 'K金饰品', brand: '周大福', sourceUrl: 'https://demo.tmall.test/jewelry/k-gold-necklace-023', rowIndex: 23, sales30d: 211, positiveRate: 0.977, stock: 88, originalPrice: 2599, lowestPrice30d: 2399, campaignPrice: 2299, joinedBrandDay: false, certificateStatus: 'valid', raw: { material: '18K gold', style: '小蛮腰' } },
  { platform: 'jd', storeId: 'jd-jewelry', externalSkuId: 'gold-coin-024', productName: '生肖纪念金币 5g Au9999', category: '投资金', brand: '京东珠宝', sourceUrl: 'https://demo.jd.test/jewelry/gold-coin-024', rowIndex: 24, sales30d: 44, positiveRate: 0.986, stock: 40, originalPrice: 3299, lowestPrice30d: 3199, campaignPrice: 3099, joinedBrandDay: true, certificateStatus: 'valid', raw: { material: 'Au9999', weight: '5g', joinedBrandDay: true } },
]

const rulesJson = [
  { id: 'stock-min-20', type: 'threshold', field: 'stock', operator: 'gte', value: 20, severity: 'block', label: '库存不少于20件' },
  { id: 'positive-rate-min-092', type: 'threshold', field: 'positiveRate', operator: 'gte', value: 0.92, severity: 'block', label: '好评率不少于92%' },
  { id: 'certificate-required', type: 'data_required', field: 'certificateStatus', acceptedValues: ['valid'], severity: 'manual_review', label: '珠宝商品必须具备有效证书' },
  { id: 'campaign-price-not-higher', type: 'field_compare', leftField: 'campaignPrice', operator: 'lte', rightField: 'lowestPrice30d', severity: 'block', label: '活动价不得高于近30天最低价' },
  { id: 'brand-day-conflict', type: 'boolean_block', field: 'joinedBrandDay', blockedValue: true, severity: 'block', label: '互斥品牌日活动 SKU 不得报名' },
]

function databaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL
  const user = process.env.POSTGRES_USER
  const password = process.env.POSTGRES_PASSWORD
  const db = process.env.POSTGRES_DB || process.env.POSTGRES_DATABASE || 'pickagent'
  const host = process.env.POSTGRES_LOCAL_HOST || '127.0.0.1'
  const port = process.env.POSTGRES_LOCAL_PORT || '15432'
  if (!user || !password) throw new Error('DATABASE_URL or POSTGRES_USER/POSTGRES_PASSWORD is required')
  return `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${db}`
}

function assess(row) {
  const issues = []
  const actions = []
  if ((row.stock ?? 0) < 20) {
    issues.push({ code: 'LOW_STOCK', label: '库存低于活动门槛', severity: 'warning', evidenceRefs: ['stock'] })
    actions.push('补足活动可售库存至 20 件以上')
  }
  if ((row.positiveRate ?? 0) < 0.92) {
    issues.push({ code: 'LOW_POSITIVE_RATE', label: '好评率低于 92%', severity: 'blocker', evidenceRefs: ['positiveRate'] })
    actions.push('转人工复核售后与评价风险')
  }
  if (row.certificateStatus !== 'valid') {
    issues.push({ code: 'CERTIFICATE_NOT_VALID', label: '证书状态未通过', severity: row.certificateStatus === 'missing' ? 'warning' : 'blocker', evidenceRefs: ['certificateStatus'] })
    actions.push('补齐或复核珠宝证书信息')
  }
  if (row.joinedBrandDay) {
    issues.push({ code: 'BRAND_DAY_CONFLICT', label: '已参加互斥品牌日活动', severity: 'blocker', evidenceRefs: ['joinedBrandDay'] })
    actions.push('确认活动互斥关系后再报名')
  }
  const hasBlocker = issues.some((item) => item.severity === 'blocker')
  return {
    status: hasBlocker ? 'BLOCKED' : issues.length > 0 ? 'REPAIRABLE' : 'READY',
    healthScore: Math.max(0, 96 - issues.length * 18 - (hasBlocker ? 18 : 0)),
    dataQualityScore: row.certificateStatus === 'valid' ? 96 : row.certificateStatus === 'missing' ? 70 : 62,
    issues,
    actions: actions.length ? actions : ['可进入活动报名池'],
    evidence: [
      { type: 'snapshot', label: '库存', value: row.stock },
      { type: 'snapshot', label: '好评率', value: row.positiveRate },
      { type: 'snapshot', label: '证书状态', value: row.certificateStatus },
      { type: 'snapshot', label: '互斥活动', value: row.joinedBrandDay },
    ],
  }
}

const client = new Client({ connectionString: databaseUrl() })
await client.connect()
try {
  await client.query('begin')
  const connector = await client.query(
    `insert into connectors (code, name, kind, platform, config_json, status)
     values ($1, $2, $3, $4, $5::jsonb, 'active')
     on conflict (code) do update set name = excluded.name, kind = excluded.kind, platform = excluded.platform, config_json = excluded.config_json, updated_at = now()
     returning id`,
    [connectorCode, '天猫/京东珠宝演示采集', 'browser_extension', 'multi', JSON.stringify({ seed: true, source: 'businessFoundationSeedFixture' })],
  )
  const connectorId = connector.rows[0].id

  const skuProfileIds = []
  for (const row of rows) {
    const key = `${row.platform}:${row.storeId}:${row.externalSkuId}`
    const diagnosis = assess(row)
    const existingProfile = await client.query(
      `select id from sku_profiles where canonical_key = $1 or (platform = $2 and store_id = $3 and external_sku_id = $4) limit 1`,
      [key, row.platform, row.storeId, row.externalSkuId],
    )
    const profile = existingProfile.rowCount
      ? await client.query(
          `update sku_profiles set canonical_key = $1, product_name = $2, category = $3, brand = $4, updated_at = now() where id = $5 returning id`,
          [key, row.productName, row.category, row.brand, existingProfile.rows[0].id],
        )
      : await client.query(
          `insert into sku_profiles (canonical_key, platform, store_id, external_sku_id, product_name, category, brand)
           values ($1, $2, $3, $4, $5, $6, $7)
           returning id`,
          [key, row.platform, row.storeId, row.externalSkuId, row.productName, row.category, row.brand],
        )
    const skuProfileId = profile.rows[0].id
    skuProfileIds.push(skuProfileId)
    const snapshot = await client.query(
      `insert into sku_snapshots (sku_profile_id, connector_id, source_url, row_index, collected_at, product_name, category, sales30d, positive_rate, stock, original_price, lowest_price_30d, campaign_price, joined_brand_day, certificate_status, raw_json, normalized_json)
       values ($1, $2, $3, $4, $5::timestamptz, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16::jsonb, $17::jsonb)
       returning id`,
      [skuProfileId, connectorId, row.sourceUrl, row.rowIndex, collectedAt, row.productName, row.category, row.sales30d, row.positiveRate, row.stock, row.originalPrice, row.lowestPrice30d, row.campaignPrice, row.joinedBrandDay, row.certificateStatus, JSON.stringify(row.raw), JSON.stringify(row)],
    )
    const snapshotId = snapshot.rows[0].id
    const health = await client.query(
      `insert into sku_health_diagnoses (sku_profile_id, snapshot_id, health_status, health_score, data_quality_score, issues_json, next_actions_json, evidence_json)
       values ($1, $2, $3::health_status, $4, $5, $6::jsonb, $7::jsonb, $8::jsonb)
       returning id`,
      [skuProfileId, snapshotId, diagnosis.status, diagnosis.healthScore, diagnosis.dataQualityScore, JSON.stringify(diagnosis.issues), JSON.stringify(diagnosis.actions), JSON.stringify(diagnosis.evidence)],
    )
    await client.query(
      `insert into current_sku_projections (sku_profile_id, latest_snapshot_id, latest_diagnosis_id, health_status, health_score, data_quality_score, top_issues_json)
       values ($1, $2, $3, $4::health_status, $5, $6, $7::jsonb)
       on conflict (sku_profile_id) do update set latest_snapshot_id = excluded.latest_snapshot_id, latest_diagnosis_id = excluded.latest_diagnosis_id, health_status = excluded.health_status, health_score = excluded.health_score, data_quality_score = excluded.data_quality_score, top_issues_json = excluded.top_issues_json, updated_at = now()`,
      [skuProfileId, snapshotId, health.rows[0].id, diagnosis.status, diagnosis.healthScore, diagnosis.dataQualityScore, JSON.stringify(diagnosis.issues.slice(0, 3))],
    )
  }

  await client.query('delete from rule_set_versions where rule_set_id in (select id from activity_rule_sets where name = $1 and platform = $2)', [ruleName, 'tmall'])
  await client.query('delete from activities where current_rule_set_id in (select id from activity_rule_sets where name = $1 and platform = $2)', [ruleName, 'tmall'])
  await client.query('delete from activity_rule_sets where name = $1 and platform = $2', [ruleName, 'tmall'])
  const ruleSet = await client.query(
    `insert into activity_rule_sets (name, platform, source_text, rules_json, parse_model, parse_confidence, parse_status, parse_metadata_json, created_by)
     values ($1, $2, $3, $4::jsonb, 'deterministic-seed', 1.0, 'parsed', $5::jsonb, 'seed-script')
     returning id`,
    [ruleName, 'tmall', ruleText, JSON.stringify(rulesJson), JSON.stringify({ seed: true, skuProfileIds })],
  )
  const ruleSetId = ruleSet.rows[0].id
  await client.query(
    `insert into rule_set_versions (rule_set_id, version, status, source_text, rules_json, required_fields_json, confirmations_json, metadata_json, created_by)
     values ($1, 1, 'published', $2, $3::jsonb, $4::jsonb, $5::jsonb, $6::jsonb, 'seed-script')`,
    [ruleSetId, ruleText, JSON.stringify(rulesJson), JSON.stringify(['stock', 'positiveRate', 'certificateStatus', 'campaignPrice', 'lowestPrice30d', 'joinedBrandDay']), JSON.stringify(['certificateStatus=ambiguous', 'joinedBrandDay=true']), JSON.stringify({ seed: true })],
  )
  await client.query(
    `insert into activities (name, platform, status, current_rule_set_id, scope_json, starts_at, ends_at, summary_json, evidence_refs_json, created_by)
     values ('天猫618大促', 'tmall', 'active', $1, $2::jsonb, '2026-06-01T00:00:00+08:00', '2026-06-20T23:59:59+08:00', $3::jsonb, $4::jsonb, 'seed-script')`,
    [ruleSetId, JSON.stringify({ categories: ['黄金饰品', '钻石饰品', '彩宝饰品', '翡翠玉石', '铂金饰品', '珍珠饰品', '投资金'] }), JSON.stringify({ skuCount: rows.length, ruleCount: rulesJson.length }), JSON.stringify([{ type: 'rule_set', id: ruleSetId, label: ruleName }])],
  )
  await client.query('commit')
  console.log(`Seeded ${rows.length} SKU profiles and rule set ${ruleSetId}`)
} catch (error) {
  await client.query('rollback')
  throw error
} finally {
  await client.end()
}
