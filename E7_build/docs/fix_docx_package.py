import zipfile,sys
src,dst=sys.argv[1],sys.argv[2]
zin=zipfile.ZipFile(src); zout=zipfile.ZipFile(dst,'w',zipfile.ZIP_DEFLATED)
for it in zin.infolist():
    data=zin.read(it.filename)
    if it.filename=='word/_rels/document.xml.rels':
        s=data.decode('utf-8')
        if 'fontTable' not in s:
            s=s.replace('</Relationships>','<Relationship Id="rId8" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/fontTable" Target="fontTable.xml"/></Relationships>')
        data=s.encode('utf-8')
    zout.writestr(it,data)
zout.close()
