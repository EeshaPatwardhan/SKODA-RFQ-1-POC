# Technical Change reference document

Technical_Change_Dashboards_Reference.docx (project root) is generated from make_tc_reference_doc.js.

Update it whenever a Technical Change dashboard, KPI card, visual, rule or glossary term changes:

1. Edit the content in make_tc_reference_doc.js and add a row to Appendix D (revision history).
2. node make_tc_reference_doc.js out.docx   (needs the docx npm package)
3. python fix_docx_package.py out.docx ../Technical_Change_Dashboards_Reference.docx   (adds the font-table relationship the docx library omits)
