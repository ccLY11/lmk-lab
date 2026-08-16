// ===== 动态注入样式（修复详情面板背景颜色）=====
(function injectStyles() {
    const styleId = 'dynamic-detail-styles';
    if (document.getElementById(styleId)) return;
    
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
        .detail-desc-wrap {
            background: linear-gradient(180deg, rgba(20,40,75,0.92), rgba(10,22,45,0.96)) !important;
            border: 1px solid rgba(59,130,246,0.25) !important;
            border-left: 3px solid rgba(96,165,250,0.9) !important;
            border-radius: 6px !important;
        }
        .detail-desc {
            color: rgba(210,222,240,0.95) !important;
            text-shadow: 0 0 2px rgba(0,0,0,0.3);
        }
        .tech-pill {
            background: linear-gradient(135deg, rgba(22,45,90,0.92), rgba(10,22,45,0.97)) !important;
            border: 1px solid rgba(59,130,246,0.35) !important;
            border-radius: 5px !important;
            color: #c7dbfb !important;
            box-shadow: inset 0 1px 0 rgba(147,197,253,0.08);
        }
        .skill-name {
            color: #d0daea !important;
            text-shadow: 0 0 2px rgba(0,0,0,0.5);
        }
        .skill-bar {
            height: 8px !important;
            background: linear-gradient(180deg, #0a1428, #060c18) !important;
            border-radius: 4px !important;
            border: 1px solid rgba(59,130,246,0.3) !important;
            box-shadow: inset 0 2px 6px rgba(0,0,0,0.6);
        }
        .skill-fill {
            border-radius: 4px !important;
            box-shadow: 0 0 10px rgba(96,165,250,0.6) !important;
        }
        .skill-value {
            color: #7db8fa !important;
            text-shadow: 0 0 4px rgba(59,130,246,0.5);
        }
        .project-card {
            background: linear-gradient(180deg, rgba(16,32,64,0.92), rgba(8,18,38,0.97)) !important;
            border: 1px solid rgba(59,130,246,0.25) !important;
            border-radius: 6px !important;
            box-shadow: inset 0 1px 0 rgba(147,197,253,0.05);
        }
        .project-desc {
            color: rgba(180,195,220,0.88) !important;
            text-shadow: 0 0 2px rgba(0,0,0,0.3);
        }
    `;
    document.head.appendChild(style);
})();

// ===== 加载动画控制（进度模拟 + 日志打印 + 淡出）=====
(function initLoader() {
    const loader = document.getElementById('loader');
    if (!loader) return;

    // 后台管理员页面跳过加载动画
    if (window.__skipLoader) {
        loader.style.display = 'none';
        return;
    }

    const fill = loader.querySelector('.loader-progress-fill');
    const glow = loader.querySelector('.loader-progress-glow');
    const percentEl = loader.getElementById ? document.getElementById('loaderPercent') : loader.querySelector('.loader-percent');
    const percentEl2 = document.getElementById('loaderPercent');
    const pctEl = percentEl2 || percentEl;
    const statusText = document.getElementById('loaderStatusText') || loader.querySelector('.loader-status-text');
    const logEl = loader.querySelector('.loader-log');
    const modEl = document.getElementById('loaderModCount');
    const memEl = document.getElementById('loaderMem');
    const uptimeEl = document.getElementById('loaderUptime');
    const typingEl = document.getElementById('loaderTyping');

    const startTime = performance.now();
    function pad2(n) { return n < 10 ? '0' + n : '' + n; }
    function fmtUptime(t) {
        const total = Math.floor(t / 1000);
        const m = pad2(Math.floor(total / 60));
        const s = pad2(total % 60);
        const cs = pad2(Math.floor((t % 1000) / 10));
        return m + ':' + s + '.' + cs;
    }

    // 模拟加载日志（科技风，含结构化标签）
    const logs = [
        { ts: true, msg: ['LMK-LAB boot sequence ', '<span class="log-h">v2.026</span>'], tag: 'INF' },
        { ts: true, msg: ['Loading core module: <span class="log-h">lab_kernel</span>'], tag: 'INF' },
        { ts: true, msg: ['Init database pool: <span class="log-h">pool=4 ok</span>'], tag: 'OK' },
        { ts: true, msg: ['Mount recruitment channel <span class="log-h">/recruit/v1</span>'], tag: 'OK' },
        { ts: true, msg: ['Loading groups config: 05 units'], tag: 'INF' },
        { ts: true, msg: ['Subscribe realtime feed... ack.'], tag: 'OK' },
        { ts: true, msg: ['Warm caches... 12MB → 128MB'], tag: 'WRN' },
        { ts: true, msg: ['Ready. 欢迎加入 LMK 实验室.'], tag: 'OK' }
    ];

    // 终端打字机效果文字序列
    const typingLines = [
        './lmk_boot.sh --init',
        'mount /mnt/lab_share',
        'modprobe lab_core.ko',
        'db.ping() → ok',
        'launch::router /home',
        '[boot] ready.'
    ];

    // 读取内联脚本已设置的进度（如果有）
    let progress = window.__loaderProgress || 0;
    let logIndex = 0;
    let typingIndex = 0;
    let loading = true;

    function setStatus(text) { if (statusText) statusText.textContent = text; }
    function fmtNow(t) {
        const d = new Date(startTime + t);
        return pad2(d.getMinutes()) + ':' + pad2(d.getSeconds()) + '.' + pad2(Math.floor(d.getMilliseconds()/10));
    }
    function addLog(entry) {
        if (!logEl) return;
        const line = document.createElement('div');
        line.className = 'log-line';
        if (entry.ts) {
            const ts = document.createElement('span');
            ts.className = 'log-ts';
            ts.textContent = '[T+' + fmtNow(performance.now() - startTime) + ']';
            line.appendChild(ts);
        }
        const msg = document.createElement('span');
        msg.className = 'log-msg';
        msg.innerHTML = entry.msg.join ? entry.msg.join('') : entry.msg;
        line.appendChild(msg);
        if (entry.tag) {
            const tag = document.createElement('span');
            tag.className = 'log-tag ' + (entry.tag === 'OK' ? 'ok' : entry.tag === 'WRN' ? 'wrn' : 'inf');
            tag.textContent = entry.tag;
            line.appendChild(tag);
        }
        logEl.appendChild(line);
        // 自动滚到底部
        logEl.scrollTop = logEl.scrollHeight;
    }
    function updateProgress(v) {
        progress = Math.min(100, v);
        if (fill) fill.style.right = (100 - progress) + '%';
        if (glow) glow.style.left = progress + '%';
        if (pctEl) pctEl.textContent = Math.floor(progress) + '%';
        window.__loaderProgress = progress;
        // HUD：模块数（随进度 1→6）、内存（12→104MB）
        if (modEl) {
            const mc = Math.max(1, Math.min(6, Math.ceil(progress / (100 / 6))));
            modEl.textContent = mc < 10 ? '0' + mc : '' + mc;
        }
        if (memEl) {
            const m = 12 + Math.floor((progress / 100) * 92);
            memEl.textContent = '' + m;
        }
    }

    // UPTIME 实时刷新
    const uptimeTimer = setInterval(() => {
        if (uptimeEl) uptimeEl.textContent = fmtUptime(performance.now() - startTime);
    }, 50);

    // 终端打字机
    function typeNext() {
        if (!typingEl || !loading) return;
        const text = typingLines[typingIndex % typingLines.length];
        typingIndex++;
        let i = 0;
        typingEl.textContent = '';
        const sub = setInterval(() => {
            if (!loading) { clearInterval(sub); return; }
            typingEl.textContent += text.charAt(i);
            i++;
            if (i >= text.length) {
                clearInterval(sub);
                setTimeout(typeNext, 900);
            }
        }, 55);
    }
    setTimeout(typeNext, 400);

    // 立即更新一次（用内联脚本的当前进度）
    updateProgress(progress);

    // 启动日志和状态更新（立即打印，不等待）
    function printLogsAndStatus() {
        const targetLogIndex = Math.min(logs.length, Math.floor(progress / (100 / logs.length)));
        while (logIndex < targetLogIndex) {
            addLog(logs[logIndex]);
            logIndex++;
        }
        if (progress < 30)      setStatus('初始化内核模块与启动脚本');
        else if (progress < 60) setStatus('装载实验室组别与数据订阅');
        else if (progress < 90) setStatus('预热缓存与招新通道');
        else                    setStatus('系统就绪，即将进入实验室');
    }
    printLogsAndStatus();

    // 接管进度推进（如果内联脚本已启动，从当前进度继续）
    const tick = setInterval(() => {
        if (progress >= 100) {
            clearInterval(tick);
            return;
        }
        const step = progress < 80 ? 4 + Math.random() * 6 : 2 + Math.random() * 3;
        updateProgress(progress + step);
        printLogsAndStatus();

        if (progress >= 100) {
            clearInterval(tick);
            loading = false;
            while (logIndex < logs.length) { addLog(logs[logIndex]); logIndex++; }
            finish();
        }
    }, 180);

    function finish() {
        // 真实页面加载完成 + 至少展示 1.8s，再对焦过渡
        const minDisplayTime = 1900;
        const start = performance.now();
        function tryFocus() {
            const elapsed = performance.now() - start;
            if (document.readyState === 'complete' && elapsed >= minDisplayTime) {
                // 1. 触发对焦过渡：loader 失焦模糊+淡出，主页面对焦清晰浮现
                loader.classList.add('focusing');
                const frontApp = document.getElementById('frontApp');
                if (frontApp) frontApp.classList.add('entered');
                clearInterval(uptimeTimer);
                // 2. 等过渡完成（0.95s 失焦 + 1.05s 对焦尾段）
                setTimeout(() => {
                    if (loader.parentNode) loader.parentNode.removeChild(loader);
                }, 1200);
            } else {
                setTimeout(tryFocus, 120);
            }
        }
        tryFocus();
    }

    // 兜底：超过 6 秒强制对焦，防止卡死
    setTimeout(() => {
        if (!loader.classList.contains('focusing')) {
            updateProgress(100);
            loading = false;
            while (logIndex < logs.length) { addLog(logs[logIndex]); logIndex++; }
            setStatus('系统就绪，即将进入实验室');
            loader.classList.add('focusing');
            const frontApp = document.getElementById('frontApp');
            if (frontApp) frontApp.classList.add('entered');
            clearInterval(uptimeTimer);
            setTimeout(() => { if (loader.parentNode) loader.parentNode.removeChild(loader); }, 1200);
        }
    }, 6200);
})();

// ===== 导航栏滚动效果 =====
const header = document.getElementById('header');
const backTop = document.getElementById('backTop');
const navLinks = document.querySelectorAll('.nav-link');
const sections = document.querySelectorAll('section[id]');

function handleScroll() {
    const scrollY = window.scrollY;

    // 导航栏阴影
    if (scrollY > 8) {
        header.classList.add('scrolled');
    } else {
        header.classList.remove('scrolled');
    }

    // 返回顶部按钮
    if (scrollY > 400) {
        backTop.classList.add('visible');
    } else {
        backTop.classList.remove('visible');
    }

    // 当前 section 高亮
    let current = '';
    sections.forEach(section => {
        const top = section.offsetTop - 100;
        const height = section.offsetHeight;
        if (scrollY >= top && scrollY < top + height) {
            current = section.id;
        }
    });

    navLinks.forEach(link => {
        link.classList.remove('active');
        const href = link.getAttribute('href');
        if (href === '#' + current) {
            link.classList.add('active');
        }
    });
}

window.addEventListener('scroll', handleScroll, { passive: true });

// ===== 移动端菜单 =====
const navToggle = document.getElementById('navToggle');
const navMenu = document.getElementById('navMenu');

if (navToggle) {
    navToggle.addEventListener('click', () => {
        navToggle.classList.toggle('active');
        navMenu.classList.toggle('active');
    });

    navLinks.forEach(link => {
        link.addEventListener('click', () => {
            navToggle.classList.remove('active');
            navMenu.classList.remove('active');
        });
    });
}

// ===== 返回顶部 =====
if (backTop) {
    backTop.addEventListener('click', () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });
}

// ===== 平滑滚动到锚点（修正偏移） =====
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        const href = this.getAttribute('href');
        if (!href || href === '#') return;

        const target = document.querySelector(href);
        if (target) {
            e.preventDefault();
            const offset = 80;
            const top = target.offsetTop - offset;
            window.scrollTo({ top, behavior: 'smooth' });
        }
    });
});

// ===== 滚动揭示动画 =====
const revealTargets = document.querySelectorAll(
    '.research-card, .award-summary-item, .awards-row, .gallery-item, .about-list-item, .info-card, .join-steps li, .contact-list li'
);

revealTargets.forEach(el => el.classList.add('reveal'));

const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry, i) => {
        if (entry.isIntersecting) {
            // 同一组元素错开显示，但延迟很短，保持克制
            const siblings = Array.from(entry.target.parentElement.children).filter(c =>
                c.classList.contains('reveal')
            );
            const index = siblings.indexOf(entry.target);
            const delay = Math.min(index * 60, 240);
            setTimeout(() => {
                entry.target.classList.add('visible');
            }, delay);
            revealObserver.unobserve(entry.target);
        }
    });
}, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

revealTargets.forEach(el => revealObserver.observe(el));

// ===== 云数据库配置（Supabase）=====
// 项目部署后保持不变，这两项是公开可见的（受 RLS 策略保护）
const SUPABASE_URL = "https://idkfeltsswxdlbkduhcs.supabase.co";
const SUPABASE_KEY = "sb_publishable_fFsZPc15qmDMK8PrQHLYAg_TY4Xrawq";

// （可选）同时发到你邮箱：填入 Formspree endpoint，留空则只存数据库
const FORMSPREE_ENDPOINT = "";

// ===== 本地存储工具（离线回退用）=====
const STORAGE_KEY = "lmk_applications";
function saveLocalCopy(formData) {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        const applications = raw ? JSON.parse(raw) : [];
        applications.unshift(formData);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(applications));
    } catch (err) {
        console.warn("保存本地副本失败:", err);
    }
}

// ===== 连接预热（关键加速：页面加载时提前握手，用户点提交时复用热连接）=====
// 浏览器会缓存 DNS + TCP + TLS 到 Supabase 的连接到 keep-alive 池，后续 POST 复用，省 200-800ms
(function warmupSupabase() {
    try {
        // 1. 页面就绪后立即发一个极轻量请求触发完整握手（只查 1 条 id，几字节）
        const fire = () => {
            fetch(SUPABASE_URL + "/rest/v1/applications?select=id&limit=1", {
                method: "GET",
                headers: {
                    "apikey": SUPABASE_KEY,
                    "Authorization": "Bearer " + SUPABASE_KEY
                },
                cache: "no-store"  // 不走缓存，强制建立真实连接
            }).catch(() => { /* 预热失败不影响主流程 */ });
        };
        // 2. 优先用 requestIdleCallback 在空闲时触发，避免抢占首屏渲染
        if ("requestIdleCallback" in window) {
            requestIdleCallback(fire, { timeout: 1500 });
        } else if (document.readyState === "complete") {
            setTimeout(fire, 300);
        } else {
            window.addEventListener("load", () => setTimeout(fire, 300));
        }
        // 3. 每 40 秒补一次热身，防止 keep-alive 超时被回收（默认 idle 60s 断开）
        setInterval(() => {
            try {
                fetch(SUPABASE_URL + "/rest/v1/applications?select=id&limit=1", {
                    method: "GET",
                    headers: { "apikey": SUPABASE_KEY, "Authorization": "Bearer " + SUPABASE_KEY },
                    cache: "no-store"
                }).catch(() => {});
            } catch {}
        }, 40000);
    } catch (e) {
        console.warn("预热连接失败（不影响提交）:", e);
    }
})();

// ===== 表单提交 =====
const joinForm = document.getElementById("joinForm");

if (joinForm) {
    joinForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        // 简单验证
        const required = joinForm.querySelectorAll("[required]");
        let valid = true;
        required.forEach(field => {
            if (!field.value.trim()) {
                valid = false;
                field.style.borderColor = "var(--danger)";
                setTimeout(() => { field.style.borderColor = ""; }, 2000);
            }
        });

        if (!valid) {
            showToast("请填写所有必填项", "error");
            return;
        }

        // 邮箱格式校验
        const email = document.getElementById("email");
        const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (email && !emailPattern.test(email.value)) {
            showToast("邮箱格式不正确", "error");
            email.style.borderColor = "var(--danger)";
            setTimeout(() => { email.style.borderColor = ""; }, 2000);
            return;
        }

        // 手机号简单校验
        const phone = document.getElementById("phone");
        const phonePattern = /^1[3-9]\d{9}$/;
        if (phone && !phonePattern.test(phone.value)) {
            showToast("手机号格式不正确", "error");
            phone.style.borderColor = "var(--danger)";
            setTimeout(() => { phone.style.borderColor = ""; }, 2000);
            return;
        }

        const btn = joinForm.querySelector("button[type='submit']");
        const originalText = btn.textContent;
        btn.disabled = true;
        btn.textContent = "提交中...";

        // 收集表单数据（注意：数据库是 snake_case，前端用 camelCase）
        const nowIso = new Date().toISOString();
        const id = "APP" + Date.now() + Math.floor(Math.random() * 1000);
        const formData = {
            id: id,
            name: document.getElementById("name").value.trim(),
            studentId: document.getElementById("studentId").value.trim(),
            grade: document.getElementById("grade").value,
            major: document.getElementById("major").value.trim(),
            phone: document.getElementById("phone").value.trim(),
            email: document.getElementById("email").value.trim(),
            direction: document.getElementById("direction").value,
            experience: document.getElementById("experience").value.trim(),
            motivation: document.getElementById("motivation").value.trim(),
            submitTime: nowIso,
            status: "pending"
        };

        // 对应数据库字段（snake_case）
        const payloadForDb = {
            id: id,
            name: formData.name,
            student_id: formData.studentId,
            grade: formData.grade,
            major: formData.major,
            phone: formData.phone,
            email: formData.email,
            direction: formData.direction,
            experience: formData.experience,
            motivation: formData.motivation,
            submit_time: nowIso,
            status: "pending"
        };

        // ===== 乐观更新：立即显示成功 + 重置表单，云端写入异步进行 =====
        // 立即保存本地副本（无论云端成不成功都不丢）
        saveLocalCopy(formData);
        btn.textContent = "提交成功";
        showToast("申请已提交，我们将在3个工作日内与您联系", "success");
        joinForm.reset();

        // 立即恢复按钮（不阻塞用户继续操作）
        setTimeout(() => {
            btn.disabled = false;
            btn.textContent = originalText;
        }, 1200);

        // ===== 异步写入云端（后台进行，失败再提示）=====
        const ctrl = new AbortController();
        const tid = setTimeout(() => ctrl.abort(), 12000); // 12s 超时
        (async () => {
            try {
                const supabaseRes = await fetch(SUPABASE_URL + "/rest/v1/applications", {
                    method: "POST",
                    headers: {
                        "apikey": SUPABASE_KEY,
                        "Authorization": "Bearer " + SUPABASE_KEY,
                        "Content-Type": "application/json",
                        "Prefer": "return=minimal"
                    },
                    body: JSON.stringify(payloadForDb),
                    signal: ctrl.signal
                });
                clearTimeout(tid);
                if (!supabaseRes.ok) {
                    const text = await supabaseRes.text().catch(() => "");
                    throw new Error("HTTP " + supabaseRes.status + " " + text.slice(0, 120));
                }
                console.info("[Supabase] 云端写入成功:", id);

                //（可选）Formspree 邮件通知，失败不影响主流程
                if (FORMSPREE_ENDPOINT) {
                    try {
                        await fetch(FORMSPREE_ENDPOINT, {
                            method: "POST",
                            headers: { "Content-Type": "application/json", "Accept": "application/json" },
                            body: JSON.stringify({
                                name: formData.name, studentId: formData.studentId, grade: formData.grade,
                                major: formData.major, phone: formData.phone, email: formData.email,
                                direction: formData.direction, experience: formData.experience,
                                motivation: formData.motivation, submitTime: formData.submitTime,
                                _subject: "LMK实验室新申请 - " + formData.name + " - " + formData.direction
                            })
                        });
                    } catch (fErr) {
                        console.warn("Formspree 邮件通知失败（云数据库已写入）:", fErr);
                    }
                }
            } catch (err) {
                console.warn("[Supabase] 云端写入失败（已暂存本地，无需重提）:", err);
                // 失败时再提示，但数据已存在本地，后台打开后会自动迁移
                showToast("服务器暂不可用，申请已暂存本地。管理员后台打开后会自动同步到云端", "info");
            }
        })();
    });
}

// ===== Toast 提示 =====
function showToast(message, type = 'info') {
    const colors = {
        success: { bg: '#f0fdf4', border: '#059669', text: '#065f46', icon: '✓' },
        error:   { bg: '#fef2f2', border: '#dc2626', text: '#991b1b', icon: '!' },
        info:    { bg: '#eff6ff', border: '#1e40af', text: '#1e3a8a', icon: 'i' }
    };
    const c = colors[type] || colors.info;

    const toast = document.createElement('div');
    toast.style.cssText = `
        position: fixed;
        top: 88px;
        right: 32px;
        padding: 14px 20px;
        background: ${c.bg};
        border: 1px solid ${c.border};
        border-left: 4px solid ${c.border};
        border-radius: 6px;
        color: ${c.text};
        font-size: 14px;
        z-index: 9999;
        display: flex;
        align-items: center;
        gap: 10px;
        box-shadow: 0 4px 12px rgba(15, 30, 58, 0.1);
        transform: translateX(120%);
        transition: transform 0.3s ease;
        max-width: 360px;
    `;
    toast.innerHTML = `
        <span style="
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 20px;
            height: 20px;
            background: ${c.border};
            color: #fff;
            border-radius: 50%;
            font-size: 12px;
            font-weight: 700;
            flex-shrink: 0;
        ">${c.icon}</span>
        <span>${message}</span>
    `;

    document.body.appendChild(toast);
    requestAnimationFrame(() => {
        toast.style.transform = 'translateX(0)';
    });

    setTimeout(() => {
        toast.style.transform = 'translateX(120%)';
        setTimeout(() => toast.remove(), 300);
    }, 3200);
}

// ===== 页面加载完成 =====
window.addEventListener('load', () => {
    // 初始触发一次滚动检测
    handleScroll();
    initMouseInteractions();
});

// ===== 鼠标交互动画 =====
function initMouseInteractions() {
    // 1. 鼠标跟随光点（微弱科技感）
    const cursorDot = document.createElement('div');
    cursorDot.className = 'cursor-dot';
    document.body.appendChild(cursorDot);

    let mouseX = 0, mouseY = 0;
    let dotX = 0, dotY = 0;

    document.addEventListener('mousemove', (e) => {
        mouseX = e.clientX;
        mouseY = e.clientY;
        cursorDot.style.opacity = '1';

        // 2. 检测悬停元素，改变光点样式
        const el = document.elementFromPoint(mouseX, mouseY);
        if (el && (el.closest('a, button, input, textarea, .research-card, .gallery-item, .info-card, .award-summary-item'))) {
            cursorDot.classList.add('hovering');
        } else {
            cursorDot.classList.remove('hovering');
        }
    });

    // 平滑跟随
    function animateDot() {
        dotX += (mouseX - dotX) * 0.15;
        dotY += (mouseY - dotY) * 0.15;
        cursorDot.style.left = dotX + 'px';
        cursorDot.style.top = dotY + 'px';
        requestAnimationFrame(animateDot);
    }
    animateDot();

    // 鼠标离开页面时隐藏
    document.addEventListener('mouseleave', () => {
        cursorDot.style.opacity = '0';
    });
    document.addEventListener('mouseenter', () => {
        cursorDot.style.opacity = '1';
    });

    // 3. Hero 区域视差效果
    const hero = document.querySelector('.hero');
    if (hero) {
        const heroElements = hero.querySelectorAll('.hero-bg-grid, .hero-glow, .hero-content');
        hero.addEventListener('mousemove', (e) => {
            const rect = hero.getBoundingClientRect();
            const x = (e.clientX - rect.left) / rect.width - 0.5;
            const y = (e.clientY - rect.top) / rect.height - 0.5;

            heroElements.forEach((el, i) => {
                const depth = (i + 1) * 8;
                el.style.transform = `translate(${x * depth}px, ${y * depth}px)`;
            });
        });

        hero.addEventListener('mouseleave', () => {
            heroElements.forEach(el => {
                el.style.transform = 'translate(0, 0)';
                el.style.transition = 'transform 0.6s ease';
                setTimeout(() => el.style.transition = '', 600);
            });
        });
    }

    // 4. 卡片 3D 倾斜效果
    const tiltCards = document.querySelectorAll('.research-card, .info-card, .award-summary-item');
    tiltCards.forEach(card => {
        card.style.transformStyle = 'preserve-3d';
        card.style.transition = 'transform 0.1s ease-out';

        card.addEventListener('mousemove', (e) => {
            const rect = card.getBoundingClientRect();
            const x = (e.clientX - rect.left) / rect.width;
            const y = (e.clientY - rect.top) / rect.height;
            const rotateX = (y - 0.5) * -6;
            const rotateY = (x - 0.5) * 6;
            card.style.transform = `perspective(800px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(1.02)`;
        });

        card.addEventListener('mouseleave', () => {
            card.style.transform = 'perspective(800px) rotateX(0) rotateY(0) scale(1)';
            card.style.transition = 'transform 0.4s ease';
            setTimeout(() => card.style.transition = 'transform 0.2s ease-out', 400);
        });
    });

    // 5. 画廊卡片悬停发光
    const galleryItems = document.querySelectorAll('.gallery-item');
    galleryItems.forEach(item => {
        item.addEventListener('mouseenter', () => {
            item.style.boxShadow = '0 8px 30px rgba(30, 64, 175, 0.25), 0 0 0 1px rgba(30, 64, 175, 0.3)';
            item.style.borderColor = 'rgba(30, 64, 175, 0.4)';
        });
        item.addEventListener('mouseleave', () => {
            item.style.boxShadow = '';
            item.style.borderColor = '';
        });
    });

    // 6. 按钮/链接悬停光晕
    const glowElements = document.querySelectorAll('.hero-btn, .join-btn, .nav-link');
    glowElements.forEach(el => {
        el.addEventListener('mouseenter', () => {
            el.style.boxShadow = '0 0 20px rgba(30, 64, 175, 0.3)';
        });
        el.addEventListener('mouseleave', () => {
            el.style.boxShadow = '';
        });
    });

    // 7. 点击涟漪效果
    document.addEventListener('click', (e) => {
        // 只在非交互元素上创建涟漪
        const target = e.target;
        if (target.closest('a, button, input, textarea, select')) return;

        const ripple = document.createElement('div');
        ripple.className = 'click-ripple';
        ripple.style.left = e.clientX + 'px';
        ripple.style.top = e.clientY + 'px';
        document.body.appendChild(ripple);
        setTimeout(() => ripple.remove(), 800);
    });

    // 8. 导航栏扫描线效果
    const navBar = document.querySelector('.nav');
    if (navBar) {
        navBar.addEventListener('mousemove', (e) => {
            const rect = navBar.getBoundingClientRect();
            const x = e.clientX - rect.left;
            navBar.style.setProperty('--scan-x', x + 'px');
        });
    }

    // 9. 粒子网络背景（科技感粒子动画）
    initParticleNetwork();

    // 10. Hero 数字滚动动画
    initNumberCounter();

    // 11. 鼠标拖尾光线效果
    initMouseTrail();

    // 12. 标题打字机 — 已由 #25 initHeroTypewriterLoop 接管，跳过旧版 initTypewriterEffect()

    // 13. 滚动进度条
    initScrollProgress();

    // 14. 元素进入时粒子爆发
    initParticleBurstOnReveal();

    // 15. Hero 区域数据流背景
    initDataStreamBg();

    // 16. 滚动入场动画（错落淡入上移）
    initScrollReveal();

    // 17. 磁吸 CTA 按钮
    initMagneticButtons();

    // 18. 卡片 spotlight 光带
    initCardSpotlight();

    // 19. 大背景柔光跟随鼠标
    initAmbientGlow();

    // 20. 标题逐字渐入
    initTitleCharReveal();

    // 22. Hero 区 3D 透视网格地形
    initHero3DGrid();

    // 23. 滚动视差
    initScrollParallax();

    // 24. Section 之间的扫描线分隔
    initSectionDividers();

    // 25. Hero 标题打字机循环（覆盖原 .hero-title 内容）
    try { initHeroTypewriterLoop(); } catch(e) { console.warn('typewriter fail:', e); }

    // 26. 右侧滚动指示器
    initScrollSpy();

    // 27. 多页路由：基于 ?page= 的单页切换
    try { initPageRouter(); } catch(err) { console.warn('page-router init fail:', err); }
}

// ===== 粒子网络背景 =====
function initParticleNetwork() {
    const canvas = document.createElement('canvas');
    canvas.className = 'particle-network';
    document.body.appendChild(canvas);
    const ctx = canvas.getContext('2d');

    let particles = [];
    const PARTICLE_COUNT = 60;

    function resize() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }
    resize();
    window.addEventListener('resize', resize);

    // 创建粒子
    for (let i = 0; i < PARTICLE_COUNT; i++) {
        particles.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            vx: (Math.random() - 0.5) * 0.3,
            vy: (Math.random() - 0.5) * 0.3,
            r: Math.random() * 1.5 + 0.5
        });
    }

    let mouse = { x: -1000, y: -1000 };
    document.addEventListener('mousemove', (e) => {
        mouse.x = e.clientX;
        mouse.y = e.clientY;
    });

    function draw() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // 绘制粒子和连线
        for (let i = 0; i < particles.length; i++) {
            const p = particles[i];
            p.x += p.vx;
            p.y += p.vy;

            // 边界反弹
            if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
            if (p.y < 0 || p.y > canvas.height) p.vy *= -1;

            // 鼠标排斥
            const dx = p.x - mouse.x;
            const dy = p.y - mouse.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < 120) {
                const force = (120 - dist) / 120;
                p.x += (dx / dist) * force * 2;
                p.y += (dy / dist) * force * 2;
            }

            // 绘制粒子
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(30, 64, 175, 0.4)';
            ctx.fill();

            // 连线
            for (let j = i + 1; j < particles.length; j++) {
                const p2 = particles[j];
                const dx2 = p.x - p2.x;
                const dy2 = p.y - p2.y;
                const dist2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);
                if (dist2 < 110) {
                    ctx.beginPath();
                    ctx.moveTo(p.x, p.y);
                    ctx.lineTo(p2.x, p2.y);
                    ctx.strokeStyle = `rgba(30, 64, 175, ${0.15 * (1 - dist2 / 110)})`;
                    ctx.lineWidth = 0.5;
                    ctx.stroke();
                }
            }
        }

        requestAnimationFrame(draw);
    }
    draw();
}

// ===== Hero 数字滚动动画 =====
function initNumberCounter() {
    const nums = document.querySelectorAll('.hero-stat-num');
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting && !entry.target.dataset.counted) {
                entry.target.dataset.counted = '1';
                const text = entry.target.textContent;
                const match = text.match(/(\d+)/);
                if (!match) return;
                const target = parseInt(match[1]);
                const span = entry.target.querySelector('span');
                const suffix = span ? span.outerHTML : '';
                let current = 0;
                const duration = 1500;
                const steps = 60;
                const inc = target / steps;
                const stepTime = duration / steps;

                const timer = setInterval(() => {
                    current += inc;
                    if (current >= target) {
                        current = target;
                        clearInterval(timer);
                    }
                    entry.target.innerHTML = Math.floor(current) + suffix;
                }, stepTime);
            }
        });
    }, { threshold: 0.5 });
    nums.forEach(n => observer.observe(n));
}

// ===== 鼠标拖尾光线 =====
function initMouseTrail() {
    const trails = [];
    const maxTrails = 15;

    document.addEventListener('mousemove', (e) => {
        // 添加新轨迹点
        trails.push({
            x: e.clientX,
            y: e.clientY,
            life: 1,
            size: Math.random() * 3 + 1
        });
        if (trails.length > maxTrails) trails.shift();
    });

    function drawTrail() {
        // 移除已存在的拖尾元素
        document.querySelectorAll('.mouse-trail').forEach(el => el.remove());

        trails.forEach((t, i) => {
            t.life -= 0.06;
            if (t.life > 0) {
                const dot = document.createElement('div');
                dot.className = 'mouse-trail';
                dot.style.left = t.x + 'px';
                dot.style.top = t.y + 'px';
                dot.style.width = (t.size * t.life * 4) + 'px';
                dot.style.height = (t.size * t.life * 4) + 'px';
                dot.style.opacity = t.life * 0.6;
                document.body.appendChild(dot);
            }
        });

        // 清理死掉的轨迹
        while (trails.length && trails[0].life <= 0) trails.shift();

        requestAnimationFrame(drawTrail);
    }
    drawTrail();
}

// ===== 标题打字机效果 =====
function initTypewriterEffect() {
    const title = document.querySelector('.hero-title');
    if (!title) return;
    const originalHTML = title.innerHTML;
    const text = title.textContent;
    title.innerHTML = '<span class="typewriter-text"></span><span class="typewriter-cursor">|</span>';
    const textEl = title.querySelector('.typewriter-text');
    const cursor = title.querySelector('.typewriter-cursor');

    let i = 0;
    function type() {
        if (i < text.length) {
            textEl.textContent += text[i];
            i++;
            setTimeout(type, 80);
        } else {
            // 完成后恢复原 HTML（保留 <br> 等）
            setTimeout(() => {
                title.innerHTML = originalHTML;
                title.classList.add('typed');
            }, 500);
        }
    }
    setTimeout(type, 600);
}

// ===== 滚动进度条 =====
function initScrollProgress() {
    const bar = document.createElement('div');
    bar.className = 'scroll-progress';
    document.body.appendChild(bar);

    window.addEventListener('scroll', () => {
        const scrollable = document.documentElement.scrollHeight - window.innerHeight;
        const progress = (window.scrollY / scrollable) * 100;
        bar.style.width = progress + '%';
    }, { passive: true });
}

// ===== 元素进入时粒子爆发 =====
function initParticleBurstOnReveal() {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting && !entry.target.dataset.bursted) {
                entry.target.dataset.bursted = '1';
                const rect = entry.target.getBoundingClientRect();
                const cx = rect.left + rect.width / 2;
                const cy = rect.top + rect.height / 2;
                createBurst(cx, cy);
            }
        });
    }, { threshold: 0.3 });

    document.querySelectorAll('.section-title, .hero-stat-num, .award-num').forEach(el => observer.observe(el));
}

function createBurst(x, y) {
    const count = 12;
    for (let i = 0; i < count; i++) {
        const p = document.createElement('div');
        p.className = 'burst-particle';
        const angle = (i / count) * Math.PI * 2;
        const distance = 40 + Math.random() * 30;
        const dx = Math.cos(angle) * distance;
        const dy = Math.sin(angle) * distance;
        p.style.left = x + 'px';
        p.style.top = y + 'px';
        p.style.setProperty('--dx', dx + 'px');
        p.style.setProperty('--dy', dy + 'px');
        document.body.appendChild(p);
        setTimeout(() => p.remove(), 1000);
    }
}

// ===== Hero 区域数据流背景 =====
function initDataStreamBg() {
    const hero = document.querySelector('.hero');
    if (!hero) return;

    const stream = document.createElement('div');
    stream.className = 'data-stream';
    hero.appendChild(stream);

    const chars = '01LMKабвгдежзийклмнопрстуфхцчшщъыьэюя';

    function addColumn() {
        const col = document.createElement('div');
        col.className = 'stream-column';
        const len = 8 + Math.floor(Math.random() * 12);
        let text = '';
        for (let i = 0; i < len; i++) {
            text += chars[Math.floor(Math.random() * chars.length)] + '<br>';
        }
        col.innerHTML = text;
        col.style.left = Math.random() * 100 + '%';
        col.style.animationDuration = (4 + Math.random() * 4) + 's';
        stream.appendChild(col);
        setTimeout(() => col.remove(), 8000);
    }

    setInterval(addColumn, 600);
}

// ===== 16. 滚动入场动画（IntersectionObserver + 错落淡入上移）=====
function initScrollReveal() {
    // 注意：.section-title 由 initTitleCharReveal 单独处理，此处排除避免双重动画
    const targets = document.querySelectorAll(
        '.section-sub, .research-card, .gallery-item, .info-card, ' +
        '.award-summary-item, .hero-stat, .hero-actions, .join-form-wrap, .footer-inner'
    );
    targets.forEach((el, i) => {
        el.classList.add('reveal-init');
        el.style.transitionDelay = (i % 6) * 80 + 'ms';
    });
    const io = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('reveal-in');
                io.unobserve(entry.target);
            }
        });
    }, { threshold: 0.12, rootMargin: '0px 0px -60px 0px' });
    targets.forEach(el => io.observe(el));
}

// ===== 17. 磁吸 CTA 按钮（鼠标靠近时按钮被吸引位移）=====
function initMagneticButtons() {
    const magnets = document.querySelectorAll('.btn-primary, .btn-outline, .hero-btn, .join-btn');
    magnets.forEach(btn => {
        btn.addEventListener('mousemove', (e) => {
            const rect = btn.getBoundingClientRect();
            const x = e.clientX - rect.left - rect.width / 2;
            const y = e.clientY - rect.top - rect.height / 2;
            btn.style.transform = `translate(${x * 0.25}px, ${y * 0.35}px)`;
        });
        btn.addEventListener('mouseleave', () => {
            btn.style.transform = '';
            btn.style.transition = 'transform 0.4s cubic-bezier(0.16, 1, 0.3, 1)';
            setTimeout(() => btn.style.transition = '', 400);
        });
        btn.addEventListener('mouseenter', () => {
            btn.style.transition = 'transform 0.15s ease-out';
        });
    });
}

// ===== 18. 卡片 spotlight 光带（悬停时光跟随鼠标扫过卡片）=====
function initCardSpotlight() {
    const cards = document.querySelectorAll('.research-card, .gallery-item, .info-card, .award-summary-item');
    cards.forEach(card => {
        card.classList.add('spotlight-card');
        card.addEventListener('mousemove', (e) => {
            const rect = card.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            card.style.setProperty('--spot-x', x + 'px');
            card.style.setProperty('--spot-y', y + 'px');
        });
    });
}

// ===== 19. 大背景柔光跟随鼠标（沉浸感增强，非小点）=====
function initAmbientGlow() {
    const glow = document.createElement('div');
    glow.className = 'ambient-glow';
    document.body.appendChild(glow);

    let tx = window.innerWidth / 2, ty = window.innerHeight / 2;
    let cx = tx, cy = ty;

    document.addEventListener('mousemove', (e) => {
        tx = e.clientX;
        ty = e.clientY;
    });

    function loop() {
        cx += (tx - cx) * 0.06;
        cy += (ty - cy) * 0.06;
        glow.style.transform = `translate(${cx - 250}px, ${cy - 250}px)`;
        requestAnimationFrame(loop);
    }
    loop();

    // 鼠标离开页面时淡出
    document.addEventListener('mouseleave', () => glow.style.opacity = '0');
    document.addEventListener('mouseenter', () => glow.style.opacity = '');
}

// ===== 20. 标题逐字渐入（适用 section-title）=====
function initTitleCharReveal() {
    const titles = document.querySelectorAll('.section-title');
    titles.forEach(title => {
        if (title.dataset.charInit) return;
        title.dataset.charInit = '1';
        const text = title.textContent;
        title.textContent = '';
        [...text].forEach((ch, i) => {
            const span = document.createElement('span');
            span.className = 'char';
            span.textContent = ch === ' ' ? '\u00A0' : ch;
            span.style.animationDelay = (i * 50) + 'ms';
            title.appendChild(span);
        });
    });

    const io = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('char-in');
                io.unobserve(entry.target);
            }
        });
    }, { threshold: 0.5 });
    titles.forEach(t => io.observe(t));
}

// ===== 22. Hero 区 3D 透视网格地形（未来科技感）=====
function initHero3DGrid() {
    const hero = document.querySelector('.hero');
    if (!hero) return;

    const wrap = document.createElement('div');
    wrap.className = 'hero-3d-grid';
    hero.appendChild(wrap);

    const canvas = document.createElement('canvas');
    canvas.width = 1200;
    canvas.height = 400;
    wrap.appendChild(canvas);
    const ctx = canvas.getContext('2d');

    let t = 0;
    function draw() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.strokeStyle = 'rgba(30, 64, 175, 0.35)';
        ctx.lineWidth = 1;

        // 横向网格线（透视，远处密近处疏）
        for (let i = 0; i < 16; i++) {
            const yProgress = (i / 16 + (t * 0.0008)) % 1;
            const y = canvas.height * 0.3 + Math.pow(yProgress, 2) * canvas.height * 0.7;
            const alpha = Math.min(yProgress * 1.5, 1) * 0.35;
            ctx.strokeStyle = `rgba(30, 64, 175, ${alpha})`;
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(canvas.width, y);
            ctx.stroke();
        }

        // 纵向网格线（向远处汇聚）
        const vp = { x: canvas.width / 2, y: canvas.height * 0.3 };
        for (let i = -8; i <= 8; i++) {
            const xBottom = canvas.width / 2 + i * (canvas.width / 14);
            ctx.strokeStyle = 'rgba(30, 64, 175, 0.25)';
            ctx.beginPath();
            ctx.moveTo(vp.x, vp.y);
            ctx.lineTo(xBottom, canvas.height);
            ctx.stroke();
        }

        // 顶部光晕
        const grad = ctx.createRadialGradient(vp.x, vp.y, 0, vp.x, vp.y, 200);
        grad.addColorStop(0, 'rgba(96, 165, 250, 0.25)');
        grad.addColorStop(1, 'rgba(96, 165, 250, 0)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        t++;
        requestAnimationFrame(draw);
    }
    draw();
}

// ===== 23. 滚动视差（背景元素相对前景慢速移动）=====
function initScrollParallax() {
    const parallaxTargets = document.querySelectorAll(
        '.hero-bg-grid, .hero-glow, .hero-3d-grid, .data-stream'
    );
    if (!parallaxTargets.length) return;

    let ticking = false;
    function update() {
        const sy = window.scrollY;
        parallaxTargets.forEach((el, i) => {
            const speed = 0.15 + (i % 3) * 0.08;
            el.style.transform = `translateY(${sy * speed * -1}px)`;
        });
        ticking = false;
    }

    window.addEventListener('scroll', () => {
        if (!ticking) {
            requestAnimationFrame(update);
            ticking = true;
        }
    }, { passive: true });
}

// ===== 24. Section 之间的扫描线分隔（进入视口时扫过）=====
function initSectionDividers() {
    const sections = document.querySelectorAll('section[id]');
    sections.forEach(section => {
        const divider = document.createElement('div');
        divider.className = 'section-divider';
        const line = document.createElement('div');
        line.className = 'section-divider-line';
        divider.appendChild(line);
        section.insertBefore(divider, section.firstChild);
    });

    const io = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('scanned');
                io.unobserve(entry.target);
            }
        });
    }, { threshold: 0.15 });
    document.querySelectorAll('.section-divider').forEach(d => io.observe(d));
}

// ===== 25. Hero 标题打字机（单条标语）=====
function initHeroTypewriterLoop() {
    const title = document.querySelector('.hero-title');
    if (!title) return;

    const fullText = '在项目中成长，于竞赛中蜕变';
    const target = title.querySelector('.typewriter-loop-text');
    if (!target) return;

    target.textContent = '';
    let charIndex = 0;

    function tick() {
        if (charIndex <= fullText.length) {
            target.textContent = fullText.slice(0, charIndex);
            charIndex++;
            setTimeout(tick, 95);
        }
    }
    setTimeout(tick, 400);
}

// ===== 26. 右侧滚动指示器（当前 section 高亮）=====
function initScrollSpy() {
    const sections = Array.from(document.querySelectorAll('section[id]'));
    if (!sections.length) return;

    const indicator = document.createElement('div');
    indicator.className = 'scroll-spy';
    indicator.innerHTML = sections.map((s, i) =>
        `<a href="#${s.id}" class="scroll-spy-dot" data-target="${s.id}" title="${s.id}"></a>`
    ).join('');
    document.body.appendChild(indicator);

    const dots = indicator.querySelectorAll('.scroll-spy-dot');

    function update() {
        const scrollY = window.scrollY + 200;
        let activeIdx = 0;
        sections.forEach((s, i) => {
            if (scrollY >= s.offsetTop) activeIdx = i;
        });
        dots.forEach((d, i) => d.classList.toggle('active', i === activeIdx));
    }
    window.addEventListener('scroll', update, { passive: true });
    update();

    // 点击平滑滚动
    dots.forEach(d => {
        d.addEventListener('click', (e) => {
            e.preventDefault();
            const target = document.getElementById(d.dataset.target);
            if (target) target.scrollIntoView({ behavior: 'smooth' });
        });
    });
}

// ===== 27. 触摸涟漪（手机端点击扩散光环）=====
(function initTouchRipple() {
    if (!('ontouchstart' in window)) return;
    document.addEventListener('touchstart', (e) => {
        for (const touch of e.touches) {
            const ripple = document.createElement('div');
            ripple.className = 'touch-ripple';
            ripple.style.left = touch.clientX + 'px';
            ripple.style.top = touch.clientY + 'px';
            document.body.appendChild(ripple);
            setTimeout(() => ripple.remove(), 900);
        }
    }, { passive: true });
})();

// ===== 28. 触摸按压反馈（按钮/卡片按压感+蓝色光晕）=====
(function initTouchPress() {
    if (!('ontouchstart' in window)) return;
    const targets = document.querySelectorAll('.btn, .group-card, .award-card, .nav-link, .research-card');
    targets.forEach(el => {
        el.addEventListener('touchstart', () => el.classList.add('touch-pressed'), { passive: true });
        el.addEventListener('touchend', () => {
            el.classList.remove('touch-pressed');
            setTimeout(() => el.classList.remove('touch-pressed'), 200);
        }, { passive: true });
        el.addEventListener('touchcancel', () => el.classList.remove('touch-pressed'), { passive: true });
    });
})();

// ===== 29. 触摸拖动光迹（手指滑动留下柔和蓝色光迹）=====
(function initTouchTrail() {
    if (!('ontouchstart' in window)) return;
    let lastTime = 0;
    document.addEventListener('touchmove', (e) => {
        const now = Date.now();
        if (now - lastTime < 40) return;
        lastTime = now;
        for (const touch of e.touches) {
            const dot = document.createElement('div');
            dot.className = 'touch-trail';
            dot.style.left = touch.clientX + 'px';
            dot.style.top = touch.clientY + 'px';
            document.body.appendChild(dot);
            setTimeout(() => dot.remove(), 700);
        }
    }, { passive: true });
})();

// ===== 30. 触摸卡片3D倾斜（手指在卡片上滑动，卡片3D跟随倾斜）=====
(function initTouchTilt() {
    if (!('ontouchstart' in window)) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const cards = document.querySelectorAll('.group-card, .award-card, .research-card, .hero-card');
    cards.forEach(card => {
        card.style.transition = 'transform 0.4s cubic-bezier(0.16, 1, 0.3, 1)';
        card.addEventListener('touchmove', (e) => {
            const touch = e.touches[0];
            const rect = card.getBoundingClientRect();
            const x = (touch.clientX - rect.left) / rect.width;
            const y = (touch.clientY - rect.top) / rect.height;
            if (x < 0 || x > 1 || y < 0 || y > 1) return;
            const rotateX = (y - 0.5) * -12;
            const rotateY = (x - 0.5) * 12;
            card.style.transform = `perspective(800px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(1.02)`;
        }, { passive: true });
        card.addEventListener('touchend', () => {
            card.style.transform = '';
        }, { passive: true });
        card.addEventListener('touchcancel', () => {
            card.style.transform = '';
        }, { passive: true });
    });
})();

// ===== 18. 组别详情切换（科技感丝滑过渡）=====
(function initGroupDetail() {
    const overlay  = document.getElementById('groupDetailOverlay');
    if (!overlay) return;

    const items        = document.querySelectorAll('.gallery-item[data-group]');
    const panel        = overlay.querySelector('.detail-panel');
    const scanLine     = overlay.querySelector('.scan-line');
    const scanLineRev  = overlay.querySelector('.scan-line-reverse');
    const backdrop     = overlay.querySelector('.detail-backdrop');
    const closeBtn     = document.getElementById('detailClose');
    const dsbText      = document.getElementById('dsbText');

    // 详情数据填充节点
    const tagEl        = document.getElementById('detailTag');
    const codeEl       = document.getElementById('detailCode');
    const titleEl      = document.getElementById('detailTitle');
    const subtitleEl   = document.getElementById('detailSubtitle');
    const descEl       = document.getElementById('detailDesc');
    const techGridEl   = document.getElementById('detailTechGrid');
    const skillsEl     = document.getElementById('detailSkills');
    const projectsEl   = document.getElementById('detailProjects');

    if (!items.length || !panel || !closeBtn) return;

    /* ==========================================================
       5 个组别的详细介绍数据
       ========================================================== */
    const GROUP_DATA = {
        frontend: {
            tag: 'FRONTEND',
            code: '// 0x01',
            title: '前端组',
            subtitle: 'Frontend Development Group',
            statusText: 'GROUP_DETAIL // FRONTEND_MODULE_LOADED',
            desc: '前端组负责实验室所有 Web 与客户端界面的开发工作，覆盖从设计稿到上线全流程。我们追求像素级的视觉还原、丝滑的交互动效，以及极致的性能体验。组内成员均熟悉现代前端工程化体系，并具备扎实的设计审美。',
            techStack: ['HTML5', 'CSS3', 'JavaScript', 'TypeScript', 'React', 'Vue 3', 'Next.js', 'TailwindCSS', 'Vite', 'Git'],
            skills: [
                { name: 'HTML/CSS', value: 95 },
                { name: 'JavaScript', value: 90 },
                { name: 'React/Vue', value: 88 },
                { name: '响应式布局', value: 92 },
                { name: '动效/可视化', value: 85 }
            ],
            projects: [
                { name: '实验室官网',  desc: '响应式品牌站点，含招新报名系统' },
                { name: '数据可视化大屏', desc: '基于 ECharts + WebSocket 的实时监控面板' },
                { name: '后台管理系统', desc: 'React + Ant Design Pro 中后台解决方案' }
            ]
        },
        backend: {
            tag: 'BACKEND',
            code: '// 0x02',
            title: '后台组',
            subtitle: 'Backend & Infrastructure Group',
            statusText: 'GROUP_DETAIL // BACKEND_MODULE_LOADED',
            desc: '后台组承担实验室所有服务端开发与基础架构工作，负责设计高可用、高并发的服务架构，处理数据库设计与性能优化。我们关注代码可维护性、服务稳定性，并实践 DevOps 全流程。',
            techStack: ['Java', 'Spring Boot', 'Node.js', 'Python', 'MySQL', 'Redis', 'Docker', 'Kubernetes', 'Nginx', 'Linux'],
            skills: [
                { name: '服务端开发', value: 90 },
                { name: '数据库设计', value: 88 },
                { name: '系统架构',   value: 85 },
                { name: 'Docker/K8s', value: 82 },
                { name: '性能优化',   value: 86 }
            ],
            projects: [
                { name: '统一鉴权服务', desc: 'JWT + OAuth2 的多端 SSO 单点登录' },
                { name: '分布式任务调度', desc: '基于 Redis + Quartz 的集群任务系统' },
                { name: '对象存储服务', desc: 'MinIO 二次封装，支持分片上传' }
            ]
        },
        multimedia: {
            tag: 'MULTIMEDIA',
            code: '// 0x03',
            title: '多媒体组',
            subtitle: 'Multimedia & Motion Design Group',
            statusText: 'GROUP_DETAIL // MULTIMEDIA_MODULE_LOADED',
            desc: '多媒体组负责实验室所有视频内容的策划、拍摄与后期制作，涵盖宣传短片、活动纪录、产品演示与课程教程。我们擅长用镜头语言讲好实验室的故事，并融合动效设计提升视觉表现力。',
            techStack: ['Premiere Pro', 'After Effects', 'DaVinci', 'Cinema 4D', 'Photoshop', 'Illustrator', 'Audition', 'OBS'],
            skills: [
                { name: '视频剪辑',   value: 92 },
                { name: '动效制作',   value: 85 },
                { name: '调色',       value: 80 },
                { name: '三维动画',   value: 75 },
                { name: '音频处理',   value: 78 }
            ],
            projects: [
                { name: '实验室招新片', desc: '年度招新宣传片，含航拍与动效包装' },
                { name: '活动回顾视频', desc: '重大活动现场纪录与快剪输出' },
                { name: '产品演示视频', desc: '配合研发组输出软件功能演示动画' }
            ]
        },
        graphic: {
            tag: 'GRAPHIC',
            code: '// 0x04',
            title: '平面设计组',
            subtitle: 'Graphic & Visual Design Group',
            statusText: 'GROUP_DETAIL // GRAPHIC_MODULE_LOADED',
            desc: '平面设计组负责实验室全部视觉物料的设计工作，从品牌 Logo、海报、易拉宝，到 UI 界面、图标、字体设计。我们建立了实验室统一的视觉规范，并用设计驱动品牌价值的传播。',
            techStack: ['Photoshop', 'Illustrator', 'Figma', 'Sketch', 'CorelDRAW', 'InDesign', 'After Effects'],
            skills: [
                { name: '品牌设计',   value: 90 },
                { name: '海报/物料',  value: 92 },
                { name: 'UI 设计',   value: 88 },
                { name: '插画/图标', value: 85 },
                { name: '排版',       value: 90 }
            ],
            projects: [
                { name: '实验室VI手册', desc: 'Logo + 字体 + 配色 + 应用规范的完整品牌系统' },
                { name: '招新物料包', desc: '海报、易拉宝、传单、社交媒体封面统一输出' },
                { name: '产品 UI Kit', desc: '设计系统组件库，支撑前后端快速开发' }
            ]
        },
        '3d': {
            tag: '3D MODELING',
            code: '// 0x05',
            title: '3D建模组',
            subtitle: '3D Modeling & Scene Design Group',
            statusText: 'GROUP_DETAIL // 3D_MODEL_MODULE_LOADED',
            desc: '3D 建模组专注于三维建模、材质贴图、灯光渲染与场景设计。我们用三维内容赋能游戏、虚拟展厅、产品演示、影视片头等多个方向，并积极探索实时渲染与元宇宙相关技术。',
            techStack: ['Blender', 'Maya', '3ds Max', 'ZBrush', 'Substance Painter', 'Unreal Engine', 'Unity', 'Houdini'],
            skills: [
                { name: '多边形建模', value: 90 },
                { name: '材质贴图',   value: 85 },
                { name: '灯光渲染',   value: 82 },
                { name: '数字雕刻',   value: 78 },
                { name: '实时渲染',   value: 80 }
            ],
            projects: [
                { name: '虚拟实验室展厅', desc: '基于 Unreal Engine 的沉浸式线上展厅' },
                { name: '产品三维演示', desc: '可旋转、可拆解的产品 3D 交互演示' },
                { name: '影视片头动画', desc: '为多媒体组视频提供三维片头与转场' }
            ]
        }
    };

    /* ==========================================================
       状态机
       ========================================================== */
    let activeCard = null;
    let isAnimating = false;

    /* ==========================================================
       填充详情数据
       ========================================================== */
    function fillDetail(data) {
        if (!data) return;
        tagEl.textContent      = data.tag;
        codeEl.textContent     = data.code;
        titleEl.textContent    = data.title;
        subtitleEl.textContent = data.subtitle;
        descEl.textContent     = data.desc;
        dsbText.textContent    = data.statusText;

        // 技术栈
        techGridEl.innerHTML = '';
        data.techStack.forEach((tech, i) => {
            const el = document.createElement('div');
            el.className = 'tech-pill';
            el.textContent = tech;
            el.style.animation = `techPillIn 0.4s cubic-bezier(0.16,1,0.3,1) ${0.6 + i * 0.04}s both`;
            techGridEl.appendChild(el);
        });

        // 技能进度条（先清零，再加 fill）
        skillsEl.innerHTML = '';
        data.skills.forEach((s, i) => {
            const item = document.createElement('div');
            item.className = 'skill-item';
            item.innerHTML = `
                <span class="skill-name">${s.name}</span>
                <div class="skill-bar"><div class="skill-fill" data-target="${s.value}"></div></div>
                <span class="skill-value">${s.value}%</span>
            `;
            skillsEl.appendChild(item);
            // 触发延迟填充
            requestAnimationFrame(() => {
                setTimeout(() => {
                    const fill = item.querySelector('.skill-fill');
                    fill.style.width = s.value + '%';
                }, 700 + i * 100);
            });
        });

        // 项目卡片
        projectsEl.innerHTML = '';
        data.projects.forEach((p, i) => {
            const el = document.createElement('div');
            el.className = 'project-card';
            el.innerHTML = `
                <div class="project-name">${p.name}</div>
                <div class="project-desc">${p.desc}</div>
            `;
            el.style.animation = `projectCardIn 0.5s cubic-bezier(0.16,1,0.3,1) ${0.85 + i * 0.08}s both`;
            projectsEl.appendChild(el);
        });
    }

    /* ==========================================================
       打开详情 - 触发4阶段过渡动画
       ========================================================== */
    function openDetail(group, card) {
        if (isAnimating || overlay.classList.contains('active')) return;
        const data = GROUP_DATA[group];
        if (!data) return;

        isAnimating = true;
        activeCard = card;

        // 1) 填充数据
        fillDetail(data);

        // 2) 原卡片"被吸入"
        if (card) {
            card.classList.add('card-zoom-in');
        }

        // 3) 显示 overlay
        overlay.classList.add('active');
        overlay.setAttribute('aria-hidden', 'false');
        document.body.style.overflow = 'hidden';

        // 4) 触发扫描线动画（重置 + 重播）
        scanLine.classList.remove('scanning');
        // 强制 reflow，保证重置生效
        void scanLine.offsetWidth;
        scanLine.classList.add('scanning');

        // 5) 动画结束后释放锁
        setTimeout(() => {
            isAnimating = false;
        }, 1300);
    }

    /* ==========================================================
       关闭详情 - 反向动画
       ========================================================== */
    function closeDetail() {
        if (isAnimating || !overlay.classList.contains('active')) return;
        isAnimating = true;

        // 1) 详情面板淡出
        panel.style.transitionDelay = '0s';
        overlay.classList.remove('active');

        // 2) 反向扫描线
        scanLine.classList.remove('scanning');
        void scanLine.offsetWidth;
        scanLineRev.classList.add('scanning');

        // 3) 等 700ms 后清理
        setTimeout(() => {
            overlay.setAttribute('aria-hidden', 'true');
            document.body.style.overflow = '';
            scanLineRev.classList.remove('scanning');
            if (activeCard) {
                activeCard.classList.remove('card-zoom-in');
                activeCard = null;
            }
            // 重置进度条填充，方便下次重新触发
            skillsEl.querySelectorAll('.skill-fill').forEach(f => {
                f.style.width = '0';
            });
            isAnimating = false;
        }, 750);
    }

    /* ==========================================================
       事件绑定
       ========================================================== */
    items.forEach(item => {
        const group = item.dataset.group;
        // 点击
        item.addEventListener('click', (e) => {
            // 避免子元素（如 link）的冒泡触发
            if (e.target.closest('a, button')) return;
            openDetail(group, item);
        });
        // 键盘可访问
        item.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                openDetail(group, item);
            }
        });
    });

    // 关闭：按钮 / 背景 / Esc
    closeBtn.addEventListener('click', closeDetail);
    closeBtn.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            closeDetail();
        }
    });
    backdrop.addEventListener('click', closeDetail);
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && overlay.classList.contains('active')) {
            closeDetail();
        }
    });

    // 暴露给全局调试（可选）
    window.__groupDetail = { open: openDetail, close: closeDetail, data: GROUP_DATA };
})();

/* 动态注入 tech-pill / project-card 的入场关键帧 */
(function injectDetailKeyframes() {
    const css = `
@keyframes techPillIn {
    0%   { opacity: 0; transform: translateY(10px) scale(0.9); }
    100% { opacity: 1; transform: translateY(0) scale(1); }
}
@keyframes projectCardIn {
    0%   { opacity: 0; transform: translateX(-12px); }
    100% { opacity: 1; transform: translateX(0); }
}
`;
    const style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);
})();


// ===== 多页路由：基于 URL ?page= 的单页切换 =====
function initPageRouter() {
    const PAGE_IDS = ['index', 'about', 'research', 'awards', 'groups', 'teachers', 'join'];
    const DEFAULT_PAGE = 'index';
    const pageSections = {};
    PAGE_IDS.forEach(id => { pageSections[id] = document.getElementById('page-' + id); });

    function getPageFromUrl() {
        const search = location.search || '';
        const m = search.match(/[?&]page=([a-zA-Z0-9_-]+)/);
        if (!m) return DEFAULT_PAGE;
        const p = (m[1] || '').toLowerCase();
        if (PAGE_IDS.includes(p)) return p;
        // 兼容旧锚点的情况：如果用户输入了旧锚点 id
        const oldMap = { 'home': 'index', 'about':'about', 'research':'research', 'awards':'awards', 'gallery':'groups', 'join':'join' };
        if (oldMap[p]) return oldMap[p];
        return DEFAULT_PAGE;
    }

    function setActiveNav(page) {
        const navLinks = document.querySelectorAll('.nav-link');
        navLinks.forEach(l => {
            const dp = l.getAttribute('data-page');
            if (dp === page) l.classList.add('active');
            else l.classList.remove('active');
        });
    }

    // 创建或获取过渡遮罩
    let overlay = document.querySelector('.page-transition-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.className = 'page-transition-overlay';
        overlay.setAttribute('aria-hidden', 'true');
        overlay.innerHTML = `
            <div class="pto-grid"></div>
            <div class="pto-ring"></div>
            <div class="pto-cross"></div>
            <span class="pto-corner tl"></span><span class="pto-corner tr"></span>
            <span class="pto-corner bl"></span><span class="pto-corner br"></span>
            <div class="pto-status">
                <span class="pto-led"></span>
                <span>SWITCHING MODULE</span>
                <span class="pto-dots"><span>.</span><span>.</span><span>.</span></span>
            </div>`;
        document.body.appendChild(overlay);
    }

    let isFirstLoad = true;
    let currentPage = null;
    let isAnimating = false;
    const SWEEP_MS = 700;     // 遮罩总时长（圆形扩散+收缩）
    const MID_MS = 330;       // 遮罩盖住全屏的时刻（在此切换页面）

    function updateUrl(page, pushState) {
        if (!pushState) return;
        const q = page === DEFAULT_PAGE ? location.pathname : `${location.pathname}?page=${page}`;
        try { history.replaceState({ page }, '', q); } catch(_) {}
    }

    // 真正执行页面切换（隐藏其它、显示目标、动画/URL/active 等）
    function doPageSwitch(page, pushState) {
        // 1) 隐藏其它
        PAGE_IDS.forEach(id => {
            const el = pageSections[id];
            if (!el || id === page) return;
            el.classList.remove('page-visible', 'page-in', 'page-out');
            el.style.display = 'none';
        });

        // 2) 显示目标
        const target = pageSections[page];
        if (target) {
            target.style.display = '';
            target.classList.remove('page-in', 'page-out');
            void target.offsetHeight;
            target.classList.add('page-visible');
            // 遮罩盖住时设置目标为"待入场"状态，遮罩滑出时再触发 page-in
            setTimeout(() => target.classList.add('page-in'), 30);
        }

        // 3) 导航 active
        setActiveNav(page);

        // 4) 更新 URL
        updateUrl(page, pushState);

        // 5) 回到顶部
        try { window.scrollTo({ top: 0, behavior: 'auto' }); } catch(_) {}

        // 6) 触发入场动画
        try {
            const reveals = (target || document).querySelectorAll('.reveal');
            reveals.forEach(el => {
                el.style.visibility = 'visible';
                el.classList.add('revealed');
            });
        } catch(_) {}

        // 7) 刷新数字动画
        try {
            const nums = (target || document).querySelectorAll('[data-count], .award-summary-num, .hero-stat-num');
            nums.forEach(el => {
                el.style.animation = 'none';
                void el.offsetHeight;
                el.style.animation = '';
            });
        } catch(_) {}
    }

    function showPage(page, pushState) {
        page = page || DEFAULT_PAGE;
        if (!PAGE_IDS.includes(page)) page = DEFAULT_PAGE;

        // 同页点击：仅同步 URL/active，不播动画
        if (!isFirstLoad && currentPage === page) {
            setActiveNav(page);
            updateUrl(page, pushState);
            return;
        }
        // 动画进行中：忽略
        if (isAnimating) return;

        // 首次加载 / 无遮罩：直接显示，不带过渡
        if (isFirstLoad || !overlay) {
            doPageSwitch(page, pushState);
            isFirstLoad = false;
            currentPage = page;
            return;
        }

        isAnimating = true;
        const oldEl = currentPage ? pageSections[currentPage] : null;

        // 1) 启动遮罩入场 + 旧页面退出动画（同时进行）
        overlay.classList.remove('active');
        void overlay.offsetWidth;
        overlay.classList.add('active');
        if (oldEl) {
            oldEl.classList.remove('page-in');
            oldEl.classList.add('page-out');
        }

        // 2) 遮罩盖住全屏的时刻：执行真正的页面切换
        setTimeout(() => {
            if (oldEl) {
                oldEl.classList.remove('page-visible', 'page-out');
                oldEl.style.display = 'none';
            }
            doPageSwitch(page, pushState);
        }, MID_MS);

        // 3) 遮罩动画完成后清理
        setTimeout(() => {
            overlay.classList.remove('active');
            isAnimating = false;
        }, SWEEP_MS + 40);

        currentPage = page;
    }

    // 点击 <a href="?page=xx">：不重新加载，用前端切换
    function bindPageLinks() {
        const links = document.querySelectorAll('a[href*="?page="]');
        links.forEach(a => {
            a.addEventListener('click', function(e) {
                const href = this.getAttribute('href') || '';
                const m = href.match(/page=([a-zA-Z0-9_-]+)/);
                if (!m) return;
                e.preventDefault();
                const p = (m[1] || '').toLowerCase();
                showPage(PAGE_IDS.includes(p) ? p : DEFAULT_PAGE, true);
                // 关闭移动端菜单
                try {
                    const nt = document.getElementById('navToggle');
                    const nm = document.getElementById('navMenu');
                    if (nt) nt.classList.remove('active');
                    if (nm) nm.classList.remove('active');
                } catch(_) {}
            });
        });
    }

    bindPageLinks();
    window.addEventListener('popstate', () => showPage(getPageFromUrl(), false));
    showPage(getPageFromUrl(), true);
}
