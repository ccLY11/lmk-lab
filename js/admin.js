// ===== LMK 实验室 - 申请管理后台（Supabase 云数据库版） =====
(function () {
    'use strict';

    // ===== 配置 =====
    const SUPABASE_URL = "https://idkfeltsswxdlbkduhcs.supabase.co";
    const SUPABASE_KEY = "sb_publishable_fFsZPc15qmDMK8PrQHLYAg_TY4Xrawq";

    const STORAGE_KEY = 'lmk_applications';
    const LOGIN_KEY = 'lmk_admin_session';
    const ADMIN_USER = 'admin';
    const ADMIN_PASS = 'lmk2026';
    const GROUPS = ['前端组', '后台组', '多媒体组', '平面设计组', '3D建模组'];

    let currentFilter = 'all';
    let currentGroup = '';
    let searchKeyword = '';
    let allData = [];
    let autoRefresh = true;
    let unseenNewCount = 0;
    let realtimeChannel = null;
    let offlineMode = false; // 离线回退模式（仅读 localStorage）
    let dbMigrated = false;

    // ===== DOM 工具（必须在模块之前定义） =====
    const $ = id => document.getElementById(id);

    // ===== 短信通知模块 =====
    const SMS_CFG_KEY = 'lmk_sms_config_v1';
    const DEFAULT_SMS_CONFIG = {
        enabled: false,
        method: 'POST_FORM',       // POST / POST_FORM / GET
        url: '',                   // https://api.example.com/sms/send
        phoneKey: 'mobile',        // 手机号字段名
        contentKey: 'content',     // 内容字段名
        headers: '',               // JSON: {"Authorization":"Bearer xxx"}
        extraBody: '',             // JSON: {"appKey":"xxx","templateId":"SMS_123456"}
        proxy: '',                 // CORS 代理前缀，如 https://cors-anywhere.herokuapp.com/
        tplApproved: '【LMK实验室】{name}同学，恭喜你通过{group}组初审，请于本周六下午2点（{date}）准时到信息工程学院302会议室参加面试。如有问题请直接回复本号码联系我们。',
        tplRejected: '【LMK实验室】{name}同学，感谢你申请{group}组。由于本届申请人数较多，我们综合评估后暂无法接纳你加入本期实验室。请不要灰心，实验室每年春季都会开放补录，欢迎你届时再次申请，也祝你在技术道路上不断进步！',
        preview: true              // 发送前预览确认
    };

    // 阿里云预设配置（需要中转接口，浏览器无法直接调用阿里云API）
    const ALIYUN_PRESET = {
        method: 'POST',
        url: 'https://你的中转接口地址/api/sms',
        phoneKey: 'phone',
        contentKey: 'content',
        headers: '{"Content-Type":"application/json"}',
        extraBody: '{"accessKeyId":"你的AccessKeyId","accessKeySecret":"你的AccessKeySecret","signName":"LMK实验室","templateCode":"SMS_XXXXXX"}',
        proxy: ''
    };

    let smsConfig = loadSmsConfig();
    let pendingSms = null;        // { item, status, content, phone }

    function loadSmsConfig() {
        try {
            const raw = localStorage.getItem(SMS_CFG_KEY);
            if (raw) return Object.assign({}, DEFAULT_SMS_CONFIG, JSON.parse(raw));
        } catch {}
        return Object.assign({}, DEFAULT_SMS_CONFIG);
    }
    function saveSmsConfig(cfg) {
        smsConfig = cfg;
        try { localStorage.setItem(SMS_CFG_KEY, JSON.stringify(cfg)); } catch {}
        updateSmsStatusBadge();
    }
    function updateSmsStatusBadge() {
        const el = $('smsStatusBadge');
        if (!el) return;
        el.classList.remove('sms-on', 'sms-off', 'sms-warn');
        if (!smsConfig.enabled) {
            el.classList.add('sms-off');
            el.textContent = '未启用';
        } else if (!smsConfig.url || !smsConfig.phoneKey || !smsConfig.contentKey) {
            el.classList.add('sms-warn');
            el.textContent = '配置不完整';
        } else {
            el.classList.add('sms-on');
            el.textContent = '已启用';
        }
    }
    function tryParseJson(s) {
        if (!s) return null;
        if (typeof s !== 'string') return s;
        const t = s.trim();
        if (!t) return null;
        try { return JSON.parse(t); } catch (e) { return 'PARSE_ERROR:' + e.message; }
    }
    function isValidPhone(phone) {
        return /^1[3-9]\d{9}$/.test(String(phone || '').trim());
    }
    function renderTemplate(tpl, item) {
        const d = new Date();
        const p = n => String(n).padStart(2, '0');
        const today = `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}`;
        return String(tpl || '')
            .replace(/\{name\}/g, item.name || '同学')
            .replace(/\{group\}/g, item.direction || '实验室')
            .replace(/\{date\}/g, today);
    }
    async function sendSmsApi(phone, content) {
        if (!smsConfig.enabled) return { ok: true, simulated: true, msg: '未启用API，模拟发送完成' };
        if (!smsConfig.url) return { ok: false, msg: '未配置短信 API 地址' };
        if (!smsConfig.phoneKey || !smsConfig.contentKey) return { ok: false, msg: '手机号/内容字段名未配置' };

        const headersObj = tryParseJson(smsConfig.headers);
        if (typeof headersObj === 'string' && headersObj.startsWith('PARSE_ERROR:')) {
            return { ok: false, msg: '请求头 JSON 错误：' + headersObj };
        }
        const extraObj = tryParseJson(smsConfig.extraBody);
        if (typeof extraObj === 'string' && extraObj.startsWith('PARSE_ERROR:')) {
            return { ok: false, msg: '额外 Body JSON 错误：' + extraObj };
        }

        let url = smsConfig.url;
        let init = { method: smsConfig.method === 'GET' ? 'GET' : 'POST' };
        init.headers = Object.assign({}, headersObj || {});

        // CORS 代理：如果配置了代理，将代理前缀拼接到 URL 前
        const proxy = (smsConfig.proxy || '').trim();
        if (proxy) {
            url = proxy + encodeURIComponent(url);
        }

        const data = Object.assign({}, extraObj || {});
        data[smsConfig.phoneKey] = phone;
        data[smsConfig.contentKey] = content;

        try {
            if (smsConfig.method === 'GET') {
                const qs = new URLSearchParams();
                Object.keys(data).forEach(k => qs.append(k, data[k]));
                url += (url.indexOf('?') >= 0 ? '&' : '?') + qs.toString();
            } else if (smsConfig.method === 'POST_FORM') {
                const fd = new URLSearchParams();
                Object.keys(data).forEach(k => fd.append(k, data[k]));
                init.body = fd.toString();
                if (!init.headers['Content-Type']) init.headers['Content-Type'] = 'application/x-www-form-urlencoded;charset=UTF-8';
            } else {
                init.body = JSON.stringify(data);
                if (!init.headers['Content-Type']) init.headers['Content-Type'] = 'application/json';
            }
            const res = await safeFetch(url, init, 12000);
            let body = '';
            try { body = await res.text(); } catch {}
            if (!res.ok) return { ok: false, msg: 'HTTP ' + res.status + '，响应：' + body.slice(0, 180) };
            return { ok: true, msg: 'API 返回 HTTP 2xx', raw: body.slice(0, 200) };
        } catch (e) {
            return { ok: false, msg: '请求失败：' + (e.message || String(e)) };
        }
    }
    async function performSmsIfNeeded(item, nextStatus) {
        // 只有 processed=同意 / rejected=拒绝 真正触发
        if (nextStatus !== 'processed' && nextStatus !== 'rejected') return { ok: true, skipped: true };
        if (!item.phone) return { ok: false, skipped: true, msg: '申请人未填写手机号，已跳过短信' };

        const tpl = nextStatus === 'processed' ? smsConfig.tplApproved : smsConfig.tplRejected;
        const content = renderTemplate(tpl, item);
        const phone = String(item.phone).trim();

        const trigger = () => sendSmsApi(phone, content);

        if (!smsConfig.preview || !smsConfig.enabled) {
            // 不预览：直接走
            const r = await trigger();
            return { ok: r.ok, simulated: r.simulated, msg: r.msg };
        }
        // 进入预览模态
        return new Promise(resolve => {
            pendingSms = { item, status: nextStatus, content, phone, resolve };
            showSmsPreview(item, nextStatus, phone, content);
        });
    }
    function showSmsPreview(item, status, phone, content) {
        try {
            const modal = $('smsPreviewModal');
            if (!modal) { console.error('[SMS] smsPreviewModal 未找到'); return; }
            const pvPhone = $('pvPhone'); if (pvPhone) pvPhone.textContent = phone;
            const pvName = $('pvName'); if (pvName) pvName.textContent = item?.name || '-';
            const pvGroup = $('pvGroup'); if (pvGroup) pvGroup.textContent = item?.direction || '-';
            const actBadge = $('pvAction');
            if (actBadge) {
                if (status === 'processed') { actBadge.textContent = '同意申请（面试通知）'; actBadge.style.color = 'var(--success)'; }
                else { actBadge.textContent = '婉拒申请'; actBadge.style.color = 'var(--warning)'; }
            }
            const pvContent = $('pvContent'); if (pvContent) pvContent.textContent = content;
            const note = $('pvNote');
            if (note) {
                if (!smsConfig.enabled) {
                    note.textContent = '⚠ 当前短信通知未启用。点击「确认发送」仅会在本地模拟，不会真正调 API。启用请到「⚙ 短信通知设置」。';
                    note.style.color = 'var(--warning)';
                } else if (!isValidPhone(phone)) {
                    note.textContent = '⚠ 该手机号 ' + phone + ' 不符合中国大陆 11 位格式，可能无法送达。';
                    note.style.color = 'var(--danger)';
                } else {
                    note.textContent = '✅ 手机号格式校验通过，点击「确认发送」后将调用你配置的短信 API。';
                    note.style.color = 'var(--success)';
                }
            }
            modal.hidden = false;
        } catch (e) {
            console.error('[SMS] showSmsPreview 出错:', e);
        }
    }
    function closeSmsPreview() {
        const m = $('smsPreviewModal'); if (m) m.hidden = true;
        if (pendingSms) { pendingSms.resolve({ ok: false, cancelled: true }); pendingSms = null; }
    }
    async function confirmSmsSend() {
        if (!pendingSms) { closeSmsPreview(); return; }
        const ctx = pendingSms; pendingSms = null;
        const m = $('smsPreviewModal'); if (m) m.hidden = true;
        // 执行实际发送
        const r = await sendSmsApi(ctx.phone, ctx.content);
        ctx.resolve({ ok: r.ok, simulated: r.simulated, msg: r.msg });
    }

    // 设置弹窗交互
    function openSmsSettings() {
        try {
            const m = $('smsModal'); if (!m) { console.error('[SMS] smsModal 未找到'); return; }
            const set = (id, val) => { const el = $(id); if (el) el.value = val ?? ''; };
            const setChecked = (id, val) => { const el = $(id); if (el) el.checked = !!val; };
            setChecked('smsEnabled', smsConfig.enabled);
            set('smsMethod', smsConfig.method || 'POST_FORM');
            set('smsUrl', smsConfig.url || '');
            set('smsPhoneKey', smsConfig.phoneKey || '');
            set('smsContentKey', smsConfig.contentKey || '');
            set('smsHeaders', smsConfig.headers || '');
            set('smsExtraBody', smsConfig.extraBody || '');
            set('smsProxy', smsConfig.proxy || '');
            set('smsTplApproved', smsConfig.tplApproved || '');
            set('smsTplRejected', smsConfig.tplRejected || '');
            setChecked('smsPreview', !!smsConfig.preview);
            m.hidden = false;
        } catch (e) { console.error('[SMS] openSmsSettings 出错:', e); }
    }
    function closeSmsSettings() { const m = $('smsModal'); if (m) m.hidden = true; }
    function readFormIntoCfg() {
        return {
            enabled: !!$('smsEnabled').checked,
            method: $('smsMethod').value || 'POST_FORM',
            url: $('smsUrl').value.trim(),
            phoneKey: $('smsPhoneKey').value.trim(),
            contentKey: $('smsContentKey').value.trim(),
            headers: $('smsHeaders').value.trim(),
            extraBody: $('smsExtraBody').value.trim(),
            proxy: $('smsProxy').value.trim(),
            tplApproved: $('smsTplApproved').value,
            tplRejected: $('smsTplRejected').value,
            preview: !!$('smsPreview').checked
        };
    }

    // 阿里云一键配置
    function applyAliyunPreset() {
        try {
            const set = (id, val) => { const el = $(id); if (el) el.value = val ?? ''; };
            set('smsMethod', ALIYUN_PRESET.method);
            set('smsUrl', ALIYUN_PRESET.url);
            set('smsPhoneKey', ALIYUN_PRESET.phoneKey);
            set('smsContentKey', ALIYUN_PRESET.contentKey);
            set('smsHeaders', ALIYUN_PRESET.headers);
            set('smsExtraBody', ALIYUN_PRESET.extraBody);
            set('smsProxy', ALIYUN_PRESET.proxy);
            toast('warning', '阿里云配置已填入', '阿里云API无法直接浏览器调用，需部署中转接口（见文档），请替换URL和凭证后保存');
        } catch (e) { console.error('[SMS] applyAliyunPreset 出错:', e); }
    }

    function initSmsUiOnce() {
        try {
            updateSmsStatusBadge();
            const setBtn = $('smsSettingsBtn'); if (setBtn) setBtn.onclick = openSmsSettings;
            const c1 = $('smsModalClose'), c2 = $('smsModal');
            if (c1) c1.onclick = closeSmsSettings;
            if (c2) c2.onclick = e => { if (e.target.id === 'smsModal') closeSmsSettings(); };
            const saveBtn = $('smsSave');
            if (saveBtn) saveBtn.onclick = () => {
                try {
                    const cfg = readFormIntoCfg();
                    const heads = tryParseJson(cfg.headers);
                    if (cfg.headers && typeof heads === 'string' && heads.startsWith('PARSE_ERROR:')) { alert('请求头 JSON 解析失败：' + heads); return; }
                    const extra = tryParseJson(cfg.extraBody);
                    if (cfg.extraBody && typeof extra === 'string' && extra.startsWith('PARSE_ERROR:')) { alert('额外 Body JSON 解析失败：' + extra); return; }
                    saveSmsConfig(cfg);
                    closeSmsSettings();
                    toast('success', '短信设置已保存', cfg.enabled ? '同意/拒绝申请时将按配置发送短信' : '已关闭短信，同意/拒绝时仅本地预览');
                } catch (e) { console.error('[SMS] 保存设置出错:', e); alert('保存出错：' + e.message); }
            };
            const rst = $('smsReset');
            if (rst) rst.onclick = () => {
                if (!customConfirm('恢复默认短信模板和配置？\n（保留当前启用开关、API地址和代理）')) return;
                const kept = { enabled: smsConfig.enabled, url: smsConfig.url, phoneKey: smsConfig.phoneKey, contentKey: smsConfig.contentKey, proxy: smsConfig.proxy };
                const def = Object.assign({}, DEFAULT_SMS_CONFIG, kept);
                saveSmsConfig(def);
                openSmsSettings();
                toast('info', '已恢复默认', '模板已重置，记得点「保存设置」喔');
            };
            const aliyunBtn = $('smsAliyunPreset');
            if (aliyunBtn) aliyunBtn.onclick = applyAliyunPreset;
            const pvClose = $('smsPreviewClose'), pvCancel = $('pvCancel'), pvBg = $('smsPreviewModal');
            if (pvClose) pvClose.onclick = closeSmsPreview;
            if (pvCancel) pvCancel.onclick = closeSmsPreview;
            if (pvBg) pvBg.onclick = e => { if (e.target.id === 'smsPreviewModal') closeSmsPreview(); };
            const pvOk = $('pvConfirm');
            if (pvOk) pvOk.onclick = confirmSmsSend;

            const testBtn = $('smsTestBtn');
            if (testBtn) testBtn.onclick = async () => {
                try {
                    const phone = await customPrompt('发送测试短信', '请输入要接收测试短信的手机号（11位）：', '例如：13800138000');
                    if (!phone) return;
                    if (!isValidPhone(phone)) { toast('warning', '手机号格式错误', '请输入 11 位中国大陆手机号'); return; }
                    const mockItem = { name: '测试同学', direction: '前端组' };
                    const content = renderTemplate(smsConfig.tplApproved, mockItem);
                    toast('info', '正在发送测试短信', '目标号码：' + phone);
                    const r = await sendSmsApi(phone, content);
                    if (r.ok) toast(r.simulated ? 'warning' : 'success', r.simulated ? '模拟发送成功（未启用API）' : '测试短信已发出', r.msg || '');
                    else toast('error', '测试短信发送失败', r.msg || '');
                } catch (e) { console.error('[SMS] 测试发送出错:', e); toast('error', '测试出错', e.message); }
            };
        } catch (e) {
            console.error('[SMS] initSmsUiOnce 出错:', e);
        }
    }

    // ===== 自定义 prompt 替代（兼容不支持原生 prompt 的浏览器环境） =====
    function customPrompt(title, label, placeholder) {
        return new Promise(resolve => {
            const modal = $('promptModal');
            if (!modal) { resolve(null); return; }
            $('promptTitle').textContent = title || '提示';
            $('promptLabel').textContent = label || '';
            const input = $('promptInput');
            input.value = '';
            input.placeholder = placeholder || '';
            input.focus();

            const cleanup = () => {
                modal.hidden = true;
                $('promptOk').onclick = null;
                $('promptCancel').onclick = null;
                $('promptClose').onclick = null;
                input.onkeydown = null;
                modal.onclick = null;
            };
            const ok = () => { const v = input.value.trim(); cleanup(); resolve(v || null); };
            const cancel = () => { cleanup(); resolve(null); };

            $('promptOk').onclick = ok;
            $('promptCancel').onclick = cancel;
            $('promptClose').onclick = cancel;
            input.onkeydown = e => { if (e.key === 'Enter') ok(); if (e.key === 'Escape') cancel(); };
            modal.onclick = e => { if (e.target.id === 'promptModal') cancel(); };
            modal.hidden = false;
        });
    }

    // ===== 自定义 confirm 替代 =====
    function customConfirm(msg) {
        return new Promise(resolve => {
            const ok = window.confirm ? window.confirm(msg) : true;
            resolve(ok);
        });
    }

    // ===== 初始化元素 =====
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

    // ===== 网络请求工具（带超时 & 凭证） =====
    function restUrl(path) {
        return SUPABASE_URL + '/rest/v1' + path;
    }
    function restHeaders(extra) {
        const h = {
            'apikey': SUPABASE_KEY,
            'Authorization': 'Bearer ' + SUPABASE_KEY,
            'Content-Type': 'application/json',
            'Prefer': 'return=minimal'
        };
        if (extra) Object.assign(h, extra);
        return h;
    }
    async function safeFetch(url, opts, timeoutMs) {
        const ctrl = new AbortController();
        const tid = setTimeout(() => ctrl.abort(), timeoutMs || 10000);
        try {
            const res = await fetch(url, Object.assign({ signal: ctrl.signal }, opts || {}));
            return res;
        } finally {
            clearTimeout(tid);
        }
    }

    // ===== Hash 路由 =====
    function applyRoute() {
        const isAdmin = window.location.hash === '#admin';
        const sideNav = $('sideNavBar');
        if (isAdmin) {
            frontApp.style.display = 'none';
            adminApp.style.display = 'block';
            if (sideNav) sideNav.style.display = 'none';
            document.body.style.background = '#f5f6f8';
            document.body.style.margin = '0';
            checkLogin();
        } else {
            frontApp.style.display = 'block';
            adminApp.style.display = 'none';
            if (sideNav) sideNav.style.display = 'flex';
            document.body.style.background = '';
            stopRealtime();
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
        initSmsUiOnce();
        refreshData();
        updateLastUpdate();
        startRealtime();
        if (!dbMigrated) migrateLocalToCloud().then(() => { dbMigrated = true; }).catch(() => {});
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
            stopRealtime();
            history.replaceState(null, '', window.location.pathname);
            applyRoute();
        }
    });

    // ===== 数据层：数据库 ↔ 本地格式转换 =====
    function rowToItem(row) {
        return {
            id: row.id,
            name: row.name || '',
            studentId: row.student_id || '',
            grade: row.grade || '',
            major: row.major || '',
            phone: row.phone || '',
            email: row.email || '',
            direction: row.direction || '',
            experience: row.experience || '',
            motivation: row.motivation || '',
            submitTime: row.submit_time || (row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString()),
            status: row.status || 'pending'
        };
    }

    // ===== 读取：云数据库优先，失败回退本地 =====
    async function loadFromCloud() {
        const res = await safeFetch(
            restUrl('/applications?select=*&order=submit_time.desc'),
            { method: 'GET', headers: restHeaders({ 'Prefer': 'return=representation' }) },
            8000
        );
        if (!res.ok) {
            throw new Error('云查询失败: HTTP ' + res.status);
        }
        const rows = await res.json();
        return rows.map(rowToItem);
    }
    function loadFromLocal() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            return raw ? JSON.parse(raw) : [];
        } catch { return []; }
    }

    // ===== 写入：云端更新 + 本地同步 =====
    async function updateStatusInCloud(id, status) {
        const res = await safeFetch(
            restUrl('/applications?id=eq.' + encodeURIComponent(id)),
            {
                method: 'PATCH',
                headers: restHeaders({ 'Prefer': 'return=minimal' }),
                body: JSON.stringify({ status: status })
            },
            8000
        );
        if (!res.ok) throw new Error('更新失败: HTTP ' + res.status);
    }
    async function deleteInCloud(id) {
        const res = await safeFetch(
            restUrl('/applications?id=eq.' + encodeURIComponent(id)),
            { method: 'DELETE', headers: restHeaders({ 'Prefer': 'return=minimal' }) },
            8000
        );
        if (!res.ok) throw new Error('删除失败: HTTP ' + res.status);
    }
    async function insertInCloud(item) {
        const payload = {
            id: item.id,
            name: item.name,
            student_id: item.studentId,
            grade: item.grade,
            major: item.major,
            phone: item.phone,
            email: item.email,
            direction: item.direction,
            experience: item.experience,
            motivation: item.motivation,
            submit_time: item.submitTime,
            status: item.status || 'pending'
        };
        const res = await safeFetch(
            restUrl('/applications'),
            {
                method: 'POST',
                headers: restHeaders({ 'Prefer': 'return=minimal' }),
                body: JSON.stringify(payload)
            },
            8000
        );
        if (!res.ok) {
            // 409 = 重复插入（ID 已存在），忽略；其它抛错
            if (res.status !== 409) throw new Error('插入失败: HTTP ' + res.status);
        }
    }

    // ===== 本地旧数据迁移（只迁移一次） =====
    async function migrateLocalToCloud() {
        const local = loadFromLocal();
        if (!local.length) return;
        try {
            // 先查云端是否有数据，避免重复
            const cloud = await loadFromCloud();
            const cloudIds = new Set(cloud.map(a => a.id));
            const missing = local.filter(a => !cloudIds.has(a.id));
            if (!missing.length) return;
            for (const it of missing) {
                try { await insertInCloud(it); } catch (e) { console.warn('迁移单条失败:', it.id, e); }
            }
            if (missing.length) toast('info','本地数据已同步',`${missing.length} 条本地记录已上传到云端`);
        } catch (e) {
            console.warn('迁移本地数据失败（可稍后重试）:', e);
        }
    }

    // ===== 格式化 =====
    function fmtTime(iso) {
        if (!iso) return '-';
        const d = new Date(iso);
        if (isNaN(d.getTime())) return String(iso).slice(0, 16);
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

    // ===== 渲染 =====
    function renderStats() {
        const today = new Date().toDateString();
        const todayCount = allData.filter(a => {
            try { return new Date(a.submitTime).toDateString() === today; } catch { return false; }
        }).length;
        const pending = allData.filter(a => a.status === 'pending').length;
        const processed = allData.filter(a => a.status === 'processed').length;
        if ($('statTotal')) $('statTotal').textContent = allData.length;
        if ($('statToday')) $('statToday').textContent = todayCount;
        if ($('statPending')) $('statPending').textContent = pending;
        if ($('statProcessed')) $('statProcessed').textContent = processed;
    }
    function renderCounts() {
        if ($('countAll')) $('countAll').textContent = allData.length;
        if ($('countPending')) $('countPending').textContent = allData.filter(a => a.status === 'pending').length;
        if ($('countProcessed')) $('countProcessed').textContent = allData.filter(a => a.status === 'processed').length;
        if ($('countRejected')) $('countRejected').textContent = allData.filter(a => a.status === 'rejected').length;
    }
    function renderDistribution() {
        const container = $('distBars');
        if (!container) return;
        const counts = GROUPS.map(g => allData.filter(a => a.direction === g).length);
        const max = Math.max(...counts, 1);
        container.innerHTML = GROUPS.map((g, i) => `
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
        const container = $('groupFilters');
        if (!container) return;
        container.innerHTML = GROUPS.map(g =>
            `<span class="side-tag${currentGroup===g?' active':''}" data-group="${g}">${g}</span>`
        ).join('');
        container.querySelectorAll('.side-tag').forEach(tag => {
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
        if ($('resultCount')) $('resultCount').textContent = `共 ${list.length} 条记录`;

        const tb = $('tableBody');
        const es = $('emptyState');
        const dt = $('dataTable');

        if (list.length === 0) {
            if (tb) tb.innerHTML = '';
            if (es) es.style.display = 'flex';
            if (dt) dt.style.display = 'none';
            return;
        }
        if (es) es.style.display = 'none';
        if (dt) dt.style.display = 'table';

        if (tb) {
            tb.innerHTML = list.map(a => {
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

            tb.querySelectorAll('tr').forEach(tr => {
                const id = tr.dataset.id;
                tr.onclick = () => handleAction('view', id);
                tr.querySelectorAll('.action-btn').forEach(btn => {
                    btn.onclick = e => { e.stopPropagation(); handleAction(btn.dataset.act, id); };
                });
            });
        }
    }

    // ===== 操作（调用云端 API，失败保留本地回退） =====
    async function handleAction(action, id) {
        try {
            const item = allData.find(a => a.id === id);
            if (!item) return;

            if (action === 'view') {
                showDetailPanel(item);
                const panel = $('detailPanel');
                if (panel && panel.scrollIntoView) {
                    panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
                return;
            }

            if (action === 'process') {
                const nextStatus = item.status === 'processed' ? 'pending' : 'processed';
                // 短信通知（仅在状态从 pending → processed 变化时触发真正的"同意"动作）
                let smsResult = null;
                if (item.status !== nextStatus && nextStatus === 'processed') {
                    smsResult = await performSmsIfNeeded(item, nextStatus);
                    if (smsResult && smsResult.cancelled) return; // 用户取消了短信发送 → 中止本次操作
                }
                try {
                    if (!offlineMode) await updateStatusInCloud(id, nextStatus);
                    item.status = nextStatus;
                    syncLocalFromAll();
                    refreshData(true, [id]);
                    if (currentDetailId === item.id) showDetailPanel(item);
                    let desc = `${item.name} → ${statusText(nextStatus)}（云端已同步）`;
                    let toastType = 'success';
                    if (smsResult && smsResult.msg) {
                        desc += smsResult.simulated ? ' · 短信(模拟)' : ' · 短信已发';
                        if (!smsResult.ok && !smsResult.simulated) toastType = 'warning';
                    }
                    toast(toastType, '状态已更新', desc);
                    if (smsResult && smsResult.msg) toast(smsResult.simulated ? 'info' : (smsResult.ok ? 'success' : 'error'), smsResult.simulated ? '短信（本地模拟）' : (smsResult.ok ? '短信发送结果' : '短信发送失败'), smsResult.msg);
                } catch (e) {
                    console.error(e);
                    // 失败时更新本地并提示
                    item.status = nextStatus;
                    syncLocalFromAll();
                    refreshData(true, [id]);
                    if (currentDetailId === item.id) showDetailPanel(item);
                    toast('warning', '本地已更新，但云端同步失败', String(e.message || e).slice(0, 40) + '。请检查网络/Supabase。');
                }
                return;
            }

            if (action === 'delete') {
                if (!customConfirm(`确定要删除「${item.name}」的申请吗？`)) return;
                try {
                    if (!offlineMode) await deleteInCloud(id);
                    allData = allData.filter(a => a.id !== id);
                    syncLocalFromAll();
                    hideDetailPanel();
                    refreshData();
                    toast('success', '已删除', `${item.name} 的申请已删除（云端已同步）`);
                } catch (e) {
                    console.error(e);
                    allData = allData.filter(a => a.id !== id);
                    syncLocalFromAll();
                    hideDetailPanel();
                    refreshData();
                    toast('warning', '本地已删除，但云端删除失败', String(e.message || e).slice(0, 40));
                }
            }
        } catch (err) {
            console.error('handleAction error:', err);
            alert('操作出错：' + err.message);
        }
    }
    function syncLocalFromAll() {
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(allData)); } catch {}
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
                if (btnProcess) btnProcess.onclick = () => detailSetStatus(item, item.status==='processed'?'pending':'processed');
                if (btnReject) btnReject.onclick = () => detailSetStatus(item, item.status==='rejected'?'pending':'rejected');
                if (btnDelete) btnDelete.onclick = () => handleAction('delete', item.id);
            }
        } catch (err) {
            console.error('showDetailPanel error:', err);
        }
    }
    async function detailSetStatus(item, nextStatus) {
        try {
            // 短信通知（仅真正的 同意/拒绝 状态变化触发；恢复pending不会发短信）
            let smsResult = null;
            if (item.status !== nextStatus && (nextStatus === 'processed' || nextStatus === 'rejected')) {
                smsResult = await performSmsIfNeeded(item, nextStatus);
                if (smsResult && smsResult.cancelled) return;
            }
            if (!offlineMode) await updateStatusInCloud(item.id, nextStatus);
            item.status = nextStatus;
            syncLocalFromAll();
            refreshData(true, [item.id]);
            showDetailPanel(item);
            toast('success', '状态已更新', `${item.name} → ${statusText(nextStatus)}`);
            if (smsResult && smsResult.msg) {
                toast(smsResult.simulated ? 'info' : (smsResult.ok ? 'success' : 'error'),
                    smsResult.simulated ? '短信（本地模拟）' : (smsResult.ok ? '短信发送结果' : '短信发送失败'),
                    smsResult.msg);
            }
        } catch (e) {
            console.error(e);
            item.status = nextStatus;
            syncLocalFromAll();
            refreshData(true, [item.id]);
            showDetailPanel(item);
            toast('warning', '本地已更新，云端同步失败', String(e.message || e).slice(0, 40));
        }
    }
    function hideDetailPanel() {
        currentDetailId = null;
        const empty = $('detailEmpty');
        const content = $('detailContent');
        if (empty) empty.hidden = false;
        if (content) content.hidden = true;
    }

    // ===== 侧边栏 & 搜索 =====
    document.querySelectorAll('.side-link').forEach(link => {
        link.onclick = e => {
            e.preventDefault();
            document.querySelectorAll('.side-link').forEach(l => l.classList.remove('active'));
            link.classList.add('active');
            currentFilter = link.dataset.filter;
            renderTable();
        };
    });
    if ($('searchInput')) $('searchInput').oninput = e => { searchKeyword = e.target.value.trim(); renderTable(); };

    // ===== 实时监听状态指示器 & 新徽章 =====
    function updateLastUpdate() {
        const d = new Date();
        const p = n => String(n).padStart(2, '0');
        if (lastUpdateText) lastUpdateText.textContent = `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
        if (lastUpdate) {
            lastUpdate.classList.remove('flash');
            void lastUpdate.offsetWidth;
            lastUpdate.classList.add('flash');
        }
    }
    function updateLiveStatusLabel() {
        if (!liveStatus || !liveStatusText) return;
        if (!autoRefresh) {
            liveStatus.classList.add('paused');
            liveStatusText.textContent = '已暂停';
        } else if (offlineMode) {
            liveStatus.classList.add('paused');
            liveStatusText.textContent = '离线(本地)';
        } else if (realtimeChannel && realtimeChannel._ok) {
            liveStatus.classList.remove('paused');
            liveStatusText.textContent = '实时监听中';
        } else {
            liveStatus.classList.remove('paused');
            liveStatusText.textContent = '轮询同步中';
        }
    }
    function updateNewBadge() {
        if (!newBadge) return;
        if (unseenNewCount > 0) {
            newBadge.hidden = false;
            const numEl = newBadge.querySelector('.new-badge-num');
            if (numEl) numEl.textContent = '+' + unseenNewCount;
        } else {
            newBadge.hidden = true;
        }
    }
    if (newBadge) newBadge.onclick = () => { unseenNewCount = 0; updateNewBadge(); };

    if (liveStatus) {
        liveStatus.onclick = () => {
            autoRefresh = !autoRefresh;
            if (autoRefresh) {
                updateLiveStatusLabel();
                toast('success','已开启自动刷新','将实时接收新申请');
                startRealtime();
                refreshData();
            } else {
                updateLiveStatusLabel();
                toast('warning','已暂停自动刷新','点击状态指示器可继续');
                stopRealtime();
            }
        };
    }

    // ===== Supabase Realtime 订阅（手写 WebSocket，避免加载官方库） =====
    function realtimeUrl() {
        // Supabase Realtime v1 WS 地址：<ref>.supabase.co/realtime/v1/websocket?apikey=...&vsn=1.0.0
        const host = SUPABASE_URL.replace(/^https?:\/\//, '').replace(/\/+$/, '');
        const proto = location.protocol === 'https:' ? 'wss' : 'ws';
        return `${proto}://${host}/realtime/v1/websocket?apikey=${encodeURIComponent(SUPABASE_KEY)}&vsn=1.0.0`;
    }

    function startRealtime() {
        if (!autoRefresh || offlineMode || !window.WebSocket) { updateLiveStatusLabel(); return; }
        stopRealtime();
        let ws = null;
        let heartbeat = null;
        let heartbeatSend = null;
        let reconnectTimer = null;
        let refCounter = 1;
        const ch = { _ok: false, close: null };
        realtimeChannel = ch;

        function connect() {
            try {
                ws = new WebSocket(realtimeUrl());
            } catch (e) {
                console.warn('创建 WS 失败，启用轮询:', e);
                updateLiveStatusLabel();
                return;
            }
            ws.onopen = () => {
                // 1. heartbeat
                heartbeatSend = setInterval(() => {
                    if (ws && ws.readyState === 1) ws.send(JSON.stringify({
                        topic: 'phoenix', event: 'heartbeat', payload: {}, ref: String(refCounter++)
                    }));
                }, 30000);
                // 2. 订阅 public.applications 的所有事件
                const joinMsg = {
                    topic: 'realtime:lmk-apps',
                    event: 'phx_join',
                    payload: {
                        config: { broadcast: { self: false }, presence: { key: '' }, postgres_changes: [{
                            schema: 'public', table: 'applications', event: '*'
                        }] }
                    },
                    ref: String(refCounter++)
                };
                ws.send(JSON.stringify(joinMsg));
            };
            ws.onmessage = (ev) => {
                let msg; try { msg = JSON.parse(ev.data); } catch { return; }
                if (msg.event === 'phx_reply' && msg.payload && msg.payload.status === 'ok' && /^realtime:/.test(msg.topic || '')) {
                    ch._ok = true;
                    updateLiveStatusLabel();
                }
                if (msg.event === 'postgres_changes' && msg.payload && msg.payload.data) {
                    const evt = msg.payload.data; // { schema, table, commit_timestamp, type, old_record, record, errors, columns }
                    if (evt.table !== 'applications') return;
                    if (evt.type === 'INSERT' && evt.record) {
                        const newItem = rowToItem(evt.record);
                        // 避免重复
                        if (!allData.find(a => a.id === newItem.id)) {
                            allData.unshift(newItem);
                            syncLocalFromAll();
                            renderStats(); renderDistribution(); renderCounts();
                            renderGroupFilters();
                            renderTable([newItem.id]);
                            unseenNewCount += 1;
                            updateNewBadge();
                            toast('success','收到新申请（实时）', `${newItem.name} · ${newItem.direction}`);
                            updateLastUpdate();
                        }
                    } else if (evt.type === 'UPDATE' && evt.record) {
                        const updated = rowToItem(evt.record);
                        const idx = allData.findIndex(a => a.id === updated.id);
                        if (idx >= 0) allData[idx] = updated;
                        syncLocalFromAll();
                        refreshData(false, [updated.id]);
                        if (currentDetailId === updated.id) showDetailPanel(updated);
                    } else if (evt.type === 'DELETE' && evt.old_record && evt.old_record.id) {
                        const delId = evt.old_record.id;
                        allData = allData.filter(a => a.id !== delId);
                        syncLocalFromAll();
                        if (currentDetailId === delId) hideDetailPanel();
                        refreshData();
                    }
                }
            };
            ws.onerror = () => { /* 由 onclose 处理 */ };
            ws.onclose = () => {
                ch._ok = false;
                if (heartbeatSend) clearInterval(heartbeatSend);
                if (heartbeat) clearTimeout(heartbeat);
                updateLiveStatusLabel();
                if (autoRefresh && !offlineMode) {
                    if (reconnectTimer) clearTimeout(reconnectTimer);
                    reconnectTimer = setTimeout(() => { if (autoRefresh && !offlineMode) connect(); }, 4000);
                }
            };
        }
        ch.close = () => {
            if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
            if (heartbeatSend) { clearInterval(heartbeatSend); heartbeatSend = null; }
            if (heartbeat) { clearTimeout(heartbeat); heartbeat = null; }
            try { if (ws && ws.readyState <= 1) ws.close(); } catch {}
            ch._ok = false;
        };
        connect();
    }
    function stopRealtime() {
        if (realtimeChannel && typeof realtimeChannel.close === 'function') {
            try { realtimeChannel.close(); } catch {}
        }
        realtimeChannel = null;
    }

    // ===== 数据刷新（合并 Realtime 推送 & 轮询兜底） =====
    let refreshInProgress = false;
    async function refreshData(forceToast, highlightIds) {
        if (refreshInProgress) return;
        refreshInProgress = true;
        const prevIds = new Set(allData.map(a => a.id));
        let data = null;
        let switched = false;

        if (!offlineMode) {
            try {
                data = await loadFromCloud();
            } catch (e) {
                console.warn('云端读取失败，降级为本地模式:', e);
                data = loadFromLocal();
                offlineMode = true;
                switched = true;
            }
        } else {
            data = loadFromLocal();
        }

        allData = data;
        syncLocalFromAll();

        const newItems = forceToast ? allData.filter(a => !prevIds.has(a.id)) : [];
        const ids = (highlightIds && highlightIds.length) ? highlightIds.concat(newItems.map(a => a.id)) : newItems.map(a => a.id);
        renderStats();
        renderDistribution();
        renderGroupFilters();
        renderCounts();
        renderTable(ids);
        updateLastUpdate();
        updateLiveStatusLabel();

        if (newItems.length > 0) {
            unseenNewCount += newItems.length;
            updateNewBadge();
            const latest = newItems[0];
            if (newItems.length === 1) {
                toast('success','收到新申请', `${latest.name} · ${latest.direction}`);
            } else {
                toast('success', `收到 ${newItems.length} 条新申请`, `最新：${latest.name} · ${latest.direction}`);
            }
        } else if (switched) {
            toast('warning','当前为离线模式','云端不可用，已切换到本地数据（刷新网络后重试）');
        }
        refreshInProgress = false;
    }

    if (refreshBtn) refreshBtn.onclick = async () => {
        // 手动刷新：如果处于离线模式，先尝试重新连网
        if (offlineMode) {
            try {
                const test = await loadFromCloud();
                offlineMode = false;
                allData = test;
                syncLocalFromAll();
                toast('success','已恢复云端连接','数据已重新从云端加载');
                startRealtime();
            } catch (e) {
                offlineMode = true;
            }
        }
        await refreshData(true);
        toast('info','已刷新', `共 ${allData.length} 条申请`);
    };

    // ===== Toast =====
    function toast(type, title, desc) {
        try {
            const c = $('toastContainer');
            if (!c) return;
            const el = document.createElement('div');
            el.className = 'toast ' + type;
            const iconMap = { success: '✓', warning: '!', info: 'i', error: '!' };
            el.innerHTML = `<div class="toast-icon">${iconMap[type] || 'i'}</div>
                <div class="toast-content"><div class="toast-title">${escape(title)}</div><div class="toast-desc">${escape(desc)}</div></div>`;
            c.appendChild(el);
            requestAnimationFrame(() => el.classList.add('show'));
            setTimeout(() => {
                el.classList.remove('show');
                setTimeout(() => { if (el.parentNode) el.parentNode.removeChild(el); }, 300);
            }, 3800);
        } catch (err) {
            console.error('toast error:', err);
        }
    }

    // ===== 模拟提交（写入云端，便于测试实时刷新） =====
    if ($('seedBtn')) {
        $('seedBtn').onclick = () => {
            if (!confirm('模拟实时提交 5 条前端组申请到云端？\n\n每 1.5 秒提交一条，用于测试实时刷新效果。')) return;
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
            const btn = $('seedBtn');
            btn.disabled = true;
            btn.style.opacity = '0.6';
            toast('info','开始模拟', '每 1.5 秒向云端提交一条，共 5 条');
            async function submit() {
                if (i >= 5) {
                    btn.disabled = false;
                    btn.style.opacity = '';
                    btn.innerHTML = '<span>●</span> 模拟提交测试数据';
                    toast('success','模拟完成','5 条前端组申请已全部写入云端');
                    return;
                }
                btn.innerHTML = '<span>●</span> 提交中 ' + (i+1) + '/5';
                const now = new Date().toISOString();
                const id = 'SEED' + Date.now() + Math.floor(Math.random()*1000);
                const data = {
                    id: id,
                    name: names[i], studentId: '2026' + String(20240+i).padStart(5,'0'),
                    grade: grades[i], major: majors[i],
                    phone: '139' + String(12345678 + i*1111).slice(0,8),
                    email: 'frontend_' + (i+1) + '@lit.edu.cn',
                    direction: '前端组', experience: experiences[i], motivation: motivations[i],
                    submitTime: now, status: 'pending'
                };
                try {
                    await insertInCloud(data);
                    // 同时保持本地副本
                    const existing = loadFromLocal();
                    existing.unshift(data);
                    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(existing)); } catch {}
                } catch (e) {
                    console.warn('模拟提交失败:', e);
                    toast('warning', '模拟提交失败', String(e.message || e).slice(0, 40));
                }
                i++;
                setTimeout(submit, 1500);
            }
            setTimeout(submit, 300);
        };
    }

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
    if ($('exportJsonBtn')) $('exportJsonBtn').onclick = () => {
        if (!allData.length) { toast('warning','无数据','当前没有可导出的记录'); return; }
        downloadBlob(new Blob([JSON.stringify(allData,null,2)],{type:'application/json'}),`lmk_${fmtDate()}.json`);
        toast('success','导出成功',`共 ${allData.length} 条 (JSON)`);
    };
    if ($('exportCsvBtn')) $('exportCsvBtn').onclick = () => {
        if (!allData.length) { toast('warning','无数据','当前没有可导出的记录'); return; }
        const headers = ['姓名','学号','年级','专业','组别','手机','邮箱','经历','动机','时间','状态'];
        const rows = allData.map(a => [a.name,a.studentId,a.grade,a.major,a.direction,a.phone,a.email,a.experience,a.motivation,fmtTime(a.submitTime),statusText(a.status)]);
        const csv = [headers].concat(rows).map(r => r.map(c => `"${String(c||'').replace(/"/g,'""')}"`).join(',')).join('\n');
        downloadBlob(new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8'}),`lmk_${fmtDate()}.csv`);
        toast('success','导出成功',`共 ${allData.length} 条 (CSV)`);
    };
    if ($('clearAllBtn')) $('clearAllBtn').onclick = async () => {
        if (!allData.length) { toast('warning','无数据','当前没有可清空的记录'); return; }
        if (!confirm(`确定要清空全部 ${allData.length} 条申请记录吗？\n\n建议先导出备份！`)) return;
        if (!confirm('再次确认：真的要清空全部数据吗？此操作不可恢复！')) return;
        try {
            if (!offlineMode) {
                // 逐条删除（避免 REST 的批量删除可能被 RLS 拦截）
                const ids = allData.map(a => a.id);
                for (const id of ids) {
                    try { await deleteInCloud(id); } catch(e) { console.warn('删除失败', id, e); }
                }
            }
            localStorage.removeItem(STORAGE_KEY);
            allData = [];
            refreshData();
            toast('warning','已清空', offlineMode ? '本地记录已清空（云端不可用）' : '全部云端记录已删除');
        } catch (e) {
            console.error(e);
            toast('error','清空失败', String(e.message || e).slice(0, 40));
        }
    };

    // ===== 轮询兜底（每 6s，保证即使 Realtime 断线也能发现） =====
    setInterval(async () => {
        if (adminApp.style.display === 'none' || adminMain.style.display !== 'block' || !autoRefresh) return;
        if (realtimeChannel && realtimeChannel._ok && !offlineMode) return;
        await refreshData(true);
    }, 6000);

    // ===== 页面可见性切换时拉一次 =====
    document.addEventListener('visibilitychange', async () => {
        if (document.hidden) return;
        if (adminApp.style.display === 'none' || adminMain.style.display !== 'block' || !autoRefresh) return;
        if (!offlineMode) startRealtime();
        await refreshData(true);
    });

    // ===== 启动 =====
    applyRoute();
})();
