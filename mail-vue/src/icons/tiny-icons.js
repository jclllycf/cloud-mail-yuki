import registry from '@/assets/icons/warm-letter/registry.json'

// Only glyphs change. TinyMCE retains its toolbar, plugins, dialogs and commands.
// Native toolbar + enabled link/image/lists/table/code/preview/fullscreen controls.
export const tinyIconNames = {
  bold:'bold', italic:'italic', underline:'underline', 'strike-through':'strike',
  subscript:'subscript', superscript:'superscript',
  'align-left':'align-left', 'align-center':'align-center', 'align-right':'align-right',
  'align-justify':'align-justify', 'align-none':'align-left',
  indent:'indent', outdent:'outdent', 'unordered-list':'list', 'ordered-list':'ordered-list',
  link:'link', unlink:'unlink', image:'image', 'image-options':'image', 'edit-image':'edit',
  table:'table', sourcecode:'code', 'code-sample':'code', preview:'eye', fullscreen:'fullscreen',
  emoji:'emoji', emoticons:'emoji', 'text-color':'text-color', 'color-levels':'highlight',
  'color-picker':'palette', 'color-swatch':'palette', 'color-swatch-remove-color':'close',
  'highlight-bg-color':'highlight', fontsize:'text-size',
  'chevron-down':'chevron', 'chevron-up':'chevron-up', 'chevron-left':'chevron-left',
  'chevron-right':'chevron-right', close:'close', cancel:'close', checkmark:'check', selected:'check',
  browse:'folder', upload:'upload', warning:'warning', info:'info', help:'help',
  undo:'undo', redo:'redo', copy:'copy', cut:'cut', paste:'paste', plus:'plus', minus:'minus',
  remove:'delete', search:'search', settings:'settings', preferences:'settings',
  'table-merge-cells':'table-merge', 'table-split-cells':'table-split',
  'table-insert-column-before':'insert-column-before', 'table-insert-column-after':'insert-column-after',
  'table-insert-row-above':'insert-row-before', 'table-insert-row-after':'insert-row-after',
  'table-delete-table':'delete', 'table-delete-column':'columns', 'table-delete-row':'rows',
  'table-cell-properties':'table-properties', 'table-row-properties':'table-properties',
  'table-cell-select-all':'table', 'table-cell-select-inner':'table',
  'table-cell-classes':'table-properties', 'table-classes':'table-properties',
  'table-caption':'paragraph', 'table-top-header':'rows', 'table-left-header':'columns',
  'table-row-numbering':'ordered-list', 'table-row-numbering-rtl':'ordered-list',
  'cell-background-color':'highlight', 'cell-border-color':'palette',
  'border-style':'minus', 'border-width':'minus', 'vertical-align':'align-middle',
  'list-bull-circle':'list', 'list-bull-default':'list', 'list-bull-disc':'list', 'list-bull-square':'list',
  'list-num-default':'ordered-list', 'list-num-lower-alpha':'ordered-list',
  'list-num-lower-greek':'ordered-list', 'list-num-lower-roman':'ordered-list',
  'list-num-upper-alpha':'ordered-list', 'list-num-upper-roman':'ordered-list',
}

export function installTinyIcons(editor) {
  for (const [name, semantic] of Object.entries(tinyIconNames)) {
    const glyph = registry[semantic]
    if (!glyph) throw new Error(`[Warm Letter] Missing editor SVG: ${semantic}`)
    editor.ui.registry.addIcon(name, `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" style="fill:none;stroke:currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${glyph.body}</svg>`)
  }
}
