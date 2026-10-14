/**
 * ORLINX GROUP & ORLINX ADS - Gerador Nativo de PDF Executivo para Briefings
 * 100% Nativo Node.js (Zero dependências externas, compatível com PDF 1.4)
 * Codificação WinAnsiEncoding para suporte pleno a caracteres em Português
 */

const fs = require('fs');
const path = require('path');

// Mapeamento de caracteres acentuados para WinAnsi / Latin1
function encodeWinAnsi(str) {
  if (!str) return '';
  // Normaliza e garante caracteres dentro do conjunto WinAnsi
  const winAnsiMap = {
    'á': '\xE1', 'Á': '\xC1',
    'à': '\xE0', 'À': '\xC0',
    'ã': '\xE3', 'Ã': '\xC3',
    'â': '\xE2', 'Â': '\xC2',
    'é': '\xE9', 'É': '\xC9',
    'ê': '\xEA', 'Ê': '\xCA',
    'í': '\xED', 'Í': '\xCD',
    'ó': '\xF3', 'Ó': '\xD3',
    'õ': '\xF5', 'Õ': '\xD5',
    'ô': '\xF4', 'Ô': '\xD4',
    'ú': '\xFA', 'Ú': '\xDA',
    'ü': '\xFC', 'Ü': '\xDC',
    'ç': '\xE7', 'Ç': '\xC7',
    '–': '-', '—': '-',
    '“': '"', '”': '"',
    '‘': "'", '’': "'",
    '•': '\x95',
    '©': '\xA9', '®': '\xAE'
  };

  let clean = '';
  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    if (winAnsiMap[ch]) {
      clean += winAnsiMap[ch];
    } else {
      const code = ch.charCodeAt(0);
      if (code < 128) {
        clean += ch;
      } else if (code <= 255) {
        clean += ch;
      } else {
        clean += '?';
      }
    }
  }
  return clean;
}

function escapePdfString(str) {
  const encoded = encodeWinAnsi(str);
  return encoded
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

class SimplePdfDocument {
  constructor() {
    this.width = 595.28; // A4 pt
    this.height = 841.89; // A4 pt
    this.pages = [];
    this.currentPage = null;
    this.fonts = [
      { id: 'F1', name: 'Helvetica' },
      { id: 'F2', name: 'Helvetica-Bold' },
      { id: 'F3', name: 'Helvetica-Oblique' }
    ];
    this.addPage();
  }

  addPage() {
    this.currentPage = {
      content: [],
      y: this.height - 40 // Margem superior
    };
    this.pages.push(this.currentPage);
    return this.currentPage;
  }

  checkPageBreak(neededSpace = 30) {
    if (this.currentPage.y - neededSpace < 45) { // Margem inferior de 45pt
      this.addPage();
    }
  }

  // Comandos Gráficos
  rect(x, y, w, h, fillRGB = null, strokeRGB = null, lineWidth = 1) {
    const ops = [];
    ops.push('q');
    if (lineWidth) ops.push(`${lineWidth} w`);
    if (fillRGB) ops.push(`${fillRGB[0]} ${fillRGB[1]} ${fillRGB[2]} rg`);
    if (strokeRGB) ops.push(`${strokeRGB[0]} ${strokeRGB[1]} ${strokeRGB[2]} RG`);
    ops.push(`${x.toFixed(2)} ${y.toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re`);
    if (fillRGB && strokeRGB) ops.push('B');
    else if (fillRGB) ops.push('f');
    else if (strokeRGB) ops.push('S');
    ops.push('Q');
    this.currentPage.content.push(ops.join(' '));
  }

  line(x1, y1, x2, y2, strokeRGB = [0.8, 0.8, 0.8], lineWidth = 0.75) {
    const ops = [
      'q',
      `${lineWidth} w`,
      `${strokeRGB[0]} ${strokeRGB[1]} ${strokeRGB[2]} RG`,
      `${x1.toFixed(2)} ${y1.toFixed(2)} m`,
      `${x2.toFixed(2)} ${y2.toFixed(2)} l`,
      'S',
      'Q'
    ];
    this.currentPage.content.push(ops.join(' '));
  }

  // Texto
  text(str, x, y, options = {}) {
    const font = options.font || 'F1';
    const size = options.size || 10;
    const color = options.color || [0.1, 0.1, 0.1];
    const escaped = escapePdfString(str);

    const ops = [
      'BT',
      `/${font} ${size} Tf`,
      `${color[0]} ${color[1]} ${color[2]} rg`,
      `1 0 0 1 ${x.toFixed(2)} ${y.toFixed(2)} Tm`,
      `(${escaped}) Tj`,
      'ET'
    ];
    this.currentPage.content.push(ops.join(' '));
  }

  // Parágrafo com quebra automática de linha
  wrappedText(str, x, y, maxWidth, options = {}) {
    const size = options.size || 9;
    const lineHeight = options.lineHeight || (size * 1.35);
    const words = (str || '').split(' ');
    let line = '';
    let currentY = y;
    // Estimativa média de largura de caractere Helvetica
    const charWidth = size * 0.52;
    const maxChars = Math.floor(maxWidth / charWidth);

    for (let i = 0; i < words.length; i++) {
      const testLine = line ? `${line} ${words[i]}` : words[i];
      if (testLine.length > maxChars && line) {
        this.checkPageBreak(lineHeight);
        this.text(line, x, this.currentPage.y, options);
        this.currentPage.y -= lineHeight;
        currentY = this.currentPage.y;
        line = words[i];
      } else {
        line = testLine;
      }
    }
    if (line) {
      this.checkPageBreak(lineHeight);
      this.text(line, x, this.currentPage.y, options);
      this.currentPage.y -= lineHeight;
      currentY = this.currentPage.y;
    }
    return currentY;
  }

  // Seção com cabeçalho estilizado
  sectionHeader(title, sectionNum) {
    this.checkPageBreak(40);
    const y = this.currentPage.y;
    // Barra de fundo suave
    this.rect(40, y - 18, 515.28, 22, [0.95, 0.96, 0.98], [0.85, 0.88, 0.92], 0.5);
    // Marcador lateral dourado ORLINX
    this.rect(40, y - 18, 4, 22, [0.83, 0.69, 0.22]);

    this.text(`SEÇÃO ${sectionNum} • ${title.toUpperCase()}`, 52, y - 12, {
      font: 'F2',
      size: 9.5,
      color: [0.04, 0.1, 0.2] // Navy ORLINX
    });

    this.currentPage.y = y - 28;
  }

  // Par chave-valor lado a lado
  keyValueRow(label, value, x1 = 45, x2 = 180, width = 360) {
    this.checkPageBreak(16);
    const y = this.currentPage.y;
    this.text(label, x1, y, { font: 'F2', size: 8.5, color: [0.3, 0.35, 0.4] });
    
    const valStr = (value !== null && value !== undefined && value !== '') ? String(value) : 'Não informado';
    
    // Se couber em linha simples
    if (valStr.length < 55) {
      this.text(valStr, x2, y, { font: 'F1', size: 8.5, color: [0.1, 0.1, 0.15] });
      this.currentPage.y = y - 14;
    } else {
      // Envolve texto
      this.currentPage.y = y;
      this.wrappedText(valStr, x2, y, width, { font: 'F1', size: 8.5, color: [0.1, 0.1, 0.15] });
      this.currentPage.y -= 4;
    }
  }

  // Compila todo o documento binário PDF 1.4
  compile() {
    const objects = [];
    let objCount = 0;

    function createObj(content) {
      objCount++;
      objects.push({ id: objCount, content });
      return objCount;
    }

    // 1: Catalog
    const catalogId = createObj('<< /Type /Catalog /Pages 2 0 R >>');

    // Fontes
    const f1Id = createObj('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
    const f2Id = createObj('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
    const f3Id = createObj('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Oblique /Encoding /WinAnsiEncoding >>');

    const totalPages = this.pages.length;

    // Constrói cada página e seus fluxos de conteúdo
    const pageObjIds = [];
    const contentObjIds = [];

    // Adiciona rodapés a todas as páginas antes de compilar o stream
    for (let i = 0; i < totalPages; i++) {
      const p = this.pages[i];
      // Linha separadora do rodapé
      const footerOps = [
        'q',
        '0.5 w',
        '0.85 0.85 0.85 RG',
        '40.00 35.00 m',
        '555.28 35.00 l',
        'S',
        'Q',
        'BT',
        '/F1 7.5 Tf',
        '0.5 0.5 0.55 rg',
        `1 0 0 1 40.00 24.00 Tm (ORLINX GROUP • orlinxgroup.com.br • Documento Confidencial Interno) Tj`,
        'ET',
        'BT',
        '/F2 7.5 Tf',
        '0.4 0.4 0.4 rg',
        `1 0 0 1 490.00 24.00 Tm (Página ${i + 1} de ${totalPages}) Tj`,
        'ET'
      ];
      p.content.push(footerOps.join(' '));

      // Cria Stream de conteúdo
      const streamText = p.content.join('\n');
      const streamLen = Buffer.byteLength(streamText, 'binary');
      const contentId = createObj(`<< /Length ${streamLen} >>\nstream\n${streamText}\nendstream`);
      contentObjIds.push(contentId);
    }

    // Para cada página, cria o objeto Page
    for (let i = 0; i < totalPages; i++) {
      const pageId = createObj(
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${this.width} ${this.height}] /Contents ${contentObjIds[i]} 0 R ` +
        `/Resources << /Font << /F1 ${f1Id} 0 R /F2 ${f2Id} 0 R /F3 ${f3Id} 0 R >> >> >>`
      );
      pageObjIds.push(pageId);
    }

    // Objeto 2: Pages tree
    const kidsStr = pageObjIds.map(id => `${id} 0 R`).join(' ');
    // Substitui objeto 2
    objects.splice(1, 0, {
      id: 2,
      content: `<< /Type /Pages /Kids [${kidsStr}] /Count ${totalPages} >>`
    });

    // Reordena IDs
    // Para simplificar a geração de xref rigorosa, reconstruímos linearmente
    const finalObjs = [];
    finalObjs.push(`%PDF-1.4\n%\xE2\xE3\xCF\xD3`);

    const offsets = [];
    let currentOffset = Buffer.byteLength(finalObjs[0], 'binary') + 1; // + newline

    // Mapeamento sequencial 1..N
    const sortedObjects = [];
    sortedObjects.push({ id: 1, body: '<< /Type /Catalog /Pages 2 0 R >>' });
    sortedObjects.push({ id: 2, body: `<< /Type /Pages /Kids [${kidsStr}] /Count ${totalPages} >>` });
    sortedObjects.push({ id: 3, body: '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>' });
    sortedObjects.push({ id: 4, body: '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>' });
    sortedObjects.push({ id: 5, body: '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Oblique /Encoding /WinAnsiEncoding >>' });

    let nextId = 6;
    for (let i = 0; i < totalPages; i++) {
      const cId = nextId++;
      const pId = nextId++;

      const p = this.pages[i];
      const streamText = p.content.join('\n');
      const streamLen = Buffer.byteLength(streamText, 'binary');

      sortedObjects.push({
        id: cId,
        body: `<< /Length ${streamLen} >>\nstream\n${streamText}\nendstream`
      });

      sortedObjects.push({
        id: pId,
        body: `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${this.width} ${this.height}] /Contents ${cId} 0 R ` +
              `/Resources << /Font << /F1 3 0 R /F2 4 0 R /F3 5 0 R >> >> >>`
      });
    }

    // Corrige kids do objeto 2 com IDs reais dos pages
    const realPageIds = [];
    for (let i = 0; i < totalPages; i++) {
      realPageIds.push(`${7 + i * 2} 0 R`);
    }
    sortedObjects[1].body = `<< /Type /Pages /Kids [${realPageIds.join(' ')}] /Count ${totalPages} >>`;

    // Monta o arquivo com cálculo preciso de byte offsets para xref
    let pdfBuffer = Buffer.from(`%PDF-1.4\n%\xE2\xE3\xCF\xD3\n`, 'binary');
    const xrefOffsets = [];
    xrefOffsets.push(0); // obj 0

    for (let i = 0; i < sortedObjects.length; i++) {
      const obj = sortedObjects[i];
      xrefOffsets[obj.id] = pdfBuffer.length;
      const objHeader = Buffer.from(`${obj.id} 0 obj\n`, 'binary');
      const objBody = Buffer.from(`${obj.body}\nendobj\n`, 'binary');
      pdfBuffer = Buffer.concat([pdfBuffer, objHeader, objBody]);
    }

    const startXref = pdfBuffer.length;
    let xrefStr = `xref\n0 ${sortedObjects.length + 1}\n0000000000 65535 f \n`;
    for (let i = 1; i <= sortedObjects.length; i++) {
      const offset = xrefOffsets[i] || 0;
      const offStr = String(offset).padStart(10, '0');
      xrefStr += `${offStr} 00000 n \n`;
    }

    const trailerStr = `trailer\n<< /Size ${sortedObjects.length + 1} /Root 1 0 R >>\nstartxref\n${startXref}\n%%EOF\n`;
    pdfBuffer = Buffer.concat([pdfBuffer, Buffer.from(xrefStr + trailerStr, 'binary')]);

    return pdfBuffer;
  }
}

/**
 * Função Principal de Geração do Relatório de Briefing em PDF
 * @param {Object} data - Dados completos do briefing
 * @returns {Buffer} - Buffer binário do PDF 1.4 gerado
 */
function generateBriefingPdf(data) {
  const doc = new SimplePdfDocument();
  const protocol = data.protocol_code || 'BRF-SEM-PROTOCOLO';
  const createdAt = data.created_at ? new Date(data.created_at).toLocaleString('pt-BR') : new Date().toLocaleString('pt-BR');

  // ==========================================
  // CABEÇALHO EXECUTIVO ORLINX
  // ==========================================
  // Barra superior Azul Petróleo ORLINX (#0A192F)
  doc.rect(40, doc.currentPage.y - 58, 515.28, 62, [0.04, 0.1, 0.18]);
  // Detalhe Dourado (#D4AF37)
  doc.rect(40, doc.currentPage.y - 62, 515.28, 4, [0.83, 0.69, 0.22]);

  doc.text('ORLINX GROUP • PLATAFORMA DE PROJETOS & ORLINX ADS', 52, doc.currentPage.y - 18, {
    font: 'F2',
    size: 11,
    color: [0.83, 0.69, 0.22] // Gold
  });

  doc.text('ESPECIFICAÇÃO TÉCNICA E BRIEFING DIGITAL DE WEBSITE', 52, doc.currentPage.y - 34, {
    font: 'F2',
    size: 13,
    color: [1, 1, 1] // Branco
  });

  doc.text(`Protocolo Oficial: ${protocol}  |  Emissão: ${createdAt}  |  Status: ${data.status || 'submitted'}`, 52, doc.currentPage.y - 48, {
    font: 'F1',
    size: 8,
    color: [0.8, 0.85, 0.9]
  });

  doc.currentPage.y -= 75;

  // Box de Resumo do Protocolo
  doc.rect(40, doc.currentPage.y - 32, 515.28, 36, [0.98, 0.98, 0.99], [0.88, 0.9, 0.94], 0.75);
  doc.text('PROTOCOLO REGISTRADO:', 50, doc.currentPage.y - 12, { font: 'F2', size: 8, color: [0.4, 0.45, 0.5] });
  doc.text(protocol, 50, doc.currentPage.y - 24, { font: 'F2', size: 11, color: [0.04, 0.1, 0.18] });

  doc.text('SOLICITANTE:', 220, doc.currentPage.y - 12, { font: 'F2', size: 8, color: [0.4, 0.45, 0.5] });
  doc.text(data.contact_name || 'N/I', 220, doc.currentPage.y - 24, { font: 'F1', size: 9.5, color: [0.1, 0.1, 0.1] });

  doc.text('EMPRESA / MARCA:', 380, doc.currentPage.y - 12, { font: 'F2', size: 8, color: [0.4, 0.45, 0.5] });
  doc.text(data.company_name || 'N/I', 380, doc.currentPage.y - 24, { font: 'F2', size: 9.5, color: [0.04, 0.1, 0.18] });

  doc.currentPage.y -= 44;

  // ==========================================
  // SEÇÃO 1: DADOS INSTITUCIONAIS & CONTATO
  // ==========================================
  doc.sectionHeader('Dados Institucionais e Contato Comercial', 1);
  doc.keyValueRow('Razão Social / Nome:', data.company_name);
  if (data.trading_name) doc.keyValueRow('Nome Fantasia:', data.trading_name);
  doc.keyValueRow('CNPJ ou CPF:', data.document_number);
  doc.keyValueRow('Responsável pelo Projeto:', data.contact_name);
  doc.keyValueRow('E-mail Corporativo:', data.email);
  doc.keyValueRow('Telefone / WhatsApp:', data.phone);
  doc.keyValueRow('Cidade / Estado (UF):', data.city_state || 'Não informado');
  doc.keyValueRow('Segmento de Atuação:', data.business_segment || 'Não informado');

  doc.currentPage.y -= 6;

  // ==========================================
  // SEÇÃO 2: VISÃO GERAL & OBJETIVOS DO SITE
  // ==========================================
  doc.sectionHeader('Visão Geral e Objetivos do Projeto', 2);
  doc.keyValueRow('Tipo de Site:', formatProjectType(data.project_type));
  doc.keyValueRow('Objetivo Principal:', formatPrimaryGoal(data.primary_goal));
  if (data.target_audience) {
    doc.keyValueRow('Público-Alvo:', data.target_audience);
  }
  if (data.project_summary) {
    doc.keyValueRow('Resumo / Missão:', data.project_summary);
  }

  doc.currentPage.y -= 6;

  // ==========================================
  // SEÇÃO 3: ESCOPO, PÁGINAS & REQUISITOS
  // ==========================================
  doc.sectionHeader('Escopo, Estrutura de Páginas e Recursos', 3);
  const pagesList = Array.isArray(data.required_pages) && data.required_pages.length > 0
    ? data.required_pages.join(', ')
    : 'Estrutura institucional padrão';
  doc.keyValueRow('Páginas Previstas:', pagesList);

  const featuresList = Array.isArray(data.custom_features) && data.custom_features.length > 0
    ? data.custom_features.join(', ')
    : 'Nenhum módulo sob medida indicado';
  doc.keyValueRow('Recursos e Funcionalidades:', featuresList);

  if (data.special_requirements) {
    doc.keyValueRow('Requisitos Especiais:', data.special_requirements);
  }

  doc.currentPage.y -= 6;

  // ==========================================
  // SEÇÃO 4: IDENTIDADE VISUAL & DESIGN
  // ==========================================
  doc.sectionHeader('Identidade Visual, Paleta de Cores e Estilo', 4);
  doc.keyValueRow('Situação da Marca:', formatBrandStatus(data.brand_status));
  doc.keyValueRow('Estilo Visual Pretendido:', formatDesignStyle(data.design_style));

  let colorsDesc = 'Padrão sugerido pela equipe de design';
  if (data.color_palette && typeof data.color_palette === 'object') {
    const cp = data.color_palette;
    const parts = [];
    if (cp.primary) parts.push(`Primária: ${cp.primary}`);
    if (cp.secondary) parts.push(`Secundária: ${cp.secondary}`);
    if (cp.accent) parts.push(`Destaque: ${cp.accent}`);
    if (cp.avoid) parts.push(`Evitar: ${cp.avoid}`);
    if (parts.length > 0) colorsDesc = parts.join(' | ');
  }
  doc.keyValueRow('Paleta de Cores:', colorsDesc);

  if (data.design_notes) {
    doc.keyValueRow('Diretrizes de Design:', data.design_notes);
  }

  doc.currentPage.y -= 6;

  // ==========================================
  // SEÇÃO 5: DOCUMENTOS E ANEXOS PRIVADOS
  // ==========================================
  doc.sectionHeader('Documentos e Arquivos Fornecidos (Repositório Seguro)', 5);
  const files = Array.isArray(data.uploaded_files) ? data.uploaded_files : [];
  if (files.length === 0) {
    doc.keyValueRow('Arquivos Anexados:', 'Nenhum documento anexado na submissão (envio posterior via e-mail ou painel).');
  } else {
    doc.checkPageBreak(files.length * 16 + 20);
    doc.keyValueRow('Quantidade de Anexos:', `${files.length} arquivo(s) armazenado(s) em cofre privado`);
    files.forEach((f, idx) => {
      const sizeKb = f.size_bytes ? `${Math.round(f.size_bytes / 1024)} KB` : '';
      const catLabel = formatFileCategory(f.category);
      doc.keyValueRow(`Anexo #${idx + 1} (${catLabel}):`, `${f.original_name || 'arquivo'} - ${f.mime_type || ''} [${sizeKb}]`);
    });
  }

  doc.currentPage.y -= 6;

  // ==========================================
  // SEÇÃO 6: REFERÊNCIAS VISUAIS & CONCORRÊNCIA
  // ==========================================
  doc.sectionHeader('Referências Visuais e Mapeamento de Mercado', 6);
  const benchmarks = Array.isArray(data.benchmark_urls) ? data.benchmark_urls : [];
  if (benchmarks.length === 0) {
    doc.keyValueRow('Sites de Referência:', 'Não informados');
  } else {
    benchmarks.forEach((b, idx) => {
      const urlText = typeof b === 'string' ? b : `${b.url || ''} ${b.notes ? `(${b.notes})` : ''}`;
      doc.keyValueRow(`Referência #${idx + 1}:`, urlText);
    });
  }
  if (data.disliked_elements) {
    doc.keyValueRow('Elementos a Evitar:', data.disliked_elements);
  }

  doc.currentPage.y -= 6;

  // ==========================================
  // SEÇÃO 7: CONTEÚDO, FOTOGRAFIAS & IDIOMAS
  // ==========================================
  doc.sectionHeader('Produção de Conteúdo, Textos e Idiomas', 7);
  doc.keyValueRow('Origem dos Textos (Copy):', formatContentSource(data.content_source));
  doc.keyValueRow('Fotografias e Imagens:', formatMediaSource(data.media_source));
  const langs = Array.isArray(data.languages) ? data.languages.join(', ') : 'Português (pt-BR)';
  doc.keyValueRow('Idiomas do Site:', langs);

  doc.currentPage.y -= 6;

  // ==========================================
  // SEÇÃO 8: DOMÍNIO, HOSPEDAGEM & E-MAILS
  // ==========================================
  doc.sectionHeader('Infraestrutura de Domínio, Hospedagem e E-mails', 8);
  doc.keyValueRow('Status do Domínio:', formatDomainStatus(data.domain_status));
  if (data.domain_name) doc.keyValueRow('Endereço do Domínio:', data.domain_name);
  doc.keyValueRow('Preferência de Hospedagem:', formatHostingPreference(data.hosting_preference));
  doc.keyValueRow('Caixas Postais Corporativas:', `${data.corporate_emails_needed || 0} conta(s)`);

  doc.currentPage.y -= 6;

  // ==========================================
  // SEÇÃO 9: PUBLICIDADE ORLINX ADS (OPCIONAL)
  // ==========================================
  doc.sectionHeader('Módulo Publicitário • Rede ORLINX ADS (Opcional)', 9);
  if (data.ads_opt_in) {
    doc.keyValueRow('Interesse em ORLINX ADS:', 'SIM - Cliente solicitou veiculação publicitária combinada');
    if (data.ads_format) doc.keyValueRow('Formato de Destaque:', data.ads_format);
    if (data.ads_target_url) doc.keyValueRow('URL de Destino do Anúncio:', data.ads_target_url);
    if (data.ads_period_days) doc.keyValueRow('Período de Veiculação:', `${data.ads_period_days} dias`);
    if (data.ads_budget_range) doc.keyValueRow('Expectativa de Investimento:', data.ads_budget_range);
    if (data.ads_start_date) doc.keyValueRow('Data Prevista de Início:', data.ads_start_date);
  } else {
    doc.keyValueRow('Interesse em ORLINX ADS:', 'NÃO - Apenas desenvolvimento do website (sem veiculação de anúncios)');
  }

  doc.currentPage.y -= 6;

  // ==========================================
  // SEÇÃO 10: CRONOGRAMA, INVESTIMENTO & LGPD
  // ==========================================
  doc.sectionHeader('Cronograma, Faixa de Investimento e Consentimentos', 10);
  doc.keyValueRow('Prazo Pretendido de Lançamento:', data.target_launch_date ? data.target_launch_date : 'Flexível / A combinar');
  doc.keyValueRow('Faixa de Investimento Estimada:', data.investment_bracket || 'Sob consulta comercial');

  // Consentimentos Legais Rigorosamente Separados
  doc.keyValueRow('Aceite da Política de Privacidade (LGPD):', data.privacy_policy_accepted ? 'CONFIRMADO E REGISTRADO' : 'PENDENTE');
  if (data.privacy_accepted_at) {
    doc.keyValueRow('Data/Hora do Aceite LGPD:', new Date(data.privacy_accepted_at).toLocaleString('pt-BR'));
  }
  if (data.privacy_ip_hash) {
    doc.keyValueRow('Hash de Integridade do IP:', data.privacy_ip_hash);
  }

  doc.keyValueRow('Autorização para Portfólio:', data.portfolio_showcase_authorized
    ? 'AUTORIZADO pelo cliente (Marca/Print autorizados para showcase)'
    : 'NÃO AUTORIZADO (Projeto mantido em sigilo corporativo / sem divulgação)');

  if (data.portfolio_authorized_at) {
    doc.keyValueRow('Data da Opção de Portfólio:', new Date(data.portfolio_authorized_at).toLocaleString('pt-BR'));
  }

  // ==========================================
  // ASSINATURA & HOMOLOGAÇÃO COMERCIAL
  // ==========================================
  doc.checkPageBreak(90);
  doc.currentPage.y -= 15;
  doc.rect(40, doc.currentPage.y - 75, 515.28, 75, [0.98, 0.98, 0.98], [0.85, 0.88, 0.92], 0.5);

  doc.text('HOMOLOGAÇÃO DA DIRETORIA COMERCIAL • ORLINX GROUP', 50, doc.currentPage.y - 14, {
    font: 'F2',
    size: 8.5,
    color: [0.04, 0.1, 0.18]
  });

  doc.text('Este documento constitui especificação técnica formal para estimativa de esforço e proposta comercial.', 50, doc.currentPage.y - 26, {
    font: 'F1',
    size: 7.5,
    color: [0.4, 0.45, 0.5]
  });

  doc.line(50, doc.currentPage.y - 58, 250, doc.currentPage.y - 58, [0.6, 0.6, 0.6], 0.75);
  doc.text('Responsável Técnico / Comercial ORLINX', 50, doc.currentPage.y - 68, { font: 'F1', size: 7.5, color: [0.4, 0.4, 0.4] });

  doc.line(305, doc.currentPage.y - 58, 505, doc.currentPage.y - 58, [0.6, 0.6, 0.6], 0.75);
  doc.text(`De Acordo: ${data.company_name || 'Cliente'}`, 305, doc.currentPage.y - 68, { font: 'F1', size: 7.5, color: [0.4, 0.4, 0.4] });

  return doc.compile();
}

// Helpers de Formatação para Apresentação Executiva
function formatProjectType(type) {
  const map = {
    'institucional': 'Website Institucional Corporativo',
    'landing_page': 'Landing Page de Alta Conversão',
    'ecommerce': 'E-commerce / Loja Virtual Completa',
    'portal_noticias': 'Portal de Conteúdo e Notícias',
    'catalogo_produtos': 'Catálogo Digital B2B de Produtos',
    'sistema_web': 'Aplicação Web / Painel Sob Medida'
  };
  return map[type] || type || 'Não especificado';
}

function formatPrimaryGoal(goal) {
  const map = {
    'gerar_leads': 'Geração de Leads e Contatos Comerciais',
    'vendas_diretas': 'Vendas Diretas Online',
    'fortalecer_marca': 'Fortalecimento de Marca e Credibilidade',
    'apresentar_servicos': 'Apresentação Detalhada de Serviços e Portfólio',
    'atendimento_suporte': 'Canal de Atendimento e Suporte a Clientes'
  };
  return map[goal] || goal || 'Não especificado';
}

function formatBrandStatus(status) {
  const map = {
    'possui_marca_pronta': 'Possui marca e identidade visual prontas (enviará arquivos)',
    'precisa_redesenho': 'Possui marca mas precisa de modernização / redesenho',
    'precisa_criar_marca': 'Não possui marca (deseja criar branding do zero com a ORLINX)'
  };
  return map[status] || status || 'Não especificado';
}

function formatDesignStyle(style) {
  const map = {
    'moderno_corporativo': 'Moderno Corporativo (Sóbrio, Elegante, Minimalista)',
    'tecnologico_inovador': 'Tecnológico e Inovador (Dark Mode, Gradientes, Efeitos)',
    'criativo_expressivo': 'Criativo e Expressivo (Cores Vivas, Tipografia Forte)',
    'classico_tradicional': 'Clássico e Tradicional (Institucional, Alto Padrão)'
  };
  return map[style] || style || 'Não especificado';
}

function formatFileCategory(cat) {
  const map = {
    'logo': 'Logotipo Vetorial / Imagem',
    'brand_manual': 'Manual de Identidade Visual',
    'photos': 'Fotografias Corporativas',
    'inpi_doc': 'Certificado / Protocolo INPI',
    'other': 'Documento Complementar'
  };
  return map[cat] || cat || 'Documento';
}

function formatContentSource(src) {
  const map = {
    'cliente_fornece_pronto': 'Cliente fornecerá todos os textos prontos e revisados',
    'orlinx_copywriting': 'Cliente solicita serviço de redação publicitária (Copywriting ORLINX)',
    'misto': 'Fornecimento parcial pelo cliente com refinamento pela ORLINX'
  };
  return map[src] || src || 'Não especificado';
}

function formatMediaSource(src) {
  const map = {
    'fotos_proprias': 'Cliente possui banco de fotos profissionais próprias',
    'banco_imagens': 'Utilizar banco de imagens profissional selecionado pela ORLINX',
    'necessita_sessao': 'Necessita de produção fotográfica corporativa'
  };
  return map[src] || src || 'Não especificado';
}

function formatDomainStatus(status) {
  const map = {
    'ja_registrado': 'Domínio já registrado e ativo sob controle do cliente',
    'deseja_registro': 'Deseja que a ORLINX registre e gerencie o domínio',
    'nao_sabe': 'Não possui domínio e precisa de orientação técnica'
  };
  return map[status] || status || 'Não especificado';
}

function formatHostingPreference(pref) {
  const map = {
    'hospedagem_orlinx': 'Hospedagem Gerenciada de Alta Performance ORLINX (Recomendado)',
    'hospedagem_propria': 'Manter ou utilizar servidor/hospedagem própria do cliente',
    'analisar_melhor': 'Analisar melhor opção de acordo com a arquitetura'
  };
  return map[pref] || pref || 'Não especificado';
}

module.exports = {
  SimplePdfDocument,
  generateBriefingPdf
};
