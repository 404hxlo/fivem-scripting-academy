// Token-aware removal preserves strings and line breaks, including Lua long
// strings/comments. It is a lexical helper, not a CfxLua parser.
export function stripComments(code: string, language: 'lua'|'web'|'config' = 'lua'): string {
  let output = '', index = 0;
  const blank = (text:string) => text.replace(/[^\r\n]/g,' ');
  while (index < code.length) {
    const rest = code.slice(index);
    if (language === 'web' && rest.startsWith('<!--')) {
      const end=code.indexOf('-->',index+4), count=end<0?code.length-index:end+3-index;
      output+=blank(code.slice(index,index+count));index+=count;continue;
    }
    if ((language==='lua' && rest.startsWith('--')) || (language==='web' && rest.startsWith('//')) || (language==='config' && (rest.startsWith('#')||rest.startsWith('//')))) {
      const long=language==='lua' ? rest.match(/^--\[(=*)\[/) : null;
      let end:number;
      if(long){const close=`]${long[1]}]`;const found=code.indexOf(close,index+long[0].length);end=found<0?code.length:found+close.length;}
      else{const found=code.indexOf('\n',index);end=found<0?code.length:found;}
      output+=blank(code.slice(index,end));index=end;continue;
    }
    if(language==='web'&&rest.startsWith('/*')){const found=code.indexOf('*/',index+2);const end=found<0?code.length:found+2;output+=blank(code.slice(index,end));index=end;continue;}
    const quote=code[index];
    if(quote==='"'||quote==="'"||(language==='web'&&quote==='`')){
      let end=index+1;
      while(end<code.length){if(code[end]==='\\'){end+=2;continue;}if(code[end++]===quote)break;}
      output+=code.slice(index,end);index=end;continue;
    }
    const long=language==='lua'?rest.match(/^\[(=*)\[/):null;
    if(long){const close=`]${long[1]}]`;const found=code.indexOf(close,index+long[0].length);const end=found<0?code.length:found+close.length;output+=code.slice(index,end);index=end;continue;}
    output+=code[index++];
  }
  return output;
}

// Mask comments and strings for block indentation. Track their original spans
// so a continuation line inside a literal keeps its exact leading whitespace.
export function formatLua(code: string, tabSize = 2): string {
  const spans: {start: number; end: number}[] = [];
  const luaLiterals = /--\[(=*)\[[\s\S]*?(?:\]\1\]|$)|--[^\r\n]*|\[(=*)\[[\s\S]*?(?:\]\2\]|$)|"(?:\\[\s\S]|[^"\\])*(?:"|$)|'(?:\\[\s\S]|[^'\\])*(?:'|$)/g;
  const masked = code.replace(luaLiterals, (token, _comment, _literal, offset) => {
    if (/[\r\n]/.test(token)) spans.push({start: offset, end: offset + token.length});
    return token.replace(/[^\r\n]/g, ' ');
  });

  const indentWidth = Math.min(8, Math.max(1, Math.floor(tabSize)));
  let depth = 0;
  let span = 0;
  return code.replace(/[^\r\n]+/g, (line, offset) => {
    while (span < spans.length && spans[span].end <= offset) span++;
    const insideLiteral = span < spans.length && spans[span].start < offset;
    const layout = masked.slice(offset, offset + line.length).trimStart();
    const closesBlock = /^(?:end\b|until\b|else\b|elseif\b|})/.test(layout);
    const indent = Math.max(0, depth - Number(closesBlock));
    for (const [token] of layout.matchAll(/\b(?:function|then|do|repeat|end|until|elseif)\b|[{}]/g)) {
      depth += /^(?:end|until|elseif|})$/.test(token) ? -1 : 1;
    }
    depth = Math.max(0, depth);
    if (insideLiteral) return line;
    const content = line.trimStart();
    return content ? ' '.repeat(indent * indentWidth) + content : '';
  });
}
