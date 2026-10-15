/**
 * ORLINX GROUP & ORLINX ADS - Motor de Briefing Digital
 * Multi-etapas (10 passos), Auto-Save em sessionStorage, Validação de Magic Bytes,
 * Uploads Seguros com Categoria e Submissão Confiável
 */

(function () {
  'use strict';

  const OFFICIAL_SUPABASE_URL = 'https://ulajrvkaqqedwuaiaksp.supabase.co';
  const OFFICIAL_SUPABASE_ANON_KEY = 'sb_publishable_5OvenPLd8XALBaYN5YF25g_6VAx_MAk';
  const supabaseUrl = window.ORLINX_SUPABASE_URL || OFFICIAL_SUPABASE_URL;
  const supabaseAnonKey = window.ORLINX_SUPABASE_ANON_KEY || OFFICIAL_SUPABASE_ANON_KEY;

  const TOTAL_STEPS = 10;
  let currentStep = 1;
  const filesState = []; // [{ id, name, size, type, category, base64Data }]

  const STEP_LABELS = [
    'Institucional',
    'Objetivos',
    'Escopo',
    'Design',
    'Uploads',
    'Referências',
    'Conteúdo',
    'Domínio',
    'ORLINX ADS',
    'LGPD & Envio'
  ];

  // Elementos do DOM
  const form = document.getElementById('orlinx-briefing-form');
  const progressBar = document.getElementById('briefing-progress-bar');
  const stepCounterText = document.getElementById('step-counter-text');
  const stepsPillNav = document.getElementById('steps-pill-nav');
  const alertBox = document.getElementById('briefing-alert-box');
  const btnPrev = document.getElementById('btn-prev-step');
  const btnNext = document.getElementById('btn-next-step');
  const btnSubmit = document.getElementById('btn-submit-briefing');
  const btnSubmitSpinner = document.getElementById('btn-submit-spinner');
  const draftStatusPill = document.getElementById('draft-status-pill');

  // Inicialização
  document.addEventListener('DOMContentLoaded', () => {
    initStepNavigation();
    initColorPickers();
    initFileUploads();
    initBenchmarks();
    initConditionalAds();
    restoreDraft();
    updateStepView(1);

    // Auto-save ao alterar qualquer campo
    form.addEventListener('input', debounce(saveDraft, 500));
    form.addEventListener('change', saveDraft);

    // Navegação
    btnPrev.addEventListener('click', () => goToStep(currentStep - 1));
    btnNext.addEventListener('click', handleNextStep);
    form.addEventListener('submit', handleFormSubmit);

    // Botão de copiar protocolo no modal de sucesso
    const btnCopy = document.getElementById('btn-copy-protocol');
    if (btnCopy) {
      btnCopy.addEventListener('click', () => {
        const text = document.getElementById('modal-protocol-display').innerText;
        navigator.clipboard.writeText(text).then(() => {
          btnCopy.innerText = 'Copiado!';
          setTimeout(() => { btnCopy.innerText = 'Copiar'; }, 2000);
        });
      });
    }
  });

  // --- 1. Navegação de Etapas ---
  function initStepNavigation() {
    stepsPillNav.innerHTML = '';
    for (let i = 1; i <= TOTAL_STEPS; i++) {
      const li = document.createElement('li');
      li.className = 'flex items-center';
      
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.id = `pill-step-${i}`;
      btn.className = `px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 border transition-all ${
        i === 1
          ? 'bg-[#D4AF37]/20 border-[#D4AF37] text-[#D4AF37]'
          : 'bg-[#080E1E] border-[#1E3158] text-[#D3CBC3] hover:border-[#D4AF37]/50'
      }`;
      btn.innerHTML = `<span class="w-4 h-4 rounded-full bg-[#1E3158] text-[10px] flex items-center justify-center">${i}</span><span>${STEP_LABELS[i - 1]}</span>`;
      btn.addEventListener('click', () => {
        // Só permite avançar se as etapas intermediárias forem válidas
        if (i <= currentStep) {
          goToStep(i);
        } else {
          if (validateCurrentStep()) {
            goToStep(i);
          }
        }
      });

      li.appendChild(btn);
      stepsPillNav.appendChild(li);
    }
  }

  function updateStepView(step) {
    currentStep = step;

    // Alterna visibilidade dos fieldsets
    const fieldsets = form.querySelectorAll('.step-content');
    fieldsets.forEach(fs => {
      const fsStep = parseInt(fs.getAttribute('data-step'), 10);
      if (fsStep === step) {
        fs.classList.add('active');
      } else {
        fs.classList.remove('active');
      }
    });

    // Atualiza barra de progresso
    const pct = Math.round((step / TOTAL_STEPS) * 100);
    progressBar.style.width = `${pct}%`;
    stepCounterText.innerText = `Etapa ${step} de ${TOTAL_STEPS}`;

    // Atualiza pills de navegação
    for (let i = 1; i <= TOTAL_STEPS; i++) {
      const pill = document.getElementById(`pill-step-${i}`);
      if (!pill) continue;
      if (i === step) {
        pill.className = 'px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 border bg-[#D4AF37]/20 border-[#D4AF37] text-[#D4AF37] shadow-sm';
      } else if (i < step) {
        pill.className = 'px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 border bg-[#142244] border-emerald-500/50 text-emerald-400';
      } else {
        pill.className = 'px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 border bg-[#080E1E] border-[#1E3158] text-[#D3CBC3] hover:border-[#D4AF37]/50';
      }
    }

    // Controle dos botões
    btnPrev.disabled = (step === 1);
    if (step === TOTAL_STEPS) {
      btnNext.classList.add('hidden');
      btnSubmit.classList.remove('hidden');
    } else {
      btnNext.classList.remove('hidden');
      btnSubmit.classList.add('hidden');
    }

    hideAlert();
    window.scrollTo({ top: form.offsetTop - 100, behavior: 'smooth' });
  }

  function handleNextStep() {
    if (validateCurrentStep()) {
      goToStep(currentStep + 1);
    }
  }

  function goToStep(step) {
    if (step < 1 || step > TOTAL_STEPS) return;
    updateStepView(step);
  }

  // --- 2. Validação por Etapa ---
  function validateCurrentStep() {
    hideAlert();

    if (currentStep === 1) {
      const company = document.getElementById('company_name').value.trim();
      const doc = document.getElementById('document_number').value.trim();
      const contact = document.getElementById('contact_name').value.trim();
      const email = document.getElementById('email').value.trim();
      const phone = document.getElementById('phone').value.trim();

      if (company.length < 3) {
        showAlert('Informe a Razão Social ou Nome da Empresa (mínimo 3 caracteres).');
        document.getElementById('company_name').focus();
        return false;
      }
      if (doc.length < 8) {
        showAlert('Informe um CNPJ ou CPF válido.');
        document.getElementById('document_number').focus();
        return false;
      }
      if (contact.length < 3) {
        showAlert('Informe o Nome Completo do Responsável pelo projeto.');
        document.getElementById('contact_name').focus();
        return false;
      }
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!email || !emailRegex.test(email)) {
        showAlert('Informe um endereço de e-mail corporativo válido.');
        document.getElementById('email').focus();
        return false;
      }
      if (phone.length < 8) {
        showAlert('Informe o telefone ou WhatsApp com DDD.');
        document.getElementById('phone').focus();
        return false;
      }
    }

    if (currentStep === 2) {
      const projectType = form.querySelector('input[name="project_type"]:checked');
      const goal = document.getElementById('primary_goal').value;

      if (!projectType) {
        showAlert('Selecione o tipo de website pretendido.');
        return false;
      }
      if (!goal) {
        showAlert('Selecione o objetivo principal do projeto.');
        document.getElementById('primary_goal').focus();
        return false;
      }
    }

    if (currentStep === 10) {
      const privacy = document.getElementById('privacy_policy_accepted').checked;
      if (!privacy) {
        showAlert('O aceite dos Termos da Política de Privacidade (LGPD) é obrigatório para protocolar o briefing.');
        document.getElementById('privacy_policy_accepted').focus();
        return false;
      }
    }

    return true;
  }

  function showAlert(msg) {
    alertBox.className = 'mb-6 p-4 rounded-xl text-xs sm:text-sm border border-red-500/60 bg-red-950/40 text-red-200 block';
    alertBox.innerHTML = `<strong>Atenção:</strong> ${escapeHtml(msg)}`;
  }

  function hideAlert() {
    alertBox.className = 'hidden mb-6 p-4 rounded-xl text-xs sm:text-sm border';
    alertBox.innerHTML = '';
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>"']/g, (m) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    })[m]);
  }

  // --- 3. Sincronização da Paleta de Cores ---
  function initColorPickers() {
    const pairs = [
      { picker: 'color_primary', text: 'color_primary_txt' },
      { picker: 'color_secondary', text: 'color_secondary_txt' },
      { picker: 'color_accent', text: 'color_accent_txt' },
      { picker: 'color_avoid', text: 'color_avoid_txt' }
    ];

    pairs.forEach(p => {
      const pickerEl = document.getElementById(p.picker);
      const textEl = document.getElementById(p.text);
      if (!pickerEl || !textEl) return;

      pickerEl.addEventListener('input', (e) => {
        textEl.value = e.target.value.toUpperCase();
      });

      textEl.addEventListener('input', (e) => {
        let val = e.target.value.trim();
        if (!val.startsWith('#')) val = '#' + val;
        if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
          pickerEl.value = val;
        }
      });
    });
  }

  // --- 4. Uploads de Arquivos com Verificação de Magic Bytes ---
  function initFileUploads() {
    const dropzone = document.getElementById('file-dropzone');
    const input = document.getElementById('file-input');

    if (!dropzone || !input) return;

    ['dragenter', 'dragover'].forEach(eventName => {
      dropzone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropzone.classList.add('border-[#D4AF37]', 'bg-[#142244]/80');
      });
    });

    ['dragleave', 'drop'].forEach(eventName => {
      dropzone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropzone.classList.remove('border-[#D4AF37]', 'bg-[#142244]/80');
      });
    });

    dropzone.addEventListener('drop', (e) => {
      const files = e.dataTransfer.files;
      if (files && files.length > 0) {
        handleFiles(files);
      }
    });

    input.addEventListener('change', (e) => {
      if (e.target.files && e.target.files.length > 0) {
        handleFiles(e.target.files);
        input.value = ''; // Reset
      }
    });
  }

  async function handleFiles(fileList) {
    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];

      // Limite de 5MB
      if (file.size > 5 * 1024 * 1024) {
        alert(`O arquivo ${file.name} excede o limite máximo permitido de 5MB.`);
        continue;
      }

      // Validação de tipo / Magic Bytes no navegador
      try {
        const validated = await validateFileSignature(file);
        if (!validated.valid) {
          alert(`Arquivo ${file.name} inválido: ${validated.error}`);
          continue;
        }

        const base64Data = await readFileAsBase64(file);
        const fileId = 'fl-' + Math.random().toString(36).substring(2, 9);

        // Dedução automática de categoria com base no nome ou tipo
        let category = 'other';
        const lowerName = file.name.toLowerCase();
        if (lowerName.includes('logo')) category = 'logo';
        else if (lowerName.includes('manual') || lowerName.includes('brand')) category = 'brand_manual';
        else if (lowerName.includes('inpi') || lowerName.includes('registro')) category = 'inpi_doc';
        else if (validated.type.startsWith('image/')) category = 'photos';

        filesState.push({
          id: fileId,
          name: file.name,
          size: file.size,
          type: validated.type,
          category,
          base64Data
        });
      } catch (err) {
        console.error('Erro na validação do arquivo:', err);
        alert(`Falha ao ler o arquivo ${file.name}.`);
      }
    }

    renderUploadedFilesList();
  }

  function validateFileSignature(file) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const arr = new Uint8Array(e.target.result);
        if (arr.length < 4) {
          return resolve({ valid: false, error: 'Arquivo vazio ou corrompido.' });
        }

        // PNG: 89 50 4E 47
        if (arr[0] === 0x89 && arr[1] === 0x50 && arr[2] === 0x4E && arr[3] === 0x47) {
          return resolve({ valid: true, type: 'image/png' });
        }
        // JPEG: FF D8 FF
        if (arr[0] === 0xFF && arr[1] === 0xD8 && arr[2] === 0xFF) {
          return resolve({ valid: true, type: 'image/jpeg' });
        }
        // WebP: RIFF (bytes 0..3) ... WEBP (bytes 8..11)
        if (arr.length >= 12 &&
            arr[0] === 0x52 && arr[1] === 0x49 && arr[2] === 0x46 && arr[3] === 0x46 &&
            arr[8] === 0x57 && arr[9] === 0x45 && arr[10] === 0x42 && arr[11] === 0x50) {
          return resolve({ valid: true, type: 'image/webp' });
        }
        // PDF: %PDF (25 50 44 46)
        if (arr[0] === 0x25 && arr[1] === 0x50 && arr[2] === 0x44 && arr[3] === 0x46) {
          return resolve({ valid: true, type: 'application/pdf' });
        }
        // SVG
        const textChunk = new TextDecoder().decode(arr.subarray(0, 512)).toLowerCase().trim();
        if (textChunk.startsWith('<svg') || (textChunk.startsWith('<?xml') && textChunk.includes('<svg'))) {
          const fullText = new TextDecoder().decode(arr).toLowerCase();
          if (fullText.includes('<script') || /on\w+\s*=/i.test(fullText)) {
            return resolve({ valid: false, error: 'Arquivo SVG contém scripts executáveis não permitidos.' });
          }
          return resolve({ valid: true, type: 'image/svg+xml' });
        }

        resolve({ valid: false, error: 'Formato não reconhecido. Formatos aceitos: PNG, JPEG, WebP, SVG ou PDF.' });
      };
      reader.onerror = () => resolve({ valid: false, error: 'Erro de leitura I/O.' });
      reader.readAsArrayBuffer(file.slice(0, 1024 * 64)); // Primeiros 64KB bastam para checar assinatura
    });
  }

  function readFileAsBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function renderUploadedFilesList() {
    const container = document.getElementById('uploaded-files-list-container');
    const ul = document.getElementById('uploaded-files-list');

    if (filesState.length === 0) {
      container.classList.add('hidden');
      ul.innerHTML = '';
      return;
    }

    container.classList.remove('hidden');
    ul.innerHTML = '';

    filesState.forEach((f) => {
      const li = document.createElement('li');
      li.className = 'p-3 rounded-xl bg-[#080E1E] border border-[#1E3158] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs';

      const sizeKb = Math.round(f.size / 1024);
      li.innerHTML = `
        <div class="flex items-center gap-2 overflow-hidden">
          <span class="text-[#D4AF37] font-bold text-base">&#128196;</span>
          <div class="truncate">
            <span class="font-bold text-[#FDFBF7] block truncate">${escapeHtml(f.name)}</span>
            <span class="text-[10px] text-[#D3CBC3]">${f.type} • ${sizeKb} KB</span>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <select class="category-select px-2.5 py-1 rounded bg-[#0E1830] border border-[#1E3158] text-[11px] text-[#D4AF37] focus:outline-none" data-id="${f.id}">
            <option value="logo" ${f.category === 'logo' ? 'selected' : ''}>Logotipo</option>
            <option value="brand_manual" ${f.category === 'brand_manual' ? 'selected' : ''}>Manual de Marca</option>
            <option value="photos" ${f.category === 'photos' ? 'selected' : ''}>Fotografias</option>
            <option value="inpi_doc" ${f.category === 'inpi_doc' ? 'selected' : ''}>Documento INPI</option>
            <option value="other" ${f.category === 'other' ? 'selected' : ''}>Outro</option>
          </select>
          <button type="button" class="btn-remove-file text-red-400 hover:text-red-300 font-bold px-2 py-1 rounded hover:bg-red-950/40" data-id="${f.id}" title="Remover anexo">
            &#10005;
          </button>
        </div>
      `;

      ul.appendChild(li);
    });

    // Eventos nos selects de categoria e botões de exclusão
    ul.querySelectorAll('.category-select').forEach(sel => {
      sel.addEventListener('change', (e) => {
        const id = e.target.getAttribute('data-id');
        const item = filesState.find(x => x.id === id);
        if (item) item.category = e.target.value;
      });
    });

    ul.querySelectorAll('.btn-remove-file').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.getAttribute('data-id');
        const idx = filesState.findIndex(x => x.id === id);
        if (idx !== -1) {
          filesState.splice(idx, 1);
          renderUploadedFilesList();
        }
      });
    });
  }

  // --- 5. Módulo de Referências (Repeater) ---
  function initBenchmarks() {
    const btnAdd = document.getElementById('btn-add-benchmark');
    const container = document.getElementById('benchmarks-container');
    if (!btnAdd || !container) return;

    btnAdd.addEventListener('click', () => {
      const row = document.createElement('div');
      row.className = 'benchmark-row p-3 rounded-xl bg-[#080E1E] border border-[#1E3158] grid grid-cols-1 sm:grid-cols-2 gap-2 relative';
      row.innerHTML = `
        <input type="url" name="benchmark_url[]" placeholder="https://exemplo.com.br" class="px-3 py-2 rounded-lg bg-[#0E1830] border border-[#1E3158] focus:border-[#D4AF37] text-xs text-[#FDFBF7] focus:outline-none">
        <div class="flex items-center gap-2">
          <input type="text" name="benchmark_notes[]" placeholder="O que você mais gosta neste site?" class="w-full px-3 py-2 rounded-lg bg-[#0E1830] border border-[#1E3158] focus:border-[#D4AF37] text-xs text-[#FDFBF7] focus:outline-none">
          <button type="button" class="btn-remove-benchmark text-red-400 hover:text-red-300 font-bold px-2 py-1 text-sm" title="Remover">&#10005;</button>
        </div>
      `;
      row.querySelector('.btn-remove-benchmark').addEventListener('click', () => {
        row.remove();
      });
      container.appendChild(row);
    });
  }

  // --- 6. Módulo Condicional ORLINX ADS ---
  function initConditionalAds() {
    const checkAds = document.getElementById('ads_opt_in');
    const sectionAds = document.getElementById('ads-conditional-section');
    if (!checkAds || !sectionAds) return;

    checkAds.addEventListener('change', () => {
      if (checkAds.checked) {
        sectionAds.classList.remove('hidden');
      } else {
        sectionAds.classList.add('hidden');
      }
    });
  }

  // --- 7. Auto-Save e Restauração de Rascunho (sessionStorage) ---
  function saveDraft() {
    try {
      const formData = new FormData(form);
      const draft = {};
      formData.forEach((value, key) => {
        // Evita gravar honeypot ou arrays desnecessários no draft
        if (key === '_hp_briefing_corp_catch') return;
        if (draft[key]) {
          if (!Array.isArray(draft[key])) draft[key] = [draft[key]];
          draft[key].push(value);
        } else {
          draft[key] = value;
        }
      });

      draft._savedStep = currentStep;
      sessionStorage.setItem('orx_briefing_draft', JSON.stringify(draft));

      if (draftStatusPill) {
        draftStatusPill.innerHTML = '<span class="w-1.5 h-1.5 rounded-full bg-emerald-400"></span> Rascunho salvo';
      }
    } catch (_) {
      // sessionStorage indisponível
    }
  }

  function restoreDraft() {
    try {
      const raw = sessionStorage.getItem('orx_briefing_draft');
      if (!raw) return;
      const draft = JSON.parse(raw);

      Object.keys(draft).forEach(key => {
        if (key.startsWith('_')) return;
        const val = draft[key];
        const elements = form.querySelectorAll(`[name="${key}"], [name="${key}[]"]`);

        elements.forEach(el => {
          if (el.type === 'radio') {
            if (el.value === val) el.checked = true;
          } else if (el.type === 'checkbox') {
            if (Array.isArray(val)) {
              el.checked = val.includes(el.value);
            } else {
              el.checked = (val === 'true' || val === el.value || val === true);
            }
          } else {
            el.value = val;
          }
        });
      });

      // Sincroniza pickers de cores com os textos restaurados
      ['color_primary', 'color_secondary', 'color_accent', 'color_avoid'].forEach(k => {
        const txt = document.getElementById(k + '_txt');
        const picker = document.getElementById(k);
        if (txt && picker && txt.value) {
          picker.value = txt.value;
        }
      });

      // Se ads_opt_in foi restaurado como marcado, exibe a seção condicional
      const checkAds = document.getElementById('ads_opt_in');
      const sectionAds = document.getElementById('ads-conditional-section');
      if (checkAds && sectionAds && checkAds.checked) {
        sectionAds.classList.remove('hidden');
      }
    } catch (err) {
      console.warn('Erro ao restaurar rascunho:', err);
    }
  }

  // --- 8. Envio do Formulário Final ---
  async function handleFormSubmit(e) {
    e.preventDefault();

    if (!validateCurrentStep()) return;

    // Honeypot anti-spam
    const hp = document.getElementById('_hp_briefing_corp_catch');
    if (hp && hp.value.trim() !== '') {
      showAlert('Submissão bloqueada pelo filtro de proteção.');
      return;
    }

    // Coleta dos dados estruturados
    const formData = new FormData(form);

    const requiredPages = [];
    form.querySelectorAll('input[name="required_pages[]"]:checked').forEach(cb => requiredPages.push(cb.value));

    const customFeatures = [];
    form.querySelectorAll('input[name="custom_features[]"]:checked').forEach(cb => customFeatures.push(cb.value));

    const languages = [];
    form.querySelectorAll('input[name="languages[]"]:checked').forEach(cb => languages.push(cb.value));

    const benchmarkUrls = [];
    const urlInputs = form.querySelectorAll('input[name="benchmark_url[]"]');
    const noteInputs = form.querySelectorAll('input[name="benchmark_notes[]"]');
    for (let i = 0; i < urlInputs.length; i++) {
      const u = urlInputs[i].value.trim();
      const n = noteInputs[i] ? noteInputs[i].value.trim() : '';
      if (u) {
        benchmarkUrls.push({ url: u, notes: n });
      }
    }

    const payload = {
      _hp_briefing_corp_catch: hp ? hp.value : '',
      company_name: (formData.get('company_name') || '').trim(),
      trading_name: (formData.get('trading_name') || '').trim(),
      document_number: (formData.get('document_number') || '').trim(),
      contact_name: (formData.get('contact_name') || '').trim(),
      email: (formData.get('email') || '').trim(),
      phone: (formData.get('phone') || '').trim(),
      city_state: (formData.get('city_state') || '').trim(),
      business_segment: (formData.get('business_segment') || '').trim(),
      project_type: formData.get('project_type') || 'institucional',
      primary_goal: formData.get('primary_goal') || 'gerar_leads',
      target_audience: (formData.get('target_audience') || '').trim(),
      project_summary: (formData.get('project_summary') || '').trim(),
      required_pages: requiredPages,
      custom_features: customFeatures,
      special_requirements: (formData.get('special_requirements') || '').trim(),
      brand_status: formData.get('brand_status') || 'possui_marca_pronta',
      design_style: formData.get('design_style') || 'moderno_corporativo',
      color_palette: {
        primary: document.getElementById('color_primary_txt')?.value || '#080E1E',
        secondary: document.getElementById('color_secondary_txt')?.value || '#2E1F1A',
        accent: document.getElementById('color_accent_txt')?.value || '#D4AF37',
        avoid: document.getElementById('color_avoid_txt')?.value || '#FF0055'
      },
      design_notes: (formData.get('design_notes') || '').trim(),
      files: filesState.map(f => ({
        originalName: f.name,
        category: f.category,
        base64Data: f.base64Data
      })),
      benchmark_urls: benchmarkUrls,
      disliked_elements: (formData.get('disliked_elements') || '').trim(),
      content_source: formData.get('content_source') || 'cliente_fornece_pronto',
      media_source: formData.get('media_source') || 'fotos_proprias',
      languages: languages.length > 0 ? languages : ['pt-BR'],
      domain_status: formData.get('domain_status') || 'ja_registrado',
      domain_name: (formData.get('domain_name') || '').trim(),
      hosting_preference: formData.get('hosting_preference') || 'hospedagem_orlinx',
      corporate_emails_needed: parseInt(formData.get('corporate_emails_needed'), 10) || 0,
      ads_opt_in: document.getElementById('ads_opt_in')?.checked || false,
      ads_format: formData.get('ads_format') || '',
      ads_target_url: (formData.get('ads_target_url') || '').trim(),
      ads_period_days: parseInt(formData.get('ads_period_days'), 10) || null,
      ads_budget_range: formData.get('ads_budget_range') || '',
      target_launch_date: formData.get('target_launch_date') || null,
      investment_bracket: formData.get('investment_bracket') || '',
      privacy_policy_accepted: document.getElementById('privacy_policy_accepted')?.checked || false,
      portfolio_showcase_authorized: document.getElementById('portfolio_showcase_authorized')?.checked || false
    };

    // Gera código de protocolo oficial e timestamps de auditoria
    const protocolYear = new Date().getFullYear();
    const protocolRandom = Math.floor(100000 + Math.random() * 900000);
    const protocolCode = `BRF-${protocolYear}-${protocolRandom}`;
    payload.protocol_code = protocolCode;

    // Payload estruturado para a tabela orx_briefings no Supabase oficial
    const supabasePayload = {
      protocol_code: protocolCode,
      company_name: payload.company_name,
      trading_name: payload.trading_name,
      document_number: payload.document_number,
      contact_name: payload.contact_name,
      email: payload.email,
      phone: payload.phone,
      city_state: payload.city_state,
      business_segment: payload.business_segment,
      project_type: payload.project_type,
      primary_goal: payload.primary_goal,
      target_audience: payload.target_audience,
      project_summary: payload.project_summary,
      required_pages: payload.required_pages,
      custom_features: payload.custom_features,
      special_requirements: payload.special_requirements,
      brand_status: payload.brand_status,
      design_style: payload.design_style,
      color_palette: payload.color_palette,
      uploaded_files: filesState.map(f => ({
        originalName: f.name,
        category: f.category,
        size: f.size,
        type: f.type
      })),
      benchmark_urls: payload.benchmark_urls,
      disliked_elements: payload.disliked_elements,
      content_source: payload.content_source,
      media_source: payload.media_source,
      languages: payload.languages,
      domain_status: payload.domain_status,
      domain_name: payload.domain_name,
      hosting_preference: payload.hosting_preference,
      corporate_emails_needed: payload.corporate_emails_needed,
      ads_opt_in: payload.ads_opt_in,
      ads_format: payload.ads_format,
      ads_target_url: payload.ads_target_url,
      ads_period_days: payload.ads_period_days,
      ads_budget_range: payload.ads_budget_range,
      target_launch_date: payload.target_launch_date,
      investment_bracket: payload.investment_bracket,
      privacy_policy_accepted: payload.privacy_policy_accepted,
      privacy_accepted_at: new Date().toISOString(),
      portfolio_showcase_authorized: payload.portfolio_showcase_authorized,
      portfolio_authorized_at: payload.portfolio_showcase_authorized ? new Date().toISOString() : null,
      status: 'submitted'
    };

    // UI de envio
    btnSubmit.disabled = true;
    btnSubmitSpinner.classList.remove('hidden');

    let persisted = false;
    let finalProtocol = protocolCode;
    let persistError = null;

    try {
      // 1. Tentativa via gateway local (/api/briefings) para compatibilidade com ambiente Node local
      try {
        const response = await fetch('/api/briefings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (response.ok) {
          const result = await response.json();
          if (result && result.success) {
            persisted = true;
            finalProtocol = result.protocol_code || protocolCode;
          }
        }
      } catch (_) {
        // Gateway local /api indisponível (hospedagem estática LiteSpeed Hostinger)
      }

      // 2. Inserção direta via PostgREST oficial do Supabase (ulajrvkaqqedwuaiaksp) com política RLS pública
      if (!persisted && supabaseAnonKey) {
        try {
          console.info('[ORLINX Briefing] Enviando payload ao Supabase PostgREST (Prefer: return=minimal)...');
          const sbRes = await fetch(`${supabaseUrl}/rest/v1/orx_briefings`, {
            method: 'POST',
            headers: {
              'apikey': supabaseAnonKey,
              'Authorization': `Bearer ${supabaseAnonKey}`,
              'Content-Type': 'application/json',
              'Prefer': 'return=minimal'
            },
            body: JSON.stringify(supabasePayload)
          });

          console.info('[ORLINX Briefing] Resposta Supabase PostgREST:', sbRes.status, sbRes.statusText);

          if (sbRes.status === 201 || (sbRes.status >= 200 && sbRes.status < 300)) {
            persisted = true;
          } else {
            const errBody = await sbRes.text().catch(() => '');
            persistError = `Falha na API Supabase (${sbRes.status}): ${errBody}`;
            console.error('[ORLINX Briefing] Erro na resposta Supabase:', persistError);
          }
        } catch (sbErr) {
          persistError = 'Erro de rede na comunicação com o banco de dados Supabase.';
          console.error('[ORLINX Briefing] Erro de rede:', sbErr);
        }
      }

      // 3. Apresentação do Resultado & Despacho da Notificação
      if (persisted) {
        try {
          sessionStorage.removeItem('orx_briefing_draft');
        } catch (_) {}

        const modal = document.getElementById('briefing-success-modal');
        const protocolDisplay = document.getElementById('modal-protocol-display');
        const notificationStatus = document.getElementById('modal-notification-status');

        if (protocolDisplay) {
          protocolDisplay.innerText = finalProtocol;
        }
        if (modal) {
          modal.classList.remove('hidden');
        }

        // 4. Despacho Real e Seguro da Notificação por E-mail (Serviço de Produção Hostinger)
        if (notificationStatus) {
          notificationStatus.className = 'text-[10px] text-[#D3CBC3] block animate-pulse';
          notificationStatus.innerHTML = '&#8987; Transmitindo notifica&ccedil;&atilde;o para comercial@orlinxgroup.com.br...';
        }

        try {
          payload.protocol_code = finalProtocol;

          const notifyRes = await fetch('/api/notify-briefing.php', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
          });

          if (notifyRes.ok) {
            const notifyData = await notifyRes.json().catch(() => null);
            if (notifyData && notifyData.success) {
              if (notificationStatus) {
                notificationStatus.className = 'text-[10px] text-emerald-400 block';
                notificationStatus.innerHTML = '&#10003; Notifica&ccedil;&atilde;o confirmada e enviada para comercial@orlinxgroup.com.br';
              }
              console.info('[ORLINX Briefing] Notificação por e-mail confirmada com sucesso:', notifyData);
            } else {
              if (notificationStatus) {
                notificationStatus.className = 'text-[10px] text-[#D3CBC3] block';
                notificationStatus.innerHTML = '&#9432; Protocolo registrado no banco centralizado. Em an&aacute;lise pela equipe comercial.';
              }
            }
          } else {
            console.warn('[ORLINX Briefing] Despachante retornou status HTTP:', notifyRes.status);
            if (notificationStatus) {
              notificationStatus.className = 'text-[10px] text-[#D3CBC3] block';
              notificationStatus.innerHTML = '&#9432; Protocolo registrado no banco centralizado. Em an&aacute;lise pela equipe comercial.';
            }
          }
        } catch (notifyErr) {
          console.warn('[ORLINX Briefing] Erro na transmissão da notificação:', notifyErr);
          if (notificationStatus) {
            notificationStatus.className = 'text-[10px] text-[#D3CBC3] block';
            notificationStatus.innerHTML = '&#9432; Protocolo registrado no banco centralizado. Em an&aacute;lise pela equipe comercial.';
          }
        }

      } else {
        // Regra Estrita de Governança: O protocolo de confirmação é emitido SOMENTE após persistência confirmada.
        // Se houver falha, exibe mensagem clara ao usuário e preserva o rascunho.
        const failureDetails = persistError ? ` (${persistError})` : '';
        showAlert(`Falha de comunicação: Não foi possível confirmar a gravação do briefing no banco de dados centralizado${failureDetails}. Seus dados permanecem salvos com segurança neste navegador. Por favor, tente novamente ou contate nosso canal oficial: comercial@orlinxgroup.com.br.`);
      }
    } catch (err) {
      console.error('Erro na submissão do briefing:', err);
      showAlert(`Erro no envio: ${err.message}`);
    } finally {
      btnSubmit.disabled = false;
      btnSubmitSpinner.classList.add('hidden');
    }
  }

  // Helper debounce
  function debounce(fn, delay) {
    let timer = null;
    return function (...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), delay);
    };
  }

})();
