import os

def process_file(filepath):
    if not os.path.exists(filepath): return
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    old = content
    
    # Make it incredibly glassy
    content = content.replace('bg-white/5 ', 'bg-white/60 ')
    content = content.replace('bg-white/5"', 'bg-white/60"')
    content = content.replace('bg-black/20', 'bg-white/50')
    content = content.replace('bg-black/40', 'bg-white/70')
    content = content.replace('border-white/5 ', 'border-white/70 ')
    content = content.replace('border-white/5"', 'border-white/70"')
    content = content.replace('border-white/10', 'border-white/80')
    content = content.replace('backdrop-blur-xl', 'backdrop-blur-3xl')
    content = content.replace('backdrop-blur-2xl', 'backdrop-blur-3xl')
    content = content.replace('backdrop-blur-md', 'backdrop-blur-2xl')
    
    # Lighter green glow and shadows
    content = content.replace('bg-teal-500/10', 'bg-teal-100/80')
    content = content.replace('bg-teal-500/20', 'bg-teal-200/80')
    content = content.replace('from-teal-400/5', 'from-teal-100/50')
    content = content.replace('to-teal-600/5', 'to-teal-200/50')
    content = content.replace('bg-teal-900/50', 'bg-teal-100/60')
    content = content.replace('bg-teal-800/50', 'bg-teal-200/60')
    content = content.replace('bg-cyan-950/60', 'bg-teal-50/80')
    content = content.replace('bg-[#134E4A]', 'bg-teal-100')
    content = content.replace('bg-[#0F766E]', 'bg-teal-300')
    
    # Text changes for readability on light glassy background
    content = content.replace('text-white', 'text-teal-950')
    content = content.replace('text-teal-100', 'text-teal-900')
    content = content.replace('text-teal-200', 'text-teal-800')
    content = content.replace('text-teal-300', 'text-teal-700')
    content = content.replace('text-teal-400', 'text-teal-600')
    content = content.replace('text-[#134E4A]', 'text-teal-800')
    
    if old != content:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f'Updated {filepath}')

base = r'c:\Design Project\dylaan\frontend\src\app'
for root, dirs, files in os.walk(base):
    for file in files:
        if file.endswith(('.tsx', '.ts')):
            process_file(os.path.join(root, file))

# Update globals.css
css_path = os.path.join(base, 'globals.css')
if os.path.exists(css_path):
    with open(css_path, 'r', encoding='utf-8') as f:
        css = f.read()
    css = css.replace('--background: #042F2E;', '--background: linear-gradient(135deg, #f0fdf4 0%, #ccfbf1 100%);')
    css = css.replace('--foreground: #F0FDFA;', '--foreground: #042F2E;')
    css = css.replace('--background: #F0FDFA;', '--background: linear-gradient(135deg, #f0fdf4 0%, #ccfbf1 100%);')
    css = css.replace('--foreground: #134E4A;', '--foreground: #042F2E;')
    
    with open(css_path, 'w', encoding='utf-8') as f:
        f.write(css)
    print('Updated globals.css')

print('Done.')
