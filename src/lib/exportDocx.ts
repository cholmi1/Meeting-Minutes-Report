import {processingLabel} from './processing'
import { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType, LevelFormat, AlignmentType } from 'docx'
import type { Meeting } from '../types'
import {formatDateTime} from './format'
import {safeFileName} from './exportHtml'
export async function downloadDocx(m:Meeting){
 const para=(text:string)=>new Paragraph({children:[new TextRun({text,font:'맑은 고딕'})],spacing:{after:120}})
 const heading=(text:string)=>new Paragraph({text,heading:HeadingLevel.HEADING_1})
 const table=(rows:string[][])=>new Table({width:{size:100,type:WidthType.PERCENTAGE},rows:rows.map(row=>new TableRow({children:row.map(text=>new TableCell({children:[para(text)]}))}))})
 const doc=new Document({creator:'회의록 보고서',title:m.title,numbering:{config:[{reference:'decisions',levels:[{level:0,format:LevelFormat.DECIMAL,text:'%1.',alignment:AlignmentType.START,style:{paragraph:{indent:{left:720,hanging:360}}}}]}]},styles:{default:{document:{run:{font:'맑은 고딕',size:22},paragraph:{spacing:{after:120}}}}},sections:[{properties:{page:{size:{width:11906,height:16838},margin:{top:1134,bottom:1134,left:1134,right:1134}}},children:[new Paragraph({text:m.title,heading:HeadingLevel.TITLE}),table([['일시',formatDateTime(m.heldAt)],['참석',m.attendees.join(', ')],['처리 AI',processingLabel(m)],['자료',m.fileName??'없음'],['길이',m.durationLabel??'-'],...(m.link?[['참고 링크',m.link]]:[])]),heading('1. 핵심 요약'),...m.summary.split('\n').map(para),heading('2. 결정사항'),...m.decisions.map(d=>new Paragraph({numbering:{reference:'decisions',level:0},children:[new TextRun({text:d,font:'맑은 고딕'})],spacing:{after:120}})),heading('3. 할 일'),table([['할 일','담당','기한'],...m.todos.map(t=>[t.task,t.owner,t.due])]),...(m.memo?[heading('4. 메모'),...m.memo.split('\n').map(para)]:[]),para('생성 '+formatDateTime(m.createdAt))]}]})
 const blob=await Packer.toBlob(doc);const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=safeFileName(m)+'.docx';document.body.appendChild(a);a.click();a.remove();window.setTimeout(()=>URL.revokeObjectURL(url),10000)
}
