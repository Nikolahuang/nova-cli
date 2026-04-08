#!/usr/bin/env python3
"""
可爱炸弹人游戏服务器
Cute Bomberman Game Server
"""

import http.server
import socketserver
import webbrowser
import os
import sys
from pathlib import Path

# 配置
PORT = 8080
DIRECTORY = Path(__file__).parent.absolute()

class GameHandler(http.server.SimpleHTTPRequestHandler):
    """自定义请求处理器"""
    
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(DIRECTORY), **kwargs)
    
    def end_headers(self):
        # 添加CORS和缓存控制头
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        self.send_header('Access-Control-Allow-Origin', '*')
        super().end_headers()
    
    def log_message(self, format, *args):
        # 美化日志输出
        print(f"[🎮 服务器] {args[0]}")


def main():
    """启动游戏服务器"""
    
    # 切换到游戏目录
    os.chdir(DIRECTORY)
    
    # 创建服务器
    with socketserver.TCPServer(("", PORT), GameHandler) as httpd:
        url = f"http://localhost:{PORT}/game.html"
        
        print("\n" + "="*50)
        print("  💣 可爱炸弹人游戏服务器启动成功! 💣")
        print("="*50)
        print(f"\n  🌐 游戏地址: {url}")
        print(f"  📁 游戏目录: {DIRECTORY}")
        print("\n  🎮 游戏操作说明:")
        print("     方向键/WASD - 移动角色")
        print("     空格键      - 放置炸弹")
        print("     消灭所有敌人即可过关!")
        print("\n  按 Ctrl+C 停止服务器")
        print("="*50 + "\n")
        
        # 自动打开浏览器
        try:
            webbrowser.open(url)
            print("[🎮 服务器] 浏览器已自动打开游戏页面")
        except Exception as e:
            print(f"[⚠️ 警告] 无法自动打开浏览器: {e}")
            print(f"[💡 提示] 请手动访问: {url}")
        
        # 启动服务器
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n\n[🎮 服务器] 服务器已停止，感谢游玩!")
            sys.exit(0)


if __name__ == "__main__":
    main()