/* A lista de fotos está em fotos/indice.js. Não precisa de servidor ou framework. */
(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const titleFromFile = (file) => file.split('/').pop().replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').replace(/^\d+[ .]+/, '').trim() || 'Tela do aplicativo';
  const source = Array.isArray(window.GALERIA_FOTOS) ? window.GALERIA_FOTOS : [];
  const photos = source.map((item) => typeof item === 'string' ? { arquivo: item } : item)
    .filter((item) => item && typeof item.arquivo === 'string' && item.arquivo.trim())
    .map((item) => ({ ...item, arquivo: item.arquivo.replace(/\\/g, '/') }))
    .filter((item) => !item.arquivo.startsWith('/') && !item.arquivo.includes(':') && !item.arquivo.split('/').includes('..') && /\.(png|jpe?g|webp|gif|avif|bmp|svg)$/i.test(item.arquivo))
    .map((item) => ({ title: typeof item.titulo === 'string' && item.titulo.trim() ? item.titulo : titleFromFile(item.arquivo), description: typeof item.descricao === 'string' ? item.descricao : '', url: 'fotos/' + item.arquivo.split('/').map(encodeURIComponent).join('/') }));
  const grid = $('grid');
  const dialog = $('lightbox');
  const viewer = $('viewer');
  const viewerImage = $('viewer-image');
  const zoom = $('zoom');
  let current = 0;
  let opener = null;

  $('total').textContent = String(photos.length).padStart(2, '0');
  $('count-label').textContent = photos.length === 1 ? 'tela na galeria' : 'telas na galeria';
  $('empty').hidden = photos.length > 0;

  function resetZoom() {
    viewer.classList.remove('zoomed');
    zoom.setAttribute('aria-pressed', 'false');
    zoom.textContent = 'Ampliar';
    viewer.scrollTo(0, 0);
  }

  function show(index) {
    current = (index + photos.length) % photos.length;
    const photo = photos[current];
    resetZoom();
    $('viewer-title').textContent = photo.title;
    $('position').textContent = `${current + 1} / ${photos.length}`;
    $('previous').disabled = $('next').disabled = photos.length < 2;
    $('viewer-error').hidden = true;
    viewerImage.hidden = false;
    zoom.disabled = true;
    viewerImage.alt = photo.description || `Tela ${photo.title} do MindNutrition`;
    viewerImage.src = photo.url;
    $('original').href = photo.url;
  }

  function open(index, button) {
    opener = button;
    show(index);
    document.body.classList.add('modal-open');
    dialog.showModal();
    $('close').focus();
  }

  photos.forEach((photo, index) => {
    const card = document.createElement('article');
    card.className = 'screen-card';
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'screen-button';
    button.setAttribute('aria-label', `Ampliar ${photo.title}`);
    const stage = document.createElement('div');
    stage.className = 'screen-stage';
    const img = document.createElement('img');
    img.alt = photo.description || `Tela ${photo.title} do MindNutrition`;
    img.loading = index < 3 ? 'eager' : 'lazy';
    img.decoding = 'async';
    img.addEventListener('load', () => { stage.classList.toggle('landscape', img.naturalWidth >= img.naturalHeight); });
    img.addEventListener('error', () => {
      img.hidden = true;
      const error = document.createElement('p');
      error.className = 'image-error';
      error.textContent = 'Imagem indisponível';
      stage.append(error);
    }, { once: true });
    img.src = photo.url;
    const number = document.createElement('span');
    number.className = 'screen-number';
    number.textContent = String(index + 1).padStart(2, '0');
    number.setAttribute('aria-hidden', 'true');
    stage.append(img, number);
    const caption = document.createElement('div');
    caption.className = 'screen-caption';
    const text = document.createElement('div');
    const title = document.createElement('h3');
    title.textContent = photo.title;
    text.append(title);
    if (photo.description) {
      const description = document.createElement('p');
      description.textContent = photo.description;
      text.append(description);
    }
    const arrow = document.createElement('span');
    arrow.className = 'expand-mark';
    arrow.textContent = '↗';
    arrow.setAttribute('aria-hidden', 'true');
    caption.append(text, arrow);
    button.append(stage, caption);
    button.addEventListener('click', () => open(index, button));
    card.append(button);
    grid.append(card);
  });

  viewerImage.addEventListener('load', () => { zoom.disabled = false; });
  viewerImage.addEventListener('error', () => { viewerImage.hidden = true; $('viewer-error').hidden = false; zoom.disabled = true; });
  $('close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => { document.body.classList.remove('modal-open'); resetZoom(); opener?.focus(); });
  dialog.addEventListener('click', (event) => { if (event.target === dialog) dialog.close(); });
  $('previous').addEventListener('click', () => show(current - 1));
  $('next').addEventListener('click', () => show(current + 1));
  dialog.addEventListener('keydown', (event) => {
    if (viewer.classList.contains('zoomed')) return;
    if (event.key === 'ArrowLeft') { event.preventDefault(); show(current - 1); }
    if (event.key === 'ArrowRight') { event.preventDefault(); show(current + 1); }
  });
  zoom.addEventListener('click', () => {
    const active = viewer.classList.toggle('zoomed');
    zoom.setAttribute('aria-pressed', String(active));
    zoom.textContent = active ? 'Ajustar à tela' : 'Ampliar';
    viewer.scrollTo(0, 0);
  });
})();
