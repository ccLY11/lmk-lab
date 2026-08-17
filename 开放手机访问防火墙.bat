@echo off
chcp 65001 >nul
title LMK实验室 - 开放手机访问防火墙规则

:: 检查管理员权限
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo ============================================
    echo  需要管理员权限来修改防火墙
    echo  正在自动请求提权，请在弹出的窗口点"是"
    echo ============================================
    timeout /t 2 >nul
    powershell -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
    exit /b
)

:: 已是管理员
echo ============================================
echo  正在添加防火墙入站规则: 端口 8765
echo ============================================

netsh advfirewall firewall delete rule name="LMK_Web_8765" >nul 2>&1
netsh advfirewall firewall add rule name="LMK_Web_8765" dir=in action=allow protocol=TCP localport=8765

if %errorlevel% equ 0 (
    echo.
    echo  [成功] 防火墙规则已添加！
    echo.
    echo  ============================================
    echo   手机访问地址:
    echo.
    echo   前台:  http://192.168.1.121:8765/
    echo   后台:  http://192.168.1.121:8765/#admin
    echo   账号: admin  密码: lmk2026
    echo  ============================================
    echo.
    echo  请确保:
    echo   1. 手机和电脑连同一个WiFi
    echo   2. 电脑上的服务器还在运行
) else (
    echo  [失败] 添加防火墙规则时出错
)

echo.
pause
