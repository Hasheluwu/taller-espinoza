from pathlib import Path
import re, xml.etree.ElementTree as E

ROOT=Path(__file__).resolve().parent
APP=ROOT.parent/'taller-espinoza-main'
sql=(APP/'taller_espinoza.sql').read_text(encoding='utf-8')+'\n'+(APP/'backend/migrations/001_sessions.sql').read_text(encoding='utf-8')
migration=(APP/'backend/src/services/migrate.js').read_text(encoding='utf-8')
sql+='\n'+'\n'.join(re.findall(r'`(CREATE TABLE.*?)`',migration))
names={
'usuario':'Usuario','cliente':'Cliente','vehiculo':'Vehiculo','proveedor':'Proveedor','inventario':'Material','compra_inventario':'CompraInventario','movimiento_inventario':'MovimientoInventario','repuesto_taller':'RepuestoTaller','personal':'Trabajador','presupuesto':'Presupuesto','presupuesto_detalle':'DetallePresupuesto','orden':'OrdenTrabajo','orden_servicio':'ServicioOrden','repuesto_cliente':'RepuestoCliente','orden_material':'ConsumoMaterial','orden_repuesto':'UsoRepuesto','orden_personal':'AsignacionTrabajo','orden_media':'AdjuntoOrden','orden_dano_oculto':'DanoOculto','pago_cliente':'PagoCliente','pago_seguro':'PagoSeguro','linker_lafise':'TramiteLafise','liquidacion_personal':'Liquidacion','liquidacion_detalle':'DetalleLiquidacion','auditoria':'Auditoria','sesion_usuario':'SesionUsuario','cita':'Cita','foto_orden':'FotoOrden','costo_orden':'CostoOrden','consumo_responsable':'ResponsableConsumo'}
methods={
'usuario':['autenticar()','verificarPermiso()'],'cliente':['registrar()','actualizar()'],'vehiculo':['registrar()','consultarHistorial()'],'proveedor':['registrar()','actualizar()'],'inventario':['validarDisponibilidad()','consultarMovimientos()'],'compra_inventario':['calcularTotal()','registrarEntrada()'],'movimiento_inventario':['registrar()'],'repuesto_taller':['validarStock()','actualizar()'],'personal':['consultarAsignaciones()'],'presupuesto':['calcularTotal()','cambiarEstado()'],'presupuesto_detalle':['calcularImporte()'],'orden':['cambiarEstado()','calcularTotal()','calcularSaldos()','actualizarEntregaEstimada()'],'orden_servicio':['calcularImporte()'],'repuesto_cliente':['registrar()','devolver()'],'orden_material':['registrarConsumo()','revertir()'],'orden_repuesto':['registrarUso()'],'orden_personal':['asignar()'],'orden_media':['consultarMetadatos()'],'orden_dano_oculto':['registrarReporte()'],'pago_cliente':['registrarAbono()','emitirRecibo()'],'pago_seguro':['corregirPendiente()','confirmarRecepcion()'],'linker_lafise':['consultarDatos()'],'liquidacion_personal':['preparar()','confirmarPago()'],'liquidacion_detalle':['consultarTrabajo()'],'auditoria':['registrarAccion()'],'sesion_usuario':['validar()','revocar()'],'cita':['programar()','cancelar()','completar()'],'foto_orden':['validarArchivo()','adjuntar()'],'costo_orden':['registrarCostos()','estimarGanancia()'],'consumo_responsable':['asignarResponsable()']}
groups=[('Atención',['cliente','vehiculo','cita','presupuesto','presupuesto_detalle']),('Reparaciones',['orden','orden_servicio','orden_dano_oculto','foto_orden','costo_orden','orden_media']),('Inventario',['proveedor','inventario','compra_inventario','movimiento_inventario','orden_material','consumo_responsable']),('Repuestos y cobros',['repuesto_taller','orden_repuesto','repuesto_cliente','pago_cliente','pago_seguro','linker_lafise']),('Personal',['personal','orden_personal','liquidacion_personal','liquidacion_detalle']),('Acceso y auditoría',['usuario','sesion_usuario','auditoria'])]

def split_fields(body):
    parts=[];start=0;level=0;quote=False
    for i,c in enumerate(body):
        if c=="'":quote=not quote
        if not quote:
            if c=='(':level+=1
            if c==')':level-=1
            if c==',' and level==0:parts.append(body[start:i].strip());start=i+1
    parts.append(body[start:].strip());return parts

classes={};relations=[]
for match in re.finditer(r'CREATE TABLE (?:IF NOT EXISTS )?(\w+)\s*\(',sql):
    key=match.group(1);start=match.end();level=1;i=start;quote=False
    while level:
        c=sql[i]
        if c=="'":quote=not quote
        if not quote:
            if c=='(':level+=1
            elif c==')':level-=1
        i+=1
    body=re.sub(r'--[^\n]*','',sql[start:i-1]);fields=split_fields(body);cols={};fks=[]
    for f in fields:
        fk=re.match(r'FOREIGN KEY\s*\((\w+)\)\s*REFERENCES\s+(\w+)',f,re.I)
        if fk:fks.append(fk.groups());continue
        col=re.match(r'(\w+)\s+(INT|CHAR|VARCHAR|TEXT|DATETIME|DATE|YEAR|DECIMAL|BOOLEAN|ENUM|MEDIUMBLOB)\b(.*)',f,re.I|re.S)
        if col:cols[col[1]]=(col[2],col[3])
    if key=='movimiento_inventario':fks.append(('id_orden','orden'))
    foreign={f[0] for f in fks};attrs=[]
    types={'INT':'int','CHAR':'string','VARCHAR':'string','TEXT':'string','DATETIME':'datetime','DATE':'date','YEAR':'int','DECIMAL':'decimal','BOOLEAN':'boolean','ENUM':'enum','MEDIUMBLOB':'bytes'}
    for col,(typ,rest) in cols.items():
        if col in foreign:continue
        attrs.append(f'- {col}: {types[typ]}')
    classes[key]=attrs
    for col,target in fks:
        rest=cols[col][1];parent_mult='1' if 'NOT NULL' in rest or 'PRIMARY KEY' in rest else '0..1'
        child_mult='0..1' if 'UNIQUE' in rest or 'PRIMARY KEY' in rest else '0..*'
        # Business rule: an assignment can be included in only one liquidation.
        if key=='liquidacion_detalle' and target=='orden_personal':child_mult='0..1'
        relations.append((target,key,parent_mult,child_mult,col))
assert len(classes)==30

doc=E.Element('mxfile',host='app.diagrams.net',type='device',version='24.7.17')
def page(name):
    d=E.SubElement(doc,'diagram',id='page'+str(len(doc)),name=name)
    model=E.SubElement(d,'mxGraphModel',dx='1800',dy='1000',grid='1',gridSize='10',guides='1',tooltips='1',connect='1',arrows='1',fold='1',page='0',pageScale='1',math='0',shadow='0')
    root=E.SubElement(model,'root');E.SubElement(root,'mxCell',id='0');E.SubElement(root,'mxCell',id='1',parent='0');return root
def vertex(root,id,value,x,y,w,h,style,parent='1'):
    c=E.SubElement(root,'mxCell',id=id,value=value,style=style,vertex='1',parent=parent)
    E.SubElement(c,'mxGeometry',x=str(x),y=str(y),width=str(w),height=str(h),attrib={'as':'geometry'});return c
base='fontFamily=Helvetica;fontSize=15;strokeColor=#244761;fillColor=#FFFFFF;'
def klass(root,key,x,y,compact=False,reference=False):
    attrs=classes[key] if not reference else []
    if compact and len(attrs)>6:attrs=attrs[:6]+['…']
    ops=[] if reference else ['+ '+v for v in methods[key]]
    header=names[key]
    if key in ['orden_media','linker_lafise']:header='«previsto»\n'+header
    if reference:header='«referencia»\n'+header
    hh=58 if '\n' in header else 36;ah=max(30,len(attrs)*22+14);mh=max(30,len(ops)*22+14);h=hh+ah+mh
    vertex(root,key,header,x,y,340,h,base+f'swimlane;startSize={hh};fontStyle=1;align=center;horizontal=1;collapsible=0;container=1;recursiveResize=0;fillColor='+('#E8EAED;' if reference else '#D9EAF7;'))
    vertex(root,key+'-attrs','\n'.join(attrs),0,hh,340,ah,base+'text;strokeColor=none;fillColor=#FFFFFF;align=left;verticalAlign=top;spacingLeft=10;spacingTop=7;',key)
    vertex(root,key+'-methods','\n'.join(ops),0,hh+ah,340,mh,base+'align=left;verticalAlign=top;spacingLeft=10;spacingTop=7;whiteSpace=wrap;',key)
    return h
def edge(root,r,index):
    a,b,ma,mb,label=r
    c=E.SubElement(root,'mxCell',id='edge'+str(index),value=label,edge='1',parent='1',source=a,target=b,style='edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=40;html=0;endArrow=none;startArrow=none;strokeColor=#47677F;strokeWidth=1.5;fontSize=11;fontColor=#526D80;labelBackgroundColor=#FFFFFF;')
    E.SubElement(c,'mxGeometry',relative='1',attrib={'as':'geometry'})
    for suffix,m,x in [('a',ma,-0.88),('b',mb,0.88)]:
        el=E.SubElement(root,'mxCell',id=f'edge{index}-{suffix}',value=m,vertex='1',connectable='0',parent=c.attrib['id'],style='edgeLabel;html=0;align=center;verticalAlign=middle;resizable=0;points=[];fontSize=14;fontStyle=1;labelBackgroundColor=#FFFFFF;')
        g=E.SubElement(el,'mxGeometry',x=str(x),y='-14',width='42',height='22',relative='1',attrib={'as':'geometry'});E.SubElement(g,'mxPoint',x='0',y='0',attrib={'as':'offset'})

root=page('00 · Modelo completo')
for gi,(label,keys) in enumerate(groups):
    gx=(gi%3)*1100;gy=(gi//3)*1430
    vertex(root,'group'+str(gi),label.upper(),gx,gy,1000,42,'text;html=0;fontSize=27;fontStyle=1;fontColor=#16364D;align=left;')
    y=gy+90
    for j in range(0,len(keys),2):
        hs=[]
        for k,key in enumerate(keys[j:j+2]):hs.append(klass(root,key,gx+k*530,y,compact=True))
        y+=max(hs)+125
for i,r in enumerate(relations):edge(root,r,i)

for gi,(label,keys) in enumerate(groups):
    root=page(f'{gi+1:02d} · {label}')
    local=[r for r in relations if r[1] in keys]
    refs=sorted({r[0] for r in local if r[0] not in keys})
    y=50
    for j in range(0,len(keys),3):
        hs=[]
        for k,key in enumerate(keys[j:j+3]):hs.append(klass(root,key,60+k*560,y))
        y+=max(hs)+170
    if refs:
        y+=40
        for j in range(0,len(refs),3):
            hs=[]
            for k,key in enumerate(refs[j:j+3]):hs.append(klass(root,key,60+k*560,y,reference=True))
            y+=max(hs)+100
    for i,r in enumerate(local):edge(root,r,i)

out=ROOT/'Modelo_Objetos_Taller_Espinoza.drawio'
E.indent(doc,space='  ');E.ElementTree(doc).write(out,encoding='utf-8',xml_declaration=True)
check=E.parse(out)
for diagram in check.getroot():
    cells=diagram.findall('./mxGraphModel/root/mxCell');ids=[c.get('id') for c in cells];assert len(ids)==len(set(ids))
    for c in cells:
        if c.get('edge')=='1':assert c.get('source') in ids and c.get('target') in ids
assert len(check.getroot())==7
print(f'{out}\n30 clases; {len(relations)} relaciones; 7 páginas; XML verificado.')
