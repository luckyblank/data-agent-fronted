// 场景与字典来自相邻后端 conf/meta_config.yaml；此文件不代表实时数据库状态。
export const scenarios = [
  { id: 'sales', title: '销售趋势', icon: 'trend', category: '经营分析', description: '看清业务走势，发现增长变化', question: '统计去年每个月的销售总额和订单数量，按月份排序', tag: '按月追踪', color: 'teal' },
  { id: 'region', title: '区域对比', icon: 'region', category: '经营分析', description: '比较不同地区的业务表现', question: '统计去年各地区的销售总额，按销售额从高到低排序', tag: '多维对比', color: 'blue' },
  { id: 'product', title: '商品排行', icon: 'box', category: '商品分析', description: '找到畅销商品与核心品类', question: '查询去年销售额最高的 10 个商品，展示商品名称、品类和销售总额', tag: 'TOP 10', color: 'amber' },
  { id: 'customer', title: '客户分析', icon: 'users', category: '客户分析', description: '了解客户结构与消费偏好', question: '按会员等级统计去年的客户数量、订单数量和销售总额', tag: '客户分层', color: 'violet' },
  { id: 'overview', title: '经营概览', icon: 'chart', category: '经营分析', description: '快速了解整体经营情况', question: '统计去年的销售总额、订单数量、购买客户数和商品总销量', tag: '核心指标', color: 'teal' },
  { id: 'category', title: '品类表现', icon: 'layers', category: '商品分析', description: '对比品类销售额与商品销量', question: '按商品品类统计去年的销售总额和商品销量，按销售额降序排列', tag: '品类分析', color: 'amber' },
  { id: 'province', title: '省份销售', icon: 'region', category: '经营分析', description: '深入省份维度，发现区域机会', question: '查询去年销售额最高的 10 个省份及其所属大区', tag: '区域洞察', color: 'blue' },
  { id: 'brand', title: '品牌分析', icon: 'box', category: '商品分析', description: '比较不同品牌的销售贡献', question: '按品牌统计去年的销售总额和订单数量，按销售额降序排列', tag: '品牌对比', color: 'violet' },
]

export const dictionary = [
  { name: 'fact_order', label: '订单事实', type: '事实表', icon: 'table', description: '记录订单、客户、商品、时间、地区，以及购买数量和订单金额。', fields: [
    { name: 'order_id', label: '订单唯一标识', role: '主键' },
    { name: 'customer_id', label: '关联客户', role: '外键' },
    { name: 'product_id', label: '关联商品', role: '外键' },
    { name: 'date_id', label: '关联时间', role: '外键' },
    { name: 'region_id', label: '关联地区', role: '外键' },
    { name: 'order_quantity', label: '商品购买数量 / 销量 / 件数', role: '度量' },
    { name: 'order_amount', label: '订单金额 / 销售额 / 收入', role: '度量' },
  ] },
  { name: 'dim_region', label: '地区维度', type: '维度表', icon: 'region', description: '按国家、大区、省份分析订单发生的地理区域。', fields: [
    { name: 'region_id', label: '地区唯一标识', role: '主键' },
    { name: 'province', label: '省份', role: '维度' },
    { name: 'region_name', label: '地区 / 区域 / 大区', role: '维度' },
    { name: 'country', label: '国家', role: '维度' },
  ] },
  { name: 'dim_product', label: '商品维度', type: '维度表', icon: 'box', description: '通过商品名称、品类和品牌分析商品表现。', fields: [
    { name: 'product_id', label: '商品唯一标识', role: '主键' },
    { name: 'product_name', label: '商品名称 / 产品名称', role: '维度' },
    { name: 'category', label: '商品类别 / 品类 / 分类', role: '维度' },
    { name: 'brand', label: '品牌', role: '维度' },
  ] },
  { name: 'dim_customer', label: '客户维度', type: '维度表', icon: 'users', description: '基于客户名称、性别和会员等级了解客户结构。', fields: [
    { name: 'customer_id', label: '客户唯一标识', role: '主键' },
    { name: 'customer_name', label: '客户名称 / 用户名称', role: '维度' },
    { name: 'gender', label: '性别', role: '维度' },
    { name: 'member_level', label: '会员等级 / 用户等级', role: '维度' },
  ] },
  { name: 'dim_date', label: '时间维度', type: '维度表', icon: 'calendar', description: '支持按年、季度、月份和日期分析业务变化。', fields: [
    { name: 'date_id', label: '日期唯一标识（yyyyMMdd）', role: '主键' },
    { name: 'year', label: '年份', role: '维度' },
    { name: 'quarter', label: '季度', role: '维度' },
    { name: 'month', label: '月份', role: '维度' },
    { name: 'day', label: '日', role: '维度' },
  ] },
]

export const nodeDescriptions = {
  抽取关键字: '理解问题中的时间、维度与分析目标',
  召回字段: '匹配表结构、业务字段与别名',
  召回字段取值: '检索真实业务实体与筛选取值',
  召回指标: '匹配业务指标及其定义',
  合并召回信息: '整合字段、指标与取值的检索结果',
  过滤表格: '筛选当前问题需要的表与字段',
  过滤指标: '保留相关业务指标',
  添加额外上下文信息: '补充时间、表关联与数据库信息',
  生成SQL: '将业务问题转为数据库查询',
  验证SQL: '使用 EXPLAIN 检查语法与引用',
  校正SQL: '根据数据库错误修正查询',
  执行SQL: '读取数据并返回查询结果',
}
