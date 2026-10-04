import fs from 'node:fs'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const iconDir = path.join(root,'src/assets/icons/warm-letter')
const registry = JSON.parse(fs.readFileSync(path.join(iconDir,'registry.json'),'utf8'))
const failures = [], usages = []
const check = (name, file, line) => {
  usages.push({name,file,line})
  if (!Object.hasOwn(registry,name)) failures.push({name,file,line,reason:'Missing registry name'})
}
const files = function* (dir) {for(const entry of fs.readdirSync(dir,{withFileTypes:true})) {const file=path.join(dir,entry.name); if(entry.isDirectory())yield* files(file);else if(/\.(vue|js)$/.test(file))yield file}}
const dynamic = {
 'src/layout/aside/index.vue':['item.icon'],
 'src/components/email-scroll/index.vue':['item.statusIcon.icon'],
 'src/views/login/index.vue':['p.icon'],
 'src/views/sys-setting/index.vue':['p.icon'],
 'src/views/user/index.vue':['oauthPlatform(props.row).icon'],
}
const spreads = {
 'src/layout/write/index.vue':['getIconByName(item.filename)'],
 'src/views/content/index.vue':['getIconByName(att.filename)'],
}
for(const file of files(path.join(root,'src'))) {
  const relative = path.relative(root,file).replaceAll('\\','/'), text=fs.readFileSync(file,'utf8')
  if(/@iconify|<(?:Icon|icon)\b/.test(text)) failures.push({file:relative,reason:'Legacy icon renderer/import'})
  for(const match of text.matchAll(/<LetterIcon\b([^>]+)>/g)) {
    const attrs=match[1], line=text.slice(0,match.index).split('\n').length
    const fixed=attrs.match(/(?<!:)\bname="([^"]+)"/)
    const bound=attrs.match(/:name="([^"]+)"/)
    const spread=attrs.match(/v-bind="([^"]+)"/)
    if(fixed)check(fixed[1],relative,line)
    else if(bound && dynamic[relative]?.includes(bound[1])) usages.push({expression:bound[1],file:relative,line})
    else if(spread && spreads[relative]?.includes(spread[1])) usages.push({expression:spread[1],file:relative,line})
    else failures.push({file:relative,line,reason:'Unverified dynamic icon name',attrs})
  }
  // Static source collections feeding every approved dynamic binding above.
  if(dynamic[relative])for(const match of text.matchAll(/\bicon:\s*['"]([^'"]+)['"]/g)) {
    if(!match[1].startsWith('/'))check(match[1],relative,text.slice(0,match.index).split('\n').length)
  }
  if(relative==='src/utils/icon-utils.js')for(const match of text.matchAll(/\bname:\s*['"]([^'"]+)['"]/g))check(match[1],relative,0)
  if(relative==='src/icons/element-plus.js')for(const match of text.matchAll(/= icon\('([^']+)'\)/g))check(match[1],relative,0)
  if(relative==='src/icons/tiny-icons.js')for(const match of text.split('export function')[0].matchAll(/:\s*'([^']+)'/g))check(match[1],relative,0)
}
for(const [name,glyph] of Object.entries(registry)) {
  const svg=fs.readFileSync(path.join(iconDir,glyph.file),'utf8')
  if(!svg.includes('viewBox="0 0 24 24"'))failures.push({name,reason:'Nonstandard viewBox'})
  if(!glyph.brand && !['stroke-width="2"','stroke-linecap="round"','stroke-linejoin="round"'].every(x=>svg.includes(x))) failures.push({name,reason:'Inconsistent stroke geometry'})
  if(/https?:\/\/|<script|<foreignObject|on\w+=/.test(glyph.body))failures.push({name,reason:'Remote or executable SVG body'})
  const body=svg.replaceAll('\r\n','\n').match(/<svg\b[^>]*>([\s\S]*?)<\/svg>/)?.[1].trim()
  if(body!==glyph.body)failures.push({name,reason:'Registry differs from exact SVG'})
}
const component=fs.readFileSync(path.join(root,'src/components/letter-icon.vue'),'utf8')
if(/paths\[name\].*paths\.mail|default:\s*['"]mail['"]/.test(component))failures.push({reason:'Forbidden silent fallback'})
if(!component.includes('throw new Error(message)'))failures.push({reason:'Unknown icon does not fail in development'})
const report={passed:failures.length===0,registryCount:Object.keys(registry).length,usageCount:usages.length,missingIcons:failures.filter(x=>x.reason==='Missing registry name').length,failures,usages}
if(process.argv.includes('--json'))console.log(JSON.stringify(report,null,2))
else console.log(JSON.stringify({...report,usages:undefined},null,2))
process.exitCode=failures.length?1:0
