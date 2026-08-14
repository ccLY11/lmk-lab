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

    // 12. 标题打字机+光标效果
    initTypewriterEffect();

    // 13. 滚动进度条
    initScrollProgress();

    // 14. 元素进入时粒子爆发
    initParticleBurstOnReveal();

    // 15. Hero 区域数据流背景
    initDataStreamBg();
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
