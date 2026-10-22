#!/usr/bin/env python3
# ============================================================
# 构建脚本：把 styles.css / data.js / app.js 打包进单文件 HTML
# 用法：修改 data.js（剧情文本）后运行  python3 build.py
# 会同时更新 index.html / standalone.html / wechat-game.html
# ============================================================
import base64, pathlib, shutil

pkg = pathlib.Path(__file__).resolve().parent
html = (pkg / 'index.html').read_text(encoding='utf-8')
data_js = (pkg / 'data.js').read_text(encoding='utf-8')
app_js = (pkg / 'app.js').read_text(encoding='utf-8')

# 头像内嵌为 base64，保证单文件分发时头像不缺失
for name in ['laqiya.jpg', 'shengzhen_candy.jpg', 'shengzhen_new.jpg']:
    raw = (pkg / 'assets' / name).read_bytes()
    uri = 'data:image/jpeg;base64,' + base64.b64encode(raw).decode('ascii')
    data_js = data_js.replace('assets/' + name, uri)
    app_js = app_js.replace('assets/' + name, uri)

# 按 <script> 块定位：第一个 script = 数据，第二个 = 逻辑
first_open = html.index('<script>')
first_close = html.index('</script>', first_open)
second_open = html.index('<script>', first_close)
second_close = html.index('</script>', second_open)

head = html[:first_open + len('<script>')]
tail = html[second_close:]

new_html = head + '\n' + data_js.rstrip() + '\n</script>\n<script>\n' + app_js.rstrip() + '\n' + tail

(pkg / 'index.html').write_text(new_html, encoding='utf-8')
# standalone.html 与 wechat-game.html 同步为同一份构建产物
shutil.copyfile(pkg / 'index.html', pkg / 'standalone.html')
shutil.copyfile(pkg / 'index.html', pkg / 'wechat-game.html')
print('built:', len(new_html), 'bytes -> index.html / standalone.html / wechat-game.html')
print('has assets/ refs:', 'assets/' in new_html)
