// ===== LMK 实验室 - 申请管理后台（集成版） =====
(function () {
    'use strict';

    const STORAGE_KEY = 'lmk_applications';
    const LOGIN_KEY = 'lmk_admin_session';
    const ADMIN_USER = 'admin';
    const ADMIN_PASS = 'lmk2026';
    const GROUPS = ['前端组', '后台组', '多媒体组', '平面设计组', '3D建模组'];

    let currentFilter = 'all';
    let currentGroup = '';
    let searchKeyword = '';
    let allData = [];
    let lastDataStr = '';
    let autoRefresh = true;
    let unseenNewCount = 0;

    // ===== 初始化元素 =====
    const $ = id => document.getElementById(id);
    const frontApp = $('frontApp');
    const adminApp = $('adminApp');
    const loginScreen = $('loginScreen');
    const adminMain = $('adminMain');
    const loginForm = $('loginForm');
    const logoutBtn = $('logoutBtn');
    const refreshBtn = $('refreshBtn');
    const liveStatus = $('liveStatus');
    const liveStatusText = $('liveStatusText');
    const lastUpdate = $('lastUpdate');
    const lastUpdateText = $('lastUpdateText');
    const newBadge = $('newBadge');

    // ===== Hash 路由 =====
    function applyRoute() {
        const isAdmin = window.location.hash === '#admin';
        if (isAdmin) {
            frontApp.style.display = 'none';
            adminApp.style.display = 'block';
            checkLogin();
        } else {
            frontApp.style.display = 'block';
            adminApp.style.display = 'none';
        }
    }

    window.addEventListener('hashchange', applyRoute);

    $('backToFront').addEventListener('click', e => {
        e.preventDefault();
        history.replaceState(null, '', window.location.pathname);
        applyRoute();
    });
    $('backToFront2').addEventListener('click', e => {
        e.preventDefault();
        history.replaceState(null, '', window.location.pathname);
        applyRoute();
    });

    // ===== 登录 =====
    function checkLogin() {
        if (sessionStorage.getItem(LOGIN_KEY) === 'logged_in') {
            showAdminMain();
        } else {
            loginScreen.style.display = 'flex';
            adminMain.style.display = 'none';
        }
    }

    function showAdminMain() {
        loginScreen.style.display = 'none';
        adminMain.style.display = 'block';
        unseenNewCount = 0;
        updateNewBadge();
        refreshData();
        updateLastUpdate();
    }

    loginForm.addEventListener('submit', e => {
        e.preventDefault();
        const user = $('adminUser').value.trim() || 'admin';
        const pass = $('adminPass').value.trim();
        if (user === ADMIN_USER && pass === ADMIN_PASS) {
            sessionStorage.setItem(LOGIN_KEY, 'logged_in');
            showAdminMain();
        } else {
            const hint = document.querySelector('.login-hint');
            if (hint) {
                hint.textContent = '账号或密码错误，请重试';
                hint.style.color = '#ef4444';
                setTimeout(() => {
                    hint.textContent = '默认账号：admin / lmk2026';
                    hint.style.color = '';
                }, 2000);
            }
        }
    });

    logoutBtn.addEventListener('click', () => {
        if (confirm('确定要退出登录吗？')) {
            sessionStorage.removeItem(LOGIN_KEY);
            history.replaceState(null, '', window.location.pathname);
            applyRoute();
        }
    });

    // ===== 数据操作 =====
    function loadData() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            return raw ? JSON.parse(raw) : [];
        } catch { return []; }
    }

    function saveData(data) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    }

    function fmtTime(iso) {
        const d = new Date(iso);
        const p = n => String(n).padStart(2, '0');
        return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
    }

    function statusText(s) {
        return { pending: '待处理', processed: '已处理', rejected: '已拒绝' }[s] || '待处理';
    }

    function escape(s) {
        if (!s) return '';
        return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
    }

    function renderStats() {
        const today = new Date().toDateString();
        const todayCount = allData.filter(a => new Date(a.submitTime).toDateString() === today).length;
        const pending = allData.filter(a => a.status === 'pending').length;
        const processed = allData.filter(a => a.status === 'processed').length;
        $('statTotal').textContent = allData.length;
        $('statToday').textContent = todayCount;
        $('statPending').textContent = pending;
        $('statProcessed').textContent = processed;
    }

    function renderCounts() {
        $('countAll').textContent = allData.length;
        $('countPending').textContent = allData.filter(a => a.status === 'pending').length;
        $('countProcessed').textContent = allData.filter(a => a.status === 'processed').length;
        $('countRejected').textContent = allData.filter(a => a.status === 'rejected').length;
    }

    function renderDistribution() {
        const counts = GROUPS.map(g => allData.filter(a => a.direction === g).length);
        const max = Math.max(...counts, 1);
        $('distBars').innerHTML = GROUPS.map((g, i) => `
            <div class="dist-bar">
                <div class="dist-bar-label">${g}</div>
                <div class="dist-bar-track">
                    <div class="dist-bar-fill" style="width:${(counts[i]/max*100).toFixed(1)}%"></div>
                </div>
                <div class="dist-bar-num">${counts[i]}</div>
            </div>
        `).join('');
    }

    function renderGroupFilters() {
        $('groupFilters').innerHTML = GROUPS.map(g =>
            `<span class="side-tag${currentGroup===g?' active':''}" data-group="${g}">${g}</span>`
        ).join('');
        $('groupFilters').querySelectorAll('.side-tag').forEach(tag => {
            tag.onclick = () => {
                currentGroup = currentGroup === tag.dataset.group ? '' : tag.dataset.group;
                renderGroupFilters();
                renderTable();
            };
        });
    }

    function getFilteredData() {
        let list = allData;
        if (currentFilter !== 'all') list = list.filter(a => a.status === currentFilter);
        if (currentGroup) list = list.filter(a => a.direction === currentGroup);
        if (searchKeyword) {
            const kw = searchKeyword.toLowerCase();
            list = list.filter(a =>
                (a.name && a.name.toLowerCase().indexOf(kw) !== -1) ||
                (a.studentId && a.studentId.toLowerCase().indexOf(kw) !== -1) ||
                (a.major && a.major.toLowerCase().indexOf(kw) !== -1) ||
                (a.phone && a.phone.indexOf(kw) !== -1) ||
                (a.email && a.email.toLowerCase().indexOf(kw) !== -1)
            );
        }
        return list;
    }

    function renderTable(newIds) {
        const newIdSet = new Set(newIds || []);
        const list = getFilteredData();
        $('resultCount').textContent = `共 ${list.length} 条记录`;

        if (list.length === 0) {
            $('tableBody').innerHTML = '';
            $('emptyState').style.display = 'flex';
            $('dataTable').style.display = 'none';
            return;
        }
        $('emptyState').style.display = 'none';
        $('dataTable').style.display = 'table';

        $('tableBody').innerHTML = list.map(a => {
            const status = a.status || 'pending';
            return `
            <tr data-id="${a.id}" class="${newIdSet.has(a.id)?'new-row':''}">
                <td class="cell-name">${escape(a.name)}</td>
                <td class="cell-mono">${escape(a.studentId)}</td>
                <td>${escape(a.grade||'-')}</td>
                <td>${escape(a.major||'-')}</td>
                <td><span class="group-tag">${escape(a.direction||'-')}</span></td>
                <td class="cell-contact">
                    <div>${escape(a.phone||'-')}</div>
                    <div>${escape(a.email||'-')}</div>
                </td>
                <td class="cell-time">${fmtTime(a.submitTime)}</td>
                <td><span class="badge-status badge-${status}">${statusText(status)}</span></td>
                <td>
                    <div class="row-actions">
                        <button class="action-btn" data-act="view" title="查看">⊙</button>
                        <button class="action-btn" data-act="process" title="处理">✓</button>
                        <button class="action-btn danger" data-act="delete" title="删除">✕</button>
                    </div>
                </td>
            </tr>`;
        }).join('');

        $('tableBody').querySelectorAll('tr').forEach(tr => {
            const id = tr.dataset.id;
            tr.onclick = () => handleAction('view', id);
            tr.querySelectorAll('.action-btn').forEach(btn => {
                btn.onclick = e => { e.stopPropagation(); handleAction(btn.dataset.act, id); };
            });
        });
    }

    function handleAction(action, id) {
        try {
            const item = allData.find(a => a.id === id);
            if (!item) return;

            if (action === 'view') {
                showDetailPanel(item);
                const panel = $('detailPanel');
                if (panel && panel.scrollIntoView) {
                    panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            } else if (action === 'process') {
                item.status = item.status === 'processed' ? 'pending' : 'processed';
                saveData(allData);
                refreshData();
                if (currentDetailId === item.id) showDetailPanel(item);
                toast('success', '状态已更新', `${item.name} → ${statusText(item.status)}`);
            } else if (action === 'delete') {
                if (window.confirm(`确定要删除「${item.name}」的申请吗？`)) {
                    allData = allData.filter(a => a.id !== id);
                    saveData(allData);
                    hideDetailPanel();
                    refreshData();
                    toast('warning', '已删除', `${item.name} 的申请已删除`);
                }
            }
        } catch (err) {
            console.error('handleAction error:', err);
            alert('操作出错：' + err.message);
        }
    }

    // ===== 详情面板 =====
    let currentDetailId = null;

    function showDetailPanel(item) {
        try {
            currentDetailId = item.id;
            const status = item.status || 'pending';
            const empty = $('detailEmpty');
            const content = $('detailContent');
            if (empty) empty.hidden = true;
            if (content) {
                content.hidden = false;
                content.innerHTML = `
                    <div class="detail-panel-head">
                        <div class="detail-panel-title">
                            <span class="detail-name">${escape(item.name)}</span>
                            <span class="group-tag">${escape(item.direction||'-')}</span>
                            <span class="badge-status badge-${status}">${statusText(status)}</span>
                        </div>
                        <div class="detail-panel-time">提交于 ${fmtTime(item.submitTime)}</div>
                    </div>
                    <div class="detail-grid">
                        <div class="detail-field">
                            <div class="detail-field-label">学号</div>
                            <div class="detail-field-value mono">${escape(item.studentId||'-')}</div>
                        </div>
                        <div class="detail-field">
                            <div class="detail-field-label">年级</div>
                            <div class="detail-field-value">${escape(item.grade||'-')}</div>
                        </div>
                        <div class="detail-field">
                            <div class="detail-field-label">专业</div>
                            <div class="detail-field-value">${escape(item.major||'-')}</div>
                        </div>
                        <div class="detail-field">
                            <div class="detail-field-label">手机</div>
                            <div class="detail-field-value mono">${escape(item.phone||'-')}</div>
                        </div>
                        <div class="detail-field">
                            <div class="detail-field-label">邮箱</div>
                            <div class="detail-field-value mono">${escape(item.email||'-')}</div>
                        </div>
                    </div>
                    <div class="detail-section">
                        <div class="detail-section-title">技术基础与经历</div>
                        <div class="detail-text">${escape(item.experience||'（未填写）')}</div>
                    </div>
                    <div class="detail-section">
                        <div class="detail-section-title">加入动机</div>
                        <div class="detail-text">${escape(item.motivation||'（未填写）')}</div>
                    </div>
                    <div class="detail-panel-actions">
                        <button class="modal-btn" id="mBtnReject">${status==='rejected'?'取消拒绝':'拒绝'}</button>
                        <button class="modal-btn success" id="mBtnProcess">${status==='processed'?'取消标记':'标记已处理'}</button>
                        <button class="modal-btn danger" id="mBtnDelete">删除申请</button>
                    </div>
                `;

                const btnProcess = $('mBtnProcess');
                const btnReject = $('mBtnReject');
                const btnDelete = $('mBtnDelete');

                if (btnProcess) btnProcess.onclick = () => {
                    item.status = item.status==='processed'?'pending':'processed';
                    saveData(allData); refreshData();
                    showDetailPanel(item);
                    toast('success','状态已更新',`${item.name} → ${statusText(item.status)}`);
                };
                if (btnReject) btnReject.onclick = () => {
                    item.status = item.status==='rejected'?'pending':'rejected';
                    saveData(allData); refreshData();
                    showDetailPanel(item);
                    toast('warning','状态已更新',`${item.name} → ${statusText(item.status)}`);
                };
                if (btnDelete) btnDelete.onclick = () => {
                    if (window.confirm(`确定要删除「${item.name}」的申请吗？`)) {
                        allData = allData.filter(a => a.id !== item.id);
                        saveData(allData);
                        hideDetailPanel();
                        refreshData();
                        toast('warning','已删除',`${item.name} 的申请已删除`);
                    }
                };
            }
        } catch (err) {
            console.error('showDetailPanel error:', err);
        }
    }

    function hideDetailPanel() {
        currentDetailId = null;
        const empty = $('detailEmpty');
        const content = $('detailContent');
        if (empty) empty.hidden = false;
        if (content) content.hidden = true;
    }

    // ===== 侧边栏 =====
    document.querySelectorAll('.side-link').forEach(link => {
        link.onclick = e => {
            e.preventDefault();
            document.querySelectorAll('.side-link').forEach(l => l.classList.remove('active'));
            link.classList.add('active');
            currentFilter = link.dataset.filter;
            renderTable();
        };
    });

    $('searchInput').oninput = e => { searchKeyword = e.target.value.trim(); renderTable(); };

    // ===== 实时刷新 =====
    function updateLastUpdate() {
        const d = new Date();
        const p = n => String(n).padStart(2, '0');
        lastUpdateText.textContent = `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
        lastUpdate.classList.remove('flash');
        void lastUpdate.offsetWidth;
        lastUpdate.classList.add('flash');
    }

    function updateNewBadge() {
        if (!newBadge) return;
        if (unseenNewCount > 0) {
            newBadge.hidden = false;
            newBadge.querySelector('.new-badge-num').textContent = '+' + unseenNewCount;
        } else {
            newBadge.hidden = true;
        }
    }

    if (newBadge) newBadge.onclick = () => { unseenNewCount = 0; updateNewBadge(); };

    if (liveStatus) {
        liveStatus.onclick = () => {
            autoRefresh = !autoRefresh;
            if (autoRefresh) {
                liveStatus.classList.remove('paused');
                liveStatusText.textContent = '实时监听中';
                toast('success','已开启自动刷新','将实时接收新申请');
                refreshData();
            } else {
                liveStatus.classList.add('paused');
                liveStatusText.textContent = '已暂停';
                toast('warning','已暂停自动刷新','点击状态指示器可继续');
            }
        };
    }

    function refreshData(forceNew) {
        try {
            const prevIds = new Set(allData.map(a => a.id));
            allData = loadData();
            const newItems = forceNew ? allData.filter(a => !prevIds.has(a.id)) : [];
            renderStats();
            renderDistribution();
            renderGroupFilters();
            renderTable(newItems.map(a => a.id));
            renderCounts();
            updateLastUpdate();
            if (newItems.length > 0) {
                unseenNewCount += newItems.length;
                updateNewBadge();
                const latest = newItems[0];
                if (newItems.length === 1) {
                    toast('success','收到新申请',`${latest.name} · ${latest.direction}`);
                } else {
                    toast('success',`收到 ${newItems.length} 条新申请`,`最新：${latest.name} · ${latest.direction}`);
                }
            }
        } catch (err) {
            console.error('refreshData error:', err);
        }
    }

    refreshBtn.onclick = () => { refreshData(); toast('success','已刷新',`共 ${allData.length} 条申请`); };

    // ===== Toast =====
    function toast(type, title, desc) {
        try {
            const c = $('toastContainer');
            if (!c) return;
            const el = document.createElement('div');
            el.className = 'toast ' + type;
            const iconMap = { success: '✓', warning: '!', info: 'i' };
            el.innerHTML = `<div class="toast-icon">${iconMap[type] || 'i'}</div>
                <div class="toast-content"><div class="toast-title">${escape(title)}</div><div class="toast-desc">${escape(desc)}</div></div>`;
            c.appendChild(el);
            requestAnimationFrame(() => el.classList.add('show'));
            setTimeout(() => { el.classList.remove('show'); setTimeout(() => { if (el.parentNode) el.parentNode.removeChild(el); }, 300); }, 3500);
        } catch (err) {
            console.error('toast error:', err);
        }
    }

    // ===== 测试按钮 =====
    $('seedBtn').onclick = () => {
        if (!confirm('模拟实时提交 5 条前端组申请数据？\n\n每 1.5 秒提交一条，用于测试实时刷新效果。')) return;
        const names = ['陈思远','林晓彤','黄子轩','刘雨欣','周明轩'];
        const grades = ['大一','大二','大一','大三','大一'];
        const majors = ['软件工程','计算机科学与技术','网络工程','软件工程','数字媒体技术'];
        const motivations = [
            '对前端开发充满热情，希望系统学习React/Vue等框架',
            '热爱UI设计，希望将设计与前端技术结合',
            '高中做过个人博客，希望提升实战能力',
            '参与过学校网站维护，希望学习现代前端工程化',
            '零基础但学习能力强，对网页动效和交互设计很感兴趣'
        ];
        const experiences = [
            '掌握HTML5、CSS3、JavaScript ES6，做过2个个人项目',
            '熟悉PS、Figma，了解基础的HTML和CSS',
            '有HTML/CSS基础，正在自学JavaScript',
            '熟悉Vue框架，参与过校内项目开发',
            '刚入门，学过基础的HTML标签'
        ];
        let i = 0;
        $('seedBtn').disabled = true;
        $('seedBtn').style.opacity = '0.6';
        toast('info','开始模拟','每 1.5 秒提交一条，共 5 条');
        function submit() {
            if (i >= 5) {
                $('seedBtn').disabled = false;
                $('seedBtn').style.opacity = '';
                toast('success','模拟完成','5 条前端组申请已全部提交');
                return;
            }
            $('seedBtn').innerHTML = '<span>●</span> 提交中 ' + (i+1) + '/5';
            const data = {
                id: 'APP' + Date.now() + Math.floor(Math.random()*1000),
                name: names[i], studentId: '2026' + String(20240+i).padStart(5,'0'),
                grade: grades[i], major: majors[i],
                phone: '139' + String(12345678 + i*1111).slice(0,8),
                email: 'frontend_' + (i+1) + '@lit.edu.cn',
                direction: '前端组', experience: experiences[i], motivation: motivations[i],
                submitTime: new Date().toISOString(), status: 'pending'
            };
            const existing = loadData();
            existing.unshift(data);
            saveData(existing);
            i++;
            setTimeout(submit, 1500);
        }
        setTimeout(submit, 300);
    };

    // ===== 导出 =====
    function downloadBlob(blob, name) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = name;
        document.body.appendChild(a); a.click();
        document.body.removeChild(a); URL.revokeObjectURL(url);
    }

    function fmtDate() {
        const d = new Date();
        const p = n => String(n).padStart(2,'0');
        return `${d.getFullYear()}${p(d.getMonth()+1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}`;
    }

    $('exportJsonBtn').onclick = () => {
        if (!allData.length) { toast('warning','无数据','当前没有可导出的记录'); return; }
        downloadBlob(new Blob([JSON.stringify(allData,null,2)],{type:'application/json'}),`lmk_${fmtDate()}.json`);
        toast('success','导出成功',`共 ${allData.length} 条 (JSON)`);
    };

    $('exportCsvBtn').onclick = () => {
        if (!allData.length) { toast('warning','无数据','当前没有可导出的记录'); return; }
        const headers = ['姓名','学号','年级','专业','组别','手机','邮箱','经历','动机','时间','状态'];
        const rows = allData.map(a => [a.name,a.studentId,a.grade,a.major,a.direction,a.phone,a.email,a.experience,a.motivation,fmtTime(a.submitTime),statusText(a.status)]);
        const csv = [headers].concat(rows).map(r => r.map(c => `"${String(c||'').replace(/"/g,'""')}"`).join(',')).join('\n');
        downloadBlob(new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8'}),`lmk_${fmtDate()}.csv`);
        toast('success','导出成功',`共 ${allData.length} 条 (CSV)`);
    };

    $('clearAllBtn').onclick = () => {
        if (!allData.length) { toast('warning','无数据','当前没有可清空的记录'); return; }
        if (!confirm(`确定要清空全部 ${allData.length} 条申请记录吗？\n\n建议先导出备份！`)) return;
        if (!confirm('再次确认：真的要清空全部数据吗？')) return;
        localStorage.removeItem(STORAGE_KEY);
        allData = []; lastDataStr = '';
        refreshData();
        toast('warning','已清空','全部申请记录已删除');
    };

    // ===== 实时同步 =====
    window.addEventListener('storage', e => {
        if (e.key === STORAGE_KEY && autoRefresh) {
            lastDataStr = e.newValue || '';
            refreshData(true);
        }
    });

    setInterval(() => {
        if (adminApp.style.display !== 'none' && adminMain.style.display === 'block' && autoRefresh) {
            const cur = localStorage.getItem(STORAGE_KEY) || '';
            if (cur !== lastDataStr) {
                lastDataStr = cur;
                refreshData(true);
            }
        }
    }, 600);

    document.addEventListener('visibilitychange', () => {
        if (!document.hidden && adminApp.style.display !== 'none' && adminMain.style.display === 'block' && autoRefresh) {
            const cur = localStorage.getItem(STORAGE_KEY) || '';
            if (cur !== lastDataStr) { lastDataStr = cur; refreshData(true); }
        }
    });

    // ===== 启动 =====
    applyRoute();
})();