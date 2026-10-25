/* 现场经理工作平台 — 前端逻辑
 * 数据保存在浏览器 localStorage，无需后端；可导出/导入备份。
 */
(function () {
  'use strict';

  const FAULT_TYPES = ['机械故障', '电气故障', '液压/气动故障', '控制系统故障', '结构/磨损', '安全装置', '仪表/传感器', '其他'];
  const STATUSES = ['待处理', '处理中', '已解决'];
  const SEVERITIES = ['紧急', '重要', '一般'];

  const LS_PROJECTS = 'sm_projects_v1';
  const LS_RECORDS = 'sm_records_v1';

  /** @type {Array<{id:string,name:string,location:string}>} */
  let projects = [];
  /** @type {Array<Object>} */
  let records = [];
  let charts = {};

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const today = () => new Date().toISOString().slice(0, 10);

  /* ---------- 存储 ---------- */
  function load() {
    try { projects = JSON.parse(localStorage.getItem(LS_PROJECTS)) || []; } catch { projects = []; }
    try { records = JSON.parse(localStorage.getItem(LS_RECORDS)) || []; } catch { records = []; }
    if (!projects.length) {
      projects = [{ id: uid(), name: '示例项目', location: '默认' }];
      saveProjects();
    }
  }
  function saveProjects() { localStorage.setItem(LS_PROJECTS, JSON.stringify(projects)); }
  function saveRecords() { localStorage.setItem(LS_RECORDS, JSON.stringify(records)); }

  /* ---------- 通用 UI ---------- */
  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg; t.hidden = false;
    clearTimeout(t._t); t._t = setTimeout(() => (t.hidden = true), 1800);
  }
  function openModal(id) { $('#' + id).hidden = false; }
  function closeModal(id) { $('#' + id).hidden = true; }

  /* ---------- 项目 ---------- */
  function renderProjectSelect() {
    const sel = $('#projectSelect');
    sel.innerHTML = projects.map(p => `<option value="${p.id}">${esc(p.name)}</option>`).join('');
  }
  function activeProjectId() { return $('#projectSelect').value || (projects[0] && projects[0].id); }
  function projectName(id) { const p = projects.find(x => x.id === id); return p ? p.name : '—'; }

  function renderProjectList() {
    const ul = $('#projectList');
    ul.innerHTML = projects.map(p =>
      `<li><span class="p-meta"><b>${esc(p.name)}</b><span>${esc(p.location || '—')} · ${records.filter(r => r.projectId === p.id).length} 条记录</span></span>
       <button class="p-del" data-del="${p.id}" type="button">删除</button></li>`
    ).join('');
    $$('#projectList .p-del').forEach(b => b.addEventListener('click', () => {
      const id = b.dataset.del;
      if (records.some(r => r.projectId === id)) { alert('该项目下还有故障记录，请先删除记录或转移后再删除项目。'); return; }
      if (!confirm(`确认删除项目「${projectName(id)}」？`)) return;
      projects = projects.filter(p => p.id !== id); saveProjects();
      renderProjectSelect(); renderProjectList(); toast('项目已删除');
    }));
  }

  /* ---------- 录入 ---------- */
  function fillTypeSelect(sel) {
    sel.innerHTML = '<option value="">请选择</option>' + FAULT_TYPES.map(t => `<option>${t}</option>`).join('');
  }
  function handleFaultSubmit(e) {
    e.preventDefault();
    const pid = activeProjectId();
    if (!pid) { toast('请先创建项目'); return; }
    const el = id => $('#' + id).value;
    records.unshift({
      id: uid(),
      projectId: pid,
      device: el('f-device').trim(),
      code: el('f-code').trim(),
      type: el('f-type'),
      severity: el('f-severity'),
      status: el('f-status'),
      desc: el('f-desc').trim(),
      reporter: el('f-reporter').trim(),
      date: el('f-date') || today(),
      createdAt: Date.now()
    });
    saveRecords();
    e.target.reset();
    $('#f-date').value = today();
    $('#f-status').value = '待处理';
    $('#f-severity').value = '重要';
    toast('已保存记录');
    switchView('list');
  }

  /* ---------- 清单 ---------- */
  function renderList() {
    const pid = activeProjectId();
    const q = $('#searchInput').value.trim().toLowerCase();
    const ft = $('#filterType').value;
    const fs = $('#filterStatus').value;
    let rows = records.filter(r => r.projectId === pid);
    if (ft) rows = rows.filter(r => r.type === ft);
    if (fs) rows = rows.filter(r => r.status === fs);
    if (q) rows = rows.filter(r => (r.device + r.code + r.desc + r.reporter).toLowerCase().includes(q));

    const body = $('#recordTableBody');
    $('#listEmpty').hidden = rows.length > 0;
    body.innerHTML = rows.map(r => `
      <tr>
        <td class="dev">${esc(r.device)}<br><span class="muted">${esc(r.code || '')}</span></td>
        <td><span class="tag tag-type">${esc(r.type)}</span></td>
        <td><span class="tag sev-${r.severity}">${esc(r.severity)}</span></td>
        <td><span class="tag st-${r.status}">${esc(r.status)}</span></td>
        <td>${esc(r.date)}</td>
        <td><button class="row-btn" data-edit="${r.id}" type="button">编辑</button></td>
      </tr>`).join('');
    $$('#recordTableBody [data-edit]').forEach(b => b.addEventListener('click', () => openEdit(b.dataset.edit)));
  }

  function openEdit(id) {
    const r = records.find(x => x.id === id);
    if (!r) return;
    $('#e-id').value = r.id;
    $('#e-device').value = r.device;
    $('#e-code').value = r.code || '';
    $('#e-type').value = r.type;
    $('#e-severity').value = r.severity;
    $('#e-status').value = r.status;
    $('#e-date').value = r.date;
    $('#e-desc').value = r.desc;
    $('#e-reporter').value = r.reporter || '';
    openModal('editModal');
  }
  function handleEditSubmit(e) {
    e.preventDefault();
    const id = $('#e-id').value;
    const r = records.find(x => x.id === id);
    if (!r) return;
    Object.assign(r, {
      device: $('#e-device').value.trim(),
      code: $('#e-code').value.trim(),
      type: $('#e-type').value,
      severity: $('#e-severity').value,
      status: $('#e-status').value,
      date: $('#e-date').value || today(),
      desc: $('#e-desc').value.trim(),
      reporter: $('#e-reporter').value.trim()
    });
    saveRecords(); closeModal('editModal'); renderList(); renderStats();
    toast('已保存修改');
  }
  function handleDeleteRecord() {
    const id = $('#e-id').value;
    if (!confirm('确认删除这条记录？')) return;
    records = records.filter(x => x.id !== id);
    saveRecords(); closeModal('editModal'); renderList(); renderStats();
    toast('已删除');
  }

  /* ---------- 统计 ---------- */
  function renderStats() {
    const pid = activeProjectId();
    const rows = records.filter(r => r.projectId === pid);

    const total = rows.length;
    const todo = rows.filter(r => r.status === '待处理').length;
    const doing = rows.filter(r => r.status === '处理中').length;
    const done = rows.filter(r => r.status === '已解决').length;
    $('#statsSummary').innerHTML = `
      <div class="stat c-total"><div class="num">${total}</div><div class="lbl">故障总数</div></div>
      <div class="stat c-todo"><div class="num">${todo}</div><div class="lbl">待处理</div></div>
      <div class="stat c-doing"><div class="num">${doing}</div><div class="lbl">处理中</div></div>
      <div class="stat c-done"><div class="num">${done}</div><div class="lbl">已解决</div></div>`;

    drawDoughnut('chartType', '故障类型', countBy(rows, 'type'), FAULT_TYPES);
    drawBar('chartProject', '各项目故障数量', projects.map(p => p.name),
      projects.map(p => records.filter(r => r.projectId === p.id).length), 'rgba(13,148,136,.8)');
    drawDoughnut('chartStatus', '处理状态', countBy(rows, 'status'), STATUSES);
    drawDoughnut('chartSeverity', '严重程度', countBy(rows, 'severity'), SEVERITIES);
    drawBar('chartTop', '高频设备 TOP 10', topDevices(rows), topDevicesCount(rows), 'rgba(217,119,6,.8)');
  }

  function countBy(rows, key) {
    const base = key === 'type' ? FAULT_TYPES : key === 'status' ? STATUSES : SEVERITIES;
    const map = {}; base.forEach(b => (map[b] = 0));
    rows.forEach(r => { if (map[r[key]] !== undefined) map[r[key]]++; });
    return Object.values(map);
  }
  function topDevices(rows) {
    const map = {}; rows.forEach(r => { map[r.device] = (map[r.device] || 0) + 1; });
    return Object.keys(map).sort((a, b) => map[b] - map[a]).slice(0, 10);
  }
  function topDevicesCount(rows) { return topDevices(rows).map(d => rows.filter(r => r.device === d).length); }

  function destroyChart(id) { if (charts[id]) { charts[id].destroy(); delete charts[id]; } }
  function drawDoughnut(id, label, data, labels) {
    destroyChart(id);
    const ctx = $('#' + id).getContext('2d');
    charts[id] = new Chart(ctx, {
      type: 'doughnut',
      data: { labels, datasets: [{ data, backgroundColor: palette(labels.length), borderWidth: 2, borderColor: '#fff' }] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }
    });
  }
  function drawBar(id, label, labels, data, color) {
    destroyChart(id);
    const ctx = $('#' + id).getContext('2d');
    charts[id] = new Chart(ctx, {
      type: 'bar',
      data: { labels, datasets: [{ label, data, backgroundColor: color, borderRadius: 6 }] },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true, ticks: { precision: 0 } } }
      }
    });
  }
  function palette(n) {
    const c = ['#0d9488', '#2563eb', '#d97706', '#dc2626', '#16a34a', '#7c3aed', '#0891b2', '#db2777', '#65a30d', '#475569'];
    return Array.from({ length: n }, (_, i) => c[i % c.length]);
  }

  /* ---------- 数据管理 ---------- */
  function exportJSON() {
    const blob = new Blob([JSON.stringify({ projects, records }, null, 2)], { type: 'application/json' });
    download(blob, '现场设备数据_' + today() + '.json');
  }
  function exportCSV() {
    const head = ['项目', '设备', '编号/位置', '故障类型', '严重程度', '状态', '日期', '上报人', '描述'];
    const lines = records.map(r => [projectName(r.projectId), r.device, r.code, r.type, r.severity, r.status, r.date, r.reporter, r.desc]
      .map(v => '"' + String(v).replace(/"/g, '""') + '"').join(','));
    const csv = '﻿' + [head.join(','), ...lines].join('\n');
    download(new Blob([csv], { type: 'text/csv;charset=utf-8' }), '现场设备数据_' + today() + '.csv');
  }
  function download(blob, name) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  function importData(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const d = JSON.parse(reader.result);
        if (!Array.isArray(d.projects) || !Array.isArray(d.records)) throw new Error('格式错误');
        if (!confirm('导入将覆盖当前数据，确认继续？')) return;
        projects = d.projects; records = d.records;
        saveProjects(); saveRecords();
        renderProjectSelect(); renderList(); renderStats(); toast('导入成功');
      } catch (e) { alert('导入失败：' + e.message); }
    };
    reader.readAsText(file);
  }
  function loadSample() {
    if (records.length && !confirm('将追加示例数据到当前项目，确认？')) return;
    const pid = activeProjectId();
    const sample = [
      ['1#塔吊', 'TD-001', '机械故障', '重要', '待处理', '吊臂回转异响，疑似轴承磨损', '张工', 2],
      ['施工电梯', 'EL-02', '电气故障', '紧急', '处理中', '控制柜跳闸，需更换接触器', '李工', 1],
      ['混凝土泵车', 'PB-03', '液压/气动故障', '重要', '待处理', '臂架油缸渗油', '王工', 3],
      ['钢筋切断机', 'RC-05', '控制系统故障', '一般', '已解决', 'PLC 通讯中断已恢复', '赵工', 5],
      ['1#塔吊', 'TD-001', '结构/磨损', '重要', '处理中', '标准节螺栓松动', '张工', 4],
      ['雾炮机', 'WP-08', '仪表/传感器', '一般', '已解决', '水位传感器误报', '孙工', 6],
      ['施工电梯', 'EL-02', '安全装置', '紧急', '待处理', '防坠器检测超期', '李工', 1],
      ['电焊机', 'WX-12', '电气故障', '一般', '已解决', '电缆接头发热已处理', '周工', 7]
    ];
    const base = Date.now();
    sample.forEach((s, i) => records.unshift({
      id: uid(), projectId: pid, device: s[0], code: s[1], type: s[2], severity: s[3],
      status: s[4], desc: s[5], reporter: s[6], date: new Date(base - s[7] * 864e5).toISOString().slice(0, 10), createdAt: base - i
    }));
    saveRecords(); renderList(); renderStats(); toast('已载入示例数据');
  }
  function clearAll() {
    if (!confirm('将清空全部项目与故障记录，且无法恢复，确认？')) return;
    projects = []; records = [];
    saveProjects(); saveRecords();
    load(); renderProjectSelect(); renderProjectList(); renderList(); renderStats();
    toast('已清空');
  }

  /* ---------- 工具 ---------- */
  function esc(s) { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
  function switchView(v) {
    $$('.view').forEach(s => (s.hidden = s.id !== 'view-' + v));
    $$('.tab').forEach(t => t.classList.toggle('active', t.dataset.view === v));
    if (v === 'list') renderList();
    if (v === 'stats') renderStats();
  }

  /* ---------- 初始化 ---------- */
  function init() {
    load();
    fillTypeSelect($('#f-type'));
    fillTypeSelect($('#e-type'));
    $('#filterType').innerHTML = '<option value="">全部类型</option>' + FAULT_TYPES.map(t => `<option>${t}</option>`).join('');
    renderProjectSelect();

    $('#f-date').value = today();
    $('#faultForm').addEventListener('submit', handleFaultSubmit);
    $('#projectSelect').addEventListener('change', () => { renderList(); renderStats(); });

    // 底部导航
    $$('.tab').forEach(t => t.addEventListener('click', () => switchView(t.dataset.view)));

    // 清单筛选
    ['#searchInput', '#filterType', '#filterStatus'].forEach(s => $(s).addEventListener('input', renderList));

    // 弹窗开关
    $('#btnManageProjects').addEventListener('click', () => { renderProjectList(); openModal('projectModal'); });
    $('#btnDataMenu').addEventListener('click', () => openModal('dataModal'));
    $$('[data-close]').forEach(el => el.addEventListener('click', () => closeModal(el.dataset.close)));
    document.addEventListener('keydown', e => { if (e.key === 'Escape') $$('.modal').forEach(m => (m.hidden = true)); });

    // 项目表单
    $('#projectForm').addEventListener('submit', e => {
      e.preventDefault();
      projects.push({ id: uid(), name: $('#p-name').value.trim(), location: $('#p-location').value.trim() });
      saveProjects(); renderProjectSelect(); renderProjectList();
      e.target.reset(); toast('项目已添加');
    });

    // 编辑
    $('#editForm').addEventListener('submit', handleEditSubmit);
    $('#btnDeleteRecord').addEventListener('click', handleDeleteRecord);

    // 数据管理
    $('#btnExportJson').addEventListener('click', exportJSON);
    $('#btnExportCsv').addEventListener('click', exportCSV);
    $('#fileImport').addEventListener('change', e => { if (e.target.files[0]) importData(e.target.files[0]); });
    $('#toggleSample').addEventListener('change', e => { if (e.target.checked) { loadSample(); e.target.checked = false; } });
    $('#btnClearAll').addEventListener('click', clearAll);

    switchView('input');
  }

  document.addEventListener('DOMContentLoaded', init);
})();
