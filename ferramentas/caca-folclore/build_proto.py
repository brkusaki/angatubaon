import re,json
t=open('/home/claude/proto/template.html',encoding='utf-8').read()
old=open('/home/claude/proto/index.html',encoding='utf-8').read()
m=re.search(r"const D=(\{.*?\});\n",old,re.S)
D=m.group(1)
hw={'casa_amarela':[140,130,.5],'casa_azul':[140,130,.30],'casa_rosa':[143,130,.32],'mercearia':[133,130,.5]}
GRID=open('/home/claude/angatuba/rls.txt').read().strip()
out=t.replace('__GRID__',GRID).replace('__DATA__',D).replace('__HW__',json.dumps(hw))
open('/home/claude/proto/index.html','w',encoding='utf-8').write(out)
print(len(out))
